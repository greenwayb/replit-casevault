import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupLocalAuth, isAuthenticated } from "./localAuth";
import { randomUUID } from "crypto";
import { insertCaseSchema, insertDocumentSchema, type Role } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { analyzeBankingDocument, generateDocumentNumber, generateAccountGroupNumber, generateCSVFromPDF, generateXMLFromAnalysis } from "./aiService";
import { GoogleDriveService } from "./googleDriveService";
import { DisclosurePdfService } from "./disclosurePdfService";

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// Helper function to validate document status transitions
function validateStatusTransition(currentStatus: string, newStatus: string, userRoles: Role[]): boolean {
  // CASEADMIN can change any status to any other status
  if (userRoles.includes('CASEADMIN')) {
    return true;
  }
  
  // DISCLOSER can mark UPLOADED as READYFORREVIEW
  if (currentStatus === 'UPLOADED' && newStatus === 'READYFORREVIEW') {
    return userRoles.some(role => ['DISCLOSER'].includes(role));
  }
  
  // REVIEWER/DISCLOSER can mark READYFORREVIEW as REVIEWED
  if (currentStatus === 'READYFORREVIEW' && newStatus === 'REVIEWED') {
    return userRoles.some(role => ['REVIEWER', 'DISCLOSER'].includes(role));
  }
  
  // REVIEWER/DISCLOSER can mark REVIEWED as WITHDRAWN
  if (currentStatus === 'REVIEWED' && newStatus === 'WITHDRAWN') {
    return userRoles.some(role => ['REVIEWER', 'DISCLOSER'].includes(role));
  }
  
  // DISCLOSER/REVIEWER can mark WITHDRAWN as REVIEWED again
  if (currentStatus === 'WITHDRAWN' && newStatus === 'REVIEWED') {
    return userRoles.some(role => ['DISCLOSER', 'REVIEWER'].includes(role));
  }
  
  return false;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupLocalAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      // Remove password from response for security
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Seed route for development
  app.post("/api/seed", async (req, res) => {
    try {
      const { runSeed } = await import('./seedData');
      await runSeed();
      res.json({ message: "Seed data created successfully" });
    } catch (error) {
      console.error("Seeding error:", error);
      res.status(500).json({ message: "Failed to seed data" });
    }
  });

  // Legal organization routes
  app.get("/api/legal-organizations", async (req, res) => {
    try {
      const organizations = await storage.getLegalOrganizations();
      res.json(organizations);
    } catch (error) {
      console.error("Error fetching legal organizations:", error);
      res.status(500).json({ message: "Failed to fetch legal organizations" });
    }
  });

  app.get("/api/legal-organizations/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ message: "Query parameter 'q' is required" });
      }
      
      const organizations = await storage.searchLegalOrganizations(query);
      res.json(organizations);
    } catch (error) {
      console.error("Error searching legal organizations:", error);
      res.status(500).json({ message: "Failed to search legal organizations" });
    }
  });

  app.post("/api/legal-organizations", async (req, res) => {
    try {
      const { name, location } = req.body;
      
      const organization = await storage.createLegalOrganization({
        name,
        location: location || "Perth, WA",
      });
      
      res.status(201).json(organization);
    } catch (error) {
      console.error("Error creating legal organization:", error);
      res.status(500).json({ message: "Failed to create legal organization" });
    }
  });

  // Seed data endpoint (for development)
  app.post("/api/seed", async (req, res) => {
    try {
      const { runSeed } = await import("./seedData");
      await runSeed();
      res.json({ message: "Seed data inserted successfully" });
    } catch (error) {
      console.error("Error seeding data:", error);
      res.status(500).json({ message: "Failed to seed data" });
    }
  });

  // Case member management routes
  app.get('/api/cases/:id/members', isAuthenticated, async (req: any, res) => {
    try {
      const caseId = parseInt(req.params.id);
      const userId = req.user.id;
      
      // Check if user has access to this case
      const userRoles = await storage.getUserRolesInCase(userId, caseId);
      if (!userRoles || userRoles.length === 0) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const members = await storage.getCaseMembers(caseId);
      res.json(members);
    } catch (error) {
      console.error("Error fetching case members:", error);
      res.status(500).json({ message: "Failed to fetch case members" });
    }
  });

  app.post('/api/cases/:id/members', isAuthenticated, async (req: any, res) => {
    try {
      const caseId = parseInt(req.params.id);
      const userId = req.user.id;
      const { userId: targetUserId, roles } = req.body;
      
      // Check if user is case admin
      const userRoles = await storage.getUserRolesInCase(userId, caseId);
      if (!userRoles.includes('CASEADMIN')) {
        return res.status(403).json({ message: "Only case admins can add members" });
      }
      
      const caseUser = await storage.addUserToCase({
        caseId,
        userId: targetUserId,
        roles: roles,
      });
      
      res.json(caseUser);
    } catch (error) {
      console.error("Error adding case member:", error);
      res.status(500).json({ message: "Failed to add case member" });
    }
  });

  // Update user roles in case
  app.put('/api/cases/:id/members/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const caseId = parseInt(req.params.id);
      const targetUserId = req.params.userId;
      const userId = req.user.id;
      const { roles } = req.body;

      // Validate roles array
      if (!Array.isArray(roles) || roles.length === 0) {
        return res.status(400).json({ message: 'At least one role must be specified' });
      }

      // Check if user is case admin
      const userRoles = await storage.getUserRolesInCase(userId, caseId);
      if (!userRoles.includes('CASEADMIN')) {
        return res.status(403).json({ message: "Only case admins can modify user roles" });
      }

      // Update user roles
      await storage.updateUserRolesInCase(caseId, targetUserId, roles);
      res.json({ message: 'User roles updated successfully' });
    } catch (error) {
      console.error('Error updating user roles:', error);
      res.status(500).json({ message: 'Failed to update user roles' });
    }
  });

  app.delete('/api/cases/:id/members/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const caseId = parseInt(req.params.id);
      const targetUserId = req.params.userId;
      const userId = req.user.id;
      
      // Check if user is case admin
      const userRoles = await storage.getUserRolesInCase(userId, caseId);
      if (!userRoles.includes('CASEADMIN')) {
        return res.status(403).json({ message: "Only case admins can remove members" });
      }
      
      await storage.removeUserFromCase(caseId, targetUserId);
      res.json({ message: "User removed successfully" });
    } catch (error) {
      console.error("Error removing case member:", error);
      res.status(500).json({ message: "Failed to remove case member" });
    }
  });

  app.post('/api/cases/:id/invite', isAuthenticated, async (req: any, res) => {
    try {
      const caseId = parseInt(req.params.id);
      const userId = req.user.id;
      const { email, roles } = req.body;
      
      // Check if user is case admin
      const userRoles = await storage.getUserRolesInCase(userId, caseId);
      if (!userRoles.includes('CASEADMIN')) {
        return res.status(403).json({ message: "Only case admins can invite users" });
      }
      
      // Generate invitation token
      const token = randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry
      
      const invitation = await storage.createCaseInvitation({
        caseId,
        email,
        roles,
        invitedById: userId,
        token,
        expiresAt,
        status: 'pending',
      });
      
      // Here you would send the email invitation
      // For now, we'll just return the invitation details
      res.json({ 
        invitation,
        invitationUrl: `${req.protocol}://${req.get('host')}/accept-invitation?token=${token}`
      });
    } catch (error) {
      console.error("Error creating invitation:", error);
      res.status(500).json({ message: "Failed to create invitation" });
    }
  });

  app.get('/api/cases/:id/invitations', isAuthenticated, async (req: any, res) => {
    try {
      const caseId = parseInt(req.params.id);
      const userId = req.user.id;
      
      // Check if user is case admin
      const userRoles = await storage.getUserRolesInCase(userId, caseId);
      if (!userRoles.includes('CASEADMIN')) {
        return res.status(403).json({ message: "Only case admins can view invitations" });
      }
      
      const invitations = await storage.getCaseInvitations(caseId);
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  app.get('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      res.json(allUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Case routes
  app.post('/api/cases', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validatedData = insertCaseSchema.parse({
        ...req.body,
        createdById: userId,
      });

      // Check if case number already exists
      const existingCase = await storage.getCaseByNumber(validatedData.caseNumber);
      if (existingCase) {
        return res.status(400).json({ message: "Case number already exists" });
      }

      const newCase = await storage.createCase(validatedData);
      
      // Add creator as CASEADMIN
      await storage.addUserToCase({
        caseId: newCase.id,
        userId: userId,
        roles: ['CASEADMIN'],
      });

      // Log the activity
      await storage.createActivityLog({
        caseId: newCase.id,
        userId: userId,
        action: 'case_created',
        description: `created case "${newCase.title}" (${newCase.caseNumber})`,
        metadata: {
          caseNumber: newCase.caseNumber,
          title: newCase.title,
        }
      });

      res.json(newCase);
    } catch (error) {
      console.error("Error creating case:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid case data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create case" });
    }
  });

  app.get('/api/cases', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const cases = await storage.getCasesByUserId(userId);
      res.json(cases);
    } catch (error) {
      console.error("Error fetching cases:", error);
      res.status(500).json({ message: "Failed to fetch cases" });
    }
  });

  app.get('/api/cases/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const caseId = parseInt(req.params.id);
      
      const caseData = await storage.getCaseById(caseId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }

      const userRoles = await storage.getUserRolesInCase(userId, caseId);
      if (!userRoles || userRoles.length === 0) {
        return res.status(403).json({ message: "Access denied to this case" });
      }

      // Get documents based on user role
      let documents;
      if (userRoles.includes('DISCLOSEE') && !userRoles.includes('REVIEWER') && !userRoles.includes('CASEADMIN')) {
        // DISCLOSEE can only see REVIEWED documents
        documents = await storage.getDocumentsForDisclosee(caseId);
      } else {
        // Other roles can see all documents
        documents = await storage.getDocumentsByCase(caseId);
      }
      
      const response = {
        ...caseData,
        roles: userRoles,  // Frontend expects 'roles' field
        userRoles,        // Keep both for compatibility
        documents,
      };
      
      console.log('Case API response for user', userId, ':', { roles: userRoles });
      res.json(response);
    } catch (error) {
      console.error("Error fetching case:", error);
      res.status(500).json({ message: "Failed to fetch case" });
    }
  });

  // Document routes - Upload file only (step 1)
  app.post('/api/cases/:caseId/documents', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const caseId = parseInt(req.params.caseId);
      const { category } = req.body;

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Check if user has access to this case
      const userRoles = await storage.getUserRolesInCase(userId, caseId);
      if (!userRoles || userRoles.length === 0) {
        return res.status(403).json({ message: "Access denied to this case" });
      }

      // Create the document first
      const document = await storage.createDocument({
        caseId,
        filename: req.file.filename,
        originalName: req.file.originalname,
        category: category.toUpperCase(),
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedById: userId,
      });

      // Log activity for upload
      await storage.createActivityLog({
        caseId,
        userId,
        action: 'DOCUMENT_UPLOADED',
        description: `Uploaded document: ${req.file.originalname}`,
        metadata: {
          documentId: document.id,
          category: category.toUpperCase(),
          fileSize: req.file.size,
          filename: req.file.originalname,
        }
      });

      // Return document immediately after upload
      res.json({ 
        ...document, 
        requiresAiProcessing: category.toUpperCase() === 'BANKING' 
      });

    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  // AI Processing endpoint for banking documents - Phase 1: Basic field extraction
  app.post('/api/documents/:documentId/process-ai', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const documentId = parseInt(req.params.documentId);

      // Get the document
      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Check if user has access to this case
      const userRoles = await storage.getUserRolesInCase(userId, document.caseId);
      if (!userRoles || userRoles.length === 0) {
        return res.status(403).json({ message: "Access denied to this case" });
      }

      // Only process banking documents
      if (document.category !== 'BANKING') {
        return res.status(400).json({ message: "AI processing only available for banking documents" });
      }

      // Phase 1: Extract basic banking fields only
      try {
        const { extractBasicBankingFields } = await import('./aiServiceBasic');
        const filePath = path.join(uploadDir, document.filename);
        
        // Phase 1: Extract basic fields only
        const basicFields = await extractBasicBankingFields(filePath);
        
        // Convert basic fields to expected format for confirmation modal
        const primaryAccountHolder = basicFields.accountHolders[0] || 'Unknown';
        const accountHoldersText = basicFields.accountHolders.join(', ');
        
        // Return the basic analysis results for user review - Phase 1 complete
        res.json({
          id: document.id,
          caseId: document.caseId,
          filename: document.filename,
          originalName: document.originalName,
          extractedBankingInfo: {
            financialInstitution: basicFields.financialInstitution,
            accountHolderName: primaryAccountHolder,
            accountName: accountHoldersText, // For compatibility with existing UI
            accountNumber: basicFields.accountNumber,
            bsbSortCode: basicFields.accountBsb,
            transactionDateFrom: basicFields.startDate,
            transactionDateTo: basicFields.endDate,
            accountType: basicFields.accountType,
            // No CSV, XML or detailed analysis yet - Phase 2 not started
            csvInfo: null,
            xmlInfo: null,
            xmlAnalysisData: null,
          },
          confidence: basicFields.confidence,
          requiresConfirmation: true,
          analysisPhase: 'basic' // Indicate this is Phase 1 only
        });

      } catch (aiError) {
        console.error("AI processing failed:", aiError);
        
        // Return document with manual review required
        res.json({
          id: document.id,
          caseId: document.caseId,
          filename: document.filename,
          originalName: document.originalName,
          aiProcessingFailed: true,
          extractedBankingInfo: {
            accountHolderName: '',
            accountName: '',
            financialInstitution: '',
            accountNumber: '',
            bsbSortCode: '',
            transactionDateFrom: '',
            transactionDateTo: ''
          }
        });
      }

    } catch (error) {
      console.error("Error processing AI for document:", error);
      res.status(500).json({ message: "Failed to process document with AI" });
    }
  });

  // Phase 2: Full transaction analysis endpoint
  app.post('/api/documents/:documentId/full-analysis', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const documentId = parseInt(req.params.documentId);

      // Get the document
      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Check if user has access to this case
      const userRoles = await storage.getUserRolesInCase(userId, document.caseId);
      if (!userRoles || userRoles.length === 0) {
        return res.status(403).json({ message: "Access denied to this case" });
      }

      // Only process banking documents
      if (document.category !== 'BANKING') {
        return res.status(400).json({ message: "Full analysis only available for banking documents" });
      }

      // Check if basic analysis was completed
      if (!document.aiProcessed) {
        return res.status(400).json({ message: "Basic analysis must be completed first" });
      }

      // Phase 2: Full transaction analysis
      try {
        const { analyzeBankingDocument, generateDocumentNumber, generateAccountGroupNumber, generateXMLFromAnalysis } = await import('./aiService');
        const { generateCSVFromPDF } = await import('./aiService');
        const filePath = path.join(uploadDir, document.filename);
        
        // Run full analysis
        const analysis = await analyzeBankingDocument(filePath);
        
        // Generate CSV from PDF content
        let csvInfo = { csvPath: '', csvRowCount: 0, csvGenerated: false };
        try {
          const csvResult = await generateCSVFromPDF(filePath, document.id);
          csvInfo = {
            csvPath: csvResult.csvPath,
            csvRowCount: csvResult.rowCount,
            csvGenerated: !!csvResult.csvContent
          };
        } catch (csvError) {
          console.error("CSV generation failed:", csvError);
        }

        // Generate XML from analysis with detailed transactions
        let xmlInfo = { xmlPath: '', xmlGenerated: false };
        let xmlAnalysisData = '';
        try {
          const xmlResult = await generateXMLFromAnalysis(filePath, document.id);
          xmlInfo = {
            xmlPath: xmlResult.xmlPath,
            xmlGenerated: !!xmlResult.xmlContent
          };
          xmlAnalysisData = xmlResult.xmlContent;
        } catch (xmlError) {
          console.error("XML generation failed:", xmlError);
        }

        // Update document with full analysis
        const updatedDocument = await storage.updateDocumentWithAIAnalysis(documentId, {
          fullAnalysisCompleted: true,
          csvPath: csvInfo?.csvPath,
          csvRowCount: csvInfo?.csvRowCount,
          csvGenerated: csvInfo?.csvGenerated || false,
          xmlPath: xmlInfo?.xmlPath,
          xmlAnalysisData: xmlAnalysisData,
        });

        res.json({
          ...updatedDocument,
          csvInfo,
          xmlInfo,
          xmlAnalysisData,
          message: "Full analysis completed successfully"
        });

      } catch (error) {
        console.error("Full analysis failed:", error);
        res.status(500).json({ message: "Failed to complete full analysis" });
      }

    } catch (error) {
      console.error("Error in full analysis endpoint:", error);
      res.status(500).json({ message: "Failed to process full analysis" });
    }
  });

  // Update account name for banking documents
  app.patch('/api/documents/:id/account', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const documentId = parseInt(req.params.id);
      const { accountName } = req.body;

      if (!accountName) {
        return res.status(400).json({ message: "Account name is required" });
      }

      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Check if user has access to the case
      const userRoles = await storage.getUserRolesInCase(userId, document.caseId);
      if (!userRoles || userRoles.length === 0) {
        return res.status(403).json({ message: "Access denied to this document" });
      }

      // Update the account name
      const updatedDocument = await storage.updateDocumentWithAIAnalysis(documentId, {
        accountName: accountName.trim(),
      });

      res.json(updatedDocument);
    } catch (error) {
      console.error("Error updating account name:", error);
      res.status(500).json({ message: "Failed to update account name" });
    }
  });

  // Delete document
  app.delete('/api/documents/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const documentId = parseInt(req.params.id);
      
      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Check if user has access to the case
      const userRoles = await storage.getUserRolesInCase(userId, document.caseId);
      if (!userRoles || userRoles.length === 0) {
        return res.status(403).json({ message: "Access denied to this document" });
      }

      // Check if user has permission to delete (CASEADMIN or DISCLOSER)
      if (!userRoles.includes('CASEADMIN') && !userRoles.includes('DISCLOSER')) {
        return res.status(403).json({ message: "Insufficient permissions to delete document" });
      }

      await storage.deleteDocument(documentId);
      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // Confirm banking document analysis
  app.post("/api/documents/:id/confirm-banking", isAuthenticated, async (req: any, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const { bankingInfo, csvInfo, xmlInfo, xmlAnalysisData, isManualReview } = req.body;
      
      const { BankAbbreviationService } = await import('./bankAbbreviationService');
      const { DocumentNumberingService } = await import('./documentNumberingService');

      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Generate bank abbreviation
      const bankAbbreviation = await BankAbbreviationService.getOrCreateAbbreviation(
        bankingInfo.financialInstitution
      );

      // Generate hierarchical numbering
      const { groupNumber, documentNumber } = await DocumentNumberingService.generateBankingNumber(
        document.caseId,
        bankingInfo.accountHolderName
      );

      // Generate display name
      const displayName = DocumentNumberingService.generateBankingDisplayName(
        documentNumber,
        bankAbbreviation,
        bankingInfo.accountNumber || ''
      );

      // Update document with confirmed banking analysis
      const updatedDocument = await storage.updateDocumentWithAIExtraction(documentId, {
        accountHolderName: bankingInfo.accountHolderName,
        accountName: bankingInfo.accountName,
        financialInstitution: bankingInfo.financialInstitution,
        accountNumber: bankingInfo.accountNumber,
        bsbSortCode: bankingInfo.bsbSortCode,
        transactionDateFrom: bankingInfo.transactionDateFrom || undefined,
        transactionDateTo: bankingInfo.transactionDateTo || undefined,
        documentNumber,
        accountGroupNumber: groupNumber,
        aiProcessed: true,
        csvPath: csvInfo?.csvPath,
        csvRowCount: csvInfo?.csvRowCount,
        csvGenerated: csvInfo?.csvGenerated || false,
        xmlPath: xmlInfo?.xmlPath,
        xmlAnalysisData: xmlAnalysisData,
      });

      res.json(updatedDocument);
    } catch (error) {
      console.error("Error confirming banking document:", error);
      res.status(500).json({ message: "Failed to confirm banking document" });
    }
  });

  // Reject banking document analysis
  app.post("/api/documents/:id/reject-banking", isAuthenticated, async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);

      // Mark document as processed but without banking info
      const updatedDocument = await storage.updateDocumentWithAIAnalysis(documentId, {
        aiProcessed: false,
        processingError: "Banking information extraction was rejected by user",
      });

      res.json(updatedDocument);
    } catch (error) {
      console.error("Error rejecting banking document:", error);
      res.status(500).json({ message: "Failed to reject banking document" });
    }
  });

  // Get XML data for a document
  app.get("/api/documents/:id/xml", isAuthenticated, async (req: any, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const userId = req.user.id;

      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Check user access to the case
      const userRoles = await storage.getUserCaseRoles(userId, document.caseId);
      if (!userRoles || userRoles.length === 0) {
        return res.status(403).json({ message: "Access denied to this case" });
      }

      if (!document.xmlAnalysisData) {
        return res.status(404).json({ message: "No XML analysis data available" });
      }

      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Content-Disposition', `attachment; filename="document_${documentId}_analysis.xml"`);
      res.send(document.xmlAnalysisData);
    } catch (error) {
      console.error("Error serving XML data:", error);
      res.status(500).json({ message: "Failed to serve XML data" });
    }
  });

  // Delete case
  app.delete('/api/cases/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const caseId = parseInt(req.params.id);
      
      const caseToDelete = await storage.getCaseById(caseId);
      if (!caseToDelete) {
        return res.status(404).json({ message: "Case not found" });
      }

      // Check if user has access to the case and is a CASEADMIN
      const userRoles = await storage.getUserRolesInCase(userId, caseId);
      if (!userRoles || !userRoles.includes('CASEADMIN')) {
        return res.status(403).json({ message: "Only CASEADMIN can delete cases" });
      }

      await storage.deleteCase(caseId);
      res.json({ message: "Case deleted successfully" });
    } catch (error) {
      console.error("Error deleting case:", error);
      res.status(500).json({ message: "Failed to delete case" });
    }
  });

  app.get('/api/documents/:id/download', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const documentId = parseInt(req.params.id);
      
      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Check if user has access to the case
      const userRoles = await storage.getUserRolesInCase(userId, document.caseId);
      if (!userRoles || userRoles.length === 0) {
        return res.status(403).json({ message: "Access denied to this document" });
      }

      const filePath = path.join(uploadDir, document.filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found on server" });
      }

      res.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"`);
      res.setHeader('Content-Type', document.mimeType);
      res.sendFile(filePath);
    } catch (error) {
      console.error("Error downloading document:", error);
      res.status(500).json({ message: "Failed to download document" });
    }
  });

  app.get('/api/documents/:id/view', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const documentId = parseInt(req.params.id);
      
      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Check if user has access to the case
      const userRoles = await storage.getUserRolesInCase(userId, document.caseId);
      if (!userRoles || userRoles.length === 0) {
        return res.status(403).json({ message: "Access denied to this document" });
      }

      const filePath = path.join(uploadDir, document.filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found on server" });
      }

      res.setHeader('Content-Type', document.mimeType);
      res.sendFile(filePath);
    } catch (error) {
      console.error("Error viewing document:", error);
      res.status(500).json({ message: "Failed to view document" });
    }
  });

  // Download CSV endpoint
  app.get('/api/documents/:id/csv', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const documentId = parseInt(req.params.id);

      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Check if user has access to the case
      const userRoles = await storage.getUserRolesInCase(userId, document.caseId);
      if (!userRoles || userRoles.length === 0) {
        return res.status(403).json({ message: "Access denied to this document" });
      }

      if (!document.csvPath || !document.csvGenerated) {
        return res.status(404).json({ message: "CSV file not available for this document" });
      }

      const csvFilePath = path.join(uploadDir, document.csvPath);
      
      // Check if CSV file exists
      if (!fs.existsSync(csvFilePath)) {
        return res.status(404).json({ message: "CSV file not found" });
      }

      // Set headers for CSV download
      const csvFileName = `${document.originalName.replace('.pdf', '')}_data.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${csvFileName}"`);
      
      // Stream the CSV file
      const fileStream = fs.createReadStream(csvFilePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error downloading CSV:", error);
      res.status(500).json({ message: "Failed to download CSV" });
    }
  });

  // Get CSV data for chart (returns raw CSV content)
  app.get('/api/documents/:id/csv-data', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const documentId = parseInt(req.params.id);
      
      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Check if user has access to the case
      const userRoles = await storage.getUserRolesInCase(userId, document.caseId);
      if (!userRoles || userRoles.length === 0) {
        return res.status(403).json({ message: "Access denied to this document" });
      }

      if (!document.csvPath || !document.csvGenerated) {
        return res.status(404).json({ message: "CSV file not available for this document" });
      }

      const csvFilePath = path.join(uploadDir, document.csvPath);
      if (!fs.existsSync(csvFilePath)) {
        return res.status(404).json({ message: "CSV file not found" });
      }

      // Read and return CSV content
      const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
      res.json({ csvData: csvContent });
    } catch (error) {
      console.error("Error fetching CSV data:", error);
      res.status(500).json({ message: "Failed to fetch CSV data" });
    }
  });

  // Google Drive Integration Routes
  const googleDriveService = new GoogleDriveService();

  // Store user tokens in memory (in production, use a proper session store)
  const userTokens = new Map();

  // Google Drive authentication - initiate OAuth flow
  app.get('/api/google-drive/auth', isAuthenticated, (req: any, res) => {
    try {
      const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
      console.log('Using redirect URI:', redirectUri); // Debug log
      googleDriveService.configureOAuth(redirectUri);
      const authUrl = googleDriveService.getAuthUrl();
      res.json({ authUrl, redirectUri }); // Include redirect URI in response for debugging
    } catch (error) {
      console.error('Error generating auth URL:', error);
      res.status(500).json({ 
        message: 'Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.',
        error: error.message 
      });
    }
  });

  // Google Drive OAuth callback
  app.get('/api/auth/google/callback', isAuthenticated, async (req: any, res) => {
    try {
      const { code } = req.query;
      if (!code) {
        return res.status(400).send('Authorization code not provided');
      }

      const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
      googleDriveService.configureOAuth(redirectUri);
      
      const tokens = await googleDriveService.getTokens(code as string);
      const userId = req.user.id;
      
      // Store tokens for the user
      userTokens.set(userId, tokens);

      // Close the popup window
      res.send(`
        <script>
          window.opener.postMessage({ type: 'GOOGLE_DRIVE_AUTH_SUCCESS' }, '*');
          window.close();
        </script>
      `);
    } catch (error) {
      console.error('Google Drive authentication error:', error);
      res.status(500).send('Authentication failed');
    }
  });

  // Check Google Drive authentication status
  app.get('/api/google-drive/auth-status', isAuthenticated, (req: any, res) => {
    const userId = req.user.id;
    const tokens = userTokens.get(userId);
    
    res.json({
      authenticated: !!tokens
    });
  });

  // List Google Drive files
  app.get('/api/google-drive/files', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const tokens = userTokens.get(userId);
      
      if (!tokens) {
        return res.status(401).json({ message: 'Google Drive not authenticated' });
      }

      const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
      googleDriveService.configureOAuth(redirectUri);
      googleDriveService.setTokens(tokens);
      
      const { search, pageToken } = req.query;
      let result;
      
      if (search) {
        result = await googleDriveService.searchFiles(search as string, pageToken as string);
      } else {
        result = await googleDriveService.listPdfFiles(pageToken as string);
      }
      
      res.json(result);
    } catch (error) {
      console.error('Error listing Google Drive files:', error);
      res.status(500).json({ message: 'Failed to list Google Drive files' });
    }
  });

  // Import files from Google Drive
  app.post('/api/google-drive/import', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const tokens = userTokens.get(userId);
      
      if (!tokens) {
        return res.status(401).json({ message: 'Google Drive not authenticated' });
      }

      const { fileIds, caseId } = req.body;
      
      if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
        return res.status(400).json({ message: 'File IDs are required' });
      }

      if (!caseId) {
        return res.status(400).json({ message: 'Case ID is required' });
      }

      // Verify user has access to the case
      const caseData = await storage.getCase(caseId);
      if (!caseData) {
        return res.status(404).json({ message: 'Case not found' });
      }

      const userAccess = await storage.getUserCaseAccess(userId, caseId);
      if (!userAccess) {
        return res.status(403).json({ message: 'Access denied to this case' });
      }

      const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
      googleDriveService.configureOAuth(redirectUri);
      googleDriveService.setTokens(tokens);
      
      let importedCount = 0;
      const errors = [];

      for (const fileId of fileIds) {
        try {
          // Download file from Google Drive
          const { buffer, metadata } = await googleDriveService.downloadFile(fileId);
          
          // Generate unique filename
          const originalName = metadata.name;
          const uniqueFilename = `${Date.now()}_${Math.random().toString(36).substring(2)}_${originalName}`;
          const filePath = path.join(uploadDir, uniqueFilename);
          
          // Save file to uploads directory
          await fs.writeFileSync(filePath, buffer);
          
          // Create document record
          const documentData = {
            caseId,
            filename: uniqueFilename,
            originalName,
            category: 'BANKING', // Default to BANKING for now
            fileSize: buffer.length,
            mimeType: metadata.mimeType || 'application/pdf',
            uploadedById: userId,
          };

          const document = await storage.createDocument(documentData);
          
          // Process with AI for banking documents
          if (documentData.category === 'BANKING') {
            try {
              const documentNumber = await generateDocumentNumber(caseId);
              const accountGroupNumber = await generateAccountGroupNumber(caseId);
              
              const analysisResult = await analyzeBankingDocument(filePath, originalName);
              
              if (analysisResult.success && analysisResult.data) {
                // Generate CSV if transaction data is available
                let csvPath = null;
                let csvRowCount = 0;
                let csvGenerated = false;
                
                try {
                  const csvResult = await generateCSVFromPDF(filePath, originalName);
                  if (csvResult.success && csvResult.csvPath) {
                    csvPath = path.basename(csvResult.csvPath);
                    csvRowCount = csvResult.rowCount || 0;
                    csvGenerated = true;
                  }
                } catch (csvError) {
                  console.error("CSV generation failed:", csvError);
                }
                
                // Update document with AI analysis results
                await storage.updateDocument(document.id, {
                  ...analysisResult.data,
                  documentNumber,
                  accountGroupNumber,
                  aiProcessed: true,
                  csvPath,
                  csvRowCount,
                  csvGenerated,
                });
              }
            } catch (aiError) {
              console.error("AI processing failed:", aiError);
              await storage.updateDocument(document.id, {
                aiProcessed: false,
                processingError: aiError.message,
              });
            }
          }
          
          importedCount++;
        } catch (fileError) {
          console.error(`Failed to import file ${fileId}:`, fileError);
          errors.push(`Failed to import file: ${fileError.message}`);
        }
      }

      res.json({
        importedCount,
        totalRequested: fileIds.length,
        errors: errors.length > 0 ? errors : undefined
      });
      
    } catch (error) {
      console.error('Error importing Google Drive files:', error);
      res.status(500).json({ message: 'Failed to import files from Google Drive' });
    }
  });

  // Generate Disclosure PDF
  app.post('/api/cases/:id/generate-disclosure-pdf', isAuthenticated, async (req: any, res) => {
    try {
      const caseId = parseInt(req.params.id);
      const userId = req.user.id;

      // Verify user has access to the case
      const userRoles = await storage.getUserRolesInCase(userId, caseId);
      if (!userRoles || userRoles.length === 0) {
        return res.status(403).json({ message: 'Access denied to this case' });
      }

      // Get case data with created by user
      const caseData = await storage.getCaseById(caseId);
      if (!caseData) {
        return res.status(404).json({ message: 'Case not found' });
      }

      const createdByUser = await storage.getUser(caseData.createdById);
      if (!createdByUser) {
        return res.status(404).json({ message: 'Case creator not found' });
      }

      // Get all documents in the case with uploaded by user
      const documents = await storage.getDocumentsByCase(caseId);
      const documentsWithUser = await Promise.all(
        documents.map(async (doc) => {
          const uploadedBy = await storage.getUser(doc.uploadedById);
          return { ...doc, uploadedBy: uploadedBy! };
        })
      );

      // Get the last disclosure PDF to determine new documents
      const lastDisclosurePdf = await storage.getLatestDisclosurePdf(caseId);
      const lastGeneratedAt = lastDisclosurePdf?.generatedAt || null;

      // Generate the PDF
      const { filename, filePath } = await DisclosurePdfService.generateDisclosurePdf(
        { ...caseData, createdBy: createdByUser },
        documentsWithUser,
        lastGeneratedAt
      );

      // Store the disclosure PDF record
      const disclosurePdf = await storage.createDisclosurePdf({
        caseId,
        filename,
        generatedById: userId,
        documentCount: documents.length,
        lastGeneratedAt: new Date()
      });

      res.json({ 
        success: true, 
        disclosurePdf,
        message: `Disclosure PDF generated with ${documents.length} documents`
      });
    } catch (error) {
      console.error('Error generating disclosure PDF:', error);
      res.status(500).json({ message: 'Failed to generate disclosure PDF' });
    }
  });

  // Get disclosure PDFs for a case
  app.get('/api/cases/:id/disclosure-pdfs', isAuthenticated, async (req: any, res) => {
    try {
      const caseId = parseInt(req.params.id);
      const userId = req.user.id;

      // Verify user has access to the case
      const userRoles = await storage.getUserRolesInCase(userId, caseId);
      if (!userRoles || userRoles.length === 0) {
        return res.status(403).json({ message: 'Access denied to this case' });
      }

      const disclosurePdfs = await storage.getDisclosurePdfsByCase(caseId);
      
      // Add generated by user info
      const pdfsWithUser = await Promise.all(
        disclosurePdfs.map(async (pdf) => {
          const generatedBy = await storage.getUser(pdf.generatedById);
          return { ...pdf, generatedBy };
        })
      );

      res.json(pdfsWithUser);
    } catch (error) {
      console.error('Error fetching disclosure PDFs:', error);
      res.status(500).json({ message: 'Failed to fetch disclosure PDFs' });
    }
  });

  // Download disclosure PDF
  app.get('/api/disclosure-pdfs/:filename', isAuthenticated, async (req: any, res) => {
    try {
      const filename = req.params.filename;
      
      // Extract case number from filename to find the correct subdirectory
      // filename format: disclosure-{caseNumber}-{timestamp}.pdf
      const match = filename.match(/^disclosure-(.+?)-\d{4}-\d{2}-\d{2}-\d{6}\.pdf$/);
      if (!match) {
        return res.status(400).json({ message: 'Invalid filename format' });
      }
      
      const sanitizedCaseNumber = match[1];
      const caseDir = path.join(process.cwd(), 'uploads', `disclosure-${sanitizedCaseNumber}`);
      const filePath = path.join(caseDir, filename);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'Disclosure PDF not found' });
      }

      // Set proper headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      // Stream the file
      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      console.error('Error downloading disclosure PDF:', error);
      res.status(500).json({ message: 'Failed to download disclosure PDF' });
    }
  });

  // Recent activity endpoint
  app.get('/api/activity/recent', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit as string) || 10;
      
      // Get recent activity across all cases the user has access to
      const activities = await storage.getRecentActivity(limit);
      
      // Filter activities to only show cases the user has access to
      const filteredActivities = [];
      for (const activity of activities) {
        const userRoles = await storage.getUserRolesInCase(userId, activity.caseId);
        if (userRoles && userRoles.length > 0) {
          filteredActivities.push(activity);
        }
      }
      
      res.json(filteredActivities);
    } catch (error) {
      console.error("Error fetching recent activity:", error);
      res.status(500).json({ message: "Failed to fetch recent activity" });
    }
  });

  // Document status management endpoints
  app.patch('/api/documents/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const documentId = parseInt(req.params.id);
      const { status } = req.body;

      // Validate status
      const validStatuses = ['UPLOADED', 'READYFORREVIEW', 'REVIEWED', 'WITHDRAWN'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      // Get document and check case access
      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      const userRoles = await storage.getUserRolesInCase(userId, document.caseId);
      if (!userRoles || userRoles.length === 0) {
        return res.status(403).json({ message: "Access denied to this case" });
      }

      // Check permissions based on current status and target status
      const canUpdateStatus = validateStatusTransition(document.status, status, userRoles);
      if (!canUpdateStatus) {
        return res.status(403).json({ 
          message: `You cannot change document status from ${document.status} to ${status} with roles ${userRoles.join(', ')}` 
        });
      }

      // Update the document status
      const updatedDocument = await storage.updateDocumentStatus(documentId, status);

      // Log the status change activity
      await storage.createActivityLog({
        caseId: document.caseId,
        userId: userId,
        action: 'document_status_changed',
        description: `changed document "${document.originalName}" status from ${document.status} to ${status}`,
        metadata: {
          documentId: documentId,
          originalName: document.originalName,
          previousStatus: document.status,
          newStatus: status,
        }
      });

      res.json(updatedDocument);
    } catch (error) {
      console.error("Error updating document status:", error);
      res.status(500).json({ message: "Failed to update document status" });
    }
  });

  // Get documents filtered for DISCLOSEE role (only REVIEWED documents)
  app.get('/api/cases/:id/documents/disclosee', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const caseId = parseInt(req.params.id);
      
      const userRoles = await storage.getUserRolesInCase(userId, caseId);
      if (userRole !== 'DISCLOSEE') {
        return res.status(403).json({ message: "This endpoint is only for DISCLOSEE users" });
      }

      const documents = await storage.getDocumentsForDisclosee(caseId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents for disclosee:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Update case title
  app.put('/api/cases/:id/title', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const caseId = parseInt(req.params.id);
      const { title } = req.body;

      if (!title || title.trim().length === 0) {
        return res.status(400).json({ message: "Title is required" });
      }

      // Check if user has CASEADMIN role for this case
      const userRoles = await storage.getUserRolesInCase(userId, caseId);
      if (!userRoles.includes('CASEADMIN')) {
        return res.status(403).json({ message: "Only case administrators can edit case titles" });
      }

      const updatedCase = await storage.updateCaseTitle(caseId, title.trim());
      res.json(updatedCase);
    } catch (error) {
      console.error("Error updating case title:", error);
      res.status(500).json({ message: "Failed to update case title" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
