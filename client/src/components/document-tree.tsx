import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Folder, FileText, Edit, Building, Calendar, Hash, Download, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { AccountEditDialog } from "./account-edit-dialog";

interface Document {
  id: number;
  filename: string;
  originalName: string;
  category: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
  // AI-extracted banking information
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
}

interface DocumentTreeProps {
  documents: Document[];
  onDocumentSelect: (document: Document) => void;
  selectedDocument?: Document | null;
}

export default function DocumentTree({ documents, onDocumentSelect, selectedDocument }: DocumentTreeProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['REAL_PROPERTY', 'BANKING']));
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);

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
      if (doc.accountName && doc.accountGroupNumber) {
        const key = `${doc.accountGroupNumber}-${doc.accountName}`;
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
      default:
        return { name: category, color: 'text-gray-500' };
    }
  };

  const categories = ['REAL_PROPERTY', 'BANKING'];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)}MB`;
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
                              <div className="text-sm font-medium text-slate-900 truncate">
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
                      const [groupNumber, accountName] = accountKey.split('-');
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
                                  B{groupNumber}: {accountName}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 hover:bg-slate-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingDocument(firstDoc);
                                  }}
                                >
                                  <Edit className="h-3 w-3 text-slate-400" />
                                </Button>
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
                                  <div className="flex items-center gap-2 mr-2">
                                    <Hash className="h-3 w-3 text-slate-400" />
                                    <span className="text-xs font-mono text-slate-600">
                                      {doc.documentNumber}
                                    </span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-slate-900 truncate">
                                      {doc.originalName}
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
                          <div className="text-sm font-medium text-slate-900 truncate">
                            {doc.originalName}
                          </div>
                          <div className="text-xs text-slate-500">
                            {formatDate(doc.createdAt)} • {formatFileSize(doc.fileSize)}
                          </div>
                        </div>
                      </Button>
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
