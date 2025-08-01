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
    <aside className="w-64 bg-white shadow-lg border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">DocuFlow</h1>
        <p className="text-sm text-gray-600 mt-1">Document Management</p>
      </div>
      
      {/* User Info */}
      <div className="p-4 border-b border-gray-200 bg-blue-50">
        <div className="flex items-center space-x-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user?.profileImageUrl} alt={getDisplayName(user)} />
            <AvatarFallback className="bg-primary text-white text-sm">
              {getInitials(user)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-gray-900">{getDisplayName(user)}</p>
            <p className="text-xs text-gray-600">Document Manager</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          <li>
            <Button
              variant="secondary"
              className="w-full justify-start bg-blue-100 text-primary hover:bg-blue-200"
            >
              <LayoutDashboard className="h-4 w-4 mr-3" />
              Dashboard
            </Button>
          </li>
          <li>
            <Button
              variant="ghost"
              className="w-full justify-start text-gray-700 hover:bg-gray-100"
            >
              <Folder className="h-4 w-4 mr-3" />
              My Cases
            </Button>
          </li>
          <li>
            <Button
              variant="ghost"
              className="w-full justify-start text-gray-700 hover:bg-gray-100"
            >
              <FileText className="h-4 w-4 mr-3" />
              Documents
            </Button>
          </li>
          <li>
            <Button
              variant="ghost"
              className="w-full justify-start text-gray-700 hover:bg-gray-100"
            >
              <Users className="h-4 w-4 mr-3" />
              Team
            </Button>
          </li>
        </ul>
      </nav>

      {/* Sign Out */}
      <div className="p-4 border-t border-gray-200">
        <Button
          variant="ghost"
          className="w-full justify-start text-gray-700 hover:bg-gray-100"
          onClick={() => window.location.href = '/api/logout'}
        >
          <LogOut className="h-4 w-4 mr-3" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
