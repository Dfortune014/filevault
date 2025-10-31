import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  FolderOpen as FilesIcon, 
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
  HardDrive,
  Folder,
  ChevronRight,
  Users as UsersIcon
} from "lucide-react";
import { fileService, FileInfo } from "@/services/fileService";
import { userService, UserInfo } from "@/services/userService";
import { useToast } from "@/hooks/use-toast";

const Files = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const getRoleConfig = (role: string) => {
    switch (role) {
      case "Admin":
        return {
          color: "!bg-red-500 !text-white",
          variant: "destructive" as const,
          icon: Shield,
          permissions: ["Upload Files", "Download Files", "Delete Files", "Manage Users"],
          description: "Full access to all FileVault features"
        };
      case "Editor":
        return {
          color: "!bg-blue-500 !text-white",
          variant: "default" as const,
          icon: Edit3,
          permissions: ["Upload Files", "Download Files"],
          description: "Can upload and download files"
        };
      case "Viewer":
        return {
          color: "!bg-green-500 !text-white",
          variant: "secondary" as const,
          icon: Eye,
          permissions: ["Upload Files", "Download Files"],
          description: "Can upload and download files"
        };
      default:
        return {
          color: "!bg-gray-500 !text-white",
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
  const canManageUsers = user?.role === "Admin";
  
  // Role-based delete permission check
  const canDeleteFile = (file: FileInfo): boolean => {
    if (!user) return false;
    
    const isOwnFile = file.ownerEmail === user.email || file.ownerId === user.sub;
    
    switch (user.role) {
      case "Admin":
        // Admins can delete any file
        return true;
      case "Editor":
        // Editors can delete their own files + delegated users' files
        if (isOwnFile) return true;
        
        // Check if file belongs to a delegated viewer
        const isDelegatedFile = users.some(u =>
          (u.email === file.ownerEmail || u.id === file.ownerId) &&
          u.delegatedEditor === user.sub
        );
        return isDelegatedFile;
      case "Viewer":
        // Viewers can only delete their own files
        return isOwnFile;
      default:
        return false;
    }
  };

  // Role-based file filtering (simplified - backend handles delegation)
  const getFilteredFiles = (allFiles: FileInfo[]) => {
    if (!user) return [];
    
    switch (user.role) {
      case "Admin":
        // Admins see all files
        return allFiles;
      case "Editor":
        // Backend already filters files for Editors (own + delegated)
        // Just return all files sent by backend
        console.log("🧩 Editor: Trusting backend delegation filtering");
        return allFiles;
      case "Viewer":
        // Backend already filters files for Viewers (own only)
        // Just return all files sent by backend
        console.log("🧩 Viewer: Trusting backend file filtering");
        return allFiles;
      default:
        return [];
    }
  };

  // Group files by owner with delegation status
  const groupFilesByOwner = (files: FileInfo[]) => {
    const groups: Record<string, FileInfo[]> = {};
    
    files.forEach(file => {
      const ownerKey = file.ownerEmail || file.ownerId || 'Unknown';
      const ownerName = file.ownerName || ownerKey;
      
      if (!groups[ownerKey]) {
        groups[ownerKey] = [];
      }
      groups[ownerKey].push(file);
    });
    
    return groups;
  };

  // Get owner display info with delegation status
  const getOwnerDisplayInfo = (ownerKey: string) => {
    const isCurrentUser = ownerKey === user?.email || ownerKey === user?.sub;
    
    if (isCurrentUser) {
      return {
        name: "Your Files",
        isDelegated: false,
        isOwn: true
      };
    }
    
    // For Editors and Viewers without users data, show basic info
    if (!users || users.length === 0) {
      return {
        name: ownerKey,
        isDelegated: false, // Can't determine delegation status without users data
        isOwn: false
      };
    }
    
    // For Admins with users data, show full delegation info
    const ownerUser = users.find(u => u.email === ownerKey || u.id === ownerKey);
    const isDelegated = ownerUser?.delegatedEditor === user?.sub;
    
    return {
      name: ownerUser?.fullName || ownerKey,
      isDelegated: isDelegated,
      isOwn: false
    };
  };

  // Toggle folder expansion
  const toggleFolder = (ownerKey: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(ownerKey)) {
      newExpanded.delete(ownerKey);
    } else {
      newExpanded.add(ownerKey);
    }
    setExpandedFolders(newExpanded);
  };

  const getFirstName = (email: string) => {
    const username = email?.split('@')[0];
    const firstName = username?.split('.')[0];
    return firstName?.charAt(0).toUpperCase() + firstName?.slice(1);
  };

  const loadUsers = async () => {
    // Only load users for Admin and Editor roles (they need delegation info)
    if (!user || (user.role !== "Admin" && user.role !== "Editor")) {
      console.log("🔒 Skipping users load - not Admin or Editor role");
      return [];
    }

    try {
      const response = await userService.listUsers();
      console.log("📋 Users loaded in Files page:", response.users);
      // Normalize user data to match expected interface
      const rawUsers = response.users || [];
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
      setUsers(users);
      return users;
    } catch (err: any) {
      console.error("❌ Error loading users:", err);
      console.log("🔒 Users endpoint restricted - falling back to basic file filtering");
      // Don't show error toast for users loading failure, just log it
      return [];
    }
  };

  const loadFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load files first
      const filesResponse = await fileService.listFiles();
      console.log("📋 Files loaded in Files page:", filesResponse.files);
      setFiles(filesResponse.files || []);
      
      // Only load users for Admins (they need it for user management UI)
      if (user?.role === "Admin") {
        const usersData = await loadUsers();
        console.log("👥 Users loaded in Files page:", usersData);
      } else {
        console.log("🧩 Skipping user fetch — backend handles delegation for Editors/Viewers");
      }
    } catch (err: any) {
      console.error("❌ Error loading files:", err);
      setError(err.message);
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
    loadFiles();
  }, []);

  const handleDownload = async (file: FileInfo) => {
    try {
      if (!file.key && !file.fileId) {
        throw new Error("File key or file ID is missing. Cannot download this file.");
      }
      if (!file.fileName) {
        throw new Error("File name is missing. Cannot download this file.");
      }

      console.log("📁 Downloading file:", file);
      
      await fileService.downloadFile(file.key, file.fileName, file.fileId);
      toast({
        title: "Success",
        description: `Downloading ${file.fileName}`,
      });
    } catch (err: any) {
      console.error("❌ Download error:", err);
      toast({
        title: "Download Failed",
        description: err.message || "Failed to download file",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (file: FileInfo) => {
    // Check role-based delete permission
    if (!canDeleteFile(file)) {
      const message = user?.role === "Viewer" 
        ? "You can only delete your own files"
        : user?.role === "Editor"
        ? "You can only delete your own files or files from delegated viewers"
        : "You don't have permission to delete this file";
      
      toast({
        title: "Access Denied",
        description: message,
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`Are you sure you want to delete "${file.fileName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const deletedFileName = await fileService.deleteFile(file.key, file.fileId);
      toast({
        title: "Success",
        description: `✅ File "${deletedFileName}" deleted successfully`,
      });
      
      // Refresh the file list
      await loadFiles();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  // Apply role-based filtering first, then search filtering
  const roleFilteredFiles = getFilteredFiles(files);
  const filteredFiles = roleFilteredFiles.filter(file =>
    file.fileName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false
  );
  
  // Group files by owner for display
  const groupedFiles = groupFilesByOwner(filteredFiles);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
                {canUpload && (
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => navigate("/upload")}>
                      <Upload className="h-4 w-4 md:h-[1.15rem] md:w-[1.15rem]" />
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
                    <SidebarMenuButton onClick={() => navigate("/users")}>
                      <Users className="h-4 w-4 md:h-[1.15rem] md:w-[1.15rem]" />
                      <span>Manage Users</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => navigate("/manage-roles")}>
                      <Users className="h-4 w-4 md:h-[1.15rem] md:w-[1.15rem]" />
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
          <div className="p-4 sm:p-6 lg:p-8">
            {/* Header Section */}
            <div className="mb-6 md:mb-8">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">
                {user?.role === "Admin" ? "All Files" : 
                 user?.role === "Editor" ? "My Files & Delegated Files" : 
                 "My Files"}
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                {user?.role === "Admin" ? "View and manage all files in your FileVault" :
                 user?.role === "Editor" ? "View your files and files from delegated users" :
                 "Upload, view and download your files"}
              </p>
            </div>

          {/* Search and Stats */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search files..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={loadFiles} variant="outline" className="w-full sm:w-auto shrink-0">
                Refresh
              </Button>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
              <div className="flex items-center space-x-1">
                <FilesIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>{filteredFiles.length} files</span>
              </div>
              <div className="flex items-center space-x-1">
                <UsersIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>{Object.keys(groupedFiles).length} user{Object.keys(groupedFiles).length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center space-x-1">
                <HardDrive className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>
                  {fileService.formatFileSize(
                    filteredFiles.reduce((total, file) => total + (file.size || 0), 0)
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Files Table */}
          <Card>
            <CardHeader>
              <CardTitle>Files</CardTitle>
              <CardDescription>
                {loading ? "Loading files..." : 
                 `${filteredFiles.length} files found across ${Object.keys(groupedFiles).length} user${Object.keys(groupedFiles).length !== 1 ? 's' : ''}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-muted-foreground mt-2">Loading files...</p>
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <div className="text-red-500 mb-2">Error loading files</div>
                  <p className="text-muted-foreground mb-4">{error}</p>
                  <Button onClick={loadFiles}>Try Again</Button>
                </div>
              ) : Object.keys(groupedFiles).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FilesIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No files found</p>
                  <p className="text-sm">
                    {user?.role === "Viewer" ? "Upload your first file to get started" : "Upload some files to get started"}
                  </p>
                  {canUpload && (
                    <Button onClick={() => navigate("/upload")} className="mt-4">
                      Upload Files
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedFiles).map(([ownerKey, ownerFiles]) => {
                    const ownerInfo = getOwnerDisplayInfo(ownerKey);
                    const isExpanded = expandedFolders.has(ownerKey);
                    
                    return (
                      <Card key={ownerKey} className="overflow-hidden">
                        <Collapsible open={isExpanded} onOpenChange={() => toggleFolder(ownerKey)}>
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer transition-colors">
                              <div className="flex items-center space-x-3">
                                <div className="flex items-center space-x-2">
                                  <ChevronRight 
                                    className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                                  />
                                  <Folder className={`h-5 w-5 ${ownerInfo.isOwn ? 'text-green-500' : 'text-blue-500'}`} />
                                </div>
                                <div>
                                  <div className="font-medium flex items-center space-x-2">
                                    <span>{ownerInfo.name}</span>
                                    <span className="text-muted-foreground">📁</span>
                                    {ownerInfo.isDelegated && (
                                      <Badge variant="secondary" className="text-xs">
                                        Delegated
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {ownerFiles.length} file{ownerFiles.length !== 1 ? 's' : ''}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                <span>
                                  {fileService.formatFileSize(
                                    ownerFiles.reduce((total, file) => total + (file.size || 0), 0)
                                  )}
                                </span>
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border-t">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Size</TableHead>
                                    <TableHead>Modified</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {ownerFiles.map((file) => {
                                    console.log("🔍 Rendering file in table:", file);
                                    return (
                                    <TableRow key={file.key || file.fileName}>
                                      <TableCell>
                                        <div className="flex items-center space-x-3">
                                          <span className="text-2xl">
                                            {fileService.getFileIcon(file.fileName || '')}
                                          </span>
                                          <div>
                                            <div className="font-medium">{file.fileName || 'Unknown File'}</div>
                                            <div className="text-sm text-muted-foreground">
                                              {file.key || 'No key'}
                                            </div>
                                          </div>
                                        </div>
                                      </TableCell>
                                      <TableCell>{fileService.formatFileSize(file.size || 0)}</TableCell>
                                      <TableCell>
                                        <div className="flex items-center space-x-1">
                                          <Calendar className="h-3 w-3 text-muted-foreground" />
                                          <span>{file.lastModified ? formatDate(file.lastModified) : 'Unknown'}</span>
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
                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => handleDownload(file)}>
                                              <Download className="mr-2 h-4 w-4" />
                                              Download
                                            </DropdownMenuItem>
                                            {canDeleteFile(file) && (
                                              <DropdownMenuItem 
                                                onClick={() => handleDelete(file)}
                                                className="text-red-600 focus:text-red-600"
                                              >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Delete
                                              </DropdownMenuItem>
                                            )}
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </TableCell>
                                    </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          </div>
        </div>
      </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Files;
