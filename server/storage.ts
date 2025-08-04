import {
  users,
  legalOrganizations,
  cases,
  documents,
  caseUsers,
  disclosurePdfs,
  activityLog,
  caseInvitations,
  type User,
  type UpsertUser,
  type LegalOrganization,
  type InsertLegalOrganization,
  type Case,
  type InsertCase,
  type Document,
  type InsertDocument,
  type CaseUser,
  type InsertCaseUser,
  type DisclosurePdf,
  type InsertDisclosurePdf,
  type ActivityLog,
  type InsertActivityLog,
  type CaseInvitation,
  type InsertCaseInvitation,
  type Role,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, isNotNull, like, sql } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUser(userData: UpsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  
  // Legal organization operations
  getLegalOrganizations(): Promise<LegalOrganization[]>;
  searchLegalOrganizations(query: string): Promise<LegalOrganization[]>;
  createLegalOrganization(orgData: InsertLegalOrganization): Promise<LegalOrganization>;
  getLegalOrganizationById(id: number): Promise<LegalOrganization | undefined>;
  
  // Case operations
  createCase(caseData: InsertCase): Promise<Case>;
  getCasesByUserId(userId: string): Promise<(Case & { roles: Role[]; documentCount: number; totalFileSize: number })[]>;
  getCaseByNumber(caseNumber: string): Promise<Case | undefined>;
  getCaseById(id: number): Promise<Case | undefined>;
  getUserRolesInCase(userId: string, caseId: number): Promise<Role[]>;
  deleteCase(id: number): Promise<void>;
  
  // Case user operations
  addUserToCase(caseUser: InsertCaseUser): Promise<CaseUser>;
  getCaseMembers(caseId: number): Promise<(CaseUser & { user: User })[]>;
  removeUserFromCase(caseId: number, userId: string): Promise<void>;
  updateUserRolesInCase(caseId: number, userId: string, roles: Role[]): Promise<CaseUser>;
  updateCaseTitle(caseId: number, title: string): Promise<Case>;
  getCaseTotalFileSize(caseId: number): Promise<number>;
  
  // Case invitation operations
  createCaseInvitation(invitation: InsertCaseInvitation): Promise<CaseInvitation>;
  getCaseInvitations(caseId: number): Promise<CaseInvitation[]>;
  acceptCaseInvitation(token: string, userId: string): Promise<CaseUser | null>;
  getInvitationByToken(token: string): Promise<CaseInvitation | undefined>;
  
  // Document operations
  createDocument(document: InsertDocument): Promise<Document>;
  getDocumentsByCase(caseId: number): Promise<Document[]>;
  getDocumentById(id: number): Promise<Document | undefined>;
  getDocumentsByCategory(caseId: number, category: string): Promise<Document[]>;
  deleteDocument(id: number): Promise<void>;
  updateDocumentWithAIAnalysis(documentId: number, analysis: any): Promise<Document>;
  updateDocumentWithAIExtraction(documentId: number, data: {
    accountHolderName?: string;
    accountName?: string;
    financialInstitution?: string;
    accountNumber?: string;
    bsbSortCode?: string;
    transactionDateFrom?: string;
    transactionDateTo?: string;
    documentNumber?: string;
    accountGroupNumber?: string;
    aiProcessed?: boolean;
    processingError?: string;
    csvPath?: string;
    csvRowCount?: number;
    csvGenerated?: boolean;
    xmlPath?: string;
    xmlAnalysisData?: string;
  }): Promise<void>;
  getDocumentsByAccountGroup(caseId: number, accountGroupNumber: string): Promise<Document[]>;
  updateDocumentStatus(documentId: number, status: string): Promise<Document>;
  getDocumentsForDisclosee(caseId: number): Promise<Document[]>;
  getExistingAccountGroups(caseId: number, category: 'BANKING' | 'REAL_PROPERTY'): Promise<string[]>;
  
  // Disclosure PDF operations
  createDisclosurePdf(disclosurePdf: InsertDisclosurePdf): Promise<DisclosurePdf>;
  getDisclosurePdfsByCase(caseId: number): Promise<DisclosurePdf[]>;
  getLatestDisclosurePdf(caseId: number): Promise<DisclosurePdf | undefined>;
  
  // Activity log operations
  createActivityLog(activity: InsertActivityLog): Promise<ActivityLog>;
  getRecentActivity(limit?: number): Promise<(ActivityLog & { user: User; case: Case })[]>;
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

  async createUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.firstName, users.lastName);
  }

  // Legal organization operations
  async getLegalOrganizations(): Promise<LegalOrganization[]> {
    return await db
      .select()
      .from(legalOrganizations)
      .orderBy(legalOrganizations.name);
  }

  async searchLegalOrganizations(query: string): Promise<LegalOrganization[]> {
    return await db
      .select()
      .from(legalOrganizations)
      .where(like(legalOrganizations.name, `%${query}%`))
      .orderBy(legalOrganizations.name)
      .limit(10);
  }

  async createLegalOrganization(orgData: InsertLegalOrganization): Promise<LegalOrganization> {
    const [organization] = await db
      .insert(legalOrganizations)
      .values(orgData)
      .returning();
    return organization;
  }

  async getLegalOrganizationById(id: number): Promise<LegalOrganization | undefined> {
    const [organization] = await db
      .select()
      .from(legalOrganizations)
      .where(eq(legalOrganizations.id, id));
    return organization;
  }

  // Case operations
  async createCase(caseData: InsertCase): Promise<Case> {
    const [newCase] = await db
      .insert(cases)
      .values(caseData)
      .returning();
    return newCase;
  }

  async getCasesByUserId(userId: string): Promise<(Case & { roles: Role[]; documentCount: number; totalFileSize: number })[]> {
    const result = await db
      .select({
        id: cases.id,
        caseNumber: cases.caseNumber,
        title: cases.title,
        createdById: cases.createdById,
        status: cases.status,
        createdAt: cases.createdAt,
        updatedAt: cases.updatedAt,
        roles: caseUsers.roles,
        documentCount: sql<number>`COUNT(DISTINCT ${documents.id})`,
        totalFileSize: sql<number>`COALESCE(SUM(${documents.fileSize}), 0)`,
      })
      .from(cases)
      .innerJoin(caseUsers, eq(caseUsers.caseId, cases.id))
      .leftJoin(documents, eq(documents.caseId, cases.id))
      .where(eq(caseUsers.userId, userId))
      .groupBy(cases.id, caseUsers.roles)
      .orderBy(desc(cases.createdAt));

    return result.map(row => ({
      ...row,
      title: row.title || 'Untitled Case', // Provide default for old cases
      documentCount: Number(row.documentCount) || 0,
      totalFileSize: Number(row.totalFileSize) || 0,
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

  async getUserRolesInCase(userId: string, caseId: number): Promise<Role[]> {
    const [result] = await db
      .select({ roles: caseUsers.roles })
      .from(caseUsers)
      .where(and(eq(caseUsers.userId, userId), eq(caseUsers.caseId, caseId)));
    return result?.roles || [];
  }

  // Case user operations
  async updateCaseTitle(caseId: number, title: string): Promise<Case> {
    const [updatedCase] = await db
      .update(cases)
      .set({ title, updatedAt: new Date() })
      .where(eq(cases.id, caseId))
      .returning();
    return updatedCase;
  }

  async addUserToCase(caseUser: InsertCaseUser): Promise<CaseUser> {
    const [newCaseUser] = await db
      .insert(caseUsers)
      .values(caseUser)
      .returning();
    return newCaseUser;
  }

  async getCaseMembers(caseId: number): Promise<(CaseUser & { user: User })[]> {
    return await db
      .select({
        id: caseUsers.id,
        caseId: caseUsers.caseId,
        userId: caseUsers.userId,
        roles: caseUsers.roles,
        createdAt: caseUsers.createdAt,
        user: users,
      })
      .from(caseUsers)
      .innerJoin(users, eq(caseUsers.userId, users.id))
      .where(eq(caseUsers.caseId, caseId))
      .orderBy(caseUsers.createdAt);
  }

  async removeUserFromCase(caseId: number, userId: string): Promise<void> {
    await db
      .delete(caseUsers)
      .where(and(eq(caseUsers.caseId, caseId), eq(caseUsers.userId, userId)));
  }

  async updateUserRolesInCase(caseId: number, userId: string, roles: Role[]): Promise<CaseUser> {
    const [updatedCaseUser] = await db
      .update(caseUsers)
      .set({ roles })
      .where(and(eq(caseUsers.caseId, caseId), eq(caseUsers.userId, userId)))
      .returning();
    return updatedCaseUser;
  }

  async getCaseTotalFileSize(caseId: number): Promise<number> {
    const result = await db
      .select({ totalSize: sql<number>`SUM(${documents.fileSize})` })
      .from(documents)
      .where(eq(documents.caseId, caseId));
    
    return result[0]?.totalSize || 0;
  }

  // Case invitation operations
  async createCaseInvitation(invitation: InsertCaseInvitation): Promise<CaseInvitation> {
    const [newInvitation] = await db
      .insert(caseInvitations)
      .values(invitation)
      .returning();
    return newInvitation;
  }

  async getCaseInvitations(caseId: number): Promise<CaseInvitation[]> {
    return await db
      .select()
      .from(caseInvitations)
      .where(eq(caseInvitations.caseId, caseId))
      .orderBy(desc(caseInvitations.createdAt));
  }

  async getInvitationByToken(token: string): Promise<CaseInvitation | undefined> {
    const [invitation] = await db
      .select()
      .from(caseInvitations)
      .where(eq(caseInvitations.token, token));
    return invitation;
  }

  async acceptCaseInvitation(token: string, userId: string): Promise<CaseUser | null> {
    const invitation = await this.getInvitationByToken(token);
    if (!invitation || invitation.status !== 'pending' || invitation.expiresAt < new Date()) {
      return null;
    }

    // Add user to case
    const caseUser = await this.addUserToCase({
      caseId: invitation.caseId,
      userId: userId,
      roles: invitation.roles,
    });

    // Mark invitation as accepted
    await db
      .update(caseInvitations)
      .set({ 
        status: 'accepted',
        acceptedAt: new Date()
      })
      .where(eq(caseInvitations.id, invitation.id));

    return caseUser;
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
      bankAbbreviation?: string;
      accountNumber?: string;
      bsbSortCode?: string;
      transactionDateFrom?: Date;
      transactionDateTo?: Date;
      documentNumber?: string;
      accountGroupNumber?: string;
      displayName?: string;
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

  async updateDocumentStatus(documentId: number, status: string): Promise<Document> {
    const [updatedDocument] = await db
      .update(documents)
      .set({ 
        status: status as any,
        updatedAt: new Date()
      })
      .where(eq(documents.id, documentId))
      .returning();
    return updatedDocument;
  }

  async getDocumentsForDisclosee(caseId: number): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.caseId, caseId),
          eq(documents.status, 'REVIEWED')
        )
      )
      .orderBy(desc(documents.createdAt));
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

  async updateDocumentWithAIExtraction(
    documentId: number, 
    data: {
      accountHolderName?: string;
      accountName?: string;
      financialInstitution?: string;
      accountNumber?: string;
      bsbSortCode?: string;
      transactionDateFrom?: string;
      transactionDateTo?: string;
      documentNumber?: string;
      accountGroupNumber?: string;
      aiProcessed?: boolean;
      fullAnalysisCompleted?: boolean;
      processingError?: string;
      csvPath?: string;
      csvRowCount?: number;
      csvGenerated?: boolean;
      xmlPath?: string;
      xmlAnalysisData?: string;
    }
  ): Promise<void> {
    const updateData: any = {
      ...data,
      updatedAt: new Date(),
    };
    
    // Convert date strings to Date objects if they exist
    if (data.transactionDateFrom) {
      updateData.transactionDateFrom = new Date(data.transactionDateFrom);
    }
    if (data.transactionDateTo) {
      updateData.transactionDateTo = new Date(data.transactionDateTo);
    }
    
    await db
      .update(documents)
      .set(updateData)
      .where(eq(documents.id, documentId));
  }

  async deleteCase(id: number): Promise<void> {
    // Delete case users first (foreign key constraint)
    await db.delete(caseUsers).where(eq(caseUsers.caseId, id));
    
    // Delete all documents in the case
    await db.delete(documents).where(eq(documents.caseId, id));
    
    // Delete disclosure PDFs in the case
    await db.delete(disclosurePdfs).where(eq(disclosurePdfs.caseId, id));
    
    // Delete the case itself
    await db.delete(cases).where(eq(cases.id, id));
  }

  // Disclosure PDF operations
  async createDisclosurePdf(disclosurePdf: InsertDisclosurePdf): Promise<DisclosurePdf> {
    const [newDisclosurePdf] = await db
      .insert(disclosurePdfs)
      .values(disclosurePdf)
      .returning();
    return newDisclosurePdf;
  }

  async getDisclosurePdfsByCase(caseId: number): Promise<DisclosurePdf[]> {
    return await db
      .select()
      .from(disclosurePdfs)
      .where(eq(disclosurePdfs.caseId, caseId))
      .orderBy(desc(disclosurePdfs.generatedAt));
  }

  async getLatestDisclosurePdf(caseId: number): Promise<DisclosurePdf | undefined> {
    const [latestPdf] = await db
      .select()
      .from(disclosurePdfs)
      .where(eq(disclosurePdfs.caseId, caseId))
      .orderBy(desc(disclosurePdfs.generatedAt))
      .limit(1);
    return latestPdf;
  }

  // Activity log operations
  async createActivityLog(activity: InsertActivityLog): Promise<ActivityLog> {
    const [newActivity] = await db
      .insert(activityLog)
      .values(activity)
      .returning();
    return newActivity;
  }

  async getRecentActivity(limit: number = 10): Promise<(ActivityLog & { user: User; case: Case })[]> {
    const activities = await db
      .select({
        id: activityLog.id,
        caseId: activityLog.caseId,
        userId: activityLog.userId,
        action: activityLog.action,
        description: activityLog.description,
        metadata: activityLog.metadata,
        createdAt: activityLog.createdAt,
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
        },
        case: {
          id: cases.id,
          caseNumber: cases.caseNumber,
          title: cases.title,
          createdById: cases.createdById,
          status: cases.status,
          createdAt: cases.createdAt,
          updatedAt: cases.updatedAt,
        }
      })
      .from(activityLog)
      .innerJoin(users, eq(activityLog.userId, users.id))
      .innerJoin(cases, eq(activityLog.caseId, cases.id))
      .orderBy(desc(activityLog.createdAt))
      .limit(limit);

    return activities as (ActivityLog & { user: User; case: Case })[];
  }

}

export const storage = new DatabaseStorage();
