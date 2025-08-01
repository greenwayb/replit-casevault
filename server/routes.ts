import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertCaseSchema, insertDocumentSchema, type Role } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { analyzeBankingDocument, generateDocumentNumber, generateAccountGroupNumber, generateCSVFromPDF } from "./aiService";

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

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Case routes
  app.post('/api/cases', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
        role: 'CASEADMIN',
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
      const userId = req.user.claims.sub;
      const cases = await storage.getCasesByUserId(userId);
      res.json(cases);
    } catch (error) {
      console.error("Error fetching cases:", error);
      res.status(500).json({ message: "Failed to fetch cases" });
    }
  });

  app.get('/api/cases/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = parseInt(req.params.id);
      
      const caseData = await storage.getCaseById(caseId);
      if (!caseData) {
        return res.status(404).json({ message: "Case not found" });
      }

      const userRole = await storage.getUserRoleInCase(userId, caseId);
      if (!userRole) {
        return res.status(403).json({ message: "Access denied to this case" });
      }

      const documents = await storage.getDocumentsByCase(caseId);
      
      res.json({
        ...caseData,
        userRole,
        documents,
      });
    } catch (error) {
      console.error("Error fetching case:", error);
      res.status(500).json({ message: "Failed to fetch case" });
    }
  });

  // Document routes
  app.post('/api/cases/:caseId/documents', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = parseInt(req.params.caseId);
      const { category } = req.body;

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Check if user has access to this case
      const userRole = await storage.getUserRoleInCase(userId, caseId);
      if (!userRole) {
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

      // Process Banking documents with AI
      if (category.toUpperCase() === 'BANKING') {
        try {
          const { analyzeBankingDocument, generateDocumentNumber, generateAccountGroupNumber } = await import('./aiService');
          const filePath = path.join(uploadDir, req.file.filename);
          
          // Analyze the document with AI
          const analysis = await analyzeBankingDocument(filePath);
          
          // Get existing account groups for this case
          const existingGroups = await storage.getExistingAccountGroups(caseId, 'BANKING');
          
          // Check if account holder name already exists
          const allCaseDocuments = await storage.getDocumentsByCase(caseId);
          const existingAccount = allCaseDocuments.find(doc => 
            doc.category === 'BANKING' && 
            doc.accountHolderName?.toLowerCase() === analysis.accountHolderName.toLowerCase()
          );
          
          let accountGroupNumber: string;
          let documentSequence: number;
          
          if (existingAccount && existingAccount.accountGroupNumber) {
            // Use existing account group
            accountGroupNumber = existingAccount.accountGroupNumber;
            const groupDocuments = await storage.getDocumentsByAccountGroup(caseId, accountGroupNumber);
            documentSequence = groupDocuments.length + 1;
          } else {
            // Create new account group
            accountGroupNumber = generateAccountGroupNumber(existingGroups, analysis.accountHolderName);
            documentSequence = 1;
          }
          
          const documentNumber = generateDocumentNumber('BANKING', accountGroupNumber, documentSequence);
          
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
            // Continue without CSV - this is non-critical
          }

          // Return document with extracted AI analysis for confirmation
          const documentWithAnalysis = {
            ...document,
            extractedBankingInfo: {
              accountHolderName: analysis.accountHolderName,
              accountName: analysis.accountName,
              financialInstitution: analysis.financialInstitution,
              accountNumber: analysis.accountNumber,
              bsbSortCode: analysis.bsbSortCode,
              transactionDateFrom: analysis.transactionDateFrom,
              transactionDateTo: analysis.transactionDateTo,
              documentNumber,
              accountGroupNumber,
              csvInfo
            }
          };
          
          res.json(documentWithAnalysis);
        } catch (aiError) {
          console.error("AI analysis failed:", aiError);
          // Return document with error status for manual review
          const documentWithError = {
            ...document,
            aiProcessingFailed: true,
            processingError: aiError instanceof Error ? aiError.message : 'AI processing failed',
            extractedBankingInfo: {
              accountHolderName: '',
              accountName: '',
              financialInstitution: '',
              accountNumber: '',
              bsbSortCode: '',
              transactionDateFrom: '',
              transactionDateTo: '',
              documentNumber: '',
              accountGroupNumber: '',
              csvInfo: null
            }
          };
          res.json(documentWithError);
        }
      } else {
        res.json(document);
      }
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  // Update account name for banking documents
  app.patch('/api/documents/:id/account', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userRole = await storage.getUserRoleInCase(userId, document.caseId);
      if (!userRole) {
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
      const userId = req.user.claims.sub;
      const documentId = parseInt(req.params.id);
      
      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Check if user has access to the case
      const userRole = await storage.getUserRoleInCase(userId, document.caseId);
      if (!userRole) {
        return res.status(403).json({ message: "Access denied to this document" });
      }

      // Check if user has permission to delete (CASEADMIN or DISCLOSER)
      if (userRole !== 'CASEADMIN' && userRole !== 'DISCLOSER') {
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
      const { bankingInfo, csvInfo, isManualReview } = req.body;

      // For manual review, generate document numbers
      let documentNumber = bankingInfo.documentNumber;
      let accountGroupNumber = bankingInfo.accountGroupNumber;
      
      if (isManualReview) {
        // Get existing documents to generate proper numbering
        const document = await storage.getDocumentById(documentId);
        const caseDocuments = await storage.getDocumentsByCase(document!.caseId);
        const bankingDocs = caseDocuments.filter(doc => doc.category === 'BANKING' && doc.accountGroupNumber);
        
        // Generate account group number and document number
        accountGroupNumber = '1'; // Simple for now, can be enhanced
        documentNumber = `B${accountGroupNumber}.1`; // Simple for now
      }

      // Update document with confirmed banking analysis
      const updatedDocument = await storage.updateDocumentWithAIAnalysis(documentId, {
        accountHolderName: bankingInfo.accountHolderName,
        accountName: bankingInfo.accountName,
        financialInstitution: bankingInfo.financialInstitution,
        accountNumber: bankingInfo.accountNumber,
        bsbSortCode: bankingInfo.bsbSortCode,
        transactionDateFrom: bankingInfo.transactionDateFrom ? new Date(bankingInfo.transactionDateFrom) : undefined,
        transactionDateTo: bankingInfo.transactionDateTo ? new Date(bankingInfo.transactionDateTo) : undefined,
        documentNumber,
        accountGroupNumber,
        aiProcessed: true,
        csvPath: csvInfo?.csvPath,
        csvRowCount: csvInfo?.csvRowCount,
        csvGenerated: csvInfo?.csvGenerated || false,
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

  // Delete case
  app.delete('/api/cases/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const caseId = parseInt(req.params.id);
      
      const caseToDelete = await storage.getCaseById(caseId);
      if (!caseToDelete) {
        return res.status(404).json({ message: "Case not found" });
      }

      // Check if user has access to the case and is a CASEADMIN
      const userRole = await storage.getUserRoleInCase(userId, caseId);
      if (!userRole || userRole !== 'CASEADMIN') {
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
      const userId = req.user.claims.sub;
      const documentId = parseInt(req.params.id);
      
      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Check if user has access to the case
      const userRole = await storage.getUserRoleInCase(userId, document.caseId);
      if (!userRole) {
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
      const userId = req.user.claims.sub;
      const documentId = parseInt(req.params.id);
      
      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Check if user has access to the case
      const userRole = await storage.getUserRoleInCase(userId, document.caseId);
      if (!userRole) {
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
      const userId = req.user.claims.sub;
      const documentId = parseInt(req.params.id);

      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Check if user has access to the case
      const userRole = await storage.getUserRoleInCase(userId, document.caseId);
      if (!userRole) {
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

  const httpServer = createServer(app);
  return httpServer;
}
