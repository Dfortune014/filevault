import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Users as UsersIcon, 
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
  UserPlus,
  Activity,
  Search,
  MoreHorizontal,
  Calendar,
  ArrowLeft,
  Crown,
  UserCog,
  Link as LinkIcon,
  Unlink
} from "lucide-react";
import { userService, UserInfo } from "@/services/userService";
import { useToast } from "@/hooks/use-toast";

const Users = () => {
  const { user: currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showDelegateDialog, setShowDelegateDialog] = useState(false);
  const [newRole, setNewRole] = useState<string>("");
  const [selectedEditor, setSelectedEditor] = useState<string>("");

  const getRoleConfig = (role: string) => {
    switch (role) {
      case "Admin":
        return {
          color: "!bg-red-500 !text-white",
          variant: "destructive" as const,
          icon: Crown,
          description: "Full system access with user management capabilities"
        };
      case "Editor":
        return {
          color: "!bg-blue-500 !text-white",
          variant: "default" as const,
          icon: Edit3,
          description: "Can create and modify files"
        };
      case "Viewer":
        return {
          color: "!bg-green-500 !text-white",
          variant: "secondary" as const,
          icon: Eye,
          description: "Read-only access to files"
        };
      default:
        return {
          color: "!bg-gray-500 !text-white",
          variant: "secondary" as const,
          icon: UserCheck,
          description: "No role assigned"
        };
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("🔍 Loading users...");
      console.log("🔧 API Endpoint:", import.meta.env.VITE_API_ENDPOINT);
      const response = await userService.listUsers();
      console.log("📋 Users response:", response);
      // Normalize user data to match expected interface
      const rawUsers = response.users || [];
      console.log("🔧 Users - Raw API response structure:", rawUsers.map((u: any) => ({
        userId: u.userId,
        email: u.email,
        sub: u.sub,
        id: u.id,
        fullName: u.fullName,
        name: u.name,
        role: u.role
      })));
      const users = rawUsers.map((user: any) => ({
        id: user.sub || user.userId || user.id, // Use sub claim if available, fallback to userId
        email: user.email || user.userId || 'Unknown',
        fullName: user.fullName || user.name || 'Unknown User',
        role: user.role || 'Viewer',
        delegatedEditor: user.delegatedEditor || null,
        createdAt: user.createdAt || new Date().toISOString(),
        lastLogin: user.lastLogin || null,
        status: user.status || 'active'
      }));
      console.log("🔄 Normalized users:", users);
      setUsers(users);
    } catch (err: any) {
      console.error("❌ Error loading users:", err);
      setError(err.message);
      setUsers([]); // Ensure users is always an array even on error
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = (users || []).filter(user =>
    user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRoleChange = async () => {
    if (!selectedUser || !newRole) return;

    try {
      await userService.updateUserRole(selectedUser.id, { role: newRole as any });
      toast({
        title: "Success",
        description: `User role updated to ${newRole}`,
      });
      setShowRoleDialog(false);
      setSelectedUser(null);
      setNewRole("");
      await loadUsers();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleDelegateChange = async () => {
    if (!selectedUser) return;

    try {
      const editorId = selectedEditor === "none" ? undefined : selectedEditor;
      await userService.delegateUser(selectedUser.id, { editorId });
      
      const message = editorId 
        ? `User delegated to editor` 
        : `User delegation removed`;
      
      toast({
        title: "Success",
        description: message,
      });
      setShowDelegateDialog(false);
      setSelectedUser(null);
      setSelectedEditor("");
      await loadUsers();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEditorOptions = () => {
    return (users || []).filter(user => user.role === 'Editor');
  };

  // Check if current user is admin
  if (currentUser?.role !== "Admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-secondary p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600">Access Denied</CardTitle>
            <CardDescription>
              You need Admin privileges to access this page.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link to="/dashboard">Return to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => navigate("/dashboard")}>
                    <Home className="h-4 w-4 md:h-[1.15rem] md:w-[1.15rem]" />
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
                  <SidebarMenuButton onClick={() => navigate("/files")}>
                    <FileText className="h-4 w-4 md:h-[1.15rem] md:w-[1.15rem]" />
                    <span>View All Files</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => navigate("/upload")}>
                    <Upload className="h-4 w-4 md:h-[1.15rem] md:w-[1.15rem]" />
                    <span>Upload Files</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>User Management</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => navigate("/users")}>
                    <UsersIcon className="h-4 w-4 md:h-[1.15rem] md:w-[1.15rem]" />
                    <span>Manage Users</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => navigate("/manage-roles")}>
                    <UsersIcon className="h-4 w-4 md:h-[1.15rem] md:w-[1.15rem]" />
                    <span>Manage Roles</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <Activity className="h-4 w-4 md:h-[1.15rem] md:w-[1.15rem]" />
                <span>Recent Activity</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
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
                      {currentUser?.email?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <Badge className="!bg-red-500 !text-white text-xs shrink-0 hidden sm:inline-flex">
                    <Crown className="h-2 w-2 mr-1" />
                    Admin
                  </Badge>
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{currentUser?.email}</p>
                    <div className="flex items-center space-x-1">
                      <Crown className="h-3 w-3" />
                      <Badge className="!bg-red-500 !text-white text-xs">
                        Admin Access
                      </Badge>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
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
          <div className="p-4 sm:p-6 lg:p-8">
            {/* Header Section */}
            <div className="mb-6 md:mb-8">
              <div className="flex items-center space-x-4 mb-4">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate("/dashboard")}
                  className="flex items-center space-x-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Dashboard</span>
                </Button>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">
                User Management
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground">Manage user roles and permissions</p>
            </div>

            {/* Search and Stats */}
            <div className="mb-6 space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button onClick={loadUsers} variant="outline" className="w-full sm:w-auto shrink-0">
                  Refresh
                </Button>
              </div>
              
              <div className="flex items-center space-x-4 text-xs sm:text-sm text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <UsersIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span>{filteredUsers.length} users</span>
                </div>
              </div>
            </div>

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
              <CardDescription>
                {loading ? "Loading users..." : `${filteredUsers.length} users found`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-muted-foreground mt-2">Loading users...</p>
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <div className="text-red-500 mb-2">Error loading users</div>
                  <p className="text-muted-foreground mb-4">{error}</p>
                  <Button onClick={loadUsers}>Try Again</Button>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UsersIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No users found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Delegate</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => {
                      const roleConfig = getRoleConfig(user.role);
                      const RoleIcon = roleConfig.icon;
                      
                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary text-primary-foreground">
                                  {user.fullName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || '?'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{user.fullName || 'Unknown User'}</div>
                                <div className="text-sm text-muted-foreground">
                                  {user.email || 'No email'}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${roleConfig.color} text-xs`}>
                              <RoleIcon className="h-3 w-3 mr-1" />
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {user.delegatedEditor ? (
                              <div className="flex items-center space-x-1">
                                <LinkIcon className="h-3 w-3 text-green-500" />
                                <span className="text-sm text-green-600">Delegated</span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">None</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                              {user.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{formatDate(user.createdAt)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>User Actions</DropdownMenuLabel>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setNewRole(user.role);
                                    setShowRoleDialog(true);
                                  }}
                                >
                                  <UserCog className="mr-2 h-4 w-4" />
                                  Change Role
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setSelectedEditor(user.delegatedEditor || "none");
                                    setShowDelegateDialog(true);
                                  }}
                                >
                                  {user.delegatedEditor ? (
                                    <>
                                      <Unlink className="mr-2 h-4 w-4" />
                                      Unlink Delegate
                                    </>
                                  ) : (
                                    <>
                                      <LinkIcon className="mr-2 h-4 w-4" />
                                      Assign Delegate
                                    </>
                                  )}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          </div>
        </div>
      </SidebarInset>
      </div>

      {/* Role Change Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Update the role for {selectedUser?.fullName || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role">New Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Editor">Editor</SelectItem>
                  <SelectItem value="Viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRoleChange}>
              Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delegate Dialog */}
      <Dialog open={showDelegateDialog} onOpenChange={setShowDelegateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage User Delegate</DialogTitle>
            <DialogDescription>
              Assign or remove delegate for {selectedUser?.fullName || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editor">Select Editor</Label>
              <Select value={selectedEditor} onValueChange={setSelectedEditor}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an editor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No delegate</SelectItem>
                  {getEditorOptions().map((editor) => (
                    <SelectItem key={editor.id} value={editor.id}>
                      {editor.fullName} ({editor.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelegateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleDelegateChange}>
              Update Delegate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
};

export default Users;
