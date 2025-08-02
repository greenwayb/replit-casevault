import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface BankingDocumentAnalysis {
  accountHolderName: string;
  accountName: string;
  financialInstitution: string;
  accountNumber?: string;
  bsbSortCode?: string;
  transactionDateFrom?: string;
  transactionDateTo?: string;
  confidence: number;
}

export interface CSVGenerationResult {
  csvPath: string;
  csvContent: string;
  rowCount: number;
}

export async function analyzeBankingDocument(filePath: string): Promise<BankingDocumentAnalysis> {
  try {
    // Read and parse the PDF file to extract text
    const fileBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(fileBuffer);
    const pdfText = pdfData.text;

    if (!pdfText || pdfText.trim().length === 0) {
      throw new Error("Could not extract text from PDF");
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: `You are a financial document analysis expert. Analyze banking documents and extract key information. 
          
          IMPORTANT: Extract the account holder's actual name (person or company name), not the account type.
          
          Return a JSON response with the following structure:
          {
            "accountHolderName": "string - The actual name of the person/company who owns the account",
            "accountName": "string - A descriptive name for the account type (e.g., 'Main Business Account', 'Savings Account', 'Transaction Account')",
            "financialInstitution": "string - Name of the bank or financial institution",
            "accountNumber": "string - Account number if visible (partial masking is ok)",
            "bsbSortCode": "string - BSB, sort code, or routing number if visible",
            "transactionDateFrom": "YYYY-MM-DD - Start date of transaction period if visible",
            "transactionDateTo": "YYYY-MM-DD - End date of transaction period if visible",
            "confidence": "number between 0 and 1 - How confident you are in the extracted information"
          }
          
          If you cannot determine a specific field, use null for that field. Be conservative with confidence scores.
          For accountName, create a descriptive name even if not explicitly stated (e.g., "Business Transaction Account" for a business statement).`
        },
        {
          role: "user",
          content: `Please analyze this banking document text and extract the key information according to the schema provided. Here is the document text:

${pdfText}`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    const analysisResult = JSON.parse(response.choices[0].message.content || '{}');
    
    // Validate and normalize the response
    return {
      accountHolderName: normalizeAccountHolderName(analysisResult.accountHolderName || 'Unknown Holder'),
      accountName: analysisResult.accountName || 'Unknown Account',
      financialInstitution: analysisResult.financialInstitution || 'Unknown Institution',
      accountNumber: analysisResult.accountNumber || undefined,
      bsbSortCode: analysisResult.bsbSortCode || undefined,
      transactionDateFrom: analysisResult.transactionDateFrom || undefined,
      transactionDateTo: analysisResult.transactionDateTo || undefined,
      confidence: Math.min(Math.max(analysisResult.confidence || 0.5, 0), 1)
    };
  } catch (error) {
    console.error('Error analyzing banking document:', error);
    throw new Error(`Failed to analyze document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function generateDocumentNumber(
  category: 'BANKING' | 'REAL_PROPERTY',
  accountGroupNumber: string,
  documentSequence: number
): string {
  // accountGroupNumber already includes the prefix (e.g., "B1")
  return `${accountGroupNumber}.${documentSequence}`;
}

// Helper function to normalize account holder names
function normalizeAccountHolderName(name: string): string {
  // Remove common titles (case insensitive)
  const titles = ['mr', 'mrs', 'miss', 'ms', 'dr', 'prof', 'professor', 'sir', 'madam', 'lord', 'lady'];
  
  let normalized = name.trim();
  
  // Remove titles from the beginning of the name
  for (const title of titles) {
    const regex = new RegExp(`^${title}\\.?\\s+`, 'i');
    normalized = normalized.replace(regex, '');
  }
  
  // Convert to title case
  return normalized
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function generateAccountGroupNumber(existingGroups: string[], accountName: string): string {
  // Find the highest existing number for this category
  const bankingGroups = existingGroups.filter(group => group.startsWith('B'));
  const numbers = bankingGroups.map(group => {
    const match = group.match(/^B(\d+)$/);
    return match ? parseInt(match[1]) : 0;
  });
  
  const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  return `B${nextNumber}`;
}

export async function generateCSVFromPDF(filePath: string, documentId: number): Promise<CSVGenerationResult> {
  try {
    // Read and parse the PDF file to extract text
    const fileBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(fileBuffer);
    const pdfText = pdfData.text;

    if (!pdfText || pdfText.trim().length === 0) {
      throw new Error("Could not extract text from PDF");
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: `You are a financial document data extraction expert. Extract tabular data from banking documents and convert it to CSV format.

          For banking statements, extract transaction data with these columns:
          - Date (YYYY-MM-DD format)
          - Description 
          - Reference/Transaction_ID
          - Debit (negative amounts, leave blank if credit)
          - Credit (positive amounts, leave blank if debit)
          - Balance
          - Category (if determinable from description)

          For other financial documents, extract the most relevant tabular data available.

          Return a JSON response with:
          {
            "csvContent": "string - Complete CSV content with headers and data rows",
            "rowCount": "number - Number of data rows (excluding header)",
            "dataType": "string - Type of data extracted (e.g., 'transactions', 'summary', 'account_details')"
          }

          If no tabular data is found, return empty csvContent with rowCount 0.`
        },
        {
          role: "user",
          content: `Please extract tabular data from this financial document text and convert it to CSV format. Here is the document text:

${pdfText}`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 4000,
    });

    let extractionResult;
    try {
      const content = response.choices[0].message.content || '{}';
      // Clean up potential JSON formatting issues
      const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      extractionResult = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      console.error('Raw content:', response.choices[0].message.content);
      // Fallback to empty result
      extractionResult = { csvContent: '', rowCount: 0, dataType: 'parsing_error' };
    }
    
    // Generate CSV file path
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const csvFileName = `document_${documentId}_data.csv`;
    const csvPath = path.join(uploadsDir, csvFileName);
    
    // Write CSV content to file
    const csvContent = extractionResult.csvContent || '';
    if (csvContent) {
      fs.writeFileSync(csvPath, csvContent, 'utf8');
    }
    
    return {
      csvPath: csvContent ? csvFileName : '', // Store relative path
      csvContent,
      rowCount: extractionResult.rowCount || 0
    };
  } catch (error) {
    console.error('Error generating CSV from PDF:', error);
    throw new Error(`Failed to generate CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}