import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, AlertCircle, Loader2, BarChart3 } from "lucide-react";

interface FullAnalysisDialogProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: number;
  onComplete: (data: any) => void;
}

export default function FullAnalysisDialog({ 
  isOpen, 
  onClose, 
  documentId, 
  onComplete 
}: FullAnalysisDialogProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const steps = [
    "Analyzing document content...",
    "Extracting transaction data...",
    "Categorizing transactions...",
    "Generating CSV file...",
    "Creating XML analysis...",
    "Generating Sankey flow data...",
    "Finalizing analysis..."
  ];

  const startFullAnalysis = async () => {
    setIsAnalyzing(true);
    setError(null);
    setSuccess(false);
    setProgress(0);

    try {
      // Simulate progress through steps
      for (let i = 0; i < steps.length; i++) {
        setCurrentStep(steps[i]);
        setProgress((i / steps.length) * 100);
        
        // Add realistic delay for each step
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      }

      // Make the actual API call
      const response = await fetch(`/api/documents/${documentId}/full-analysis`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to complete full analysis');
      }

      const data = await response.json();
      
      setProgress(100);
      setCurrentStep('Analysis complete!');
      setSuccess(true);
      
      // Wait a moment before calling onComplete
      setTimeout(() => {
        onComplete(data);
        handleClose();
      }, 1500);

    } catch (error) {
      console.error('Full analysis failed:', error);
      setError(error instanceof Error ? error.message : 'Analysis failed');
      setIsAnalyzing(false);
    }
  };

  const handleClose = () => {
    if (!isAnalyzing) {
      setProgress(0);
      setCurrentStep('');
      setError(null);
      setSuccess(false);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Full Transaction Analysis
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!isAnalyzing && !success && !error && (
            <div className="text-center space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                  Ready for Full Analysis
                </h3>
                <p className="text-sm text-blue-600 dark:text-blue-300">
                  This will analyze all transactions, generate the Sankey flow diagram, 
                  create CSV exports, and provide detailed XML analysis data.
                </p>
              </div>
              <Button 
                onClick={startFullAnalysis}
                className="w-full bg-blue-600 hover:bg-blue-700"
                size="lg"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Start Full Analysis
              </Button>
            </div>
          )}

          {isAnalyzing && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <span className="font-medium">Analyzing Document</span>
              </div>
              
              <Progress value={progress} className="w-full" />
              
              <p className="text-sm text-muted-foreground">
                {currentStep}
              </p>
              
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  This process typically takes 1-2 minutes. Please wait while we analyze 
                  your banking document and generate comprehensive transaction data.
                </p>
              </div>
            </div>
          )}

          {success && (
            <div className="text-center space-y-4">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
              <div>
                <h3 className="font-medium text-green-800 dark:text-green-200">
                  Analysis Complete!
                </h3>
                <p className="text-sm text-green-600 dark:text-green-300 mt-1">
                  Your banking document has been fully analyzed. The Sankey diagram 
                  and detailed data are now available.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-red-600 mx-auto" />
              <div>
                <h3 className="font-medium text-red-800 dark:text-red-200">
                  Analysis Failed
                </h3>
                <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                  {error}
                </p>
              </div>
              <Button 
                onClick={startFullAnalysis}
                variant="outline"
                className="w-full"
              >
                Try Again
              </Button>
            </div>
          )}
        </div>

        {!isAnalyzing && (
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}