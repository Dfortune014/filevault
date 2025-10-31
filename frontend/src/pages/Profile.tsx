import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield, 
  User, 
  LogOut, 
  Mail, 
  UserCheck,
  Edit3,
  Eye,
  ArrowLeft,
  Save,
  X
} from "lucide-react";

const Profile = () => {
  const { user, logout, updateProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isEditingName, setIsEditingName] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [loading, setLoading] = useState(false);

  const handleUpdateName = async () => {
    if (!fullName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid name",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await updateProfile(fullName.trim());
      setIsEditingName(false);
      toast({
        title: "Success",
        description: "Your display name has been updated",
      });
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setFullName(user?.fullName || "");
    setIsEditingName(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logged out",
        description: "You have been successfully logged out",
      });
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getRoleConfig = (role: string) => {
    switch (role) {
      case "Admin":
        return {
          color: "admin",
          variant: "admin" as const,
          icon: Shield,
          description: "Full system access with user management capabilities",
          permissions: [
            "Upload files",
            "Download files", 
            "Delete files",
            "Manage users",
            "Invite new users",
            "Assign user roles"
          ]
        };
      case "Editor":
        return {
          color: "editor",
          variant: "editor" as const,
          icon: Edit3,
          description: "Can create and modify files",
          permissions: [
            "Upload files",
            "Download files",
            "Edit file metadata"
          ]
        };
      case "Viewer":
        return {
          color: "viewer",
          variant: "viewer" as const,
          icon: Eye,
          description: "Read-only access to files",
          permissions: [
            "View files",
            "Download files"
          ]
        };
      default:
        return {
          color: "secondary",
          variant: "secondary" as const,
          icon: UserCheck,
          description: "No role assigned",
          permissions: []
        };
    }
  };

  const roleConfig = getRoleConfig(user?.role || "");
  const RoleIcon = roleConfig.icon;

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
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
            <div className="flex items-center space-x-3">
              <Shield className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold">FileVault</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Profile Header */}
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <div className="h-24 w-24 rounded-full bg-gradient-primary flex items-center justify-center">
                <User className="h-12 w-12 text-primary-foreground" />
              </div>
            </div>
            <div className="flex items-center justify-center space-x-2">
              {isEditingName ? (
                <div className="flex items-center space-x-2">
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="text-2xl font-bold text-center border-none shadow-none bg-transparent p-0 h-auto"
                    placeholder="Enter your name"
                  />
                  <Button
                    size="sm"
                    onClick={handleUpdateName}
                    disabled={loading}
                    className="h-8 w-8 p-0"
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelEdit}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <h1 className="text-3xl font-bold">{user?.fullName || "Profile Settings"}</h1>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditingName(true)}
                    className="h-8 w-8 p-0"
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <p className="text-muted-foreground">Manage your account information and preferences</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Account Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Mail className="h-5 w-5" />
                  <span>Account Information</span>
                </CardTitle>
                <CardDescription>Your basic account details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email Address</label>
                  <p className="text-lg font-medium">{user.email}</p>
                </div>
                <Separator />
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Account Status</label>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Active</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Role & Permissions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <RoleIcon className="h-5 w-5" />
                  <span>Role & Permissions</span>
                </CardTitle>
                <CardDescription>Your current role and access level</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Current Role</label>
                  <div className="mt-1">
                    <Badge className={`bg-${roleConfig.color} text-${roleConfig.color}-foreground`}>
                      <RoleIcon className="h-3 w-3 mr-1" />
                      {user.role}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {roleConfig.description}
                  </p>
                </div>
                <Separator />
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Permissions</label>
                  <div className="mt-2 space-y-1">
                    {roleConfig.permissions.map((permission) => (
                      <div key={permission} className="flex items-center space-x-2 text-sm">
                        <div className="h-1.5 w-1.5 bg-green-500 rounded-full"></div>
                        <span>{permission}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Security Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Security</span>
              </CardTitle>
              <CardDescription>Manage your account security settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Active Session</h4>
                  <p className="text-sm text-muted-foreground">You are currently signed in</p>
                </div>
                <Button 
                  variant="destructive" 
                  onClick={handleLogout}
                  className="flex items-center space-x-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Help Section */}
          <Card>
            <CardHeader>
              <CardTitle>Need Help?</CardTitle>
              <CardDescription>Contact support or learn more about FileVault</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                If you need to change your role or have questions about permissions, 
                contact your system administrator.
              </p>
              <div className="flex space-x-3">
                <Button variant="outline" size="sm">
                  Contact Support
                </Button>
                <Button variant="outline" size="sm">
                  View Documentation
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;