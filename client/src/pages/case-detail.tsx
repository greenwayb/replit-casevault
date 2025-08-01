import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import DocumentTree from "@/components/document-tree";
import DocumentViewer from "@/components/document-viewer";
import DocumentUploadModal from "@/components/document-upload-modal";
import { ArrowLeft, Upload, Briefcase } from "lucide-react";

export default function CaseDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: caseData, isLoading: caseLoading, error } = useQuery({
    queryKey: ["/api/cases", id],
    enabled: isAuthenticated && !!id,
  });

  useEffect(() => {
    if (error && isUnauthorizedError(error as Error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [error, toast]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusDisplay = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'Active Case';
      case 'under_review':
        return 'Under Review';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'archived':
        return 'Archived';
      default:
        return status || 'Unknown Status';
    }
  };

  if (!isAuthenticated || isLoading) {
    return null;
  }

  if (caseLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading case details...</p>
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Case not found</h3>
          <p className="text-gray-600 mb-4">The requested case could not be found or you don't have access to it.</p>
          <Button onClick={() => setLocation('/')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-white">
      {/* Case Navigation & Tree View */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Case Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/')}
              className="p-2 hover:bg-gray-100"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{caseData.caseNumber}</h2>
              <p className="text-sm text-gray-600">{getStatusDisplay(caseData.status)}</p>
            </div>
          </div>
          <Button 
            onClick={() => setShowUploadModal(true)}
            className="w-full bg-primary hover:bg-blue-700"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        </div>

        {/* Document Tree */}
        <div className="flex-1 p-4 overflow-auto">
          <DocumentTree 
            documents={caseData.documents || []} 
            onDocumentSelect={setSelectedDocument}
            selectedDocument={selectedDocument}
            caseId={parseInt(id!)}
          />
        </div>
      </div>

      {/* Document Viewer Area */}
      <div className="flex-1 flex flex-col bg-gray-50">
        <DocumentViewer document={selectedDocument} />
      </div>

      <DocumentUploadModal 
        open={showUploadModal} 
        onOpenChange={setShowUploadModal}
        caseId={parseInt(id!)}
      />
    </div>
  );
}
