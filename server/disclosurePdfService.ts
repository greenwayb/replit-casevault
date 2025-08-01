import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, User, Case, DisclosurePdf } from '@shared/schema';
import { format } from 'date-fns';
import path from 'path';
import fs from 'fs/promises';

interface DocumentWithUser extends Document {
  uploadedBy: User;
}

interface DisclosureDocumentRow {
  isNew: boolean;
  category: string;
  hierarchicalNumber: string;
  description: string;
  dated: string;
  dateDisclosedToOP: string;
}

export class DisclosurePdfService {
  private static formatDate(date: Date | null): string {
    if (!date) return 'undated';
    return format(date, 'dd.MM.yyyy');
  }

  private static formatDateRange(from: Date | null, to: Date | null): string {
    if (!from && !to) return 'undated';
    if (!from) return `until ${this.formatDate(to)}`;
    if (!to) return `from ${this.formatDate(from)}`;
    if (from.getTime() === to.getTime()) return this.formatDate(from);
    return `${this.formatDate(from)} – ${this.formatDate(to)}`;
  }

  private static generateHierarchicalNumbers(documents: DocumentWithUser[]): Map<number, string> {
    const numberMap = new Map<number, string>();
    
    // Group documents by category
    const realPropertyDocs = documents.filter(d => d.category === 'REAL_PROPERTY');
    const bankingDocs = documents.filter(d => d.category === 'BANKING');
    
    // Real Property numbering (A1, A2, etc.)
    realPropertyDocs.forEach((doc, index) => {
      numberMap.set(doc.id, `A${index + 1}`);
    });
    
    // Banking numbering with account holder grouping
    const accountHolders = new Map<string, DocumentWithUser[]>();
    bankingDocs.forEach(doc => {
      const key = doc.accountHolderName || 'Unknown Account Holder';
      if (!accountHolders.has(key)) {
        accountHolders.set(key, []);
      }
      accountHolders.get(key)!.push(doc);
    });
    
    let accountGroupIndex = 1;
    accountHolders.forEach((docs, accountHolder) => {
      const baseNumber = `B${accountGroupIndex}`;
      
      // Group by financial institution within account holder
      const institutions = new Map<string, DocumentWithUser[]>();
      docs.forEach(doc => {
        const inst = doc.financialInstitution || 'Miscellaneous Banking';
        if (!institutions.has(inst)) {
          institutions.set(inst, []);
        }
        institutions.get(inst)!.push(doc);
      });
      
      let subGroupIndex = 1;
      institutions.forEach((instDocs, institution) => {
        const subGroupNumber = `${baseNumber}.${subGroupIndex}`;
        
        instDocs.forEach((doc, docIndex) => {
          numberMap.set(doc.id, `${subGroupNumber}.${docIndex + 1}`);
        });
        
        subGroupIndex++;
      });
      
      accountGroupIndex++;
    });
    
    return numberMap;
  }

  private static createDisclosureRows(
    documents: DocumentWithUser[], 
    hierarchicalNumbers: Map<number, string>,
    lastGeneratedAt: Date | null
  ): DisclosureDocumentRow[] {
    const rows: DisclosureDocumentRow[] = [];
    
    // Group documents by category for structured display
    const realPropertyDocs = documents.filter(d => d.category === 'REAL_PROPERTY');
    const bankingDocs = documents.filter(d => d.category === 'BANKING');
    
    // Add Real Property section
    if (realPropertyDocs.length > 0) {
      rows.push({
        isNew: false,
        category: 'A',
        hierarchicalNumber: 'A',
        description: 'REAL PROPERTY',
        dated: '',
        dateDisclosedToOP: ''
      });
      
      realPropertyDocs.forEach(doc => {
        const isNew = lastGeneratedAt ? doc.createdAt > lastGeneratedAt : false;
        rows.push({
          isNew,
          category: 'A',
          hierarchicalNumber: hierarchicalNumbers.get(doc.id) || '',
          description: doc.originalName,
          dated: this.formatDate(doc.createdAt),
          dateDisclosedToOP: this.formatDate(new Date())
        });
      });
    }
    
    // Add Banking section
    if (bankingDocs.length > 0) {
      rows.push({
        isNew: false,
        category: 'B',
        hierarchicalNumber: 'B',
        description: 'BANKING',
        dated: '',
        dateDisclosedToOP: ''
      });
      
      // Group by account holder
      const accountHolders = new Map<string, DocumentWithUser[]>();
      bankingDocs.forEach(doc => {
        const key = doc.accountHolderName || 'Unknown Account Holder';
        if (!accountHolders.has(key)) {
          accountHolders.set(key, []);
        }
        accountHolders.get(key)!.push(doc);
      });
      
      let accountGroupIndex = 1;
      accountHolders.forEach((docs, accountHolder) => {
        const baseNumber = `B${accountGroupIndex}`;
        
        // Add account holder row
        rows.push({
          isNew: false,
          category: 'B',
          hierarchicalNumber: baseNumber,
          description: accountHolder,
          dated: '',
          dateDisclosedToOP: ''
        });
        
        // Group by financial institution
        const institutions = new Map<string, DocumentWithUser[]>();
        docs.forEach(doc => {
          const inst = doc.financialInstitution || 'Miscellaneous Banking';
          if (!institutions.has(inst)) {
            institutions.set(inst, []);
          }
          institutions.get(inst)!.push(doc);
        });
        
        let subGroupIndex = 1;
        institutions.forEach((instDocs, institution) => {
          const subGroupNumber = `${baseNumber}.${subGroupIndex}`;
          
          // Add institution header if multiple institutions exist
          if (institutions.size > 1) {
            rows.push({
              isNew: false,
              category: 'B',
              hierarchicalNumber: subGroupNumber,
              description: institution,
              dated: '',
              dateDisclosedToOP: ''
            });
          }
          
          instDocs.forEach(doc => {
            const isNew = lastGeneratedAt ? doc.createdAt > lastGeneratedAt : false;
            const description = doc.accountNumber 
              ? `${doc.originalName} - Account Ending ${doc.accountNumber.slice(-4)}`
              : doc.originalName;
            
            const dated = doc.transactionDateFrom && doc.transactionDateTo
              ? this.formatDateRange(doc.transactionDateFrom, doc.transactionDateTo)
              : this.formatDate(doc.createdAt);
            
            rows.push({
              isNew,
              category: 'B',
              hierarchicalNumber: hierarchicalNumbers.get(doc.id) || '',
              description,
              dated,
              dateDisclosedToOP: this.formatDate(new Date())
            });
          });
          
          subGroupIndex++;
        });
        
        accountGroupIndex++;
      });
    }
    
    return rows;
  }

  static async generateDisclosurePdf(
    caseData: Case & { createdBy: User },
    documents: DocumentWithUser[],
    lastGeneratedAt: Date | null
  ): Promise<{ filename: string; filePath: string }> {
    const pdf = new jsPDF();
    const currentDate = format(new Date(), 'dd MMMM yyyy');
    
    // Add logo in top right corner
    try {
      const logoPath = path.join(process.cwd(), 'attached_assets', 'FamilyCourtDoco-Asset_1754059270273.png');
      const logoExists = await fs.access(logoPath).then(() => true).catch(() => false);
      
      if (logoExists) {
        const logoBuffer = await fs.readFile(logoPath);
        const logoBase64 = logoBuffer.toString('base64');
        const logoDataUrl = `data:image/png;base64,${logoBase64}`;
        
        // Add logo in top right corner
        pdf.addImage(logoDataUrl, 'PNG', 160, 10, 30, 30);
      }
    } catch (error) {
      console.warn('Could not load logo for PDF:', error);
    }
    
    // Set up colors and fonts
    const navyBlue = [41, 59, 100];
    const lightGray = [245, 245, 245];
    
    // Header with Family Court Doco branding
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`List of Disclosure Documents - ${caseData.createdBy.firstName?.toUpperCase()} ${caseData.createdBy.lastName?.toUpperCase()}`, 20, 30);
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`as at ${currentDate}`, 20, 40);
    
    // Legal notice
    pdf.setFontSize(9);
    pdf.text('New items are denoted with an *', 20, 55);
    pdf.text('Documents disclosed pursuant to Rule 216(2)(a) of the Family Court Rules 2021 (WA)', 20, 62);
    pdf.text('Documents to which the duty of disclosure applies', 20, 69);
    
    // Generate hierarchical numbers and rows
    const hierarchicalNumbers = this.generateHierarchicalNumbers(documents);
    const rows = this.createDisclosureRows(documents, hierarchicalNumbers, lastGeneratedAt);
    
    // Create table data
    const tableData = rows.map(row => [
      row.isNew ? '*' : '',
      row.hierarchicalNumber,
      row.description,
      row.dated,
      row.dateDisclosedToOP
    ]);
    
    // Generate table
    autoTable(pdf, {
      startY: 80,
      head: [['NEW', 'Item', 'Description', 'Dated', 'Date disclosed to OP']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: navyBlue,
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 2
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' }, // NEW column
        1: { cellWidth: 15, halign: 'center' }, // Item column
        2: { cellWidth: 100 }, // Description column
        3: { cellWidth: 35 }, // Dated column
        4: { cellWidth: 25 } // Date disclosed column
      },
      alternateRowStyles: {
        fillColor: lightGray
      },
      styles: {
        lineColor: navyBlue,
        lineWidth: 0.1
      },
      didParseCell: function(data) {
        // Style category headers (A, B)
        if (data.section === 'body') {
          const rowData = rows[data.row.index];
          if (rowData && (rowData.hierarchicalNumber === 'A' || rowData.hierarchicalNumber === 'B')) {
            data.cell.styles.fillColor = navyBlue;
            data.cell.styles.textColor = 255;
            data.cell.styles.fontStyle = 'bold';
          }
          // Style account holder rows (B1, B2, etc.)
          else if (rowData && /^B\d+$/.test(rowData.hierarchicalNumber)) {
            data.cell.styles.fillColor = [200, 200, 200];
            data.cell.styles.fontStyle = 'bold';
          }
          // Style institution rows (B1.1, B1.2, etc.)
          else if (rowData && /^B\d+\.\d+$/.test(rowData.hierarchicalNumber) && !rowData.dated) {
            data.cell.styles.fillColor = [230, 230, 230];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });
    
    // Add page numbers
    const pageCount = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.text(`Page ${i} of ${pageCount}`, 180, 285);
    }
    
    // Save PDF
    const filename = `disclosure-${caseData.caseNumber}-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.pdf`;
    const uploadsDir = path.join(process.cwd(), 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    const filePath = path.join(uploadsDir, filename);
    
    // Write PDF to file
    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));
    await fs.writeFile(filePath, pdfBuffer);
    
    return { filename, filePath };
  }
}