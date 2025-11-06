import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Shield, Check, X, Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/contexts/AuthContext";

interface MFASetupProps {
  onComplete: () => void;
  onCancel: () => void;
}

export const MFASetup: React.FC<MFASetupProps> = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState<"qr" | "verify">("qr");
  const [qrCode, setQrCode] = useState<string>("");
  const [secretCode, setSecretCode] = useState<string>("");
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { setupMFA, verifyMFASetup } = useAuth();

  const handleSetup = async () => {
    try {
      setLoading(true);
      const result = await setupMFA();
      
      if (!result.qrCode || !result.secretCode) {
        throw new Error("Missing QR code or secret code from setup");
      }
      
      setQrCode(result.qrCode);
      setSecretCode(result.secretCode);
      // Keep on "qr" step to show the QR code - user will click "Continue to Verification" when ready
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to generate QR code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    try {
      setLoading(true);
      await verifyMFASetup(verificationCode);
      toast({
        title: "Success",
        description: "MFA has been successfully enabled for your account",
      });
      onComplete();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Invalid verification code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copySecretCode = () => {
    navigator.clipboard.writeText(secretCode);
    toast({
      title: "Copied",
      description: "Secret code copied to clipboard",
    });
  };

  if (step === "qr") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Setup Multi-Factor Authentication
          </CardTitle>
          <CardDescription>
            Scan the QR code with your authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!qrCode ? (
            <Button onClick={handleSetup} disabled={loading} className="w-full">
              {loading ? "Generating..." : "Generate QR Code"}
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-center p-4 bg-white rounded-lg border">
                <QRCodeSVG value={qrCode} size={256} />
              </div>
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <Label>Secret Key (if you can't scan QR code):</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono text-sm p-2 bg-background rounded border break-all">
                    {secretCode}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copySecretCode}
                    className="shrink-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Button onClick={() => setStep("verify")} className="w-full">
                Continue to Verification
              </Button>
            </div>
          )}
          <Button variant="outline" onClick={onCancel} className="w-full">
            Cancel
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verify MFA Setup</CardTitle>
        <CardDescription>
          Enter the 6-digit code from your authenticator app to complete setup
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="verifyCode">MFA Code</Label>
          <Input
            id="verifyCode"
            type="text"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            className="text-center text-2xl tracking-widest"
            autoFocus
          />
        </div>
        <Button onClick={handleVerify} disabled={loading || verificationCode.length !== 6} className="w-full">
          {loading ? "Verifying..." : "Verify & Enable MFA"}
        </Button>
        <Button variant="outline" onClick={() => setStep("qr")} className="w-full">
          Back
        </Button>
        <Button variant="outline" onClick={onCancel} className="w-full">
          Cancel
        </Button>
      </CardContent>
    </Card>
  );
};

