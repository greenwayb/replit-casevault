import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AccountEditDialogProps {
  document: any;
  isOpen: boolean;
  onClose: () => void;
}

export function AccountEditDialog({ document, isOpen, onClose }: AccountEditDialogProps) {
  const [accountName, setAccountName] = useState(document?.accountName || "");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateAccountMutation = useMutation({
    mutationFn: async (newAccountName: string) => {
      return await apiRequest(`/api/documents/${document.id}/account`, {
        method: "PATCH",
        body: { accountName: newAccountName },
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Account name updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", document.caseId] });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update account name",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (accountName.trim()) {
      updateAccountMutation.mutate(accountName.trim());
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="legal-card">
        <DialogHeader>
          <DialogTitle className="text-slate-900 font-bold">Edit Account Name</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="accountName" className="text-sm font-medium text-slate-700">
                Account Name
              </Label>
              <Input
                id="accountName"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g., Main Business Account"
                className="mt-1"
              />
            </div>
            {document?.financialInstitution && (
              <div className="text-sm text-slate-600">
                <strong>Bank:</strong> {document.financialInstitution}
              </div>
            )}
            {document?.accountNumber && (
              <div className="text-sm text-slate-600">
                <strong>Account:</strong> {document.accountNumber}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="legal-button-primary"
              disabled={updateAccountMutation.isPending || !accountName.trim()}
            >
              {updateAccountMutation.isPending ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}