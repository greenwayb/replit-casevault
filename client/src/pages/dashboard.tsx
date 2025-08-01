import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/sidebar";
import CreateCaseModal from "@/components/create-case-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Briefcase, FileText, Upload, Eye, Calendar, Trash2 } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import logoPath from "@assets/FamilyCourtDoco-Asset_1754059270273.png";
import TiltedCard from "@/components/TiltedCard";

export default function Dashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [showCreateModal, setShowCreateModal] = useState(false);

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

  const { data: cases, isLoading: casesLoading } = useQuery({
    queryKey: ["/api/cases"],
    enabled: isAuthenticated,
  });

  const deleteCaseMutation = useMutation({
    mutationFn: async (caseId: number) => {
      const response = await fetch(`/api/cases/${caseId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete case');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Case deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: error.message || "Failed to delete case",
        variant: "destructive",
      });
    },
  });

  const handleDeleteCase = (caseItem: any, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    
    if (window.confirm(`Are you sure you want to delete case ${caseItem.caseNumber}? This action cannot be undone and will delete all documents in the case.`)) {
      deleteCaseMutation.mutate(caseItem.id);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'status-active';
      case 'under_review':
        return 'status-under-review';
      case 'in_progress':
        return 'status-in-progress';
      case 'completed':
        return 'status-completed';
      case 'archived':
        return 'status-archived';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'caseadmin':
        return 'role-caseadmin';
      case 'reviewer':
        return 'role-reviewer';
      case 'discloser':
        return 'role-discloser';
      case 'disclosee':
        return 'role-disclosee';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (!isAuthenticated || isLoading) {
    return null;
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar user={user} />
      
      <main className="flex-1 flex flex-col overflow-hidden md:ml-0">
        {/* Header */}
        <header className="bg-white border-b-2 border-slate-200 px-4 md:px-6 py-4 md:py-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="pl-12 md:pl-0">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Case Dashboard</h2>
              <p className="text-slate-600 mt-1 md:mt-2 font-medium text-sm md:text-base">Manage your legal cases and documents</p>
            </div>
            <Button 
              onClick={() => setShowCreateModal(true)}
              className="legal-button-primary px-4 md:px-6 py-2 md:py-3 text-sm md:text-base w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Case
            </Button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 p-4 md:p-8 overflow-auto">
          {/* Cases Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8 mb-8 md:mb-12">
            {casesLoading ? (
              // Loading skeletons
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="legal-card p-4 md:p-6 lg:p-8 animate-pulse">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 md:mb-6 gap-4 sm:gap-0">
                    <div className="flex items-center space-x-3 md:space-x-4">
                      <div className="w-12 h-12 md:w-14 md:h-14 bg-slate-200 rounded-lg"></div>
                      <div>
                        <div className="h-4 md:h-5 bg-slate-200 rounded w-24 md:w-28 mb-2 md:mb-3"></div>
                        <div className="h-3 md:h-4 bg-slate-200 rounded w-28 md:w-36"></div>
                      </div>
                    </div>
                    <div className="h-5 md:h-6 bg-slate-200 rounded w-16 md:w-20"></div>
                  </div>
                  <div className="space-y-2 md:space-y-3">
                    <div className="h-3 md:h-4 bg-slate-200 rounded"></div>
                    <div className="h-3 md:h-4 bg-slate-200 rounded w-3/4"></div>
                  </div>
                </Card>
              ))
            ) : cases && cases.length > 0 ? (
              cases.map((caseItem: any) => (
                <TiltedCard
                  key={caseItem.id}
                  containerHeight="320px"
                  containerWidth="100%"
                  rotateAmplitude={8}
                  scaleOnHover={1.08}
                  onClick={() => setLocation(`/cases/${caseItem.id}`)}
                  className="w-full"
                >
                  <Card className="legal-card p-4 md:p-6 lg:p-8 cursor-pointer transition-all duration-200 group relative touch-manipulation h-full shadow-lg border-0">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 md:mb-6 gap-4 sm:gap-0">
                      <div className="flex items-center space-x-3 md:space-x-4 w-full sm:w-auto">
                        <div className="w-12 h-12 md:w-14 md:h-14 bg-primary/10 rounded-lg flex items-center justify-center ring-2 ring-primary/20 flex-shrink-0">
                          <Briefcase className="h-6 w-6 md:h-7 md:w-7 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-slate-900 text-base md:text-lg tracking-tight truncate">{caseItem.caseNumber}</h3>
                          <p className="text-xs md:text-sm text-slate-600 flex items-center font-medium mt-1">
                            <Calendar className="h-3 w-3 mr-1 flex-shrink-0" />
                            <span className="truncate">Created: {formatDate(caseItem.createdAt)}</span>
                          </p>
                        </div>
                      </div>
                      <Badge className={`${getStatusBadgeClass(caseItem.status)} px-2 md:px-3 py-1 text-xs md:text-sm flex-shrink-0`}>
                        {caseItem.status?.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="space-y-2 md:space-y-3 border-t border-slate-100 pt-3 md:pt-4">
                      <div className="flex items-center justify-between text-xs md:text-sm">
                        <span className="text-slate-600 font-medium">Documents:</span>
                        <span className="font-bold text-slate-900">{caseItem.documentCount || 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs md:text-sm">
                        <span className="text-slate-600 font-medium">Role:</span>
                        <Badge className={`${getRoleBadgeClass(caseItem.role)} px-2 py-1 text-xs`}>
                          {caseItem.role}
                        </Badge>
                      </div>
                    </div>
                  
                    {/* Action buttons for CASEADMIN */}
                    {caseItem.role === 'CASEADMIN' && (
                      <div className="absolute top-2 md:top-4 right-2 md:right-4 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 md:h-8 md:w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 touch-manipulation"
                          onClick={(e) => handleDeleteCase(caseItem, e)}
                          title="Delete Case"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    
                    <div className="space-y-3 md:space-y-4 mt-auto">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-primary border-primary/20 hover:bg-primary/5 touch-manipulation text-xs md:text-sm px-3 md:px-4 py-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/cases/${caseItem.id}`);
                          }}
                        >
                          <Eye className="h-3 w-3 md:h-4 md:w-4 mr-2" />
                          View Details
                        </Button>
                        <div className="text-xs text-slate-500 flex items-center justify-center sm:justify-end">
                          <FileText className="h-3 w-3 mr-1 flex-shrink-0" />
                          <span className="truncate">Last updated: {formatDate(caseItem.updatedAt || caseItem.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </TiltedCard>
              ))
            ) : (
              <div className="col-span-full text-center py-12 md:py-16 px-4">
                <Briefcase className="h-12 w-12 md:h-16 md:w-16 text-slate-400 mx-auto mb-4 md:mb-6" />
                <h3 className="text-lg md:text-xl font-bold text-slate-900 mb-2 md:mb-3">No cases yet</h3>
                <p className="text-slate-600 mb-4 md:mb-6 max-w-md mx-auto text-sm md:text-base">Create your first case to begin managing legal documents and case files.</p>
                <Button 
                  onClick={() => setShowCreateModal(true)}
                  className="legal-button-primary px-6 md:px-8 py-2 md:py-3 text-sm md:text-base w-full sm:w-auto max-w-xs mx-auto touch-manipulation"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Case
                </Button>
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <Card className="legal-card">
            <div className="p-6 border-b border-slate-200 legal-document-section">
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">Recent Activity</h3>
            </div>
            <div className="p-8">
              <div className="text-center py-12">
                <FileText className="h-16 w-16 text-slate-400 mx-auto mb-6" />
                <p className="text-slate-600 font-medium mb-2">No recent activity to display</p>
                <p className="text-sm text-slate-500">
                  Activity will appear here when you start uploading documents and managing cases.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </main>

      <CreateCaseModal 
        open={showCreateModal} 
        onOpenChange={setShowCreateModal} 
      />
    </div>
  );
}
