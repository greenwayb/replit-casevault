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
import { DisclosurePdfManager } from "@/components/disclosure-pdf-manager";
import { CaseMemberManagement } from "@/components/case-member-management";
import EditableCaseTitle from "@/components/editable-case-title";
import { ArrowLeft, Upload, Briefcase, PanelLeftOpen, PanelLeftClose, FileText, X, Users } from "lucide-react";
import logoPath from "@assets/FamilyCourtDoco-Asset_1754059270273.png";

export default function CaseDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [navExpanded, setNavExpanded] = useState(false);
  const [showDisclosurePdfs, setShowDisclosurePdfs] = useState(false);

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
    staleTime: 0, // Force fresh data
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
    <div className="h-screen flex flex-col md:flex-row bg-white">
      {/* Case Navigation & Tree View */}
      <div className={`
        ${navExpanded ? 'w-full md:w-full' : 'w-full md:w-80'} 
        bg-white border-r-0 md:border-r border-gray-200 flex flex-col transition-all duration-300
        ${!navExpanded && selectedDocument ? 'hidden md:flex' : 'flex'}
      `}>
        {/* Case Header */}
        <div className="p-4 md:p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2 md:space-x-3 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/')}
                className="p-2 hover:bg-gray-100 touch-manipulation flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg md:text-xl font-semibold text-gray-900 truncate">{caseData.caseNumber}</h2>
                <EditableCaseTitle 
                  caseId={caseData.id}
                  currentTitle={caseData.title || 'Untitled Case'}
                  userRole={caseData.role}
                  className="text-xs md:text-sm text-primary font-semibold truncate"
                />
                <p className="text-xs md:text-sm text-gray-600 truncate">{getStatusDisplay(caseData.status)}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNavExpanded(!navExpanded)}
              className="p-2 hover:bg-gray-100 touch-manipulation flex-shrink-0 hidden md:flex"
            >
              {navExpanded ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </Button>
            {/* Mobile back button when document is selected */}
            {selectedDocument && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDocument(null)}
                className="p-2 hover:bg-gray-100 touch-manipulation flex-shrink-0 md:hidden"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="space-y-2">
            <Button 
              onClick={() => setShowUploadModal(true)}
              className="w-full bg-primary hover:bg-blue-700 touch-manipulation text-sm md:text-base py-2 md:py-2.5"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
            
            {/* Case Member Management Button - Use userRole as fallback */}
            {(caseData?.role === 'CASEADMIN' || caseData?.userRole === 'CASEADMIN') && (
              <Button 
                onClick={() => {
                  setShowDisclosurePdfs(true);
                  setSelectedDocument(null);
                }}
                variant="outline"
                className="w-full border-primary/20 text-primary hover:bg-primary/5 touch-manipulation text-sm md:text-base py-2 md:py-2.5"
              >
                <Users className="h-4 w-4 mr-2" />
                Manage Members
              </Button>
            )}
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="p-3 md:p-4 border-b border-gray-200">
          <div className="flex gap-2">
            <Button
              variant={!showDisclosurePdfs ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setShowDisclosurePdfs(false);
                setSelectedDocument(null);
              }}
              className="flex-1 text-xs"
            >
              Documents
            </Button>
            <Button
              variant={showDisclosurePdfs ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setShowDisclosurePdfs(true);
                setSelectedDocument(null);
              }}
              className="flex-1 text-xs"
            >
              <FileText className="h-3 w-3 mr-1" />
              Management
            </Button>
          </div>
        </div>

        {/* Document Tree */}
        <div className="flex-1 p-3 md:p-4 overflow-auto">
          <DocumentTree 
            documents={caseData.documents || []} 
            onDocumentSelect={(doc) => {
              setSelectedDocument(doc);
              setShowDisclosurePdfs(false);
            }}
            selectedDocument={selectedDocument}
            caseId={parseInt(id!)}
          />
        </div>
      </div>

      {/* Right Panel - Document Viewer or Disclosure PDFs */}
      <div className={`
        flex-1 bg-gray-50 
        ${!selectedDocument && !showDisclosurePdfs ? 'hidden md:block' : 'block'}
      `}>
        {showDisclosurePdfs ? (
          <div className="h-full flex flex-col">
            {/* Case Management Header */}
            <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Case Management</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDisclosurePdfs(false)}
                className="md:hidden"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Case Management Content */}
            <div className="flex-1 p-4 overflow-auto space-y-6">
              <CaseMemberManagement 
                caseId={parseInt(id!)} 
                currentUserRole={caseData?.role as any}
              />
              <DisclosurePdfManager caseId={parseInt(id!)} />
            </div>
          </div>
        ) : (
          <DocumentViewer document={selectedDocument} />
        )}
      </div>

      <DocumentUploadModal 
        open={showUploadModal} 
        onOpenChange={setShowUploadModal}
        caseId={parseInt(id!)}
      />
    </div>
  );
}
