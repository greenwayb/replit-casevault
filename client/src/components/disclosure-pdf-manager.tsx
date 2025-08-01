import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Download, Calendar, User, Plus, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface DisclosurePdf {
  id: number;
  caseId: number;
  filename: string;
  generatedById: string;
  generatedAt: string;
  documentCount: number;
  lastGeneratedAt: string;
  generatedBy: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface DisclosurePdfManagerProps {
  caseId: number;
}

export function DisclosurePdfManager({ caseId }: DisclosurePdfManagerProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing disclosure PDFs
  const { data: disclosurePdfs, isLoading } = useQuery({
    queryKey: ['/api/cases', caseId, 'disclosure-pdfs'],
    enabled: !!caseId,
  });

  // Generate new disclosure PDF
  const generatePdfMutation = useMutation({
    mutationFn: async () => {
      setIsGenerating(true);
      const response = await fetch(`/api/cases/${caseId}/generate-disclosure-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to generate PDF' }));
        throw new Error(errorData.message || 'Failed to generate PDF');
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Disclosure PDF Generated",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/cases', caseId, 'disclosure-pdfs'] });
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsGenerating(false);
    },
  });

  const handleDownload = (filename: string) => {
    const downloadUrl = `/api/disclosure-pdfs/${filename}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy HH:mm');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Disclosure PDFs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-sm text-gray-500">Loading disclosure PDFs...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Disclosure PDFs
            </CardTitle>
            <CardDescription>
              Generate comprehensive document listings for case disclosure
            </CardDescription>
          </div>
          <Button 
            onClick={() => generatePdfMutation.mutate()}
            disabled={isGenerating}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isGenerating ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Generating...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Generate New PDF
              </div>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!disclosurePdfs || disclosurePdfs.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Disclosure PDFs Generated</h3>
            <p className="text-gray-500 mb-4">
              Generate your first disclosure PDF to create a comprehensive document listing for this case.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-blue-900 mb-1">Disclosure PDF Features:</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Hierarchical document organization (A, B, B1, B1.1, etc.)</li>
                    <li>• Account holder grouping for banking documents</li>
                    <li>• Date ranges and upload tracking</li>
                    <li>• New document indicators (*) for subsequent generations</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {disclosurePdfs.map((pdf: DisclosurePdf) => (
              <div
                key={pdf.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <FileText className="h-6 w-6 text-red-600" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium text-gray-900">
                        {pdf.filename}
                      </h3>
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                        {pdf.documentCount} documents
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Generated: {formatDate(pdf.generatedAt)}
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        By: {pdf.generatedBy.firstName} {pdf.generatedBy.lastName}
                      </div>
                    </div>
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(pdf.filename)}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </div>
            ))}
            
            {disclosurePdfs.length > 1 && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                  <div className="text-sm text-amber-700">
                    <strong>Note:</strong> Documents added since the last PDF generation will be marked with "*" in new disclosure PDFs.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}