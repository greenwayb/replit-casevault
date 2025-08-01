import { db } from "./db";
import { documents } from "@shared/schema";
import { eq, and, like } from "drizzle-orm";

export class DocumentNumberingService {
  /**
   * Generate hierarchical number for banking documents
   * Banking follows B1, B2, B3... for each new account holder
   * Documents under same account holder get B1.1, B1.2, etc.
   */
  static async generateBankingNumber(
    caseId: number, 
    accountHolderName: string
  ): Promise<{ groupNumber: string; documentNumber: string }> {
    // Get all banking documents for this case
    const existingDocs = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.caseId, caseId),
          eq(documents.category, 'BANKING')
        )
      );

    // Find existing group for this account holder
    const existingGroupDoc = existingDocs.find(doc => 
      doc.accountHolderName === accountHolderName && doc.accountGroupNumber
    );

    let groupNumber: string;
    
    if (existingGroupDoc) {
      // Use existing group number
      groupNumber = existingGroupDoc.accountGroupNumber!;
    } else {
      // Create new group number (B1, B2, B3...)
      const existingGroupNumbers = existingDocs
        .map(doc => doc.accountGroupNumber)
        .filter(Boolean)
        .map(num => parseInt(num!.replace('B', '')))
        .sort((a, b) => a - b);

      const nextGroupNum = existingGroupNumbers.length > 0 
        ? Math.max(...existingGroupNumbers) + 1 
        : 1;
      
      groupNumber = `B${nextGroupNum}`;
    }

    // Find next document number within this group
    const groupDocs = existingDocs.filter(doc => 
      doc.accountGroupNumber === groupNumber
    );
    
    const existingDocNumbers = groupDocs
      .map(doc => doc.documentNumber)
      .filter(Boolean)
      .map(num => {
        const parts = num!.split('.');
        return parts.length > 1 ? parseInt(parts[1]) : 0;
      })
      .sort((a, b) => a - b);

    const nextDocNum = existingDocNumbers.length > 0 
      ? Math.max(...existingDocNumbers) + 1 
      : 1;

    const documentNumber = `${groupNumber}.${nextDocNum}`;

    return { groupNumber, documentNumber };
  }

  /**
   * Generate simple sequential number for other categories
   */
  static async generateStandardNumber(
    caseId: number, 
    category: string
  ): Promise<string> {
    const categoryPrefix = this.getCategoryPrefix(category);
    
    // Get existing documents for this category in this case
    const existingDocs = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.caseId, caseId),
          eq(documents.category, category as any)
        )
      );

    const existingNumbers = existingDocs
      .map(doc => doc.documentNumber)
      .filter(Boolean)
      .map(num => parseInt(num!.replace(categoryPrefix, '')))
      .sort((a, b) => a - b);

    const nextNum = existingNumbers.length > 0 
      ? Math.max(...existingNumbers) + 1 
      : 1;

    return `${categoryPrefix}${nextNum}`;
  }

  /**
   * Get category prefix for hierarchical numbering
   */
  private static getCategoryPrefix(category: string): string {
    const prefixMap: Record<string, string> = {
      'REAL_PROPERTY': 'A',
      'BANKING': 'B',
      'TAXATION': 'C',
      'SUPERANNUATION': 'D',
      'EMPLOYMENT': 'E',
      'SHARES_INVESTMENTS': 'F',
      'VEHICLES': 'G'
    };
    
    return prefixMap[category] || 'X';
  }

  /**
   * Generate display name for banking documents
   */
  static generateBankingDisplayName(
    documentNumber: string,
    bankAbbreviation: string,
    accountNumber: string
  ): string {
    const lastFour = accountNumber ? accountNumber.slice(-4) : 'XXXX';
    return `${documentNumber} ${bankAbbreviation} ${lastFour}`;
  }

  /**
   * Generate display name for non-banking documents
   */
  static generateStandardDisplayName(
    documentNumber: string,
    originalName: string
  ): string {
    // Remove file extension from original name for display
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
    return `${documentNumber} ${nameWithoutExt}`;
  }
}