import { useState, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Download, FileText, BarChart3, Code2, TrendingUp, FileSpreadsheet, AlertTriangle, FileDown } from "lucide-react";
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Canvg } from 'canvg';
import logoPath from "@assets/FamilyCourtDoco-Asset_1754059270273.png";
import { BankingSankeyDiagram } from "./banking-sankey-diagram";
import { ClientSVGRenderer } from "@/lib/svgRenderer";
import { BankingJsonDisplay } from "./banking-json-display";
import { BankingTransactionChart } from "./banking-transaction-chart";
import { BankingTransactionsTable } from "./banking-transactions-table";

interface BankingDocumentTabsProps {
  document: any;
  pdfUrl: string;
  xmlData?: string;

  documentName: string;
  accountName?: string;
  onFullAnalysis?: () => void;
}

export default function BankingDocumentTabs({ 
  document, 
  pdfUrl, 
  xmlData, 

  documentName, 
  accountName,
  onFullAnalysis
}: BankingDocumentTabsProps) {
  const [activeTab, setActiveTab] = useState("pdf");
  const sankeyRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  
  // Check if full analysis is completed
  const isFullAnalysisComplete = document?.fullAnalysisCompleted && xmlData;
  const hasAnalysisError = document?.analysisError || document?.aiProcessingFailed;
  
  // Check if document has too many transactions (over 600)
  const transactionCount = document?.totalTransactions || 0;
  const hasTooManyTransactions = transactionCount > 600;

  const handleDownloadXML = () => {
    if (!xmlData) return;
    
    const blob = new Blob([xmlData], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${documentName}_analysis.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Extract bank information from XML
  const getBankInfo = () => {
    if (!xmlData) return null;
    
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlData, 'text/xml');
      
      const getElementText = (tagName: string) => {
        const element = xmlDoc.getElementsByTagName(tagName)[0];
        return element ? element.textContent?.trim() || '' : '';
      };

      const accountHolders = Array.from(xmlDoc.getElementsByTagName('account_holder')).map(
        el => el.textContent?.trim() || ''
      );
      
      return {
        institution: getElementText('institution'),
        accountHolders: accountHolders,
        accountNumber: getElementText('account_number'),
        accountType: getElementText('account_type'),
        bsb: getElementText('account_bsb'),
        startDate: getElementText('start_date'),
        endDate: getElementText('end_date'),
        currency: getElementText('currency'),
        totalCredits: getElementText('total_credits'),
        totalDebits: getElementText('total_debits')
      };
    } catch (error) {
      console.error('Error parsing XML for bank info:', error);
      return null;
    }
  };

  // Extract transactions data for queried transactions
  const getQueriedTransactions = async () => {
    try {
      const response = await fetch(`/api/transactions/${document.id}`);
      const transactions = await response.json();
      return transactions.filter((t: any) => t.status === 'query');
    } catch (error) {
      console.error('Error fetching queried transactions:', error);
      return [];
    }
  };

  // Function to add watermark to page
  const addWatermark = (doc: jsPDF) => {
    try {
      // Add Family Court Documentation logo watermark in top right
      doc.addImage(logoPath, 'PNG', doc.internal.pageSize.width - 50, 5, 40, 20);
    } catch (error) {
      // Fallback to text watermark if image fails
      console.log('Logo failed, using text watermark:', error);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(200, 200, 200); // Light gray
      doc.text('Family Court Documentation', doc.internal.pageSize.width - 60, 15);
      doc.setTextColor(0, 0, 0); // Reset to black
    }
  };

  // Enhanced function to capture SVG chart with server-side rendering
  const captureSVGChart = async (containerRef: React.RefObject<HTMLDivElement>, chartName: string): Promise<string | null> => {
    return await ClientSVGRenderer.captureChart(containerRef, chartName, {
      width: 800,
      height: 600,
      scale: 2, // High resolution for PDF
      quality: 95
    });
  };

  const handleExportAnalysisPDF = async () => {
    if (!xmlData || !isFullAnalysisComplete) return;

    console.log('Starting PDF export with enhanced server-side chart capture...');
    
    const doc = new jsPDF();
    const bankInfo = getBankInfo();
    
    // Attempt to capture charts with enhanced server-side rendering
    let sankeyImage: string | null = null;
    let chartImage: string | null = null;
    
    try {
      console.log('Attempting Sankey capture...');
      sankeyImage = await captureSVGChart(sankeyRef, 'Sankey');
      console.log('Sankey capture result:', sankeyImage ? 'SUCCESS' : 'FAILED');
    } catch (error) {
      console.log('Sankey capture failed:', error);
    }
    
    try {
      console.log('Attempting transaction chart capture...');
      chartImage = await captureSVGChart(chartRef, 'TransactionChart');
      console.log('Transaction chart capture result:', chartImage ? 'SUCCESS' : 'FAILED');
    } catch (error) {
      console.log('Transaction chart capture failed:', error);
    }
    
    // Page 1: Banking Information and Summary (Portrait)
    addWatermark(doc);
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Family Court Documentation', 20, 20);
    
    doc.setFontSize(14);
    doc.text('Banking Analysis Report', 20, 30);
    
    // Banking Information in two-column layout
    if (bankInfo) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Bank Account Information', 20, 50);
      
      // Draw border around banking info
      doc.setDrawColor(200, 200, 200);
      doc.rect(15, 55, 180, 60);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      
      // Left column
      const leftColumnInfo = [
        `Institution: ${bankInfo.institution || 'N/A'}`,
        `Account Number: ${bankInfo.accountNumber || 'N/A'}`,
        `Account Type: ${bankInfo.accountType || 'N/A'}`,
        `BSB: ${bankInfo.bsb || 'N/A'}`,
        `Currency: ${bankInfo.currency || 'N/A'}`
      ];
      
      // Right column
      const rightColumnInfo = [
        `Account Holders: ${bankInfo.accountHolders.length > 0 ? bankInfo.accountHolders.join(', ') : 'N/A'}`,
        `Statement Period: ${bankInfo.startDate || 'N/A'} to ${bankInfo.endDate || 'N/A'}`,
        `Total Credits: ${bankInfo.totalCredits || 'N/A'}`,
        `Total Debits: ${bankInfo.totalDebits || 'N/A'}`,
        ``
      ];
      
      let yPos = 65;
      leftColumnInfo.forEach((info, index) => {
        doc.text(info, 20, yPos);
        if (rightColumnInfo[index]) {
          doc.text(rightColumnInfo[index], 110, yPos);
        }
        yPos += 10;
      });
    }

    // Summary section
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlData, 'text/xml');
      const summaryElement = xmlDoc.querySelector('analysis_summary');
      const summary = summaryElement?.textContent?.trim();
      
      if (summary) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Analysis Summary', 20, 130);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const splitSummary = doc.splitTextToSize(summary, 170);
        doc.text(splitSummary, 20, 145);
      }
    } catch (error) {
      console.error('Error extracting summary:', error);
    }

    // Page 2: Sankey Diagram (Landscape)
    doc.addPage('a4', 'landscape');
    addWatermark(doc);
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Transaction Flow Analysis (Sankey Diagram)', 20, 20);
    
    if (sankeyImage) {
      // Add the captured Sankey diagram image
      try {
        console.log('Adding Sankey image to PDF...');
        doc.addImage(sankeyImage, 'PNG', 20, 40, 250, 150);
        console.log('Sankey image added successfully');
      } catch (error) {
        console.error('Error adding Sankey image to PDF:', error);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.text('Sankey diagram could not be rendered. Please view the Sankey tab for visualization.', 20, 40);
      }
    } else {
      // Add detailed explanation instead of image
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.text('Transaction Flow Analysis (Sankey Diagram)', 20, 40);
      doc.setFontSize(10);
      doc.text('The Sankey diagram visualizes the flow of money in and out of the account, showing:', 20, 55);
      doc.text('• Money coming into the account (inflows) from various sources', 25, 70);
      doc.text('• Money going out of the account (outflows) to different categories', 25, 80);
      doc.text('• The relative magnitude of each flow represented by connection thickness', 25, 90);
      doc.text('• Net position showing overall account activity', 25, 100);
      doc.text('Please view the Sankey tab in the application for the interactive visualization.', 20, 115);
    }

    // Page 3: Transaction Chart (Landscape)
    doc.addPage('a4', 'landscape');
    addWatermark(doc);
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Transaction Chart Analysis', 20, 20);
    
    if (chartImage) {
      // Add the captured transaction chart image
      try {
        console.log('Adding transaction chart image to PDF...');
        doc.addImage(chartImage, 'PNG', 20, 40, 250, 150);
        console.log('Transaction chart image added successfully');
      } catch (error) {
        console.error('Error adding chart image to PDF:', error);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.text('Transaction chart could not be rendered. Please view the Chart tab for visualization.', 20, 40);
      }
    } else {
      // Add detailed explanation instead of image
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.text('Transaction Chart Analysis', 20, 40);
      doc.setFontSize(10);
      doc.text('The transaction chart provides comprehensive account activity visualization showing:', 20, 55);
      doc.text('• Daily account balance trends over the statement period', 25, 70);
      doc.text('• Credit transactions (money in) as positive bars', 25, 80);
      doc.text('• Debit transactions (money out) as negative bars', 25, 90);
      doc.text('• Key financial events such as large deposits or withdrawals', 25, 100);
      doc.text('• Account balance line showing end-of-day positions', 25, 110);
      doc.text('Please view the Chart tab in the application for the interactive visualization.', 20, 125);
    }

    // Page 4: Queried Transactions (Portrait)
    doc.addPage('a4', 'portrait');
    addWatermark(doc);
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Queried Transactions', 20, 20);
    
    const queriedTransactions = await getQueriedTransactions();
    
    if (queriedTransactions.length > 0) {
      doc.setFontSize(12);
      doc.text(`Found ${queriedTransactions.length} queried transactions:`, 20, 35);
      
      let currentY = 50;
      
      queriedTransactions.forEach((transaction: any, index: number) => {
        if (currentY > 250) {
          doc.addPage();
          addWatermark(doc);
          currentY = 20;
        }
        
        // Transaction header
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(`Transaction ${index + 1}`, 20, currentY);
        currentY += 8;
        
        // Transaction details
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        
        const transactionDetails = [
          `Date: ${new Date(transaction.transactionDate).toLocaleDateString()}`,
          `Description: ${transaction.description}`,
          `Amount: ${transaction.amount}`,
          `Balance: ${transaction.balance || 'N/A'}`,
          `Category: ${transaction.category || 'N/A'}`
        ];
        
        transactionDetails.forEach(detail => {
          doc.text(detail, 25, currentY);
          currentY += 6;
        });
        
        // Add comment box if there's a comment
        if (transaction.comments && transaction.comments.trim()) {
          currentY += 5;
          
          const commentBoxHeight = Math.max(20, Math.ceil(transaction.comments.length / 80) * 5 + 10);
          doc.setDrawColor(200, 200, 200);
          doc.rect(25, currentY - 5, 160, commentBoxHeight);
          
          doc.setFont('helvetica', 'bold');
          doc.text('Comment:', 30, currentY + 3);
          
          doc.setFont('helvetica', 'normal');
          const splitComment = doc.splitTextToSize(transaction.comments, 150);
          doc.text(splitComment, 30, currentY + 10);
          
          currentY += commentBoxHeight + 5;
        }
        
        currentY += 10;
      });
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.text('No queried transactions found.', 20, 50);
    }

    // Add footer to all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      // Ensure watermark is on every page
      if (i > 1) addWatermark(doc);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Page ${i} of ${pageCount}`, 20, doc.internal.pageSize.height - 10);
      doc.text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, doc.internal.pageSize.width - 80, doc.internal.pageSize.height - 10);
    }
    
    // Save the PDF
    const fileName = `Banking_Analysis_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };



  return (
    <div className="space-y-4">
      {/* AI Analysis and Export Buttons */}
      <div className="flex justify-center gap-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Button 
                  onClick={hasTooManyTransactions ? undefined : onFullAnalysis}
                  disabled={hasTooManyTransactions}
                  className={
                    hasTooManyTransactions
                      ? "bg-red-600 hover:bg-red-700 text-white px-6 py-2 cursor-not-allowed"
                      : isFullAnalysisComplete 
                        ? "bg-orange-600 hover:bg-orange-700 text-white px-6 py-2"
                        : "bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
                  }
                  size="lg"
                >
                  {hasTooManyTransactions ? (
                    <AlertTriangle className="h-5 w-5 mr-2" />
                  ) : (
                    <BarChart3 className="h-5 w-5 mr-2" />
                  )}
                  {hasTooManyTransactions 
                    ? "Too Many Transactions" 
                    : isFullAnalysisComplete 
                      ? "Reprocess PDF" 
                      : "AI Analysis"}
                </Button>
              </div>
            </TooltipTrigger>
            {hasTooManyTransactions && (
              <TooltipContent className="max-w-xs">
                <p>This file has {transactionCount} transactions, which exceeds the 600-transaction limit for successful processing. Please split the PDF into smaller files and re-upload them separately.</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>

        {isFullAnalysisComplete && (
          <Button 
            onClick={handleExportAnalysisPDF}
            variant="outline"
            size="lg"
            className="px-6 py-2 gap-2"
          >
            <FileDown className="h-5 w-5" />
            Export Analysis PDF
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="pdf" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            PDF Document
          </TabsTrigger>
          <TabsTrigger 
            value="summary" 
            className={`flex items-center gap-2 ${!isFullAnalysisComplete ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={!isFullAnalysisComplete}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Summary
          </TabsTrigger>
          <TabsTrigger 
            value="table" 
            className={`flex items-center gap-2 ${!isFullAnalysisComplete ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={!isFullAnalysisComplete}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Transaction Table
          </TabsTrigger>
          <TabsTrigger 
            value="sankey" 
            className={`flex items-center gap-2 ${!isFullAnalysisComplete ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={!isFullAnalysisComplete}
          >
            <TrendingUp className="h-4 w-4" />
            Sankey Flow
          </TabsTrigger>
          <TabsTrigger 
            value="chart" 
            className={`flex items-center gap-2 ${!isFullAnalysisComplete ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={!isFullAnalysisComplete}
          >
            <BarChart3 className="h-4 w-4" />
            Transaction Chart
          </TabsTrigger>
          <TabsTrigger 
            value="json" 
            className={`flex items-center gap-2 ${!isFullAnalysisComplete ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={!isFullAnalysisComplete}
          >
            <Code2 className="h-4 w-4" />
            JSON Data
          </TabsTrigger>
          <TabsTrigger 
            value="xml" 
            className={`flex items-center gap-2 ${!isFullAnalysisComplete ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={!isFullAnalysisComplete}
          >
            <Code2 className="h-4 w-4" />
            XML Data
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sankey" className="space-y-4">
          {isFullAnalysisComplete ? (
            <div ref={sankeyRef}>
              <BankingSankeyDiagram 
                xmlData={xmlData || ''}
                accountName={accountName || 'Bank Account'}
                dateRange={`${document?.transactionDateFrom || ''} - ${document?.transactionDateTo || ''}`}
              />
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">Transaction Flow Analysis</h3>
                <p className="text-gray-500 mb-4">Click "AI Analysis" to analyze transaction flows and generate the Sankey diagram</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="table" className="space-y-4">
          {isFullAnalysisComplete ? (
            <BankingTransactionsTable 
              documentId={document.id}
              xmlData={xmlData || ''}
            />
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">Transaction Table</h3>
                <p className="text-gray-500 mb-4">Click "AI Analysis" to generate a detailed transaction table with status tracking</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="chart" className="space-y-4">
          {isFullAnalysisComplete ? (
            <div ref={chartRef}>
              <BankingTransactionChart 
                xmlData={xmlData || ''}
                accountName={accountName || 'Bank Account'}
              />
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">Transaction Chart Analysis</h3>
                <p className="text-gray-500 mb-4">Click "AI Analysis" to generate interactive transaction charts and balance trends</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="json" className="space-y-4">
          {isFullAnalysisComplete ? (
            <BankingJsonDisplay xmlData={xmlData || ''} />
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Code2 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">JSON Data Export</h3>
                <p className="text-gray-500 mb-4">Click "AI Analysis" to convert XML analysis into structured JSON format</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="summary" className="space-y-4">
          {isFullAnalysisComplete ? (
            <Card>
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Analysis Summary</h3>
                    {xmlData && (() => {
                      try {
                        const parser = new DOMParser();
                        const xmlDoc = parser.parseFromString(xmlData, 'text/xml');
                        const summaryElement = xmlDoc.querySelector('analysis_summary');
                        const summary = summaryElement?.textContent?.trim();
                        
                        if (summary) {
                          return (
                            <div className="space-y-4">
                              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-3">Document Summary</h4>
                                <div className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                                  {summary.split('\n').map((line, index) => (
                                    line.trim() && (
                                      <p key={index} className="mb-2">
                                        {line.trim()}
                                      </p>
                                    )
                                  ))}
                                </div>
                              </div>
                              
                              {/* Additional summary details from XML */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                  <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">Account Details</h4>
                                  <div className="text-sm text-green-700 dark:text-green-300">
                                    <p>Institution: {xmlDoc.querySelector('institution')?.textContent || 'Not specified'}</p>
                                    <p>Account Type: {xmlDoc.querySelector('account_type')?.textContent || 'Not specified'}</p>
                                    <p>Period: {xmlDoc.querySelector('start_date')?.textContent || 'N/A'} to {xmlDoc.querySelector('end_date')?.textContent || 'N/A'}</p>
                                  </div>
                                </div>
                                
                                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                  <h4 className="font-medium text-purple-800 dark:text-purple-200 mb-2">Transaction Summary</h4>
                                  <div className="text-sm text-purple-700 dark:text-purple-300">
                                    {(() => {
                                      const transactions = xmlDoc.querySelectorAll('transaction');
                                      const totalTransactions = transactions.length;
                                      const inflows = Array.from(transactions).filter(t => t.querySelector('type')?.textContent?.includes('in')).length;
                                      const outflows = totalTransactions - inflows;
                                      
                                      return (
                                        <>
                                          <p>Total Transactions: {totalTransactions}</p>
                                          <p>Inflows: {inflows}</p>
                                          <p>Outflows: {outflows}</p>
                                        </>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        
                        return (
                          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                            <p className="text-yellow-700 dark:text-yellow-300">No analysis summary found in XML data.</p>
                          </div>
                        );
                      } catch (error) {
                        return (
                          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            <p className="text-red-700 dark:text-red-300">Error parsing XML data for summary.</p>
                          </div>
                        );
                      }
                    })()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">Analysis Summary</h3>
                <p className="text-gray-500 mb-4">Click "AI Analysis" to generate a comprehensive summary of your banking document</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>



        <TabsContent value="pdf" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="w-full h-[600px] border rounded-md overflow-hidden">
                <iframe
                  src={pdfUrl}
                  className="w-full h-full"
                  title={`PDF Viewer - ${documentName}`}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="xml" className="space-y-4">
          {isFullAnalysisComplete ? (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">
                    XML Analysis Data 
                    {xmlData && (() => {
                      const transactionMatches = xmlData.match(/<transaction>/g);
                      const transactionCount = transactionMatches ? transactionMatches.length : 0;
                      return transactionCount > 0 ? ` (${transactionCount} transactions)` : '';
                    })()}
                  </h3>
                  <div className="flex gap-2">
                    {xmlData && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleDownloadXML}
                        className="flex items-center gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Download XML
                      </Button>
                    )}
                  </div>
                </div>
                
                {xmlData ? (
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <pre className="text-sm font-mono whitespace-pre-wrap break-words">
                      {xmlData}
                    </pre>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Code2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No XML analysis data available</p>
                    <p className="text-sm">Upload and process a banking document to see analysis data</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Code2 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">XML Analysis Data</h3>
                <p className="text-gray-500 mb-4">Click "AI Analysis" to generate detailed XML transaction analysis</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>


      </Tabs>
    </div>
  );
}