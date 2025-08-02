import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function TopNav() {
  const { user } = useAuth();
  const { toast } = useToast();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/logout');
    },
    onSuccess: () => {
      window.location.href = '/';
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to logout. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  if (!user) return null;

  return (
    <div className="fixed top-0 right-0 z-50 p-4">
      <div className="flex items-center gap-3 bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <User className="h-4 w-4" />
          <span className="font-medium">{user.firstName} {user.lastName}</span>
          {user.email && (
            <span className="text-gray-500">({user.email})</span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
          className="text-red-600 border-red-200 hover:bg-red-50"
        >
          <LogOut className="h-4 w-4 mr-1" />
          {logoutMutation.isPending ? 'Signing out...' : 'Sign Out'}
        </Button>
      </div>
    </div>
  );
}