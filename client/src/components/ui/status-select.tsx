import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { StatusBadge } from "./status-badge";

interface StatusSelectProps {
  documentId: number;
  currentStatus: string;
  userRole: string;
  caseId: number;
  onStatusChange?: (newStatus: string) => void;
}

export function StatusSelect({ 
  documentId, 
  currentStatus, 
  userRole, 
  caseId,
  onStatusChange 
}: StatusSelectProps) {
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [isEditing, setIsEditing] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Define which transitions are allowed for each role
  const getAvailableStatuses = (current: string, role: string) => {
    const statuses = [];
    
    // DISCLOSER/CASEADMIN can mark UPLOADED as READYFORREVIEW
    if (current === 'UPLOADED' && ['DISCLOSER', 'CASEADMIN'].includes(role)) {
      statuses.push('READYFORREVIEW');
    }
    
    // REVIEWER/DISCLOSER/CASEADMIN can mark READYFORREVIEW as REVIEWED
    if (current === 'READYFORREVIEW' && ['REVIEWER', 'DISCLOSER', 'CASEADMIN'].includes(role)) {
      statuses.push('REVIEWED');
    }
    
    // REVIEWER/DISCLOSER/CASEADMIN can mark REVIEWED as WITHDRAWN
    if (current === 'REVIEWED' && ['REVIEWER', 'DISCLOSER', 'CASEADMIN'].includes(role)) {
      statuses.push('WITHDRAWN');
    }
    
    // DISCLOSER/CASEADMIN/REVIEWER can mark WITHDRAWN as REVIEWED again
    if (current === 'WITHDRAWN' && ['DISCLOSER', 'CASEADMIN', 'REVIEWER'].includes(role)) {
      statuses.push('REVIEWED');
    }
    
    return statuses;
  };

  const availableStatuses = getAvailableStatuses(currentStatus, userRole);

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const response = await apiRequest('PATCH', `/api/documents/${documentId}/status`, {
        status
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases', caseId] });
      toast({
        title: "Status Updated",
        description: `Document status changed to ${data.status}`,
      });
      onStatusChange?.(data.status);
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update document status",
        variant: "destructive",
      });
      setSelectedStatus(currentStatus); // Reset to original
    },
  });

  const handleStatusChange = (newStatus: string) => {
    setSelectedStatus(newStatus);
  };

  const handleSave = () => {
    if (selectedStatus !== currentStatus) {
      updateStatusMutation.mutate(selectedStatus);
    } else {
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setSelectedStatus(currentStatus);
    setIsEditing(false);
  };

  // If no status changes are allowed, just show the badge
  if (availableStatuses.length === 0) {
    return <StatusBadge status={currentStatus} />;
  }

  // If not editing, show badge with edit option
  if (!isEditing) {
    return (
      <div className="flex items-center gap-2">
        <StatusBadge status={currentStatus} />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsEditing(true)}
          className="h-6 px-2 text-xs"
        >
          Change
        </Button>
      </div>
    );
  }

  // Show select dropdown with save/cancel buttons
  return (
    <div className="flex items-center gap-2">
      <Select value={selectedStatus} onValueChange={handleStatusChange}>
        <SelectTrigger className="w-40">
          <SelectValue>
            <StatusBadge status={selectedStatus} />
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={currentStatus}>
            <StatusBadge status={currentStatus} />
          </SelectItem>
          {availableStatuses.map((status) => (
            <SelectItem key={status} value={status}>
              <StatusBadge status={status} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        onClick={handleSave}
        disabled={updateStatusMutation.isPending}
        className="h-8 px-3"
      >
        {updateStatusMutation.isPending ? "Saving..." : "Save"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCancel}
        disabled={updateStatusMutation.isPending}
        className="h-8 px-3"
      >
        Cancel
      </Button>
    </div>
  );
}