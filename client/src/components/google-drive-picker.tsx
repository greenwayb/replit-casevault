import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Search, FileText, Download, Loader2, RefreshCw, HardDrive, ExternalLink, AlertCircle, Settings } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface GoogleDriveFile {
  id: string;
  name: string;
  size: string;
  modifiedTime: string;
  webViewLink: string;
  thumbnailLink?: string;
}

interface GoogleDrivePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: number;
  onFileImported?: () => void;
}

export function GoogleDrivePicker({ open, onOpenChange, caseId, onFileImported }: GoogleDrivePickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check Google Drive authentication status
  const { data: authStatus, refetch: checkAuthStatus } = useQuery({
    queryKey: ['/api/google-drive/auth-status'],
    enabled: open,
  });

  // List Google Drive files
  const { data: driveFiles, isLoading: filesLoading, refetch: refreshFiles } = useQuery({
    queryKey: ['/api/google-drive/files', searchQuery],
    enabled: open && authStatus?.authenticated,
    refetchOnWindowFocus: false,
  });

  // Import selected files mutation
  const importFilesMutation = useMutation({
    mutationFn: async (fileIds: string[]) => {
      return await apiRequest('/api/google-drive/import', {
        method: 'POST',
        body: JSON.stringify({
          fileIds,
          caseId
        }),
      });
    },
    onSuccess: (data) => {
      toast({
        title: 'Success',
        description: `${data.importedCount} file(s) imported successfully`,
      });
      setSelectedFiles(new Set());
      onFileImported?.();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to import files',
        variant: 'destructive',
      });
    },
  });

  const authenticateWithGoogle = async () => {
    setIsAuthenticating(true);
    try {
      // Get the auth URL from the server
      const response = await fetch('/api/google-drive/auth', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get authentication URL');
      }
      
      const { authUrl } = await response.json();
      
      // Open Google authentication in a popup window
      const authWindow = window.open(authUrl, 'googleAuth', 'width=600,height=600');
      
      // Listen for authentication completion
      const messageListener = (event: MessageEvent) => {
        if (event.data.type === 'GOOGLE_DRIVE_AUTH_SUCCESS') {
          authWindow?.close();
          window.removeEventListener('message', messageListener);
          
          // Refresh authentication status
          checkAuthStatus();
          
          toast({
            title: "Success",
            description: "Connected to Google Drive successfully!",
          });
        }
      };
      
      window.addEventListener('message', messageListener);
      
      // Check if window was closed manually
      const checkClosed = setInterval(() => {
        if (authWindow?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageListener);
          setIsAuthenticating(false);
        }
      }, 1000);
      
    } catch (error: any) {
      console.error('Authentication error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to connect to Google Drive. Please check your configuration.",
        variant: "destructive",
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleFileToggle = (fileId: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId);
    } else {
      newSelection.add(fileId);
    }
    setSelectedFiles(newSelection);
  };

  const handleImportSelected = () => {
    if (selectedFiles.size > 0) {
      importFilesMutation.mutate(Array.from(selectedFiles));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Google Drive Integration
          </DialogTitle>
        </DialogHeader>

        {!authStatus?.authenticated ? (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Connect your Google Drive account to browse and import PDF documents directly.
              </AlertDescription>
            </Alert>

            <div className="text-center py-6 space-y-4">
              <HardDrive className="h-16 w-16 mx-auto text-gray-400" />
              <div>
                <h3 className="text-lg font-medium mb-2">Connect Your Google Drive</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Authenticate with Google to access your PDF files
                </p>
              </div>

              <Button 
                onClick={authenticateWithGoogle} 
                disabled={isAuthenticating}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isAuthenticating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Connect Google Drive
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search PDF files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refreshFiles()}
                disabled={filesLoading}
              >
                <RefreshCw className={`h-4 w-4 ${filesLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            <ScrollArea className="h-96 border rounded-lg">
              {filesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  Loading files...
                </div>
              ) : driveFiles?.files?.length > 0 ? (
                <div className="p-4 space-y-2">
                  {driveFiles.files.map((file: GoogleDriveFile) => (
                    <div
                      key={file.id}
                      className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50"
                    >
                      <Checkbox
                        checked={selectedFiles.has(file.id)}
                        onCheckedChange={() => handleFileToggle(file.id)}
                      />
                      <FileText className="h-5 w-5 text-red-600" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {file.size && `${file.size} • `}
                          {new Date(file.modifiedTime).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(file.webViewLink, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No PDF files found in your Google Drive
                </div>
              )}
            </ScrollArea>

            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                {selectedFiles.size} file(s) selected
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImportSelected}
                  disabled={selectedFiles.size === 0 || importFilesMutation.isPending}
                >
                  {importFilesMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Import Selected ({selectedFiles.size})
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}