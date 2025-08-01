import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  FileText, 
  Search, 
  Download, 
  Calendar, 
  HardDrive,
  ExternalLink,
  Loader2,
  CheckCircle
} from 'lucide-react';

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { toast } = useToast();

  // Check Google Drive authentication status
  const { data: authStatus, refetch: checkAuth } = useQuery({
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
    onError: (error) => {
      toast({
        title: 'Import Failed',
        description: error.message || 'Failed to import files from Google Drive',
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (authStatus) {
      setIsAuthenticated(authStatus.authenticated);
    }
  }, [authStatus]);

  const formatFileSize = (sizeInBytes: string) => {
    const size = parseInt(sizeInBytes);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleFileToggle = (fileId: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedFiles(newSelected);
  };

  const handleAuthenticate = () => {
    window.open('/api/google-drive/auth', '_blank', 'width=500,height=600');
    // Poll for authentication status
    const pollAuth = setInterval(() => {
      checkAuth().then(() => {
        if (authStatus?.authenticated) {
          clearInterval(pollAuth);
          refreshFiles();
        }
      });
    }, 2000);

    // Clear polling after 5 minutes
    setTimeout(() => clearInterval(pollAuth), 300000);
  };

  const handleImportFiles = () => {
    if (selectedFiles.size === 0) {
      toast({
        title: 'No Files Selected',
        description: 'Please select at least one file to import',
        variant: 'destructive',
      });
      return;
    }

    importFilesMutation.mutate(Array.from(selectedFiles));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Import from Google Drive
          </DialogTitle>
        </DialogHeader>

        {!isAuthenticated ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <HardDrive className="h-16 w-16 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900">Connect to Google Drive</h3>
            <p className="text-center text-gray-600 max-w-md">
              Authenticate with Google Drive to browse and import your PDF documents directly into this case.
            </p>
            <Button onClick={handleAuthenticate} className="mt-4">
              <ExternalLink className="h-4 w-4 mr-2" />
              Connect Google Drive
            </Button>
          </div>
        ) : (
          <div className="flex flex-col space-y-4 flex-1 min-h-0">
            {/* Search Bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search PDF files in your Google Drive..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button 
                onClick={() => refreshFiles()}
                variant="outline"
                disabled={filesLoading}
              >
                {filesLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Refresh'
                )}
              </Button>
            </div>

            {/* File List */}
            <ScrollArea className="flex-1 border rounded-lg">
              <div className="p-4 space-y-2">
                {filesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Loading files...</span>
                  </div>
                ) : driveFiles?.files?.length > 0 ? (
                  driveFiles.files.map((file: GoogleDriveFile) => (
                    <Card
                      key={file.id}
                      className={`cursor-pointer transition-all ${
                        selectedFiles.has(file.id) 
                          ? 'ring-2 ring-primary bg-primary/5' 
                          : 'hover:shadow-md'
                      }`}
                      onClick={() => handleFileToggle(file.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div className="flex-shrink-0">
                              {selectedFiles.has(file.id) ? (
                                <CheckCircle className="h-5 w-5 text-primary" />
                              ) : (
                                <FileText className="h-5 w-5 text-gray-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-gray-900 truncate">
                                {file.name}
                              </h4>
                              <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                                <span className="flex items-center">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  {formatDate(file.modifiedTime)}
                                </span>
                                <Badge variant="secondary">
                                  {formatFileSize(file.size)}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(file.webViewLink, '_blank');
                            }}
                            className="flex-shrink-0"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No PDF files found in your Google Drive</p>
                    {searchQuery && (
                      <p className="text-sm mt-2">
                        Try adjusting your search terms or check if you have PDF files in your Drive
                      </p>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm text-gray-600">
                {selectedFiles.size > 0 && (
                  <span>{selectedFiles.size} file(s) selected for import</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleImportFiles}
                  disabled={selectedFiles.size === 0 || importFilesMutation.isPending}
                >
                  {importFilesMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Import Selected Files
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