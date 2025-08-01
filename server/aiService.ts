import OpenAI from "openai";
import fs from "fs";
import path from "path";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface BankingDocumentAnalysis {
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
    // Read the PDF file as base64
    const fileBuffer = fs.readFileSync(filePath);
    const base64File = fileBuffer.toString('base64');

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: `You are a financial document analysis expert. Analyze banking documents and extract key information. 
          
          Return a JSON response with the following structure:
          {
            "accountName": "string - A descriptive name for the account (e.g., 'Main Business Account', 'Savings Account', 'Transaction Account')",
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
          content: [
            {
              type: "text",
              text: "Please analyze this banking document and extract the key information according to the schema provided."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:application/pdf;base64,${base64File}`
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    const analysisResult = JSON.parse(response.choices[0].message.content || '{}');
    
    // Validate and normalize the response
    return {
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
  const prefix = category === 'BANKING' ? 'B' : 'RP';
  return `${prefix}${accountGroupNumber}.${documentSequence}`;
}

export function generateAccountGroupNumber(existingGroups: string[], accountName: string): string {
  // Find the highest existing number for this category
  const bankingGroups = existingGroups.filter(group => group.startsWith('B'));
  const numbers = bankingGroups.map(group => {
    const match = group.match(/^B(\d+)$/);
    return match ? parseInt(match[1]) : 0;
  });
  
  const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  return `${nextNumber}`;
}

export async function generateCSVFromPDF(filePath: string, documentId: number): Promise<CSVGenerationResult> {
  try {
    // Read the PDF file as base64
    const fileBuffer = fs.readFileSync(filePath);
    const base64File = fileBuffer.toString('base64');

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
          content: [
            {
              type: "text",
              text: "Please extract tabular data from this financial document and convert it to CSV format."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:application/pdf;base64,${base64File}`
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 4000,
    });

    const extractionResult = JSON.parse(response.choices[0].message.content || '{}');
    
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