import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Shield, ArrowLeft, Mail } from "lucide-react";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { forgotPassword } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await forgotPassword(email);
      setEmailSent(true);
      toast({
        title: "Reset Code Sent",
        description: "If an account with this email exists, you will receive a password reset code. Please check your email.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send reset code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-secondary p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Link to="/" className="flex items-center justify-center space-x-2 text-primary mb-4 hover:opacity-80 transition-opacity">
            <Shield className="h-8 w-8" />
            <h1 className="text-3xl font-bold">FileVault</h1>
          </Link>
          <p className="text-muted-foreground">Password recovery</p>
        </div>

        <Card className="shadow-lg border-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-semibold flex items-center space-x-2">
              <Mail className="h-5 w-5" />
              <span>Reset Password</span>
            </CardTitle>
            <CardDescription>
              {emailSent 
                ? "We've sent a reset code to your email address"
                : "Enter your email address and we'll send you a reset code"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {emailSent ? (
              <div className="space-y-4">
                <div className="text-center py-6">
                  <Mail className="h-16 w-16 mx-auto text-primary mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Check Your Email</h3>
                  <p className="text-muted-foreground mb-4">
                    We've sent a password reset code to <strong>{email}</strong>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Please check your email and follow the instructions to reset your password.
                  </p>
                </div>
                
                <div className="space-y-3">
                  <Link to={`/reset-password?email=${encodeURIComponent(email)}`}>
                    <Button className="w-full" variant="hero">
                      Enter Reset Code
                    </Button>
                  </Link>
                  
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setEmailSent(false)}
                  >
                    Try Different Email
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading}
                  variant="hero"
                >
                  {loading ? "Sending..." : "Send Reset Code"}
                </Button>
              </form>
            )}

            <div className="mt-6 text-center">
              <Link 
                to="/login" 
                className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Sign In
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword;
