import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fileService } from "@/services/fileService";
import { fetchAuthSession } from "aws-amplify/auth";

const UploadDebug = () => {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runDebug = async () => {
    setLoading(true);
    try {
      // Check environment variables
      const envCheck = {
        API_ENDPOINT: import.meta.env.VITE_API_ENDPOINT,
        hasApiEndpoint: !!import.meta.env.VITE_API_ENDPOINT,
      };

      // Check authentication
      let authInfo = null;
      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();
        
        // Decode JWT token to check groups
        let tokenClaims = null;
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            tokenClaims = {
              sub: payload.sub,
              email: payload.email,
              groups: payload['cognito:groups'] || [],
              customRole: payload['custom:role'],
              aud: payload.aud,
              iss: payload.iss,
              exp: new Date(payload.exp * 1000).toISOString(),
            };
          } catch (decodeError) {
            tokenClaims = { decodeError: decodeError.message };
          }
        }
        
        // Check if user has required groups for upload
        const hasUploadPermission = tokenClaims?.groups?.some((group: string) => 
          ['Admins', 'Editors'].includes(group)
        ) || false;

        authInfo = {
          hasToken: !!token,
          tokenPreview: token ? token.substring(0, 20) + "..." : null,
          tokenLength: token?.length || 0,
          claims: tokenClaims,
          hasUploadPermission,
          requiredGroups: ['Admins', 'Editors'],
          userGroups: tokenClaims?.groups || [],
        };
      } catch (error) {
        authInfo = { error: error.message };
      }

      // Test API call
      let apiTest = null;
      try {
        const result = await fileService.getUploadUrl();
        apiTest = { success: true, result };
      } catch (error: any) {
        apiTest = {
          success: false,
          error: error.message,
          status: error.response?.status,
          responseData: error.response?.data,
        };
      }

      setDebugInfo({
        environment: envCheck,
        authentication: authInfo,
        apiTest,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      setDebugInfo({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Upload Debug Information</CardTitle>
        <CardDescription>
          This component helps debug upload issues by testing the API connection and authentication.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={runDebug} disabled={loading} className="mb-4">
          {loading ? "Running Debug..." : "Run Debug Test"}
        </Button>

        {debugInfo && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Environment Variables:</h3>
              <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
                {JSON.stringify(debugInfo.environment, null, 2)}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Authentication:</h3>
              {debugInfo.authentication?.hasUploadPermission === false && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-3">
                  <strong>❌ Upload Permission Denied:</strong> User is not in required groups (Admins or Editors)
                </div>
              )}
              {debugInfo.authentication?.hasUploadPermission === true && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-3">
                  <strong>✅ Upload Permission Granted:</strong> User has required groups
                </div>
              )}
              <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
                {JSON.stringify(debugInfo.authentication, null, 2)}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold mb-2">API Test:</h3>
              <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
                {JSON.stringify(debugInfo.apiTest, null, 2)}
              </pre>
            </div>

            <div className="text-sm text-gray-500">
              Debug run at: {debugInfo.timestamp}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UploadDebug;
