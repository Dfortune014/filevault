import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, ArrowRight } from "lucide-react";

type AuthProps = {
  initialMode?: "login" | "signup";
};

const Auth: React.FC<AuthProps> = ({ initialMode = "login" }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const isSignUp = mode === "signup";

  // Sync state when route-provided initialMode changes
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

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
      toast({ title: "Sign in failed", description: err.message, variant: "destructive" });
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
      toast({ title: "Account created", description: "Check your email to verify, then sign in." });
      setMode("login");
    } catch (err: any) {
      toast({ title: "Sign up failed", description: err.message, variant: "destructive" });
    } finally {
      setSignupLoading(false);
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

              {/* Sign Up form */}
              <div className="flex items-center justify-center p-8">
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


