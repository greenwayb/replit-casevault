import { Button } from "@/components/ui/button";
import { Download, Maximize2, FileText, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Document {
  id: number;
  filename: string;
  originalName: string;
  category: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

interface DocumentViewerProps {
  document?: Document | null;
}

export default function DocumentViewer({ document }: DocumentViewerProps) {
  const { toast } = useToast();

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
      const a = document.createElement('a');
      a.href = url;
      a.download = document.originalName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

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
      {/* Document Header */}
      <div className="p-6 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{document.originalName}</h3>
            <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
              <span className="flex items-center">
                <Calendar className="h-3 w-3 mr-1" />
                Uploaded: {formatDate(document.createdAt)}
              </span>
              <span>Size: {formatFileSize(document.fileSize)}</span>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button 
              variant="outline"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button variant="outline">
              <Maximize2 className="h-4 w-4 mr-2" />
              Full Screen
            </Button>
          </div>
        </div>
      </div>
      
      {/* PDF Viewer Area */}
      <div className="flex-1 p-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full">
          <iframe
            src={`/api/documents/${document.id}/view`}
            className="w-full h-full rounded-lg"
            title={document.originalName}
          />
        </div>
      </div>
    </div>
  );
}
