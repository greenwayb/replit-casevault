import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Folder, FileText, Edit, Building, Calendar, Hash, Download, FileSpreadsheet, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AccountEditDialog } from "./account-edit-dialog";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Document {
  id: number;
  filename: string;
  originalName: string;
  displayName?: string;
  category: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
  status: string;
  // AI-extracted banking information
  accountHolderName?: string;
  accountName?: string;
  financialInstitution?: string;
  bankAbbreviation?: string;
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
}

interface DocumentTreeProps {
  documents: Document[];
  onDocumentSelect: (document: Document) => void;
  selectedDocument?: Document | null;
  caseId: number;
  userRole?: string;
}

export default function DocumentTree({ documents, onDocumentSelect, selectedDocument, caseId, userRole = 'DISCLOSEE' }: DocumentTreeProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['REAL_PROPERTY', 'BANKING', 'TAXATION', 'SUPERANNUATION', 'EMPLOYMENT', 'SHARES_INVESTMENTS', 'VEHICLES']));
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: number) => {
      return await apiRequest(`/api/documents/${documentId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId] });
      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteDocument = (doc: Document, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${doc.originalName}"? This action cannot be undone.`)) {
      deleteDocumentMutation.mutate(doc.id);
    }
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleAccount = (accountKey: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountKey)) {
      newExpanded.delete(accountKey);
    } else {
      newExpanded.add(accountKey);
    }
    setExpandedAccounts(newExpanded);
  };

  const groupedDocuments = documents.reduce((acc, doc) => {
    if (!acc[doc.category]) {
      acc[doc.category] = [];
    }
    acc[doc.category].push(doc);
    return acc;
  }, {} as Record<string, Document[]>);

  // Group Banking documents by account
  const groupBankingByAccount = (bankingDocs: Document[]) => {
    const accountGroups: Record<string, Document[]> = {};
    
    bankingDocs.forEach(doc => {
      if (doc.accountHolderName && doc.accountGroupNumber) {
        const key = `${doc.accountGroupNumber}-${doc.accountHolderName}`;
        if (!accountGroups[key]) {
          accountGroups[key] = [];
        }
        accountGroups[key].push(doc);
      } else {
        // Ungrouped documents
        if (!accountGroups['ungrouped']) {
          accountGroups['ungrouped'] = [];
        }
        accountGroups['ungrouped'].push(doc);
      }
    });

    // Sort documents within each group by document number
    Object.keys(accountGroups).forEach(key => {
      accountGroups[key].sort((a, b) => {
        if (a.documentNumber && b.documentNumber) {
          return a.documentNumber.localeCompare(b.documentNumber);
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    });

    return accountGroups;
  };

  const getCategoryDisplay = (category: string) => {
    switch (category) {
      case 'REAL_PROPERTY':
        return { name: 'A) Real Property', color: 'text-blue-500' };
      case 'BANKING':
        return { name: 'B) Banking', color: 'text-green-500' };
      case 'TAXATION':
        return { name: 'C) Taxation', color: 'text-orange-500' };
      case 'SUPERANNUATION':
        return { name: 'D) Superannuation', color: 'text-purple-500' };
      case 'EMPLOYMENT':
        return { name: 'E) Employment', color: 'text-red-500' };
      case 'SHARES_INVESTMENTS':
        return { name: 'F) Shares/Investments', color: 'text-indigo-500' };
      case 'VEHICLES':
        return { name: 'G) Vehicles', color: 'text-yellow-600' };
      default:
        return { name: category, color: 'text-gray-500' };
    }
  };

  const categories = ['REAL_PROPERTY', 'BANKING', 'TAXATION', 'SUPERANNUATION', 'EMPLOYMENT', 'SHARES_INVESTMENTS', 'VEHICLES'];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)}MB`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'UPLOADED':
        return 'text-blue-700';
      case 'READYFORREVIEW':
        return 'text-yellow-700';
      case 'REVIEWED':
        return 'text-green-700';
      case 'WITHDRAWN':
        return 'text-red-700';
      default:
        return 'text-slate-900';
    }
  };

  return (
    <div className="space-y-2">
      {categories.map((category) => {
        const categoryDocs = groupedDocuments[category] || [];
        const isExpanded = expandedCategories.has(category);
        const categoryInfo = getCategoryDisplay(category);

        return (
          <div key={category} className="tree-node">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start p-2 h-auto font-semibold"
              onClick={() => toggleCategory(category)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-slate-400 mr-2" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-400 mr-2" />
              )}
              <Folder className={cn("h-4 w-4 mr-2", categoryInfo.color)} />
              <span className="font-bold text-slate-900 text-sm tracking-tight flex-1 text-left">
                {categoryInfo.name}
              </span>
              <span className="text-xs text-slate-500 font-medium ml-auto">
                ({categoryDocs.length})
              </span>
            </Button>
            
            {isExpanded && (
              <div className="tree-children ml-6 space-y-1 mt-1">
                {category === 'BANKING' ? (
                  // Render Banking with hierarchical account structure
                  (() => {
                    const accountGroups = groupBankingByAccount(categoryDocs);
                    const sortedAccountKeys = Object.keys(accountGroups).sort((a, b) => {
                      if (a === 'ungrouped') return 1;
                      if (b === 'ungrouped') return -1;
                      return a.localeCompare(b);
                    });

                    return sortedAccountKeys.map((accountKey) => {
                      const accountDocs = accountGroups[accountKey];
                      const isAccountExpanded = expandedAccounts.has(accountKey);
                      
                      if (accountKey === 'ungrouped') {
                        // Render ungrouped documents directly
                        return accountDocs.map((doc) => (
                          <Button
                            key={doc.id}
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "w-full justify-start p-2 h-auto text-left",
                              selectedDocument?.id === doc.id && "bg-primary/10 text-primary border border-primary/20"
                            )}
                            onClick={() => onDocumentSelect(doc)}
                          >
                            <FileText className="h-4 w-4 mr-2 text-slate-400" />
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm font-medium truncate ${getStatusColor(doc.status)}`}>
                                {doc.originalName}
                              </div>
                              <div className="text-xs text-slate-500">
                                {formatDate(doc.createdAt)} • {formatFileSize(doc.fileSize)}
                                {doc.processingError && <span className="text-amber-600 ml-1">• AI Processing Failed</span>}
                              </div>
                            </div>
                          </Button>
                        ));
                      }

                      // Parse account info
                      const [groupNumber, accountHolderName] = accountKey.split('-');
                      const firstDoc = accountDocs[0];

                      return (
                        <div key={accountKey} className="tree-node">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start p-2 h-auto"
                            onClick={() => toggleAccount(accountKey)}
                          >
                            {isAccountExpanded ? (
                              <ChevronDown className="h-4 w-4 text-slate-400 mr-2" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-slate-400 mr-2" />
                            )}
                            <Building className="h-4 w-4 mr-2 text-blue-600" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-900">
                                  B{groupNumber}: {accountHolderName}
                                </span>
                                <div
                                  className="h-6 w-6 p-0 hover:bg-slate-100 rounded cursor-pointer flex items-center justify-center"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingDocument(firstDoc);
                                  }}
                                >
                                  <Edit className="h-3 w-3 text-slate-400" />
                                </div>
                              </div>
                              <div className="text-xs text-slate-500">
                                {firstDoc.financialInstitution && (
                                  <span>{firstDoc.financialInstitution} • </span>
                                )}
                                {accountDocs.length} documents
                              </div>
                            </div>
                          </Button>
                          
                          {isAccountExpanded && (
                            <div className="tree-children ml-6 space-y-1 mt-1">
                              {accountDocs.map((doc) => (
                                <div key={doc.id} className="group relative">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                      "w-full justify-start p-2 h-auto text-left pr-8",
                                      selectedDocument?.id === doc.id && "bg-primary/10 text-primary border border-primary/20"
                                    )}
                                    onClick={() => onDocumentSelect(doc)}
                                  >
                                    <div className="flex items-center gap-2 mr-2">
                                      <Hash className="h-3 w-3 text-slate-400" />
                                      <span className="text-xs font-mono text-slate-600">
                                        {doc.documentNumber}
                                      </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className={`text-sm font-medium truncate ${getStatusColor(doc.status)}`}>
                                        {doc.displayName || doc.originalName}
                                      </div>
                                      <div className="text-xs text-slate-500 flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {doc.transactionDateFrom && doc.transactionDateTo ? (
                                          <span>
                                            {formatDate(doc.transactionDateFrom)} - {formatDate(doc.transactionDateTo)}
                                          </span>
                                        ) : (
                                          <span>{formatDate(doc.createdAt)}</span>
                                        )}
                                        <span>• {formatFileSize(doc.fileSize)}</span>
                                        {doc.csvGenerated && doc.csvRowCount && (
                                          <span>• CSV: {doc.csvRowCount} rows</span>
                                        )}
                                      </div>
                                    </div>
                                  </Button>
                                  <div
                                    className="absolute right-1 top-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600 rounded cursor-pointer flex items-center justify-center"
                                    onClick={(e) => handleDeleteDocument(doc, e)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()
                ) : (
                  // Render other categories normally
                  categoryDocs.length > 0 ? (
                    categoryDocs.map((doc) => (
                      <div key={doc.id} className="group relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "w-full justify-start p-2 h-auto text-left pr-8",
                            selectedDocument?.id === doc.id && "bg-primary/10 text-primary border border-primary/20"
                          )}
                          onClick={() => onDocumentSelect(doc)}
                        >
                          <FileText className="h-4 w-4 mr-2 text-slate-400" />
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium truncate ${getStatusColor(doc.status)}`}>
                              {doc.displayName || doc.originalName}
                            </div>
                            <div className="text-xs text-slate-500">
                              {formatDate(doc.createdAt)} • {formatFileSize(doc.fileSize)}
                            </div>
                          </div>
                        </Button>
                        <div
                          className="absolute right-1 top-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600 rounded cursor-pointer flex items-center justify-center"
                          onClick={(e) => handleDeleteDocument(doc, e)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="pl-6 py-2 text-xs text-slate-500">
                      No documents in this category
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        );
      })}
      
      {editingDocument && (
        <AccountEditDialog
          document={editingDocument}
          isOpen={true}
          onClose={() => setEditingDocument(null)}
        />
      )}
    </div>
  );
}
