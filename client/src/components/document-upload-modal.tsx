import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { isUnauthorizedError } from "@/lib/authUtils";
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
import { CloudUpload } from "lucide-react";

const uploadDocumentSchema = z.object({
  category: z.enum(["REAL_PROPERTY", "BANKING"], {
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
        
        return result;
      }

      setUploadPhase('complete');
      return response.json();
    },
    onSuccess: () => {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Select a PDF file and choose the appropriate category
          </DialogDescription>
        </DialogHeader>
        
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
      </DialogContent>
    </Dialog>
  );
}
