import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Clock, Shield } from "lucide-react";

interface InactivityWarningProps {
  isOpen: boolean;
  onStayLoggedIn: () => void;
  onLogout: () => void;
  timeRemaining: number; // seconds remaining
}

const InactivityWarning: React.FC<InactivityWarningProps> = ({
  isOpen,
  onStayLoggedIn,
  onLogout,
  timeRemaining,
}) => {
  const [countdown, setCountdown] = useState(timeRemaining);

  useEffect(() => {
    if (!isOpen) return;

    setCountdown(timeRemaining);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, timeRemaining, onLogout]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-orange-600">
            <AlertTriangle className="h-5 w-5" />
            <span>Session Timeout Warning</span>
          </DialogTitle>
          <DialogDescription>
            You have been inactive and will be automatically logged out for security.
          </DialogDescription>
        </DialogHeader>

        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700">
                    Auto-logout in:
                  </span>
                  <span className="text-2xl font-bold text-orange-600 font-mono">
                    {formatTime(countdown)}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Click "Stay Logged In" to continue your session
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex space-x-3">
          <Button
            onClick={onStayLoggedIn}
            className="flex-1"
            variant="default"
          >
            <Shield className="mr-2 h-4 w-4" />
            Stay Logged In
          </Button>
          <Button
            onClick={onLogout}
            variant="outline"
            className="flex-1"
          >
            Logout Now
          </Button>
        </div>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Your session will automatically end for security after 5 minutes of inactivity.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InactivityWarning;

