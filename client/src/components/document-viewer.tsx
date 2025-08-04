import { Button } from "@/components/ui/button";
import { Download, Maximize2, FileText, Calendar, FileSpreadsheet, Building } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import BankingDocumentTabs from "./banking-document-tabs";
import FullAnalysisDialog from "./full-analysis-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatusSelect } from "@/components/ui/status-select";

interface Document {
  id: number;
  filename: string;
  originalName: string;
  category: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
  status: string;
  caseId: number;
  // AI-extracted banking information
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
  fullAnalysisCompleted?: boolean;
}

interface DocumentViewerProps {
  document?: Document | null;
  userRole?: string;
  onDocumentUpdate?: (updatedDocument: Document) => void;
}

export default function DocumentViewer({ document, userRole, onDocumentUpdate }: DocumentViewerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isFullAnalysisDialogOpen, setIsFullAnalysisDialogOpen] = useState(false);

  // Fetch CSV data for banking documents
  const { data: csvData } = useQuery({
    queryKey: ['/api/documents', document?.id, 'csv-data'],
    enabled: document?.category === 'BANKING' && document?.csvGenerated === true,
    retry: false,
  });

  const handleDownload = async () => {
    if (!document) return;

    try {
      const response = await fetch(`/api/documents/${document.id}/download`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to download document');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.originalName;
      window.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      window.document.body.removeChild(a);

      toast({
        title: "Success",
        description: "Document downloaded successfully!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCSVDownload = async () => {
    if (!document) return;

    try {
      const response = await fetch(`/api/documents/${document.id}/csv`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to download CSV');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `${document.originalName.replace('.pdf', '')}_data.csv`;
      window.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      window.document.body.removeChild(a);

      toast({
        title: "Success",
        description: "CSV file downloaded successfully!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download CSV. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short', 
      day: 'numeric'
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFullAnalysis = () => {
    setIsFullAnalysisDialogOpen(true);
  };

  const handleFullAnalysisComplete = (analysisData: any) => {
    // Update the document with full analysis data
    if (onDocumentUpdate && document) {
      const updatedDocument = {
        ...document,
        fullAnalysisCompleted: true,
        csvPath: analysisData.csvInfo?.csvPath,
        csvRowCount: analysisData.csvInfo?.csvRowCount,
        csvGenerated: analysisData.csvInfo?.csvGenerated,
        xmlPath: analysisData.xmlInfo?.xmlPath,
        xmlAnalysisData: analysisData.xmlAnalysisData,
      };
      onDocumentUpdate(updatedDocument);
    }
    
    // Invalidate queries to refresh data
    queryClient.invalidateQueries({
      queryKey: ['/api/documents', document?.id]
    });
    
    toast({
      title: "Full Analysis Complete",
      description: "The banking document has been fully analyzed. All tabs are now available.",
    });
  };

  if (!document) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-lg font-medium mb-2">No document selected</p>
          <p className="text-sm">Select a document from the tree view to view it here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Document Status Panel */}
      <div className="p-4 bg-slate-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">Document Status:</span>
              <StatusBadge status={document.status} />
            </div>
          </div>
          {userRole !== 'DISCLOSEE' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Change Status:</span>
              <StatusSelect
                documentId={document.id}
                currentStatus={document.status}
                userRole={userRole || 'DISCLOSEE'}
                caseId={document.caseId}
                onStatusChange={(newStatus) => {
                  if (onDocumentUpdate && document) {
                    onDocumentUpdate({ ...document, status: newStatus });
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Document Header */}
      <div className="p-6 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">{document.originalName}</h3>
            <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
              <span className="flex items-center">
                <Calendar className="h-3 w-3 mr-1" />
                Uploaded: {formatDate(document.createdAt)}
              </span>
              <span>Size: {formatFileSize(document.fileSize)}</span>
              {document.documentNumber && (
                <span className="font-mono bg-slate-100 px-2 py-1 rounded text-xs">
                  {document.documentNumber}
                </span>
              )}
            </div>
            
            {/* Banking-specific information */}
            {document.category === 'BANKING' && document.aiProcessed && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Building className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-900">Banking Information</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {document.accountHolderName && (
                    <div><span className="font-medium text-slate-700">Account Holder:</span> {document.accountHolderName}</div>
                  )}
                  {document.accountName && (
                    <div><span className="font-medium text-slate-700">Account:</span> {document.accountName}</div>
                  )}
                  {document.financialInstitution && (
                    <div><span className="font-medium text-slate-700">Bank:</span> {document.financialInstitution}</div>
                  )}
                  {document.accountNumber && (
                    <div><span className="font-medium text-slate-700">Number:</span> {document.accountNumber}</div>
                  )}
                  {document.bsbSortCode && (
                    <div><span className="font-medium text-slate-700">BSB/Sort:</span> {document.bsbSortCode}</div>
                  )}
                  {document.transactionDateFrom && document.transactionDateTo && (
                    <div className="col-span-2">
                      <span className="font-medium text-slate-700">Period:</span> {formatDate(document.transactionDateFrom)} - {formatDate(document.transactionDateTo)}
                    </div>
                  )}
                  {document.csvGenerated && document.csvRowCount && (
                    <div className="col-span-2">
                      <span className="font-medium text-slate-700">CSV Data:</span> {document.csvRowCount} transaction rows extracted
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Processing error indicator */}
            {document.processingError && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
                AI Processing Failed: {document.processingError}
              </div>
            )}
          </div>
          
          <div className="flex space-x-2 ml-6">
            <Button 
              variant="outline"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            
            {/* CSV Download Button - only show for Banking documents with CSV data */}
            {document.category === 'BANKING' && document.csvGenerated && (
              <Button 
                variant="outline"
                onClick={handleCSVDownload}
                className="text-green-600 border-green-200 hover:bg-green-50"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Download CSV
              </Button>
            )}
            
            <Button variant="outline">
              <Maximize2 className="h-4 w-4 mr-2" />
              Full Screen
            </Button>
          </div>
        </div>
      </div>
      
      {/* Banking Document Tabs Section */}
      {document.category === 'BANKING' ? (
        <div className="flex-1 p-6">
          <BankingDocumentTabs 
            document={document}
            pdfUrl={`/api/documents/${document.id}/view`}
            xmlData={document.xmlAnalysisData}
            csvData={(csvData as any)?.csvData}
            documentName={document.originalName}
            accountName={document.accountName}
            onFullAnalysis={handleFullAnalysis}
          />
        </div>
      ) : (
        /* PDF Viewer Area for non-banking documents */
        <div className="flex-1 p-6 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-[calc(100vh-350px)] min-h-[500px]">
            <iframe
              src={`/api/documents/${document.id}/view`}
              className="w-full h-full rounded-lg"
              title={document.originalName}
            />
          </div>
        </div>
      )}

      {/* Full Analysis Dialog */}
      {document && (
        <FullAnalysisDialog
          isOpen={isFullAnalysisDialogOpen}
          onClose={() => setIsFullAnalysisDialogOpen(false)}
          documentId={document.id}
          onComplete={handleFullAnalysisComplete}
        />
      )}
    </div>
  );
}
