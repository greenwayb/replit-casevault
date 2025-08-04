import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, BarChart3, Code2, TrendingUp, FileSpreadsheet } from "lucide-react";
import { BankingSankeyDiagram } from "./banking-sankey-diagram";

interface BankingDocumentTabsProps {
  document: any;
  pdfUrl: string;
  xmlData?: string;
  csvData?: string;
  documentName: string;
  accountName?: string;
  onFullAnalysis?: () => void;
}

export default function BankingDocumentTabs({ 
  document, 
  pdfUrl, 
  xmlData, 
  csvData, 
  documentName, 
  accountName,
  onFullAnalysis
}: BankingDocumentTabsProps) {
  const [activeTab, setActiveTab] = useState("sankey");
  
  // Check if full analysis is completed
  const isFullAnalysisComplete = document?.fullAnalysisCompleted && xmlData;
  const hasAnalysisError = document?.analysisError || document?.aiProcessingFailed;

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

  const handleDownloadCSV = () => {
    if (!csvData) return;
    
    // Check if csvData is a string or array format
    const csvContent = typeof csvData === 'string' ? csvData : 
                      Array.isArray(csvData) ? csvData.map(row => Object.values(row).join(',')).join('\n') : 
                      '';
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${documentName}_transactions.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* AI Analysis Button - only show if full analysis not completed */}
      {!isFullAnalysisComplete && (
        <div className="flex justify-center">
          <Button 
            onClick={onFullAnalysis}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
            size="lg"
          >
            <BarChart3 className="h-5 w-5 mr-2" />
            AI Analysis
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger 
            value="sankey" 
            className={`flex items-center gap-2 ${!isFullAnalysisComplete ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={!isFullAnalysisComplete}
          >
            <TrendingUp className="h-4 w-4" />
            Sankey Flow
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
            value="analysis" 
            className={`flex items-center gap-2 ${!isFullAnalysisComplete ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={!isFullAnalysisComplete}
          >
            <BarChart3 className="h-4 w-4" />
            Analysis Data
          </TabsTrigger>
          <TabsTrigger value="pdf" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            PDF Document
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
            <BankingSankeyDiagram 
              xmlData={xmlData || ''}
              accountName={accountName || 'Bank Account'}
              dateRange={`${document?.transactionDateFrom || ''} - ${document?.transactionDateTo || ''}`}
            />
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

        <TabsContent value="analysis" className="space-y-4">
          {isFullAnalysisComplete ? (
            <Card>
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Document Analysis Summary</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Account Information</h4>
                        <p className="text-sm text-blue-600 dark:text-blue-300">
                          Account: {accountName || 'Not specified'}
                        </p>
                        <p className="text-sm text-blue-600 dark:text-blue-300">
                          Document: {documentName}
                        </p>
                      </div>
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">Analysis Status</h4>
                        <p className="text-sm text-green-600 dark:text-green-300">
                          ✓ XML Analysis Complete
                        </p>
                        <p className="text-sm text-green-600 dark:text-green-300">
                          ✓ Transaction Data Extracted
                        </p>
                        {document?.csvGenerated && (
                          <p className="text-sm text-green-600 dark:text-green-300">
                            ✓ CSV File Generated ({document.csvRowCount || 0} transactions)
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {csvData && (
                    <div>
                      <h4 className="font-medium mb-2">Transaction Preview</h4>
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 max-h-48 overflow-y-auto">
                        <pre className="text-sm font-mono whitespace-pre-wrap break-words">
                          {typeof csvData === 'string' ? 
                            csvData.split('\n').slice(0, 5).join('\n') + 
                            (csvData.split('\n').length > 5 ? '\n... (showing first 5 rows)' : '') :
                            'CSV data format not recognized'
                          }
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : hasAnalysisError ? (
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="h-12 w-12 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                      <BarChart3 className="h-6 w-6 text-red-600" />
                    </div>
                    <h3 className="text-lg font-medium text-red-800 dark:text-red-200 mb-2">Analysis Error</h3>
                    <p className="text-sm text-red-600 dark:text-red-300 mb-4">
                      {document?.analysisError || 'AI processing failed'}
                    </p>
                  </div>
                  
                  {/* Processing Steps Status */}
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                    <h4 className="font-medium text-red-800 dark:text-red-200 mb-3">Processing Status:</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        {document?.xmlGenerated ? 
                          <span className="text-green-600">✓</span> : 
                          <span className="text-red-600">✗</span>
                        }
                        <span className={document?.xmlGenerated ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-400'}>
                          XML Analysis Generation
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {document?.csvGenerated ? 
                          <span className="text-green-600">✓</span> : 
                          <span className="text-red-600">✗</span>
                        }
                        <span className={document?.csvGenerated ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-400'}>
                          CSV Data Extraction
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <Button 
                      onClick={onFullAnalysis}
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50"
                    >
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Retry Analysis
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">Analysis Data</h3>
                <p className="text-gray-500 mb-4">Click "AI Analysis" to extract detailed transaction data and analysis</p>
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
                  <h3 className="text-lg font-semibold">XML Analysis Data</h3>
                  <div className="flex gap-2">
                    {csvData && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleDownloadCSV}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download CSV
                    </Button>
                  )}
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
                <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <pre className="text-sm font-mono whitespace-pre-wrap break-words">
                      {xmlData}
                    </pre>
                  </div>
                  
                  {csvData && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Generated CSV Preview</h4>
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 max-h-48 overflow-y-auto">
                        <pre className="text-sm font-mono whitespace-pre-wrap break-words">
                          {csvData.split('\n').slice(0, 10).join('\n')}
                          {csvData.split('\n').length > 10 && '\n... (showing first 10 rows)'}
                        </pre>
                      </div>
                    </div>
                  )}
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