import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  LayoutDashboard, 
  Folder, 
  FileText, 
  Users, 
  LogOut 
} from "lucide-react";

interface SidebarProps {
  user: any;
}

export default function Sidebar({ user }: SidebarProps) {
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
    <aside className="w-64 legal-sidebar shadow-xl border-r-2 border-slate-200 flex flex-col">
      <div className="p-6 border-b border-slate-300">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">DocuFlow</h1>
        <p className="text-sm text-slate-600 mt-1 font-medium">Legal Document System</p>
      </div>
      
      {/* User Info */}
      <div className="p-4 border-b border-slate-300 legal-document-section">
        <div className="flex items-center space-x-3">
          <Avatar className="h-10 w-10 ring-2 ring-primary/20">
            <AvatarImage src={user?.profileImageUrl} alt={getDisplayName(user)} />
            <AvatarFallback className="bg-primary text-white text-sm font-semibold">
              {getInitials(user)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-slate-900">{getDisplayName(user)}</p>
            <p className="text-xs text-slate-600 font-medium">Legal Professional</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-3">
          <li>
            <Button
              variant="secondary"
              className="w-full justify-start bg-primary/10 text-primary hover:bg-primary/15 font-semibold border border-primary/20"
            >
              <LayoutDashboard className="h-4 w-4 mr-3" />
              Dashboard
            </Button>
          </li>
          <li>
            <Button
              variant="ghost"
              className="w-full justify-start text-slate-700 hover:bg-slate-100 font-medium"
            >
              <Folder className="h-4 w-4 mr-3" />
              My Cases
            </Button>
          </li>
          <li>
            <Button
              variant="ghost"
              className="w-full justify-start text-slate-700 hover:bg-slate-100 font-medium"
            >
              <FileText className="h-4 w-4 mr-3" />
              Documents
            </Button>
          </li>
          <li>
            <Button
              variant="ghost"
              className="w-full justify-start text-slate-700 hover:bg-slate-100 font-medium"
            >
              <Users className="h-4 w-4 mr-3" />
              Case Members
            </Button>
          </li>
        </ul>
      </nav>

      {/* Sign Out */}
      <div className="p-4 border-t border-slate-300">
        <Button
          variant="ghost"
          className="w-full justify-start text-slate-600 hover:bg-slate-100 font-medium"
          onClick={() => window.location.href = '/api/logout'}
        >
          <LogOut className="h-4 w-4 mr-3" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
