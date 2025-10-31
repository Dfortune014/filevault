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
  SidebarGroup,
  SidebarGroupContent,
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
  Users, 
  UserCheck,
  Edit3,
  Eye,
  FileText,
  Settings,
  LogOut,
  User,
  ChevronDown,
  Home
} from "lucide-react";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const getRoleConfig = (role: string) => {
    switch (role) {
      case "Admin":
        return {
          color: "!bg-red-500 !text-white",
          icon: Shield,
          description: "Full access to all FileVault features"
        };
      case "Editor":
        return {
          color: "!bg-blue-500 !text-white",
          icon: Edit3,
          description: "Can upload and download files"
        };
      case "Viewer":
        return {
          color: "!bg-green-500 !text-white",
          icon: Eye,
          description: "Can upload and download files"
        };
      default:
        return {
          color: "!bg-gray-500 !text-white",
          icon: UserCheck,
          description: "No permissions assigned"
        };
    }
  };

  const roleConfig = getRoleConfig(user?.role || "");
  const RoleIcon = roleConfig.icon;

  const canUpload = user?.role === "Admin" || user?.role === "Editor" || user?.role === "Viewer";
  const canManageUsers = user?.role === "Admin";

  const getFirstName = (email: string) => {
    const username = email?.split('@')[0];
    const firstName = username?.split('.')[0];
    return firstName?.charAt(0).toUpperCase() + firstName?.slice(1);
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen overflow-x-hidden">
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center space-x-2">
            <Shield className="h-5 w-5 md:h-6 md:w-6 text-primary shrink-0" />
            <span className="text-base md:text-lg font-bold whitespace-nowrap">FileVault</span>
          </div>
        </SidebarHeader>
        
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => navigate("/dashboard")}>
                    <Home className="h-4 w-4 md:h-[1.15rem] md:w-[1.15rem]" />
                    <span>Dashboard</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => navigate("/files")}>
                    <FileText className="h-4 w-4 md:h-[1.15rem] md:w-[1.15rem]" />
                    <span>My Files</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {canUpload && (
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => navigate("/upload")}>
                      <Upload className="h-4 w-4 md:h-[1.15rem] md:w-[1.15rem]" />
                      <span>Upload</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {canManageUsers && (
                  <>
                    <SidebarMenuItem>
                      <SidebarMenuButton onClick={() => navigate("/users")}>
                        <Users className="h-4 w-4 md:h-[1.15rem] md:w-[1.15rem]" />
                        <span>Users</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton onClick={() => navigate("/manage-roles")}>
                        <UserCheck className="h-4 w-4 md:h-[1.15rem] md:w-[1.15rem]" />
                        <span>Roles</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <SidebarInset>
        {/* Header */}
        <header className="border-b bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60 shadow-sm sticky top-0 z-10">
          <div className="flex h-14 md:h-16 items-center px-3 md:px-4 lg:px-6">
            <SidebarTrigger />
            <div className="flex-1" />
            
            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 h-9 md:h-10 px-2 md:px-3 shrink-0">
                  <Avatar className="h-7 w-7 md:h-8 md:w-8 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {user?.email?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <Badge 
                    className={`${roleConfig.color} text-xs shrink-0 hidden sm:inline-flex`}
                  >
                    <RoleIcon className="h-2 w-2 mr-1" />
                    {user?.role}
                  </Badge>
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
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

        <div className="flex-1 overflow-y-auto">
          <div className="w-full p-4 sm:p-6 lg:p-8">
            {/* Welcome Section */}
            <div className="mb-6 md:mb-8">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">
                Welcome, {user?.fullName || getFirstName(user?.email || '')}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                {roleConfig.description}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Card className="cursor-pointer hover:shadow-md transition-all hover:scale-[1.02] h-full">
                <CardHeader onClick={() => navigate("/files")}>
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
                    My Files
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">View and manage your files</CardDescription>
                </CardHeader>
              </Card>
              
              {canUpload && (
                <Card className="cursor-pointer hover:shadow-md transition-all hover:scale-[1.02] h-full">
                  <CardHeader onClick={() => navigate("/upload")}>
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <Upload className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
                      Upload Files
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Upload new files to FileVault</CardDescription>
                  </CardHeader>
                </Card>
              )}
              
              {canManageUsers && (
                <>
                  <Card className="cursor-pointer hover:shadow-md transition-all hover:scale-[1.02] h-full">
                    <CardHeader onClick={() => navigate("/users")}>
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
                        Manage Users
                      </CardTitle>
                      <CardDescription className="text-xs sm:text-sm">Add and manage team members</CardDescription>
                    </CardHeader>
                  </Card>
                  
                  <Card className="cursor-pointer hover:shadow-md transition-all hover:scale-[1.02] h-full">
                    <CardHeader onClick={() => navigate("/manage-roles")}>
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
                        Manage Roles
                      </CardTitle>
                      <CardDescription className="text-xs sm:text-sm">Assign permissions and roles</CardDescription>
                    </CardHeader>
                  </Card>
                </>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;