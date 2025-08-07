import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupLocalAuth, isAuthenticated } from "./localAuth";
import { randomUUID } from "crypto";
import { insertCaseSchema, insertDocumentSchema, type Role, transactions, type InsertTransaction } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { analyzeBankingDocument, generateDocumentNumber, generateAccountGroupNumber, generateCSVFromPDF, generateXMLFromAnalysis } from "./aiService";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
import { GoogleDriveService } from "./googleDriveService";
import { DisclosurePdfService } from "./disclosurePdfService";
import { SVGRenderer } from "./svgRenderer";
import { SimpleSVGRenderer } from "./simpleSvgRenderer";

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
        const accountHolderName = basicFields.accountHolders.join(' & ') || 'Unknown';
        
        // Calculate time estimate for full analysis
        const estimatedMinutes = Math.max(1, Math.ceil((basicFields.totalTransactions || 50) / 100) + 1);
        const timeDescription = `Estimated processing time: ${estimatedMinutes} minutes for ${basicFields.totalTransactions || 0} transactions`;

        // Return the basic analysis results for user review - Phase 1 complete
        res.json({
          id: document.id,
          caseId: document.caseId,
          filename: document.filename,
          originalName: document.originalName,
          extractedBankingInfo: {
            financialInstitution: basicFields.financialInstitution,
            accountHolderName: accountHolderName,
            accountName: basicFields.accountType,
            accountNumber: basicFields.accountNumber,
            bsbSortCode: basicFields.accountBsb,
            transactionDateFrom: basicFields.startDate,
            transactionDateTo: basicFields.endDate,
            // No CSV, XML or detailed analysis yet - Phase 2 not started
            csvInfo: null,
            xmlInfo: null,
            xmlAnalysisData: null,
          },
          totalTransactions: basicFields.totalTransactions,
          estimatedPdfCount: basicFields.estimatedPdfCount,
          earliestTransaction: basicFields.earliestTransaction,
          latestTransaction: basicFields.latestTransaction,
          confidence: basicFields.confidence,
          requiresConfirmation: true,
          analysisPhase: 'basic', // Indicate this is Phase 1 only
          timeEstimate: {
            estimatedMinutes: estimatedMinutes,
            description: timeDescription
          }
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

      // Phase 2: Full transaction analysis - XML-first approach
      try {
        const { analyzeBankingDocument, generateCSVFromXML, generateXMLFromAnalysis } = await import('./aiService');
        const filePath = path.join(uploadDir, document.filename);
        
        console.log(`Starting full analysis for document ${documentId}`);
        
        // Create log file for detailed AI processing logs
        const fs = await import('fs');
        const { fileURLToPath } = await import('url');
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const logsDir = path.join(__dirname, '../logs');
        if (!fs.existsSync(logsDir)) {
          fs.mkdirSync(logsDir, { recursive: true });
        }
        const logFile = path.join(logsDir, `ai-processing-${documentId}.log`);
        
        const logToFile = (message: string) => {
          const timestamp = new Date().toISOString();
          const logMessage = `[${timestamp}] ${message}\n`;
          fs.appendFileSync(logFile, logMessage);
          console.log(message); // Also log to console
        };
        
        logToFile(`Starting full analysis for document ${documentId}`);
        logToFile(`Log file location: ${logFile}`);
        
        // Step 1: Generate comprehensive XML analysis first
        let xmlAnalysisData = '';
        let xmlInfo = { xmlPath: '', xmlGenerated: false };
        let analysisError = null;
        let analysis = null; // Initialize analysis variable
        
        try {
          logToFile('Step 1: Running AI analysis to generate XML...');
          const startTime = Date.now();
          analysis = await analyzeBankingDocument(filePath);
          
          const elapsed = Date.now() - startTime;
          logToFile(`AI analysis completed in ${elapsed}ms`);
          
          if (!analysis.xmlAnalysis) {
            logToFile(`AI Analysis result: ${JSON.stringify(analysis, null, 2)}`);
            throw new Error('AI analysis did not produce XML data - check server console for full AI response');
          }
          
          // Generate XML file from analysis
          const xmlResult = await generateXMLFromAnalysis(analysis.xmlAnalysis, document.id);
          xmlInfo = {
            xmlPath: xmlResult.xmlPath,
            xmlGenerated: !!xmlResult.xmlContent
          };
          xmlAnalysisData = xmlResult.xmlContent;
          logToFile('Step 1: XML generation completed successfully');
          
        } catch (xmlError: any) {
          logToFile(`Step 1: XML generation failed: ${xmlError.message}`);
          logToFile(`Error stack: ${xmlError.stack}`);
          analysisError = `XML generation failed: ${xmlError.message}`;
          xmlAnalysisData = '';
          xmlInfo = { xmlPath: '', xmlGenerated: false };
        }

        // Step 2: CSV generation removed as requested by user
        logToFile('Step 2: CSV generation disabled by user request');

        // Step 3: Update document with results
        logToFile('Step 3: Updating document with analysis results...');
        const updateData: any = {
          fullAnalysisCompleted: !analysisError,
          xmlPath: xmlInfo.xmlPath,
          xmlAnalysisData: xmlAnalysisData,
        };

        // Add processing warning if present
        if (analysis && analysis.processingWarning) {
          updateData.processingWarning = analysis.processingWarning;
          logToFile(`Processing warning: ${analysis.processingWarning}`);
        }

        if (analysisError) {
          updateData.analysisError = analysisError;
          updateData.aiProcessingFailed = true;
        }

        const updatedDocument = await storage.updateDocumentWithAIAnalysis(documentId, updateData);

        logToFile('Step 3: Document updated successfully');
        logToFile(`Analysis completed. Log saved to: ${logFile}`);

        // Return comprehensive response with error details if any
        res.json({
          ...updatedDocument,
          xmlInfo,
          xmlAnalysisData,
          analysisError,
          processingWarning: updateData.processingWarning,
          message: analysisError 
            ? `Analysis completed with errors: ${analysisError}` 
            : updateData.processingWarning
            ? `Analysis completed with warnings: ${updateData.processingWarning}`
            : "Full analysis completed successfully",
          processingSteps: {
            xmlGenerated: xmlInfo.xmlGenerated,
            errorOccurred: !!analysisError,
            hasWarnings: !!updateData.processingWarning
          }
        });

      } catch (error: any) {
        console.error("Full analysis workflow failed:", error);
        
        // Update document to mark analysis as failed
        try {
          await storage.updateDocumentWithAIExtraction(documentId, {
            aiProcessingFailed: true,
            processingError: `Workflow error: ${error.message}`
          });
        } catch (updateError) {
          console.error("Failed to update document with error status:", updateError);
        }
        
        res.status(500).json({ 
          message: "Failed to complete full analysis",
          error: error.message,
          processingSteps: {
            xmlGenerated: false,
            errorOccurred: true
          }
        });
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

  // Update banking information for documents
  app.patch('/api/documents/:id/banking-info', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const documentId = parseInt(req.params.id);
      const { accountHolderName, accountName, financialInstitution, accountNumber, bsbSortCode } = req.body;

      console.log(`PATCH banking info for document ${documentId} by user ${userId}:`, req.body);

      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Check if user has access to the case
      const userRoles = await storage.getUserRolesInCase(userId, document.caseId);
      if (!userRoles || userRoles.length === 0) {
        return res.status(403).json({ message: "Access denied to this document" });
      }

      // Check if user has permission to edit (CASEADMIN, DISCLOSER, or REVIEWER)
      if (!userRoles.includes('CASEADMIN') && !userRoles.includes('DISCLOSER') && !userRoles.includes('REVIEWER')) {
        return res.status(403).json({ message: "Insufficient permissions to edit banking information" });
      }

      // Update banking information
      const updates: any = {};
      if (accountHolderName !== undefined) updates.accountHolderName = accountHolderName?.trim() || null;
      if (accountName !== undefined) updates.accountName = accountName?.trim() || null;
      if (financialInstitution !== undefined) updates.financialInstitution = financialInstitution?.trim() || null;
      if (accountNumber !== undefined) updates.accountNumber = accountNumber?.trim() || null;
      if (bsbSortCode !== undefined) updates.bsbSortCode = bsbSortCode?.trim() || null;

      const updatedDocument = await storage.updateDocumentWithAIAnalysis(documentId, updates);
      console.log(`Banking info updated successfully for document ${documentId}`);

      res.json(updatedDocument);
    } catch (error) {
      console.error("Error updating banking information:", error);
      res.status(500).json({ message: "Failed to update banking information" });
    }
  });

  // Delete document
  app.delete('/api/documents/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const documentId = parseInt(req.params.id);
      
      console.log(`DELETE request for document ${documentId} by user ${userId}`);
      
      // Validate documentId
      if (isNaN(documentId)) {
        console.log(`Invalid document ID: ${req.params.id}`);
        return res.status(400).json({ message: "Invalid document ID" });
      }
      
      const document = await storage.getDocumentById(documentId);
      if (!document) {
        console.log(`Document ${documentId} not found`);
        return res.status(404).json({ message: "Document not found" });
      }

      // Check if user has access to the case
      const userRoles = await storage.getUserRolesInCase(userId, document.caseId);
      console.log(`User ${userId} roles in case ${document.caseId}:`, userRoles);
      
      if (!userRoles || userRoles.length === 0) {
        console.log(`User ${userId} has no access to case ${document.caseId}`);
        return res.status(403).json({ message: "Access denied to this document" });
      }

      // Check if user has permission to delete (CASEADMIN or DISCLOSER)
      if (!userRoles.includes('CASEADMIN') && !userRoles.includes('DISCLOSER')) {
        console.log(`User ${userId} lacks delete permissions. Roles:`, userRoles);
        return res.status(403).json({ message: "Insufficient permissions to delete document" });
      }

      console.log(`Deleting document ${documentId}`);
      await storage.deleteDocument(documentId);
      console.log(`Document ${documentId} deleted successfully`);
      
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
        totalTransactions: req.body.totalTransactions,
        estimatedPdfCount: req.body.estimatedPdfCount,
        earliestTransaction: req.body.earliestTransaction,
        latestTransaction: req.body.latestTransaction,
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

  // PDF optimization endpoint
  app.post("/api/optimize-pdf", isAuthenticated, async (req: any, res) => {
    try {
      const { pdfData, fileName } = req.body;
      
      if (!pdfData || !fileName) {
        return res.status(400).json({ error: "PDF data and filename are required" });
      }

      console.log('Starting PDF optimization for:', fileName);
      
      // Convert data URI to buffer
      const base64Data = pdfData.split(',')[1];
      const pdfBuffer = Buffer.from(base64Data, 'base64');
      
      console.log(`Original PDF size: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`);
      
      // Create temporary file paths
      const tempDir = path.join(process.cwd(), 'temp');
      try {
        await fs.mkdir(tempDir, { recursive: true });
      } catch (mkdirError) {
        // Directory might already exist, continue
      }
      
      const tempInputPath = path.join(tempDir, `input_${Date.now()}.pdf`);
      const tempOutputPath = path.join(tempDir, `output_${Date.now()}.pdf`);
      
      try {
        // Write the PDF to temporary file
        await fs.writeFile(tempInputPath, pdfBuffer);
        
        // Use Ghostscript for PDF optimization (if available)
        const { spawn } = await import('child_process');
        const gsProcess = spawn('gs', [
          '-sDEVICE=pdfwrite',
          '-dCompatibilityLevel=1.4',
          '-dPDFSETTINGS=/ebook',
          '-dNOPAUSE',
          '-dQUIET',
          '-dBATCH',
          '-dColorImageResolution=150',
          '-dGrayImageResolution=150',
          '-dMonoImageResolution=150',
          '-dColorImageDownsampleType=/Bicubic',
          '-dGrayImageDownsampleType=/Bicubic',
          '-dMonoImageDownsampleType=/Bicubic',
          `-sOutputFile=${tempOutputPath}`,
          tempInputPath
        ]);

        await new Promise<void>((resolve, reject) => {
          gsProcess.on('close', (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`Ghostscript failed with code ${code}`));
            }
          });
          
          gsProcess.on('error', (error) => {
            console.log('Ghostscript not available, using alternative compression...');
            reject(error);
          });
        });

        // Read optimized PDF
        const optimizedBuffer = await fs.readFile(tempOutputPath);
        console.log(`Optimized PDF size: ${(optimizedBuffer.length / 1024 / 1024).toFixed(2)} MB`);
        
        // Clean up temporary files
        try {
          await fs.unlink(tempInputPath);
        } catch {}
        try {
          await fs.unlink(tempOutputPath);
        } catch {}
        
        // Send optimized PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send(optimizedBuffer);
        
      } catch (gsError: any) {
        console.log('Ghostscript optimization failed, trying alternative method:', gsError?.message || 'Unknown error');
        
        // Fallback: Simple compression using minimal processing
        try {
          // Use jsPDF's built-in compression if available
          // For now, just return the original with minimal processing
          const optimizedBuffer = pdfBuffer;
          
          console.log('Using fallback compression method');
          
          // Clean up temp files
          try {
            await fs.unlink(tempInputPath);
          } catch {}
          
          // Send PDF with compression headers
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
          res.setHeader('Content-Encoding', 'gzip');
          
          // Simple gzip compression
          const zlib = await import('zlib');
          const compressed = zlib.gzipSync(optimizedBuffer);
          res.send(compressed);
          
        } catch (fallbackError: any) {
          console.error('Fallback compression failed:', fallbackError?.message || 'Unknown error');
          
          // Final fallback: return original
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
          res.send(pdfBuffer);
        }
      }
      
    } catch (error: any) {
      console.error('PDF optimization error:', error);
      res.status(500).json({ 
        error: 'PDF optimization failed',
        details: error?.message || 'Unknown error' 
      });
    }
  });

  // Server-side SVG to PNG rendering endpoint
  app.post('/api/render/svg-to-png', isAuthenticated, async (req: any, res) => {
    try {
      const { svgContent, chartData, chartType, width = 800, height = 600, scale = 2 } = req.body;

      let pngBuffer: Buffer;

      if (svgContent) {
        // Debug: Log SVG content details
        const textCount = (svgContent.match(/<text/g) || []).length;
        console.log(`Server received SVG with ${textCount} text elements`);
        console.log('SVG content sample:', svgContent.substring(0, 500));
        
        // Try Puppeteer first for better text rendering, fallback to Canvas
        try {
          pngBuffer = await SVGRenderer.renderSVGToPNG(svgContent, { width, height, scale });
          console.log('Puppeteer rendering successful');
        } catch (puppeteerError) {
          const puppeteerErrorMsg = puppeteerError instanceof Error ? puppeteerError.message : String(puppeteerError);
          console.log('Puppeteer rendering failed, trying Canvas:', puppeteerErrorMsg);
          try {
            pngBuffer = await SimpleSVGRenderer.renderSVGToPNG(svgContent, { width, height, scale });
            console.log('Canvas rendering successful');
          } catch (simpleError) {
            const simpleErrorMsg = simpleError instanceof Error ? simpleError.message : String(simpleError);
            console.log('Canvas failed, trying Sharp fallback:', simpleErrorMsg);
            pngBuffer = await SimpleSVGRenderer.renderSVGToBuffer(svgContent, { width, height });
          }
        }
      } else if (chartData && chartType) {
        // Render chart data using Recharts
        try {
          pngBuffer = await SVGRenderer.renderChartToPNG(chartData, chartType, { width, height, scale });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.log('Chart rendering failed:', errorMessage);
          return res.status(500).json({ message: "Chart rendering not available" });
        }
      } else {
        return res.status(400).json({ message: "Either svgContent or chartData/chartType is required" });
      }

      // Optimize the PNG
      const optimizedPng = await SVGRenderer.optimizePNG(pngBuffer, { quality: 90 });

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Length', optimizedPng.length);
      res.send(optimizedPng);
    } catch (error) {
      console.error("Error rendering SVG to PNG:", error);
      res.status(500).json({ message: "Failed to render SVG" });
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
        error: error instanceof Error ? error.message : 'Unknown error'
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
            category: 'BANKING' as const, // Default to BANKING for now
            fileSize: buffer.length,
            mimeType: metadata.mimeType || 'application/pdf',
            uploadedById: userId,
          };

          const document = await storage.createDocument(documentData);
          
          // Process with AI for banking documents
          if (documentData.category === 'BANKING') {
            try {
              const existingGroups = await storage.getExistingAccountGroups(caseId, 'BANKING');
              const accountGroupNumber = generateAccountGroupNumber(existingGroups, originalName);
              const documentNumber = generateDocumentNumber('BANKING', accountGroupNumber, 1);
              
              const analysisResult = await analyzeBankingDocument(filePath);
              
              // Generate CSV if transaction data is available
              let csvPath = null;
              let csvRowCount = 0;
              let csvGenerated = false;
              
              try {
                const csvResult = await generateCSVFromPDF(filePath, document.id);
                if (csvResult.csvPath) {
                  csvPath = path.basename(csvResult.csvPath);
                  csvRowCount = csvResult.rowCount || 0;
                  csvGenerated = true;
                }
              } catch (csvError) {
                console.error("CSV generation failed:", csvError);
              }
              
              // Convert date strings to Date objects
              const updateData: any = {
                ...analysisResult,
                documentNumber,
                accountGroupNumber,
                aiProcessed: true,
                csvPath,
                csvRowCount,
                csvGenerated,
              };
              
              // Convert date fields properly
              if (analysisResult.transactionDateFrom) {
                updateData.transactionDateFrom = new Date(analysisResult.transactionDateFrom);
              }
              if (analysisResult.transactionDateTo) {
                updateData.transactionDateTo = new Date(analysisResult.transactionDateTo);
              }
              
              // Update document with AI analysis results
              await storage.updateDocumentWithAIExtraction(document.id, updateData);
            } catch (aiError: unknown) {
              console.error("AI processing failed:", aiError);
              await storage.updateDocumentWithAIExtraction(document.id, {
                aiProcessed: false,
                aiProcessingFailed: true,
                processingError: aiError instanceof Error ? aiError.message : 'Unknown error',
              });
            }
          }
          
          importedCount++;
        } catch (fileError: unknown) {
          console.error(`Failed to import file ${fileId}:`, fileError);
          errors.push(`Failed to import file: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`);
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
      const canUpdateStatus = validateStatusTransition(document.status || 'UPLOADED', status, userRoles);
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
      if (!userRoles.includes('DISCLOSEE')) {
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

  // Transaction management routes
  app.get("/api/transactions/:documentId", isAuthenticated, async (req: any, res) => {
    try {
      const documentId = parseInt(req.params.documentId);
      if (isNaN(documentId)) {
        return res.status(400).json({ message: "Invalid document ID" });
      }

      const transactionList = await db
        .select()
        .from(transactions)
        .where(eq(transactions.documentId, documentId));

      res.json(transactionList);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.post("/api/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const { documentId, transactionDate, description, amount, balance, category, status } = req.body;

      const [transaction] = await db
        .insert(transactions)
        .values({
          documentId,
          transactionDate,
          description,
          amount,
          balance,
          category,
          status: status || 'none'
        })
        .returning();

      res.json(transaction);
    } catch (error) {
      console.error("Error creating transaction:", error);
      res.status(500).json({ message: "Failed to create transaction" });
    }
  });

  app.put("/api/transactions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const transactionId = parseInt(req.params.id);
      if (isNaN(transactionId)) {
        return res.status(400).json({ message: "Invalid transaction ID" });
      }

      const { status, comments } = req.body;

      const updateData: any = { updatedAt: new Date() };
      if (status !== undefined) updateData.status = status;
      if (comments !== undefined) updateData.comments = comments;

      const [updatedTransaction] = await db
        .update(transactions)
        .set(updateData)
        .where(eq(transactions.id, transactionId))
        .returning();

      if (!updatedTransaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      res.json(updatedTransaction);
    } catch (error) {
      console.error("Error updating transaction:", error);
      res.status(500).json({ message: "Failed to update transaction" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
