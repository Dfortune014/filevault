import { fetchAuthSession } from "aws-amplify/auth";
import axios from "axios";

const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT;

export interface UserUpdateRequest {
  fullName: string;
}

export interface UserUpdateResponse {
  message: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };
}

export interface UserInfo {
  id: string;
  email: string;
  fullName: string;
  role: string;
  delegatedEditor?: string;
  createdAt: string;
  lastLogin?: string;
  status: 'active' | 'inactive';
}

export interface UsersListResponse {
  users: UserInfo[];
  count: number;
}

export interface RoleUpdateRequest {
  role: 'Admin' | 'Editor' | 'Viewer';
}

export interface RoleUpdateResponse {
  message: string;
  user: UserInfo;
}

export interface DelegateRequest {
  editorId?: string; // null to unlink
}

export interface DelegateResponse {
  message: string;
  user: UserInfo;
}

export interface MFAStatusResponse {
  mfaEnabled: boolean;
  hasTotpDevice: boolean;
  preferredMfaSetting: string;
  mfaDevices: number;
}

class UserService {
  private async getAuthToken(): Promise<string> {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    if (!token) {
      throw new Error("No authentication token available");
    }
    return token;
  }

  async updateUser(userId: string, updates: UserUpdateRequest): Promise<UserUpdateResponse> {
    try {
      const token = await this.getAuthToken();

      const response = await axios.patch(
        `${API_ENDPOINT}/api/users/${encodeURIComponent(userId)}`,
        updates,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to update user");
    }
  }

  async listUsers(): Promise<UsersListResponse> {
    try {
      const token = await this.getAuthToken();

      const url = `${API_ENDPOINT}/api/users`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      
      // Handle both array response and object with users property
      const data = response.data;
      if (Array.isArray(data)) {
        return { users: data, count: data.length };
      }
      return data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to list users");
    }
  }

  async listDelegatedUsers(): Promise<UsersListResponse> {
    try {
      const token = await this.getAuthToken();

      const url = `${API_ENDPOINT}/api/users/delegated`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      
      // Handle different response formats
      const data = response.data;
      
      // If it's an array, wrap it
      if (Array.isArray(data)) {
        return { users: data, count: data.length };
      }
      
      // If it has delegatedViewers property, map it to users
      if (data.delegatedViewers) {
        return { 
          users: data.delegatedViewers, 
          count: data.delegatedViewers.length 
        };
      }
      
      // If it has users property, return as is
      if (data.users) {
        return data;
      }
      
      // Fallback to empty array
      return { users: [], count: 0 };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to list delegated users");
    }
  }

  async updateUserRole(userId: string, roleUpdate: RoleUpdateRequest): Promise<RoleUpdateResponse> {
    try {
      if (!userId || userId === 'unknown-id') {
        throw new Error(`Invalid user ID provided: ${userId}. Must be a valid Cognito sub claim or email address.`);
      }
      
      const token = await this.getAuthToken();
      const response = await axios.patch(
        `${API_ENDPOINT}/api/users/${encodeURIComponent(userId)}/role`,
        roleUpdate,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to update user role");
    }
  }

  async delegateUser(userId: string, delegateRequest: DelegateRequest): Promise<DelegateResponse> {
    try {
      if (!userId || userId === 'unknown-id') {
        throw new Error(`Invalid user ID provided: ${userId}. Must be a valid Cognito sub claim or email address.`);
      }
      
      const token = await this.getAuthToken();
      const response = await axios.patch(
        `${API_ENDPOINT}/api/users/${encodeURIComponent(userId)}/delegate`,
        delegateRequest,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to delegate user");
    }
  }

  async checkMFAStatus(): Promise<MFAStatusResponse> {
    try {
      const token = await this.getAuthToken();
      const response = await axios.get(
        `${API_ENDPOINT}/api/auth/mfa-status`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || "Failed to check MFA status");
    }
  }
}

export const userService = new UserService();
