import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Folder, 
  FileText, 
  Users, 
  LogOut,
  Menu,
  X
} from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";


interface SidebarProps {
  user: any;
}

export default function Sidebar({ user }: SidebarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { toast } = useToast();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      console.log("Starting logout mutation...");
      try {
        const response = await apiRequest("/api/logout", "POST", {});
        console.log("Logout response:", response.status);
        const result = await response.json();
        console.log("Logout result:", result);
        return result;
      } catch (error) {
        console.error("Logout API error:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("Logout successful, clearing cache and redirecting...", data);
      // Clear all cached queries and redirect to auth page
      queryClient.clear();
      window.location.href = "/auth";
    },
    onError: (error: Error) => {
      console.error("Logout mutation error:", error);
      toast({
        title: "Logout failed", 
        description: error.message,
        variant: "destructive",
      });
    },
  });
  


  return (
    <>
      {/* Mobile Menu Button */}
      <div className="md:hidden fixed top-20 left-4 z-50">
        <Button
          variant="outline"
          size="sm"
          className="bg-white shadow-lg border-slate-300"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        w-64 legal-sidebar shadow-xl border-r-2 border-slate-200 flex flex-col pt-16 md:pt-0
        md:relative md:translate-x-0 md:z-auto
        fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Mobile close button */}
        <div className="md:hidden p-2 border-b border-slate-300 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="p-1"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 md:p-4 pt-4">
          <ul className="space-y-2 md:space-y-3">
            <li>
              <Button
                variant="secondary"
                className="w-full justify-start bg-primary/10 text-primary hover:bg-primary/15 font-semibold border border-primary/20 text-sm md:text-base py-2 md:py-2.5 touch-manipulation"
              >
                <LayoutDashboard className="h-4 w-4 mr-2 md:mr-3 flex-shrink-0" />
                <span className="truncate">Dashboard</span>
              </Button>
            </li>
            <li>
              <Button
                variant="ghost"
                className="w-full justify-start text-slate-700 hover:bg-slate-100 font-medium text-sm md:text-base py-2 md:py-2.5 touch-manipulation"
              >
                <Folder className="h-4 w-4 mr-2 md:mr-3 flex-shrink-0" />
                <span className="truncate">My Cases</span>
              </Button>
            </li>
            <li>
              <Button
                variant="ghost"
                className="w-full justify-start text-slate-700 hover:bg-slate-100 font-medium text-sm md:text-base py-2 md:py-2.5 touch-manipulation"
              >
                <FileText className="h-4 w-4 mr-2 md:mr-3 flex-shrink-0" />
                <span className="truncate">Documents</span>
              </Button>
            </li>
            <li>
              <Button
                variant="ghost"
                className="w-full justify-start text-slate-700 hover:bg-slate-100 font-medium text-sm md:text-base py-2 md:py-2.5 touch-manipulation"
              >
                <Users className="h-4 w-4 mr-2 md:mr-3 flex-shrink-0" />
                <span className="truncate">Case Members</span>
              </Button>
            </li>
          </ul>
        </nav>

        {/* Sign Out */}
        <div className="p-3 md:p-4 border-t border-slate-300">
          <Button
            variant="ghost"
            className="w-full justify-start text-slate-600 hover:bg-slate-100 font-medium text-sm md:text-base py-2 md:py-2.5 touch-manipulation"
            onClick={() => {
              console.log("Logout button clicked!");
              logoutMutation.mutate();
            }}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="h-4 w-4 mr-2 md:mr-3 flex-shrink-0" />
            <span className="truncate">
              {logoutMutation.isPending ? "Signing Out..." : "Sign Out"}
            </span>
          </Button>
        </div>
      </aside>
    </>
  );
}
