import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, ArrowRight, Lock, Users, Cloud } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-secondary">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Navigation - Full Width */}
        <header className="relative pt-6 px-4 sm:px-6 lg:px-8 w-full">
          <nav className="relative flex items-center justify-between sm:h-10 w-full max-w-7xl mx-auto">
            <div className="flex items-center space-x-2">
              <Shield className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold">FileVault</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/login" className="font-medium text-muted-foreground hover:text-foreground transition-colors">
                Sign in
              </Link>
              <Link to="/register">
                <Button variant="hero" size="sm">
                  Get Started
                </Button>
              </Link>
            </div>
          </nav>
        </header>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto">
          <div className="relative z-10 pb-8 sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32">

            <main className="mt-10 mx-auto max-w-7xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
              <div className="sm:text-center lg:text-left">
                <h1 className="text-4xl tracking-tight font-extrabold text-foreground sm:text-5xl md:text-6xl">
                  <span className="block xl:inline">Secure File</span>{" "}
                  <span className="block text-primary xl:inline">Management</span>
                </h1>
                <p className="mt-3 text-base text-muted-foreground sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                  Enterprise-grade file storage and management with role-based access control. 
                  Upload, organize, and share files securely with your team.
                </p>
                <div className="mt-5 sm:mt-8 sm:flex sm:justify-center lg:justify-start">
                  <div className="rounded-md shadow">
                    <Link to="/register">
                      <Button variant="hero" size="lg" className="w-full sm:w-auto">
                        Start Free Trial
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                  <div className="mt-3 sm:mt-0 sm:ml-3">
                    <Link to="/login">
                      <Button variant="outline" size="lg" className="w-full sm:w-auto">
                        Sign In
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-base text-primary font-semibold tracking-wide uppercase">Features</h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-foreground sm:text-4xl">
              Everything you need for secure file management
            </p>
          </div>

          <div className="mt-16">
            <div className="space-y-10 md:space-y-0 md:grid md:grid-cols-3 md:gap-x-8 md:gap-y-10">
              <div className="relative">
                <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-gradient-primary text-primary-foreground">
                  <Lock className="h-6 w-6" />
                </div>
                <p className="ml-16 text-lg leading-6 font-medium text-foreground">Role-Based Access</p>
                <p className="mt-2 ml-16 text-base text-muted-foreground">
                  Admin, Editor, and Viewer roles with granular permissions for secure file access control.
                </p>
              </div>

              <div className="relative">
                <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-gradient-primary text-primary-foreground">
                  <Cloud className="h-6 w-6" />
                </div>
                <p className="ml-16 text-lg leading-6 font-medium text-foreground">Cloud Storage</p>
                <p className="mt-2 ml-16 text-base text-muted-foreground">
                  Secure cloud storage powered by AWS with automatic backups and high availability.
                </p>
              </div>

              <div className="relative">
                <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-gradient-primary text-primary-foreground">
                  <Users className="h-6 w-6" />
                </div>
                <p className="ml-16 text-lg leading-6 font-medium text-foreground">Team Collaboration</p>
                <p className="mt-2 ml-16 text-base text-muted-foreground">
                  Invite team members, assign roles, and collaborate on files with enterprise-grade security.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-primary">
        <div className="max-w-2xl mx-auto text-center py-16 px-4 sm:py-20 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold text-primary-foreground sm:text-4xl">
            <span className="block">Ready to get started?</span>
            <span className="block">Create your FileVault account today.</span>
          </h2>
          <p className="mt-4 text-lg leading-6 text-primary-foreground/90">
            Join thousands of teams already using FileVault for secure file management.
          </p>
          <Link to="/register" className="mt-8 inline-block">
            <Button variant="secondary" size="lg">
              Get Started Now
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Index;
