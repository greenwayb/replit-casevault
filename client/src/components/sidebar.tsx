import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

interface SidebarProps {
  user: any;
}

export default function Sidebar({ user }: SidebarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const getInitials = (user: any) => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  const getDisplayName = (user: any) => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user?.email) {
      return user.email;
    }
    return 'User';
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="md:hidden fixed top-4 left-4 z-50">
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
        w-64 legal-sidebar shadow-xl border-r-2 border-slate-200 flex flex-col
        md:relative md:translate-x-0 md:z-auto
        fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4 md:p-6 border-b border-slate-300">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">DocuFlow</h1>
              <p className="text-xs md:text-sm text-slate-600 mt-1 font-medium">Legal Document System</p>
            </div>
            {/* Close button for mobile */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden p-1"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      
        {/* User Info */}
        <div className="p-3 md:p-4 border-b border-slate-300 legal-document-section">
          <div className="flex items-center space-x-3">
            <Avatar className="h-8 w-8 md:h-10 md:w-10 ring-2 ring-primary/20 flex-shrink-0">
              <AvatarImage src={user?.profileImageUrl} alt={getDisplayName(user)} />
              <AvatarFallback className="bg-primary text-white text-xs md:text-sm font-semibold">
                {getInitials(user)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 text-sm md:text-base truncate">{getDisplayName(user)}</p>
              <p className="text-xs text-slate-600 font-medium">Legal Professional</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 md:p-4">
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
            onClick={() => window.location.href = '/api/logout'}
          >
            <LogOut className="h-4 w-4 mr-2 md:mr-3 flex-shrink-0" />
            <span className="truncate">Sign Out</span>
          </Button>
        </div>
      </aside>
    </>
  );
}
