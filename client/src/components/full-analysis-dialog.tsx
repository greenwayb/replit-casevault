import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, AlertCircle, Loader2, BarChart3, X, Clock } from "lucide-react";

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
  const [detailedLog, setDetailedLog] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const steps = [
    "Preparing AI analysis...",
    "Generating XML transaction analysis...",
    "Extracting CSV data from XML...",
    "Creating visualization data...",
    "Finalizing analysis..."
  ];

  const addToLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDetailedLog(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  // Timer effect for elapsed time
  useEffect(() => {
    if (isAnalyzing && startTime) {
      timerRef.current = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isAnalyzing, startTime]);

  const formatElapsedTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const cancelAnalysis = async () => {
    setIsCancelling(true);
    addToLog("Cancellation requested by user");
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      addToLog("AI processing request cancelled");
    }
    
    setIsAnalyzing(false);
    setIsCancelling(false);
    setCurrentStep('Analysis cancelled');
    setError('Analysis was cancelled by user');
    addToLog("Analysis cancelled successfully");
  };

  const startFullAnalysis = async () => {
    setIsAnalyzing(true);
    setError(null);
    setSuccess(false);
    setProgress(0);
    setDetailedLog([]);
    setStartTime(new Date());
    setIsCancelling(false);
    
    // Create new AbortController for cancellation
    abortControllerRef.current = new AbortController();
    
    addToLog("Starting full analysis process");

    try {
      // Simulate progress through steps with cancellation checks
      for (let i = 0; i < steps.length; i++) {
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Analysis cancelled');
        }
        
        setCurrentStep(steps[i]);
        setProgress((i / steps.length) * 90); // Leave 10% for final API processing
        addToLog(`Step ${i + 1}/${steps.length}: ${steps[i]}`);
        
        // Add realistic delay for each step with cancellation check
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, 800 + Math.random() * 1200);
          if (abortControllerRef.current?.signal.aborted) {
            clearTimeout(timeout);
            reject(new Error('Analysis cancelled'));
          }
        });
      }

      addToLog("Sending request to AI service...");
      setCurrentStep("Processing with AI...");
      
      // Make the actual API call with abort signal
      const response = await fetch(`/api/documents/${documentId}/full-analysis`, {
        method: 'POST',
        credentials: 'include',
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        addToLog(`API Error: ${response.status} ${response.statusText}`);
        addToLog(`Error details: ${errorText}`);
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Handle the XML-first workflow response
      if (data.analysisError) {
        addToLog(`Analysis completed with errors: ${data.analysisError}`);
        
        // Show processing step details
        if (data.processingSteps) {
          addToLog(`XML Generated: ${data.processingSteps.xmlGenerated ? 'Yes' : 'No'}`);
          addToLog(`CSV Generated: ${data.processingSteps.csvGenerated ? 'Yes' : 'No'}`);
        }
        
        setCurrentStep('Analysis completed with errors');
        setError(data.analysisError);
        setProgress(100);
        
        // Still call onComplete with partial data for frontend to handle
        setTimeout(() => {
          onComplete(data);
          handleClose();
        }, 2000);
        
      } else {
        addToLog("AI analysis completed successfully");
        
        // Log successful processing steps
        if (data.processingSteps) {
          addToLog(`XML Generated: ${data.processingSteps.xmlGenerated ? 'Yes' : 'No'}`);
          addToLog(`CSV Generated: ${data.processingSteps.csvGenerated ? 'Yes' : 'No'}`);
        }
        
        if (data.csvInfo) {
          addToLog(`CSV file created: ${data.csvInfo.csvRowCount || 0} transactions`);
        }
        
        setProgress(100);
        setCurrentStep('Analysis complete!');
        setSuccess(true);
        addToLog("Analysis process finished");
        
        // Wait a moment before calling onComplete
        setTimeout(() => {
          onComplete(data);
          handleClose();
        }, 1500);
      }

    } catch (error: any) {
      console.error('Full analysis failed:', error);
      addToLog(`Error occurred: ${error.message}`);
      
      if (error.name === 'AbortError' || error.message.includes('cancelled')) {
        setError('Analysis was cancelled');
        addToLog("Analysis cancelled by user request");
      } else {
        setError(`Analysis failed: ${error.message}`);
        addToLog(`Detailed error: ${error.stack || error.toString()}`);
      }
      setIsAnalyzing(false);
    }
  };

  const handleClose = () => {
    // Cancel any ongoing analysis before closing
    if (isAnalyzing && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setIsAnalyzing(false);
    setProgress(0);
    setCurrentStep('');
    setError(null);
    setSuccess(false);
    setDetailedLog([]);
    setStartTime(null);
    setIsCancelling(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Full Transaction Analysis
            </div>
            {isAnalyzing && startTime && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {formatElapsedTime(elapsedTime)}
              </div>
            )}
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  <span className="font-medium">Analyzing Document</span>
                </div>
                

              </div>
              
              <Progress value={progress} className="w-full" />
              
              <p className="text-sm text-muted-foreground">
                {currentStep}
              </p>
              
              {/* Enhanced diagnostics section */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Process Details
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelAnalysis}
                    disabled={isCancelling}
                    className="h-7 px-2 text-xs"
                  >
                    {isCancelling ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        Cancelling...
                      </>
                    ) : (
                      <>
                        <X className="h-3 w-3 mr-1" />
                        Cancel
                      </>
                    )}
                  </Button>
                </div>
                
                {detailedLog.length > 0 && (
                  <div className="max-h-32 overflow-y-auto bg-gray-100 dark:bg-gray-800 rounded p-2">
                    <div className="space-y-1">
                      {detailedLog.slice(-6).map((log, index) => (
                        <p key={index} className="text-xs font-mono text-gray-600 dark:text-gray-400">
                          {log}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                
                <p className="text-xs text-muted-foreground">
                  This process typically takes 1-2 minutes. You can cancel at any time.
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
            <div className="space-y-4">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-3" />
                <h3 className="font-medium text-red-800 dark:text-red-200 mb-2">
                  Analysis Failed
                </h3>
                <p className="text-sm text-red-600 dark:text-red-300">
                  {error}
                </p>
              </div>
              
              {/* Detailed error log */}
              {detailedLog.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                  <p className="text-xs font-medium text-red-700 dark:text-red-300 mb-2">
                    Diagnostic Log:
                  </p>
                  <div className="max-h-32 overflow-y-auto bg-red-100 dark:bg-red-900/40 rounded p-2">
                    <div className="space-y-1">
                      {detailedLog.map((log, index) => (
                        <p key={index} className="text-xs font-mono text-red-700 dark:text-red-300">
                          {log}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
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