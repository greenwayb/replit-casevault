import {
  users,
  cases,
  documents,
  caseUsers,
  type User,
  type UpsertUser,
  type Case,
  type InsertCase,
  type Document,
  type InsertDocument,
  type CaseUser,
  type InsertCaseUser,
  type Role,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, isNotNull } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Case operations
  createCase(caseData: InsertCase): Promise<Case>;
  getCasesByUserId(userId: string): Promise<(Case & { role: Role; documentCount: number })[]>;
  getCaseByNumber(caseNumber: string): Promise<Case | undefined>;
  getCaseById(id: number): Promise<Case | undefined>;
  getUserRoleInCase(userId: string, caseId: number): Promise<Role | undefined>;
  deleteCase(id: number): Promise<void>;
  
  // Case user operations
  addUserToCase(caseUser: InsertCaseUser): Promise<CaseUser>;
  
  // Document operations
  createDocument(document: InsertDocument): Promise<Document>;
  getDocumentsByCase(caseId: number): Promise<Document[]>;
  getDocumentById(id: number): Promise<Document | undefined>;
  getDocumentsByCategory(caseId: number, category: string): Promise<Document[]>;
  deleteDocument(id: number): Promise<void>;
  updateDocumentWithAIAnalysis(documentId: number, analysis: any): Promise<Document>;
  getDocumentsByAccountGroup(caseId: number, accountGroupNumber: string): Promise<Document[]>;
  getExistingAccountGroups(caseId: number, category: 'BANKING' | 'REAL_PROPERTY'): Promise<string[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Case operations
  async createCase(caseData: InsertCase): Promise<Case> {
    const [newCase] = await db
      .insert(cases)
      .values(caseData)
      .returning();
    return newCase;
  }

  async getCasesByUserId(userId: string): Promise<(Case & { role: Role; documentCount: number })[]> {
    const result = await db
      .select({
        id: cases.id,
        caseNumber: cases.caseNumber,
        createdById: cases.createdById,
        status: cases.status,
        createdAt: cases.createdAt,
        updatedAt: cases.updatedAt,
        role: caseUsers.role,
        documentCount: db.$count(documents, eq(documents.caseId, cases.id)),
      })
      .from(cases)
      .innerJoin(caseUsers, eq(caseUsers.caseId, cases.id))
      .where(eq(caseUsers.userId, userId))
      .orderBy(desc(cases.createdAt));

    return result.map(row => ({
      ...row,
      documentCount: Number(row.documentCount) || 0,
    }));
  }

  async getCaseByNumber(caseNumber: string): Promise<Case | undefined> {
    const [caseResult] = await db
      .select()
      .from(cases)
      .where(eq(cases.caseNumber, caseNumber));
    return caseResult;
  }

  async getCaseById(id: number): Promise<Case | undefined> {
    const [caseResult] = await db
      .select()
      .from(cases)
      .where(eq(cases.id, id));
    return caseResult;
  }

  async getUserRoleInCase(userId: string, caseId: number): Promise<Role | undefined> {
    const [result] = await db
      .select({ role: caseUsers.role })
      .from(caseUsers)
      .where(and(eq(caseUsers.userId, userId), eq(caseUsers.caseId, caseId)));
    return result?.role;
  }

  // Case user operations
  async addUserToCase(caseUser: InsertCaseUser): Promise<CaseUser> {
    const [newCaseUser] = await db
      .insert(caseUsers)
      .values(caseUser)
      .returning();
    return newCaseUser;
  }

  // Document operations
  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db
      .insert(documents)
      .values(document)
      .returning();
    return newDocument;
  }

  async updateDocumentWithAIAnalysis(
    documentId: number, 
    analysis: {
      accountHolderName?: string;
      accountName?: string;
      financialInstitution?: string;
      accountNumber?: string;
      bsbSortCode?: string;
      transactionDateFrom?: Date;
      transactionDateTo?: Date;
      documentNumber?: string;
      accountGroupNumber?: string;
      aiProcessed?: boolean;
      processingError?: string;
      csvPath?: string;
      csvRowCount?: number;
      csvGenerated?: boolean;
    }
  ): Promise<Document> {
    const [updatedDocument] = await db
      .update(documents)
      .set(analysis)
      .where(eq(documents.id, documentId))
      .returning();
    return updatedDocument;
  }

  async getDocumentsByAccountGroup(caseId: number, accountGroupNumber: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.caseId, caseId),
          eq(documents.accountGroupNumber, accountGroupNumber)
        )
      )
      .orderBy(documents.documentNumber);
  }

  async getExistingAccountGroups(caseId: number, category: 'BANKING' | 'REAL_PROPERTY'): Promise<string[]> {
    const results = await db
      .selectDistinct({ accountGroupNumber: documents.accountGroupNumber })
      .from(documents)
      .where(
        and(
          eq(documents.caseId, caseId),
          eq(documents.category, category as any),
          isNotNull(documents.accountGroupNumber)
        )
      );
    
    return results.map(r => r.accountGroupNumber).filter(Boolean) as string[];
  }

  async getDocumentsByCase(caseId: number): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.caseId, caseId))
      .orderBy(desc(documents.createdAt));
  }

  async getDocumentById(id: number): Promise<Document | undefined> {
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id));
    return document;
  }

  async getDocumentsByCategory(caseId: number, category: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(and(eq(documents.caseId, caseId), eq(documents.category, category as any)))
      .orderBy(desc(documents.createdAt));
  }

  async deleteDocument(id: number): Promise<void> {
    await db
      .delete(documents)
      .where(eq(documents.id, id));
  }

  async deleteCase(id: number): Promise<void> {
    // Delete case users first (foreign key constraint)
    await db.delete(caseUsers).where(eq(caseUsers.caseId, id));
    
    // Delete all documents in the case
    await db.delete(documents).where(eq(documents.caseId, id));
    
    // Delete the case itself
    await db.delete(cases).where(eq(cases.id, id));
  }
}

export const storage = new DatabaseStorage();
