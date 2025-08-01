import OpenAI from "openai";
import { db } from "./db";
import { bankAbbreviations } from "@shared/schema";
import { eq } from "drizzle-orm";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class BankAbbreviationService {
  /**
   * Get or create a bank abbreviation for a given financial institution name
   * Uses AI to generate appropriate abbreviations for new banks
   */
  static async getOrCreateAbbreviation(bankName: string): Promise<string> {
    if (!bankName || bankName.trim() === '') {
      return 'UNKNOWN';
    }

    const cleanBankName = bankName.trim();
    
    // Check if we already have an abbreviation for this bank
    const [existingAbbreviation] = await db
      .select()
      .from(bankAbbreviations)
      .where(eq(bankAbbreviations.fullName, cleanBankName));

    if (existingAbbreviation) {
      return existingAbbreviation.abbreviation;
    }

    // Generate new abbreviation using AI
    try {
      const abbreviation = await this.generateAbbreviation(cleanBankName);
      
      // Store the new abbreviation for future consistency
      await db.insert(bankAbbreviations).values({
        fullName: cleanBankName,
        abbreviation: abbreviation
      });

      return abbreviation;
    } catch (error) {
      console.error('Error generating bank abbreviation:', error);
      // Fallback to a simple abbreviation if AI fails
      return this.generateFallbackAbbreviation(cleanBankName);
    }
  }

  /**
   * Use AI to generate an appropriate bank abbreviation
   */
  private static async generateAbbreviation(bankName: string): Promise<string> {
    const prompt = `Given the financial institution name "${bankName}", provide a commonly used, professional abbreviation that would be recognized in Australian financial contexts. The abbreviation should be 2-6 characters long and widely understood.

Examples:
- Commonwealth Bank of Australia -> CBA
- Australia and New Zealand Banking Group -> ANZ
- Westpac Banking Corporation -> WBC
- National Australia Bank -> NAB
- Bendigo and Adelaide Bank -> BEN
- ING Bank -> ING
- HSBC Bank Australia -> HSBC

Respond with only the abbreviation in uppercase, no explanation.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a financial abbreviation expert. Provide only the abbreviation, no explanation."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 10,
      temperature: 0.1
    });

    const abbreviation = response.choices[0].message.content?.trim().toUpperCase();
    
    if (!abbreviation || abbreviation.length > 6) {
      throw new Error('Invalid abbreviation generated');
    }

    return abbreviation;
  }

  /**
   * Generate a simple fallback abbreviation if AI fails
   */
  private static generateFallbackAbbreviation(bankName: string): string {
    // Extract first letters of major words, excluding common words
    const excludeWords = ['bank', 'banking', 'group', 'corporation', 'ltd', 'limited', 'australia', 'australian'];
    const words = bankName.toLowerCase().split(/\s+/).filter(word => 
      word.length > 1 && !excludeWords.includes(word)
    );
    
    if (words.length === 0) {
      return bankName.substring(0, 3).toUpperCase();
    }
    
    // Take first letter of each major word, up to 4 letters
    const abbreviation = words.slice(0, 4).map(word => word[0]).join('').toUpperCase();
    return abbreviation.length > 0 ? abbreviation : bankName.substring(0, 3).toUpperCase();
  }

  /**
   * Get all stored bank abbreviations
   */
  static async getAllAbbreviations(): Promise<Array<{ fullName: string; abbreviation: string }>> {
    return await db.select().from(bankAbbreviations);
  }
}