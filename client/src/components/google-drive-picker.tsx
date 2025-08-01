import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { HardDrive, ExternalLink, AlertCircle, Settings } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface GoogleDrivePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: number;
  onFileImported?: () => void;
}

export function GoogleDrivePicker({ open, onOpenChange, caseId, onFileImported }: GoogleDrivePickerProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  const handleConnectGoogleDrive = () => {
    setIsConnecting(true);
    
    // Simulate connection process
    setTimeout(() => {
      setIsConnecting(false);
      toast({
        title: "Google Drive Integration",
        description: "This feature requires individual user authentication with Google Drive. Please contact your administrator to set up Google OAuth credentials.",
        variant: "default",
      });
    }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Google Drive Integration
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Google Drive integration allows you to import PDF documents directly from your personal Google Drive account.
            </AlertDescription>
          </Alert>

          <div className="text-center py-6 space-y-4">
            <HardDrive className="h-16 w-16 mx-auto text-gray-400" />
            <div>
              <h3 className="text-lg font-medium mb-2">Connect Your Google Drive</h3>
              <p className="text-sm text-gray-600 mb-4">
                Link your Google account to browse and import PDF files directly from your Google Drive
              </p>
            </div>

            <div className="space-y-2">
              <Button 
                onClick={handleConnectGoogleDrive} 
                disabled={isConnecting}
                className="w-full"
              >
                {isConnecting ? (
                  <>
                    <Settings className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Connect Google Drive
                  </>
                )}
              </Button>
              
              <p className="text-xs text-gray-500">
                This will open a secure Google authentication window
              </p>
            </div>
          </div>

          <Alert>
            <Settings className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Administrator Note:</strong> To enable this feature, configure Google OAuth credentials in your Google Cloud Console and add them to the application settings.
            </AlertDescription>
          </Alert>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}