import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { fileService, FileUploadProgress } from "@/services/fileService";
import { userService, UserInfo } from "@/services/userService";
import { 
  Upload as UploadIcon, 
  File, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  X,
  CloudUpload,
  Users as UsersIcon
} from "lucide-react";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  status: 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

const Upload = () => {
  const { user } = useAuth();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [targetUserId, setTargetUserId] = useState<string>("");
  const [availableUsers, setAvailableUsers] = useState<UserInfo[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Load available users based on role
  useEffect(() => {
    const loadAvailableUsers = async () => {
      if (!user) return;

      // Viewers don't need user list (self-upload only)
      if (user.role === "Viewer") {
        return;
      }

      setLoadingUsers(true);
      try {
        if (user.role === "Admin") {
          // Admins can upload to any user
          const response = await userService.listUsers();
          const rawUsers = response.users || [];
          const users = rawUsers.map((u: any) => ({
            id: u.sub || u.userId || u.id,
            email: u.email || u.userId || 'Unknown',
            fullName: u.fullName || u.name || 'Unknown User',
            role: u.role || 'Viewer',
            delegatedEditor: u.delegatedEditor || null,
            createdAt: u.createdAt || new Date().toISOString(),
            lastLogin: u.lastLogin || null,
            status: u.status || 'active'
          }));
          setAvailableUsers(users);
        } else if (user.role === "Editor") {
          // Editors can upload to delegated viewers only
          // Use dedicated /api/users/delegated endpoint
          const response = await userService.listDelegatedUsers();
          const rawUsers = response.users || [];
          const users = rawUsers.map((u: any) => ({
            id: u.sub || u.userId || u.id,
            email: u.email || u.userId || 'Unknown',
            fullName: u.fullName || u.name || 'Unknown User',
            role: u.role || 'Viewer',
            delegatedEditor: u.delegatedEditor || null,
            createdAt: u.createdAt || new Date().toISOString(),
            lastLogin: u.lastLogin || null,
            status: u.status || 'active'
          }));
          
          setAvailableUsers(users);
        }
      } catch (error: any) {
        toast({
          title: "Warning",
          description: "Could not load user list. You can still upload to yourself.",
          variant: "default",
        });
      } finally {
        setLoadingUsers(false);
      }
    };

    loadAvailableUsers();
  }, [user]);

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const newFiles: UploadedFile[] = Array.from(selectedFiles).map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      status: 'uploading',
      progress: 0,
    }));

    setFiles(prev => [...prev, ...newFiles]);
    uploadFiles(Array.from(selectedFiles), newFiles);
  };

  const uploadFiles = async (fileObjects: File[], fileItems: UploadedFile[]) => {
    setIsUploading(true);

    for (let i = 0; i < fileObjects.length; i++) {
      const file = fileObjects[i];
      const fileItem = fileItems[i];

      try {
        await fileService.uploadFileWithProgress(
          file,
          (progress: FileUploadProgress) => {
            setFiles(prev => prev.map(f => 
              f.id === fileItem.id 
                ? { ...f, progress: progress.percentage }
                : f
            ));
          },
          targetUserId || undefined // Pass targetUserId if selected
        );

        // Mark as successful
        setFiles(prev => prev.map(f => 
          f.id === fileItem.id 
            ? { ...f, status: 'success', progress: 100 }
            : f
        ));

        toast({
          title: "Upload Successful",
          description: `${file.name} has been uploaded successfully.`,
        });

      } catch (error: any) {
        // Mark as error
        setFiles(prev => prev.map(f => 
          f.id === fileItem.id 
            ? { 
                ...f, 
                status: 'error', 
                error: error.message || 'Upload failed'
              }
            : f
        ));

        toast({
          title: "Upload Failed",
          description: `Failed to upload ${file.name}: ${error.message}`,
          variant: "destructive",
        });
      }
    }

    setIsUploading(false);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const clearAllFiles = () => {
    setFiles([]);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'uploading':
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="!bg-green-500 !text-white">Success</Badge>;
      case 'error':
        return <Badge className="!bg-red-500 !text-white">Error</Badge>;
      case 'uploading':
        return <Badge className="!bg-blue-500 !text-white">Uploading</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const completedFiles = files.filter(f => f.status === 'success').length;
  const errorFiles = files.filter(f => f.status === 'error').length;
  const uploadingFiles = files.filter(f => f.status === 'uploading').length;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Upload Files</h1>
          <p className="text-muted-foreground">
            Upload files to your secure FileVault storage
          </p>
        </div>

        {/* Target User Selection */}
        {user && (user.role === "Admin" || user.role === "Editor") && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <UsersIcon className="h-5 w-5" />
                <span>Upload For</span>
              </CardTitle>
              <CardDescription>
                {user.role === "Admin" 
                  ? "Select a user to upload files for, or leave blank to upload for yourself"
                  : "Select a delegated viewer to upload files for, or leave blank to upload for yourself"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="targetUser">Target User (Optional)</Label>
                <Select 
                  value={targetUserId || "self"} 
                  onValueChange={(value) => setTargetUserId(value === "self" ? "" : value)}
                  disabled={loadingUsers || isUploading}
                >
                  <SelectTrigger id="targetUser">
                    <SelectValue placeholder={loadingUsers ? "Loading users..." : "Select a user or upload for yourself"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self">Myself ({user.email})</SelectItem>
                    {availableUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.fullName} ({u.email}) - {u.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {user.role === "Editor" && availableUsers.length === 0 && !loadingUsers && (
                  <p className="text-sm text-muted-foreground">
                    No delegated viewers found. You can only upload for yourself.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Area */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CloudUpload className="h-5 w-5" />
              <span>Select Files</span>
            </CardTitle>
            <CardDescription>
              Choose files from your computer or drag and drop them here
              {targetUserId && availableUsers.length > 0 && (
                <span className="block mt-1 text-primary font-medium">
                  Uploading for: {availableUsers.find(u => u.id === targetUserId)?.fullName || 'Selected User'}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <UploadIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">
                {dragActive ? "Drop files here" : "Drag and drop files here"}
              </p>
              <p className="text-muted-foreground mb-4">
                or click to browse your computer
              </p>
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="mb-2"
              >
                {isUploading ? "Uploading..." : "Choose Files"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
                disabled={isUploading}
              />
              <p className="text-sm text-muted-foreground">
                Supports all file types • Max 100MB per file
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Upload Progress */}
        {files.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Upload Progress</CardTitle>
                <div className="flex items-center space-x-4">
                  <div className="text-sm text-muted-foreground">
                    {completedFiles} completed • {errorFiles} failed • {uploadingFiles} uploading
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAllFiles}
                    disabled={isUploading}
                  >
                    Clear All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {files.map((file) => (
                  <div key={file.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                    <div className="flex-shrink-0">
                      {getStatusIcon(file.status)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-muted-foreground">
                            {fileService.formatFileSize(file.size)}
                          </span>
                          {getStatusBadge(file.status)}
                        </div>
                      </div>
                      
                      {file.status === 'uploading' && (
                        <div className="space-y-1">
                          <Progress value={file.progress} className="h-2" />
                          <p className="text-xs text-muted-foreground">
                            {file.progress}% uploaded
                          </p>
                        </div>
                      )}
                      
                      {file.status === 'error' && file.error && (
                        <p className="text-xs text-red-500">{file.error}</p>
                      )}
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file.id)}
                      disabled={file.status === 'uploading'}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}


        {/* Actions */}
        <div className="flex justify-end space-x-4">
          <Button
            variant="outline"
            onClick={() => navigate('/dashboard')}
          >
            Back to Dashboard
          </Button>
          {files.length > 0 && completedFiles > 0 && (
            <Button
              onClick={() => navigate('/dashboard')}
            >
              View Files
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Upload;
