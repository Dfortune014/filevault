import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, ArrowRight, Mail } from "lucide-react";

type AuthProps = {
  initialMode?: "login" | "signup";
};

const Auth: React.FC<AuthProps> = ({ initialMode = "login" }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login, register, confirmSignUp, resendVerificationCode } = useAuth();

  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const isSignUp = mode === "signup";

  // Sign in state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Sign up state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  
  // Verification state
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [verificationFromLogin, setVerificationFromLogin] = useState(false);

  // Sync state when route-provided initialMode changes
  // But don't override if we're showing verification (to prevent resetting from login redirect)
  useEffect(() => {
    if (!showVerification) {
      setMode(initialMode);
    }
  }, [initialMode, showVerification]);

  // Check for verification query params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const verifyEmail = urlParams.get('email');
    const shouldVerify = urlParams.get('verify') === 'true';
    
    if (verifyEmail && shouldVerify) {
      setEmail(verifyEmail);
      setMode("signup");
      setShowVerification(true);
      setVerificationFromLogin(true); // Mark that this is from a login attempt
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);


  const containerClass = useMemo(() => {
    return [
      "relative mx-auto w-full max-w-5xl",
      "grid grid-cols-1 lg:grid-cols-2",
      "min-h-[640px] rounded-2xl overflow-hidden shadow-xl",
      "bg-card border border-border",
    ].join(" ");
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" });
      return;
    }
    setLoginLoading(true);
    try {
      await login(loginEmail, loginPassword);
      toast({ title: "Welcome back", description: "Signed in successfully" });
      navigate("/dashboard");
    } catch (err: any) {
      // Check if user needs to verify email
      const needsVerification = 
        err.name === 'UserNotConfirmedException' || 
        err.code === 'EMAIL_NOT_VERIFIED' ||
        err.message?.includes('not confirmed') ||
        err.message?.includes('verify your email');
      
      if (needsVerification) {
        // Set email for verification and show verification form
        const emailToUse = err.email || loginEmail;
        
        // Set all states at once - React will batch these updates
        setEmail(emailToUse);
        setMode("signup");
        setVerificationFromLogin(true);
        setShowVerification(true);
        
        toast({ 
          title: "Email Verification Required", 
          description: "Please verify your email address before signing in. Enter the verification code sent to your email.",
          variant: "destructive" 
        });
      } else {
        toast({ title: "Sign in failed", description: err.message, variant: "destructive" });
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password || !confirmPassword) {
      toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (password.length < 8) {
      toast({ title: "Error", description: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    setSignupLoading(true);
    try {
      await register(fullName, email, password);
      toast({ title: "Account created", description: "Please check your email for verification code" });
      setShowVerification(true);
      setVerificationFromLogin(false); // This is from signup, not login
    } catch (err: any) {
      // Ensure error message is properly extracted
      const errorMessage = err?.message || err?.toString() || "An error occurred during registration";
      toast({ 
        title: "Sign up failed", 
        description: errorMessage, 
        variant: "destructive" 
      });
    } finally {
      setSignupLoading(false);
    }
  };

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode) {
      toast({ title: "Error", description: "Please enter verification code", variant: "destructive" });
      return;
    }
    setVerificationLoading(true);
    try {
      await confirmSignUp(email, verificationCode);
      toast({ title: "Account Verified", description: "Your account has been successfully verified!" });
      setMode("login");
      setShowVerification(false);
      setVerificationCode("");
      setVerificationFromLogin(false);
      // If verified from login attempt, show helpful message
      if (verificationFromLogin) {
        toast({ 
          title: "Verification Complete", 
          description: "You can now sign in with your credentials." 
        });
      }
    } catch (err: any) {
      toast({ 
        title: "Verification Failed", 
        description: err?.message || "Invalid verification code", 
        variant: "destructive" 
      });
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResendLoading(true);
    try {
      await resendVerificationCode(email);
      toast({ title: "Code Resent", description: "A new verification code has been sent to your email." });
    } catch (err: any) {
      toast({ 
        title: "Resend Failed", 
        description: err?.message || "Failed to resend verification code", 
        variant: "destructive" 
      });
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background gradient */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-secondary" />
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="w-full">
        {/* Logo */}
        <div className="max-w-5xl mx-auto flex items-center justify-between mb-6 px-2">
          <Link to="/" className="flex items-center space-x-2 text-primary">
            <Shield className="h-7 w-7" />
            <span className="font-bold text-xl">FileVault</span>
          </Link>
        </div>

        <section className={containerClass}>
          {/* Forms panel */}
          <div className="relative overflow-hidden bg-card">
            {/* Inner track that slides left/right */}
            <div
              className={[
                "absolute inset-0 grid grid-cols-2 w-[200%]",
                "transition-transform duration-[750ms] ease-[cubic-bezier(0.4,0.0,0.2,1)]",
                isSignUp ? "-translate-x-1/2" : "translate-x-0",
              ].join(" ")}
            >
              {/* Sign In form */}
              <div className="flex items-center justify-center p-8">
                <form
                  onSubmit={handleSignIn}
                  className={[
                    "w-full max-w-sm space-y-4 transition-opacity duration-500",
                    isSignUp ? "opacity-0 pointer-events-none" : "opacity-100",
                  ].join(" ")}
                >
                  <div>
                    <h2 className="text-3xl md:text-4xl font-semibold">Sign In</h2>
                    <p className="text-base text-muted-foreground">Access your secure files</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="loginEmail">Email</Label>
                    <Input id="loginEmail" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="you@example.com" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="loginPassword">Password</Label>
                    <Input id="loginPassword" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="••••••••" required />
                    <div className="text-right -mt-1">
                      <Link 
                        to="/forgot-password" 
                        className="text-sm text-blue-600 hover:text-blue-700 hover:underline font-semibold transition-colors"
                      >
                        Forgot password?
                      </Link>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" variant="hero" disabled={loginLoading}>
                    {loginLoading ? "Signing in..." : "Sign In"}
                  </Button>
                  <div className="text-sm text-muted-foreground">
                    Don’t have an account?{" "}
                    <button type="button" onClick={() => setMode("signup")} className="text-primary hover:underline">
                      Sign Up
                    </button>
                  </div>
                </form>
              </div>

              {/* Sign Up form / Verification form */}
              <div className="flex items-center justify-center p-8">
                {showVerification ? (
                  <form
                    onSubmit={handleVerification}
                    className={[
                      "w-full max-w-sm space-y-4 transition-opacity duration-500",
                      // Show verification form regardless of mode when showVerification is true
                      (isSignUp || showVerification) ? "opacity-100" : "opacity-0 pointer-events-none",
                    ].join(" ")}
                  >
                    <div className="text-center mb-4">
                      <Mail className="h-12 w-12 mx-auto text-primary mb-3" />
                      <h2 className="text-3xl md:text-4xl font-semibold">Verify Email</h2>
                      <p className="text-base text-muted-foreground mt-2">
                        Enter the verification code sent to <strong>{email}</strong>
                      </p>
                      {verificationFromLogin && (
                        <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                          <p className="text-sm text-destructive font-medium">
                            ⚠️ Your account requires email verification before you can sign in.
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="verificationCode">Verification Code</Label>
                      <Input 
                        id="verificationCode" 
                        type="text" 
                        value={verificationCode} 
                        onChange={(e) => setVerificationCode(e.target.value)} 
                        placeholder="Enter 6-digit code" 
                        required 
                        maxLength={6}
                      />
                    </div>
                    <Button type="submit" className="w-full" variant="hero" disabled={verificationLoading}>
                      {verificationLoading ? "Verifying..." : "Verify Account"}
                    </Button>
                    <div className="text-center space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Didn't receive the code?
                      </p>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={handleResendCode}
                        disabled={resendLoading}
                        className="w-full"
                      >
                        {resendLoading ? "Resending..." : "Resend Code"}
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground text-center">
                      <button 
                        type="button" 
                        onClick={() => {
                          setShowVerification(false);
                          setVerificationCode("");
                        }} 
                        className="text-primary hover:underline"
                      >
                        Back to Sign Up
                      </button>
                    </div>
                  </form>
                ) : (
                  <form
                    onSubmit={handleSignUp}
                    className={[
                      "w-full max-w-sm space-y-4 transition-opacity duration-500",
                      isSignUp ? "opacity-100" : "opacity-0 pointer-events-none",
                    ].join(" ")}
                  >
                    <div>
                      <h2 className="text-3xl md:text-4xl font-semibold">Create Account</h2>
                      <p className="text-base text-muted-foreground">Join FileVault securely</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name</Label>
                      <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat your password" required />
                    </div>
                    <Button type="submit" className="w-full" variant="hero" disabled={signupLoading}>
                      {signupLoading ? "Creating account..." : "Sign Up"}
                    </Button>
                    <div className="text-sm text-muted-foreground">
                      Already have an account?{" "}
                      <button type="button" onClick={() => setMode("login")} className="text-primary hover:underline">
                        Sign In
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>

          {/* Overlay panel (gradient + text) */}
          <div className="relative hidden lg:block overflow-hidden">
            <div className="absolute inset-0">
              <div
                className={[
                  "absolute inset-0 transition-transform duration-[750ms] ease-[cubic-bezier(0.4,0.0,0.2,1)]",
                  "bg-gradient-to-br from-blue-600 via-indigo-600 to-sky-500",
                  // Keep gradient fully covering while animating text separately
                  "translate-x-0 scale-110",
                ].join(" ")}
              />
              <div className="absolute inset-0 bg-black/10" />
            </div>
            <div
              className={[
                "relative h-full w-full p-10 text-white transition-transform duration-[750ms] ease-[cubic-bezier(0.4,0.0,0.2,1)]",
                "flex items-center justify-center text-center",
                isSignUp ? "translate-x-0" : "translate-x-6",
              ].join(" ")}
            >
              <div className="max-w-md">
                <h3 className="text-3xl font-bold mb-2">
                  {isSignUp ? "Welcome to FileVault" : "Welcome back"}
                </h3>
                <p className="text-white/80 mb-6">
                  {isSignUp
                    ? "Create an account to securely store and share your files."
                    : "Sign in to access your secure files and continue where you left off."}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="bg-white/10 hover:bg-white/20 border-white text-white rounded-full px-6"
                  onClick={() => setMode(isSignUp ? "login" : "signup")}
                >
                  {isSignUp ? "Have an account? Sign In" : "New here? Create Account"}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Mobile toggle below the panel */}
        <div className="lg:hidden mt-4 text-center">
          <button
            type="button"
            onClick={() => setMode(isSignUp ? "login" : "signup")}
            className="text-primary hover:underline"
          >
            {isSignUp ? "Have an account? Sign In" : "New here? Create Account"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;


