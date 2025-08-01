import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit3, Check, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

interface EditableCaseTitleProps {
  caseId: number;
  currentTitle: string;
  userRole: string;
  className?: string;
}

export default function EditableCaseTitle({ 
  caseId, 
  currentTitle, 
  userRole, 
  className = "" 
}: EditableCaseTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(currentTitle);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateTitleMutation = useMutation({
    mutationFn: async (newTitle: string) => {
      const response = await apiRequest("PUT", `/api/cases/${caseId}/title`, { title: newTitle });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Case title updated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId.toString()] });
      setIsEditing(false);
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
        description: "Failed to update case title. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEdit = () => {
    setEditValue(currentTitle);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (editValue.trim() === currentTitle.trim()) {
      setIsEditing(false);
      return;
    }
    
    if (editValue.trim().length === 0) {
      toast({
        title: "Error",
        description: "Case title cannot be empty",
        variant: "destructive",
      });
      return;
    }

    updateTitleMutation.mutate(editValue.trim());
  };

  const handleCancel = () => {
    setEditValue(currentTitle);
    setIsEditing(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  // Only show edit functionality for CASEADMIN users
  if (userRole !== 'CASEADMIN') {
    return <span className={className}>{currentTitle}</span>;
  }

  if (isEditing) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyPress}
          className="h-8 text-sm"
          placeholder="Enter case title..."
          autoFocus
          disabled={updateTitleMutation.isPending}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSave}
          disabled={updateTitleMutation.isPending}
          className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCancel}
          disabled={updateTitleMutation.isPending}
          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-2 group ${className}`}>
      <span>{currentTitle}</span>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleEdit}
        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-slate-700 hover:bg-slate-100"
      >
        <Edit3 className="h-3 w-3" />
      </Button>
    </div>
  );
}