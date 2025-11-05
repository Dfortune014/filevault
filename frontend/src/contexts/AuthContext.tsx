import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { signIn, signUp, signOut, getCurrentUser, confirmSignUp as amplifyConfirmSignUp, resendSignUpCode, resetPassword as amplifyResetPassword, confirmResetPassword, fetchAuthSession, updateUserAttribute } from "aws-amplify/auth";
import { jwtDecode } from "jwt-decode";

export type UserRole = "Admin" | "Editor" | "Viewer";

interface User {
  email: string;
  fullName: string;
  role: UserRole;
  token: string;
  sub: string; // Cognito subject claim - used as userId in API calls
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  resendVerificationCode: (email: string) => Promise<void>;
  updateProfile: (fullName: string) => Promise<void>;
  resetInactivityTimer: () => void;
  showInactivityWarning: boolean;
  inactivityTimeRemaining: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface JWTPayload {
  sub: string; // Cognito subject claim
  email: string;
  name?: string;
  "cognito:groups"?: string[];
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [inactivityTimeRemaining, setInactivityTimeRemaining] = useState(60);
  
  // Auto-logout configuration
  const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds
  const WARNING_TIME = 1 * 60 * 1000; // 1 minute warning before logout
  
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningShownRef = useRef(false);

  useEffect(() => {
    checkAuthState();
    
    // Request notification permission on app startup
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Auto-logout functions
  const clearTimers = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    warningShownRef.current = false;
    setShowInactivityWarning(false);
  }, []);

  const autoLogout = useCallback(async () => {
    try {
      await signOut();
      setUser(null);
      
      // Show logout notification
      if (Notification.permission === 'granted') {
        new Notification('FileVault Session Ended', {
          body: 'You have been automatically logged out due to inactivity.',
          icon: '/favicon.ico',
          tag: 'filevault-logout'
        });
      }
      
      // Clear any existing timers
      clearTimers();
    } catch (error) {
      // Auto-logout error - silently fail
    }
  }, [clearTimers]);

  const showWarning = useCallback(() => {
    if (warningShownRef.current) return;
    warningShownRef.current = true;
    
    // Show warning modal
    setShowInactivityWarning(true);
    setInactivityTimeRemaining(60); // 60 seconds warning
    
    // Start countdown
    countdownTimerRef.current = setInterval(() => {
      setInactivityTimeRemaining((prev) => {
        if (prev <= 1) {
          autoLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Show browser notification if permission is granted
    if (Notification.permission === 'granted') {
      new Notification('FileVault Session Warning', {
        body: 'You will be logged out in 1 minute due to inactivity.',
        icon: '/favicon.ico',
        tag: 'filevault-warning'
      });
    }
  }, [autoLogout]);

  const resetInactivityTimer = useCallback(() => {
    clearTimers();
    
    if (!user) return;
    
    // Set warning timer (4 minutes)
    warningTimerRef.current = setTimeout(() => {
      showWarning();
    }, INACTIVITY_TIMEOUT - WARNING_TIME);
    
    // Set logout timer (5 minutes)
    inactivityTimerRef.current = setTimeout(() => {
      autoLogout();
    }, INACTIVITY_TIMEOUT);
  }, [user, showWarning, autoLogout, clearTimers]);

  const handleStayLoggedIn = useCallback(() => {
    clearTimers();
    resetInactivityTimer();
  }, [clearTimers, resetInactivityTimer]);

  const handleLogoutNow = useCallback(() => {
    clearTimers();
    autoLogout();
  }, [clearTimers, autoLogout]);

  // Activity event listeners
  useEffect(() => {
    if (!user) {
      clearTimers();
      return;
    }

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      resetInactivityTimer();
    };

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Initial timer setup
    resetInactivityTimer();

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      clearTimers();
    };
  }, [user, resetInactivityTimer, clearTimers]);

  const checkAuthState = async () => {
    try {
      const user = await getCurrentUser();
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString() || "";
      const decoded: JWTPayload = jwtDecode(token);
      
      const role = getRole(decoded["cognito:groups"]);
      
      setUser({
        email: decoded.email,
        fullName: decoded.name || decoded.email.split('@')[0],
        role,
        token,
        sub: decoded.sub, // Extract Cognito subject claim
      });
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const getRole = (groups?: string[]): UserRole => {
    if (!groups || groups.length === 0) return "Viewer";
    if (groups.includes("Admins")) return "Admin";
    if (groups.includes("Editors")) return "Editor";
    return "Viewer";
  };

  const login = async (email: string, password: string) => {
    try {
      const signInResult = await signIn({ username: email, password });
      
      // Check if signIn returned a challenge (AWS Amplify v6 behavior)
      // For unverified users, Amplify may return a challenge instead of throwing
      if (signInResult.nextStep) {
        const nextStep = signInResult.nextStep;
        
        // Check if email verification is required
        if (nextStep.signInStep === 'CONFIRM_SIGN_UP' || 
            nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_SMS_CODE' ||
            (nextStep.signInStep && nextStep.signInStep.includes('CONFIRM'))) {
          const customError: any = new Error('Your email address needs to be verified before you can sign in. Please check your email for the verification code.');
          customError.name = 'UserNotConfirmedException';
          customError.code = 'EMAIL_NOT_VERIFIED';
          customError.email = email;
          throw customError;
        }
      }
      
      // If no challenge, proceed to check auth state
      await checkAuthState();
    } catch (error: any) {
      let errorMessage = "Login failed";
      
      // Check for UserNotConfirmedException in multiple possible locations
      // AWS Amplify v6 may structure errors differently
      // Also check for HTTP 400 errors from Cognito that might contain the error
      const errorString = JSON.stringify(error);
      const isUnverified = 
        error.name === 'UserNotConfirmedException' ||
        error.cause?.name === 'UserNotConfirmedException' ||
        error.cause?.code === 'UserNotConfirmedException' ||
        error.message?.includes('UserNotConfirmedException') ||
        error.message?.includes('not confirmed') ||
        error.message?.includes('email is unverified') ||
        error.message?.includes('email not verified') ||
        error.message?.includes('verify your email') ||
        error.message?.includes('Resume is called') ||
        error.toString().includes('UserNotConfirmedException') ||
        errorString.includes('UserNotConfirmedException') ||
        // Check for 400 Bad Request with unverified user indicators
        (error.message?.includes('400') && (
          error.message?.includes('unverified') ||
          errorString.includes('unverified') ||
          errorString.includes('not confirmed')
        ));
      
      // Special handling for unverified users - throw custom error with email
      if (isUnverified) {
        const customError: any = new Error('Your email address needs to be verified before you can sign in. Please check your email for the verification code.');
        customError.name = 'UserNotConfirmedException';
        customError.code = 'EMAIL_NOT_VERIFIED';
        customError.email = email; // Include email for verification redirect
        throw customError;
      }
      
      if (error.name) {
        const errorMap: Record<string, string> = {
          'UserNotFoundException': 'No account found with this email. Please sign up first.',
          'NotAuthorizedException': 'Incorrect email or password. Please try again.',
          'PasswordResetRequiredException': 'Password reset is required. Please reset your password.',
          'TooManyRequestsException': 'Too many attempts. Please try again later.',
          'LimitExceededException': 'Too many attempts. Please try again later.',
        };
        errorMessage = errorMap[error.name] || (error.message || error.name);
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    }
  };

  const register = async (fullName: string, email: string, password: string) => {
    try {
      await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
            name: fullName,
          },
        },
      });
    } catch (error: any) {
      let errorMessage = "Registration failed";
      
      // AWS Amplify/Cognito error handling
      if (error.name) {
        const errorMap: Record<string, string> = {
          'UsernameExistsException': 'An account with this email already exists. Please sign in or use a different email.',
          'InvalidPasswordException': 'Password does not meet requirements. Please use a stronger password.',
          'InvalidParameterException': 'Invalid email or password format. Please check your input.',
          'LimitExceededException': 'Too many attempts. Please try again later.',
          'NotAuthorizedException': 'Invalid credentials provided.',
          'ResourceNotFoundException': 'User not found.',
          'UserNotConfirmedException': 'Please verify your email address before signing in.',
          'UserNotFoundException': 'User not found.',
          'AliasExistsException': 'An account with this email already exists.',
        };
        errorMessage = errorMap[error.name] || (error.message || error.name);
      } else if (error.message) {
        // If there's a message but no name, use the message
        errorMessage = error.message;
      } else if (error.toString && typeof error.toString === 'function') {
        // Fallback to string representation
        const errorString = error.toString();
        if (errorString !== '[object Object]') {
          errorMessage = errorString;
        }
      }
      
      throw new Error(errorMessage);
    }
  };

  const confirmSignUp = async (email: string, code: string) => {
    try {
      await amplifyConfirmSignUp({ username: email, confirmationCode: code });
    } catch (error: any) {
      let errorMessage = "Confirmation failed";
      
      if (error.name) {
        const errorMap: Record<string, string> = {
          'CodeMismatchException': 'Invalid verification code. Please check and try again.',
          'ExpiredCodeException': 'Verification code has expired. Please request a new one.',
          'NotAuthorizedException': 'Invalid verification code.',
          'UserNotFoundException': 'User not found.',
          'LimitExceededException': 'Too many attempts. Please try again later.',
        };
        errorMessage = errorMap[error.name] || (error.message || error.name);
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      // AWS Amplify v6 resetPassword returns a result with nextStep
      await amplifyResetPassword({ username: email });
      
      // The result contains nextStep information, but we don't need to handle it
      // The reset code will be sent via email
    } catch (error: any) {
      let errorMessage = "Failed to send reset code";
      
      if (error.name) {
        const errorMap: Record<string, string> = {
          'UserNotFoundException': 'No account found with this email.',
          'LimitExceededException': 'Too many attempts. Please try again later.',
          'InvalidParameterException': 'Invalid email address.',
          'NotAuthorizedException': 'Unable to send reset code. Please try again.',
          'TooManyRequestsException': 'Too many requests. Please try again later.',
        };
        errorMessage = errorMap[error.name] || (error.message || error.name);
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.toString && typeof error.toString === 'function') {
        const errorString = error.toString();
        if (errorString !== '[object Object]') {
          errorMessage = errorString;
        }
      }
      
      throw new Error(errorMessage);
    }
  };

  const resetPassword = async (email: string, code: string, newPassword: string) => {
    try {
      await confirmResetPassword({
        username: email,
        confirmationCode: code,
        newPassword,
      });
      
      // Password reset successful - no return value needed
    } catch (error: any) {
      let errorMessage = "Failed to reset password";
      
      if (error.name) {
        const errorMap: Record<string, string> = {
          'CodeMismatchException': 'Invalid verification code. Please check and try again.',
          'ExpiredCodeException': 'Verification code has expired. Please request a new one.',
          'InvalidPasswordException': 'Password does not meet requirements. Please use a stronger password (min 8 characters, with uppercase, lowercase, number, and symbol).',
          'LimitExceededException': 'Too many attempts. Please try again later.',
          'NotAuthorizedException': 'Invalid verification code or code has expired. Please request a new reset code.',
          'UserNotFoundException': 'No account found with this email.',
          'TooManyRequestsException': 'Too many requests. Please try again later.',
        };
        errorMessage = errorMap[error.name] || (error.message || error.name);
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.toString && typeof error.toString === 'function') {
        const errorString = error.toString();
        if (errorString !== '[object Object]') {
          errorMessage = errorString;
        }
      }
      
      throw new Error(errorMessage);
    }
  };

  const resendVerificationCode = async (email: string) => {
    try {
      await resendSignUpCode({ username: email });
    } catch (error: any) {
      let errorMessage = "Failed to resend verification code";
      
      if (error.name) {
        const errorMap: Record<string, string> = {
          'UserNotFoundException': 'User not found.',
          'LimitExceededException': 'Too many attempts. Please try again later.',
          'InvalidParameterException': 'Invalid email address.',
        };
        errorMessage = errorMap[error.name] || (error.message || error.name);
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    }
  };

  const updateProfile = async (fullName: string) => {
    try {
      await updateUserAttribute({
        userAttribute: {
          attributeKey: 'name',
          value: fullName,
        },
      });
      
      // Update local user state
      if (user) {
        setUser({
          ...user,
          fullName,
        });
      }
    } catch (error: any) {
      throw new Error(error.message || "Profile update failed");
    }
  };

  const logout = async () => {
    try {
      await signOut();
      setUser(null);
    } catch (error: any) {
      throw new Error(error.message || "Logout failed");
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    confirmSignUp,
    forgotPassword,
    resetPassword,
    resendVerificationCode,
    updateProfile,
    resetInactivityTimer,
    showInactivityWarning,
    inactivityTimeRemaining,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};