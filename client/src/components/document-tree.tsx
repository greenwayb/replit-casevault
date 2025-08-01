import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Folder, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface Document {
  id: number;
  filename: string;
  originalName: string;
  category: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

interface DocumentTreeProps {
  documents: Document[];
  onDocumentSelect: (document: Document) => void;
  selectedDocument?: Document | null;
}

export default function DocumentTree({ documents, onDocumentSelect, selectedDocument }: DocumentTreeProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['REAL_PROPERTY']));

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const groupedDocuments = documents.reduce((acc, doc) => {
    if (!acc[doc.category]) {
      acc[doc.category] = [];
    }
    acc[doc.category].push(doc);
    return acc;
  }, {} as Record<string, Document[]>);

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
              className="w-full justify-start p-2 h-auto"
              onClick={() => toggleCategory(category)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-400 mr-2" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400 mr-2" />
              )}
              <Folder className={cn("h-4 w-4 mr-2", categoryInfo.color)} />
              <span className="font-medium text-gray-900 flex-1 text-left">
                {categoryInfo.name}
              </span>
              <span className="text-xs text-gray-500 ml-auto">
                ({categoryDocs.length})
              </span>
            </Button>
            
            {isExpanded && (
              <div className="tree-children ml-6 space-y-1">
                {categoryDocs.length > 0 ? (
                  categoryDocs.map((doc) => (
                    <Button
                      key={doc.id}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "w-full justify-start p-2 h-auto text-sm",
                        selectedDocument?.id === doc.id 
                          ? "bg-blue-50 text-blue-700 hover:bg-blue-100" 
                          : "hover:bg-blue-50"
                      )}
                      onClick={() => onDocumentSelect(doc)}
                    >
                      <FileText className="h-4 w-4 text-red-500 mr-2" />
                      <span className="text-gray-700 truncate">
                        {doc.originalName}
                      </span>
                    </Button>
                  ))
                ) : (
                  <div className="pl-6 py-2 text-xs text-gray-500">
                    No documents in this category
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
