import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, BarChart3, Code2 } from "lucide-react";
import BankingSankeyDiagram from "./banking-sankey-diagram";

interface BankingDocumentTabsProps {
  document: any;
  pdfUrl: string;
  xmlData?: string;
  csvData?: string;
  documentName: string;
  accountName?: string;
}

export default function BankingDocumentTabs({ 
  document, 
  pdfUrl, 
  xmlData, 
  csvData, 
  documentName, 
  accountName 
}: BankingDocumentTabsProps) {
  const [activeTab, setActiveTab] = useState("analysis");

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
    
    const blob = new Blob([csvData], { type: 'text/csv' });
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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analysis Flow
          </TabsTrigger>
          <TabsTrigger value="pdf" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            PDF Document
          </TabsTrigger>
          <TabsTrigger value="xml" className="flex items-center gap-2">
            <Code2 className="h-4 w-4" />
            XML Data
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="space-y-4">
          <BankingSankeyDiagram 
            xmlData={xmlData}
            documentName={documentName}
            accountName={accountName}
          />
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
        </TabsContent>
      </Tabs>
    </div>
  );
}