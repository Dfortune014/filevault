import { Amplify } from "aws-amplify";

const awsConfig = {
  Auth: {
    Cognito: {
      region: import.meta.env.VITE_REGION || "us-east-1",
      userPoolId: import.meta.env.VITE_USER_POOL_ID || "",
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID || "",
    }
  },
  API: {
    REST: {
      FileVaultAPI: {
        endpoint: import.meta.env.VITE_API_ENDPOINT || "",
        region: import.meta.env.VITE_REGION || "us-east-1",
      }
    }
  }
};

// Configure Amplify
Amplify.configure(awsConfig);

export default awsConfig;