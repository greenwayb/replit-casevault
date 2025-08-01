import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { isUnauthorizedError } from "@/lib/authUtils";
import BankingConfirmationModal from "./banking-confirmation-modal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CloudUpload, HardDrive } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GoogleDrivePicker } from "./google-drive-picker";

const uploadDocumentSchema = z.object({
  category: z.enum(["REAL_PROPERTY", "BANKING", "TAXATION", "SUPERANNUATION", "EMPLOYMENT", "SHARES_INVESTMENTS", "VEHICLES"], {
    required_error: "Please select a category",
  }),
  file: z
    .any()
    .refine((file) => file instanceof File, "Please select a file")
    .refine((file) => file?.type === "application/pdf", "Only PDF files are allowed")
    .refine((file) => file?.size <= 50 * 1024 * 1024, "File size must be less than 50MB"),
});

type UploadDocumentFormData = z.infer<typeof uploadDocumentSchema>;

interface DocumentUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: number;
}

export default function DocumentUploadModal({ open, onOpenChange, caseId }: DocumentUploadModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [aiProgress, setAiProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<'upload' | 'ai' | 'complete'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showBankingConfirmation, setShowBankingConfirmation] = useState(false);
  const [pendingBankingData, setPendingBankingData] = useState<any>(null);
  const [showGoogleDrivePicker, setShowGoogleDrivePicker] = useState(false);
  
  const form = useForm<UploadDocumentFormData>({
    resolver: zodResolver(uploadDocumentSchema),
    defaultValues: {
      category: undefined,
      file: undefined,
    },
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async (data: UploadDocumentFormData) => {
      // Reset progress states
      setUploadProgress(0);
      setAiProgress(0);
      setUploadPhase('upload');

      const formData = new FormData();
      formData.append("file", data.file);
      formData.append("category", data.category);

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return 95;
          }
          return prev + Math.random() * 10;
        });
      }, 100);

      const response = await fetch(`/api/cases/${caseId}/documents`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status}: ${errorText}`);
      }

      // Start AI processing phase for Banking documents
      if (data.category === 'BANKING') {
        setUploadPhase('ai');
        
        // Simulate AI processing progress
        const aiInterval = setInterval(() => {
          setAiProgress(prev => {
            if (prev >= 95) {
              clearInterval(aiInterval);
              return 95;
            }
            return prev + Math.random() * 8;
          });
        }, 200);

        const result = await response.json();
        
        clearInterval(aiInterval);
        setAiProgress(100);
        setUploadPhase('complete');
        
        // Check if this is a banking document with extracted info that needs confirmation
        // OR if AI processing failed and needs manual review
        if (result.extractedBankingInfo) {
          setPendingBankingData(result);
          setShowBankingConfirmation(true);
          return result; // Don't close modal yet, wait for confirmation
        }
        
        return result;
      }

      setUploadPhase('complete');
      return response.json();
    },
    onSuccess: (result) => {
      // Only show success and close modal if not waiting for banking confirmation
      if (!result.extractedBankingInfo) {
        toast({
          title: "Success",
          description: "Document uploaded and processed successfully!",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId.toString()] });
        form.reset();
        setSelectedFile(null);
        setUploadProgress(0);
        setAiProgress(0);
        setUploadPhase('upload');
        onOpenChange(false);
      }
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
        description: "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UploadDocumentFormData) => {
    uploadDocumentMutation.mutate(data);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      form.setValue("file", file);
      form.clearErrors("file");
    }
  };

  const handleBankingConfirm = async (confirmedInfo: any) => {
    try {
      // For manual review, we need to generate document numbers
      const isManual = pendingBankingData.aiProcessingFailed;
      
      await fetch(`/api/documents/${pendingBankingData.id}/confirm-banking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          bankingInfo: {
            ...confirmedInfo,
            documentNumber: isManual ? 'B1.1' : pendingBankingData.extractedBankingInfo.documentNumber,
            accountGroupNumber: isManual ? '1' : pendingBankingData.extractedBankingInfo.accountGroupNumber,
          },
          csvInfo: pendingBankingData.extractedBankingInfo.csvInfo,
          isManualReview: isManual
        })
      });

      toast({
        title: "Success",
        description: "Banking document confirmed and saved successfully!",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId.toString()] });
      form.reset();
      setSelectedFile(null);
      setUploadProgress(0);
      setAiProgress(0);
      setUploadPhase('upload');
      setPendingBankingData(null);
      setShowBankingConfirmation(false);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to confirm banking information",
        variant: "destructive",
      });
    }
  };

  const handleBankingReject = async () => {
    try {
      await fetch(`/api/documents/${pendingBankingData.id}/reject-banking`, {
        method: 'POST',
        credentials: 'include',
      });

      toast({
        title: "Success",
        description: "Document uploaded without banking information extraction",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId.toString()] });
      form.reset();
      setSelectedFile(null);
      setUploadProgress(0);
      setAiProgress(0);
      setUploadPhase('upload');
      setPendingBankingData(null);
      setShowBankingConfirmation(false);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to process document rejection",
        variant: "destructive",
      });
    }
  };

  const handleGoogleDriveImported = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId.toString()] });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload documents from your device or import directly from Google Drive
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="local" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="local" className="flex items-center gap-2">
                <CloudUpload className="h-4 w-4" />
                Local Upload
              </TabsTrigger>
              <TabsTrigger value="google-drive" className="flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                Google Drive
              </TabsTrigger>
            </TabsList>

            <TabsContent value="local" className="mt-6">
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a category..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="REAL_PROPERTY">A) Real Property</SelectItem>
                      <SelectItem value="BANKING">B) Banking</SelectItem>
                      <SelectItem value="TAXATION">C) Taxation</SelectItem>
                      <SelectItem value="SUPERANNUATION">D) Superannuation</SelectItem>
                      <SelectItem value="EMPLOYMENT">E) Employment</SelectItem>
                      <SelectItem value="SHARES_INVESTMENTS">F) Shares/Investments</SelectItem>
                      <SelectItem value="VEHICLES">G) Vehicles</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="file"
              render={() => (
                <FormItem>
                  <FormLabel>Document File</FormLabel>
                  <FormControl>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary transition-colors">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handleFileChange}
                        className="hidden"
                        id="fileInput"
                      />
                      <label htmlFor="fileInput" className="cursor-pointer">
                        <CloudUpload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        {selectedFile ? (
                          <p className="text-gray-600">{selectedFile.name}</p>
                        ) : (
                          <p className="text-gray-600">Click to upload PDF file</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">Maximum file size: 50MB</p>
                      </label>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Progress Bars */}
            {uploadDocumentMutation.isPending && (
              <div className="space-y-4">
                {/* File Upload Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">File Upload</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>

                {/* AI Processing Progress */}
                {uploadPhase === 'ai' && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">AI Processing</span>
                      <span>{Math.round(aiProgress)}%</span>
                    </div>
                    <Progress value={aiProgress} className="h-2" />
                    <p className="text-xs text-gray-500">
                      Extracting metadata and generating CSV from Banking document...
                    </p>
                  </div>
                )}

                {uploadPhase === 'complete' && (
                  <div className="text-sm text-green-600 font-medium">
                    ✓ Upload and processing complete!
                  </div>
                )}
              </div>
            )}

            <div className="flex space-x-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1"
                onClick={() => onOpenChange(false)}
                disabled={uploadDocumentMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="flex-1 bg-primary hover:bg-blue-700"
                disabled={uploadDocumentMutation.isPending}
              >
                {uploadDocumentMutation.isPending ? (
                  uploadPhase === 'upload' ? "Uploading..." : 
                  uploadPhase === 'ai' ? "Processing..." : "Finalizing..."
                ) : "Upload Document"}
              </Button>
            </div>
          </form>
        </Form>
            </TabsContent>

            <TabsContent value="google-drive" className="mt-6">
              <div className="text-center py-6">
                <HardDrive className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium mb-2">Import from Google Drive</h3>
                <p className="text-gray-600 mb-4">
                  Browse and import PDF documents directly from your Google Drive
                </p>
                <Button onClick={() => setShowGoogleDrivePicker(true)}>
                  Open Google Drive Picker
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
        
        {/* Banking Confirmation Modal */}
        {pendingBankingData && (
          <BankingConfirmationModal
            open={showBankingConfirmation}
            onOpenChange={setShowBankingConfirmation}
            bankingInfo={pendingBankingData.extractedBankingInfo}
            onConfirm={handleBankingConfirm}
            onReject={handleBankingReject}
            documentId={pendingBankingData.id}
            isManualReview={pendingBankingData.aiProcessingFailed}
          />
        )}
      </Dialog>

      {/* Google Drive Picker Modal */}
      <GoogleDrivePicker
        open={showGoogleDrivePicker}
        onOpenChange={setShowGoogleDrivePicker}
        caseId={caseId}
        onFileImported={handleGoogleDriveImported}
      />
    </>
  );
}
