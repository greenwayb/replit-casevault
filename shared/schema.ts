import { sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
  pgEnum,
  integer,
  serial,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Bank abbreviations lookup table for consistency
export const bankAbbreviations = pgTable("bank_abbreviations", {
  id: serial("id").primaryKey(),
  fullName: varchar("full_name").notNull().unique(),
  abbreviation: varchar("abbreviation").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const roleEnum = pgEnum('role', ['DISCLOSER', 'REVIEWER', 'DISCLOSEE', 'CASEADMIN']);
export const caseStatusEnum = pgEnum('case_status', ['ACTIVE', 'UNDER_REVIEW', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED']);
export const categoryEnum = pgEnum('category', ['REAL_PROPERTY', 'BANKING', 'TAXATION', 'SUPERANNUATION', 'EMPLOYMENT', 'SHARES_INVESTMENTS', 'VEHICLES']);

export const cases = pgTable("cases", {
  id: serial("id").primaryKey(),
  caseNumber: varchar("case_number").notNull().unique(),
  title: varchar("title").default('Untitled Case'), // Case title like "Smith J & Smith M"
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  status: caseStatusEnum("status").default('ACTIVE'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const caseUsers = pgTable("case_users", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull().references(() => cases.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: roleEnum("role").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull().references(() => cases.id, { onDelete: 'cascade' }),
  filename: varchar("filename").notNull(),
  originalName: varchar("original_name").notNull(),
  category: categoryEnum("category").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: varchar("mime_type").notNull(),
  uploadedById: varchar("uploaded_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  
  // AI-extracted banking information
  accountHolderName: varchar("account_holder_name", { length: 255 }),
  accountName: varchar("account_name", { length: 255 }),
  financialInstitution: varchar("financial_institution", { length: 255 }),
  bankAbbreviation: varchar("bank_abbreviation", { length: 10 }), // Store the abbreviation used
  accountNumber: varchar("account_number", { length: 100 }),
  bsbSortCode: varchar("bsb_sort_code", { length: 20 }),
  transactionDateFrom: timestamp("transaction_date_from"),
  transactionDateTo: timestamp("transaction_date_to"),
  displayName: varchar("display_name"), // Formatted display name (e.g., "B1 CBA 1234")
  
  // Hierarchical numbering
  documentNumber: varchar("document_number", { length: 50 }), // e.g., "B1.1", "B1.2", "RP1.1"
  accountGroupNumber: varchar("account_group_number", { length: 20 }), // e.g., "B1", "B2"
  
  // Processing status
  aiProcessed: boolean("ai_processed").default(false),
  processingError: text("processing_error"),
  
  // CSV generation information
  csvPath: varchar("csv_path", { length: 255 }), // Path to generated CSV file
  csvRowCount: integer("csv_row_count").default(0),
  csvGenerated: boolean("csv_generated").default(false),
});

// Disclosure PDFs table
export const disclosurePdfs = pgTable("disclosure_pdfs", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull().references(() => cases.id, { onDelete: 'cascade' }),
  filename: varchar("filename").notNull(),
  generatedById: varchar("generated_by_id").notNull().references(() => users.id),
  generatedAt: timestamp("generated_at").defaultNow(),
  documentCount: integer("document_count").notNull(),
  // Store the cutoff date - documents added after this date will be marked as new
  lastGeneratedAt: timestamp("last_generated_at"),
});

// Activity log table
export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull().references(() => cases.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id),
  action: varchar("action").notNull(), // 'document_uploaded', 'document_deleted', 'case_created', etc.
  description: text("description").notNull(),
  metadata: jsonb("metadata"), // Store additional data like document info
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  createdCases: many(cases),
  caseUsers: many(caseUsers),
  uploadedDocuments: many(documents),
}));

export const casesRelations = relations(cases, ({ one, many }) => ({
  createdBy: one(users, { fields: [cases.createdById], references: [users.id] }),
  caseUsers: many(caseUsers),
  documents: many(documents),
  disclosurePdfs: many(disclosurePdfs),
}));

export const caseUsersRelations = relations(caseUsers, ({ one }) => ({
  case: one(cases, { fields: [caseUsers.caseId], references: [cases.id] }),
  user: one(users, { fields: [caseUsers.userId], references: [users.id] }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  case: one(cases, { fields: [documents.caseId], references: [cases.id] }),
  uploadedBy: one(users, { fields: [documents.uploadedById], references: [users.id] }),
}));

export const disclosurePdfsRelations = relations(disclosurePdfs, ({ one }) => ({
  case: one(cases, { fields: [disclosurePdfs.caseId], references: [cases.id] }),
  generatedBy: one(users, { fields: [disclosurePdfs.generatedById], references: [users.id] }),
}));

// Schemas
export const insertCaseSchema = createInsertSchema(cases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  caseNumber: z.string().min(1, "Case number is required").max(100, "Case number too long"),
  title: z.string().min(1, "Case title is required").max(200, "Case title too long")
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
});

export const insertCaseUserSchema = createInsertSchema(caseUsers).omit({
  id: true,
  createdAt: true,
});

export const insertDisclosurePdfSchema = createInsertSchema(disclosurePdfs).omit({
  id: true,
  generatedAt: true,
});

export const insertActivityLogSchema = createInsertSchema(activityLog).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type BankAbbreviation = typeof bankAbbreviations.$inferSelect;
export type InsertBankAbbreviation = typeof bankAbbreviations.$inferInsert;
export type Case = typeof cases.$inferSelect;
export type InsertCase = z.infer<typeof insertCaseSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type CaseUser = typeof caseUsers.$inferSelect;
export type InsertCaseUser = z.infer<typeof insertCaseUserSchema>;
export type DisclosurePdf = typeof disclosurePdfs.$inferSelect;
export type InsertDisclosurePdf = z.infer<typeof insertDisclosurePdfSchema>;
export type ActivityLog = typeof activityLog.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type Role = 'DISCLOSER' | 'REVIEWER' | 'DISCLOSEE' | 'CASEADMIN';
export type CaseStatus = 'ACTIVE' | 'UNDER_REVIEW' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';
export type Category = 'REAL_PROPERTY' | 'BANKING' | 'TAXATION' | 'SUPERANNUATION' | 'EMPLOYMENT' | 'SHARES_INVESTMENTS' | 'VEHICLES';
