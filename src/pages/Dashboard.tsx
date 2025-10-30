import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { 
  Shield, 
  Upload, 
  Download, 
  Trash2, 
  Users, 
  Files, 
  UserCheck,
  Edit3,
  Eye,
  FileText,
  Settings,
  LogOut,
  User,
  ChevronDown,
  Home,
  FolderOpen,
  Activity
} from "lucide-react";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const getRoleConfig = (role: string) => {
    switch (role) {
      case "Admin":
        return {
          color: "bg-red-500 text-white",
          variant: "destructive" as const,
          icon: Shield,
          permissions: ["Upload Files", "Download Files", "Delete Files", "Manage Users"],
          description: "Full access to all FileVault features"
        };
      case "Editor":
        return {
          color: "bg-blue-500 text-white",
          variant: "default" as const,
          icon: Edit3,
          permissions: ["Upload Files", "Download Files"],
          description: "Can upload and download files"
        };
      case "Viewer":
        return {
          color: "bg-green-500 text-white",
          variant: "secondary" as const,
          icon: Eye,
          permissions: ["Upload Files", "Download Files"],
          description: "Can upload and download files"
        };
      default:
        return {
          color: "bg-gray-500 text-white",
          variant: "secondary" as const,
          icon: UserCheck,
          permissions: [],
          description: "No permissions assigned"
        };
    }
  };

  const roleConfig = getRoleConfig(user?.role || "");
  const RoleIcon = roleConfig.icon;

  const canUpload = user?.role === "Admin" || user?.role === "Editor" || user?.role === "Viewer";
  const canDelete = user?.role === "Admin";
  const canManageUsers = user?.role === "Admin";

  const getFirstName = (email: string) => {
    const username = email?.split('@')[0];
    const firstName = username?.split('.')[0];
    return firstName?.charAt(0).toUpperCase() + firstName?.slice(1);
  };

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center space-x-2 px-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">FileVault</span>
          </div>
        </SidebarHeader>
        
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => navigate("/dashboard")} className="flex items-center space-x-2">
                    <Home className="h-4 w-4" />
                    <span>Dashboard</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>File Management</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => navigate("/files")} className="flex items-center space-x-2">
                    <FileText className="h-4 w-4" />
                    <span>View All Files</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {canUpload && (
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => navigate("/upload")} className="flex items-center space-x-2">
                      <Upload className="h-4 w-4" />
                      <span>Upload Files</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {canManageUsers && (
            <SidebarGroup>
              <SidebarGroupLabel>User Management</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => navigate("/users")} className="flex items-center space-x-2">
                      <Users className="h-4 w-4" />
                      <span>Manage Users</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => navigate("/manage-roles")} className="flex items-center space-x-2">
                      <Users className="h-4 w-4" />
                      <span>Manage Roles</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>


        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton className="flex items-center space-x-2">
                <Activity className="h-4 w-4" />
                <span>Recent Activity</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        {/* Header */}
        <header className="border-b bg-card shadow-sm">
          <div className="flex h-16 items-center px-4">
            <SidebarTrigger className="-ml-1" />
            <div className="flex-1" />
            
            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2 h-auto p-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {user?.email?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <Badge 
                    className={`${roleConfig.color} text-xs`}
                  >
                    <RoleIcon className="h-2 w-2 mr-1" />
                    {user?.role}
                  </Badge>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user?.email}</p>
                    <div className="flex items-center space-x-1">
                      <RoleIcon className="h-3 w-3" />
                      <Badge className={`${roleConfig.color} text-xs`}>
                        {user?.role} Access
                      </Badge>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => window.location.href = '/profile'}>
                  <User className="mr-2 h-4 w-4" />
                  <span>View Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Account Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={logout}
                  className="text-red-600 focus:text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="flex-1 p-6">
          {/* Welcome Section */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">
              Welcome back, {user?.fullName || getFirstName(user?.email || '')}!
            </h2>
            <p className="text-muted-foreground">{roleConfig.description}</p>
          </div>

          {/* Main Content */}
          <div className="space-y-6">
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Your recent file operations and system events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No recent activity to display</p>
                  <p className="text-sm">Start uploading and managing files to see activity here</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default Dashboard;