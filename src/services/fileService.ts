import { fetchAuthSession } from "aws-amplify/auth";
import axios from "axios";

const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT;

export interface UploadUrlResponse {
  uploadUrl: string;
  fileKey: string;
  requiredHeaders: Record<string, string>;
}

export interface FileUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface FileInfo {
  key: string;
  fileName: string;
  size: number;
  lastModified: string;
  downloadUrl: string | null;
  ownerEmail?: string;
  ownerId?: string;
  ownerName?: string;
  fileId?: string;
}

export interface FileListResponse {
  files: FileInfo[];
  count: number;
}

class FileService {
  private async getAuthToken(): Promise<string> {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    if (!token) {
      throw new Error("No authentication token available");
    }
    return token;
  }

  async getUploadUrl(filename: string, contentType?: string, targetUserId?: string): Promise<UploadUrlResponse> {
    try {
      const token = await this.getAuthToken();

      const payload: any = { filename, contentType };
      if (targetUserId) {
        payload.targetUserId = targetUserId;
      }

      const response = await axios.post(
        `${API_ENDPOINT}/api/files/upload-url`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data;
    } catch (error: any) {
      console.error("Error getting upload URL:", error);
      console.error("Response status:", error.response?.status);
      console.error("Response data:", error.response?.data);
      
      // Handle specific error codes
      if (error.response?.status === 403) {
        throw new Error("You are not authorized to upload for this user.");
      } else if (error.response?.status === 404) {
        throw new Error("Target user not found.");
      }
      
      throw new Error(error.response?.data?.message || "Failed to get upload URL");
    }
  }

  async uploadFile(
    file: File,
    uploadUrl: string,
    requiredHeaders: Record<string, string> = {},
    onProgress?: (progress: FileUploadProgress) => void
  ): Promise<void> {
    try {
      await axios.put(uploadUrl, file, {
        headers: {
          "Content-Type": file.type,
          ...requiredHeaders, // 🔑 include KMS headers
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total && onProgress) {
            const progress: FileUploadProgress = {
              loaded: progressEvent.loaded,
              total: progressEvent.total,
              percentage: Math.round((progressEvent.loaded * 100) / progressEvent.total),
            };
            onProgress(progress);
          }
        },
      });
    } catch (error: any) {
      console.error("Error uploading file to S3:", error);
      console.error("Response status:", error.response?.status);
      console.error("Response data:", error.response?.data);
      console.error("Upload URL used:", uploadUrl);

      if (error.response?.status === 403) {
        throw new Error("Access denied. The upload URL may be expired or invalid.");
      } else if (error.response?.status === 404) {
        throw new Error("Upload URL not found. Please try again.");
      } else if (error.response?.status === 400) {
        throw new Error("Invalid file or upload request.");
      } else {
        throw new Error(`Upload failed: ${error.response?.data?.message || error.message}`);
      }
    }
  }

  async uploadFileWithProgress(
    file: File,
    onProgress?: (progress: FileUploadProgress) => void,
    targetUserId?: string
  ): Promise<{ fileKey: string; fileName: string; fileSize: number }> {
    try {
      // Step 1: Get upload URL + required headers (with optional targetUserId)
      const { uploadUrl, fileKey, requiredHeaders } = await this.getUploadUrl(
        file.name,
        file.type,
        targetUserId
      );

      // Step 2: Upload file to S3 with headers
      await this.uploadFile(file, uploadUrl, requiredHeaders, onProgress);

      return {
        fileKey,
        fileName: file.name,
        fileSize: file.size,
      };
    } catch (error: any) {
      console.error("Error in upload process:", error);
      throw error;
    }
  }

  async listFiles(): Promise<FileListResponse> {
    try {
      const token = await this.getAuthToken();

      const response = await axios.get(
        `${API_ENDPOINT}/api/files`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      // Debug: Log the raw backend response
      console.log("🔍 Raw backend response:", response.data);
      console.log("📁 Files array:", response.data.files);
      
      // Map backend response into FileInfo format
      const mappedFiles = (response.data.files || []).map((f: any, index: number) => {
        console.log(`📄 File ${index}:`, f);
        
        const mappedFile = {
          key: f.s3Key || f.key || f.fileKey || f.id, // Backend returns s3Key, try multiple possible key fields
          fileName: f.fileName || f.name || (f.s3Key ? f.s3Key.split("/").pop() : 'Unknown File'),
          size: f.size || 0,
          lastModified: f.lastModified || f.modifiedAt || f.uploadedAt || new Date().toISOString(),
          downloadUrl: null, // We'll get this separately when downloading
          ownerEmail: f.ownerEmail || f.ownerId,
          ownerId: f.ownerId || f.ownerEmail,
          ownerName: f.ownerName,
          fileId: f.fileId, // Store the fileId for downloads
        };
        
        console.log(`✅ Mapped file ${index}:`, mappedFile);
        return mappedFile;
      });

      return {
        files: mappedFiles,
        count: mappedFiles.length,
      };
    } catch (error: any) {
      console.error("Error listing files:", error);
      console.error("Response status:", error.response?.status);
      console.error("Response data:", error.response?.data);
      throw new Error(error.response?.data?.message || "Failed to list files");
    }
  }

  async getDownloadUrl(fileKey: string, fileId?: string): Promise<string> {
    try {
      if (!fileKey && !fileId) {
        throw new Error("File key or file ID is required for download");
      }

      const token = await this.getAuthToken();
      
      // Use fileId if provided, otherwise extract from s3Key
      let downloadFileId = fileId;
      
      if (!downloadFileId && fileKey) {
        // Extract file ID from the s3Key (e.g., "user@email.com/uploads/filename.pdf" -> "filename.pdf")
        // The backend expects just the filename without the user path
        const keyParts = fileKey.split('/');
        downloadFileId = keyParts[keyParts.length - 1]; // Get the last part (filename)
      }

      console.log("🔗 Getting download URL for file:", downloadFileId);
      console.log("📁 Original fileKey:", fileKey);

      const response = await axios.get(
        `${API_ENDPOINT}/api/files/${encodeURIComponent(downloadFileId)}/download`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      
      console.log("✅ Download URL response:", response.data);
      return response.data.downloadUrl;
    } catch (error: any) {
      console.error("❌ Error getting download URL:", error);
      console.error("📊 Response status:", error.response?.status);
      console.error("📄 Response data:", error.response?.data);
      console.error("🔑 File key used:", fileKey);
      console.error("🆔 File ID used:", fileId);
      throw new Error(error.response?.data?.message || "Failed to get download URL");
    }
  }

  async downloadFile(fileKey: string, fileName: string, fileId?: string): Promise<void> {
    try {
      if (!fileKey && !fileId) {
        throw new Error("File key or file ID is required for download");
      }
      if (!fileName) {
        throw new Error("File name is required for download");
      }

      console.log("⬇️ Starting download for:", fileName, "with key:", fileKey, "fileId:", fileId);

      // Get the download URL from the API
      const downloadUrl = await this.getDownloadUrl(fileKey, fileId);
      
      if (!downloadUrl) {
        throw new Error("No download URL received from server");
      }

      console.log("🔗 Download URL received, starting download...");
      
      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      link.target = '_blank';
      
      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log("✅ Download initiated successfully");
    } catch (error: any) {
      console.error("❌ Error downloading file:", error);
      throw error; // Re-throw to preserve original error message
    }
  }

  async deleteFile(fileKey: string, fileId?: string): Promise<string> {
    try {
      const token = await this.getAuthToken();
      
      // Use fileId if provided, otherwise extract from fileKey
      let id = fileId;
      if (!id) {
        // Extract UUID from the key (format: uploads/{uuid}/filename.ext)
        const keyParts = fileKey.split('/');
        if (keyParts.length >= 2) {
          id = keyParts[1]; // Get the UUID (second part)
        } else {
          // Fallback: remove "uploads/" prefix
          id = fileKey.replace("uploads/", "").split('/')[0];
        }
      }

      console.log("🗑️ Deleting file with ID:", id);
      console.log("🗑️ Original fileKey:", fileKey);

      const response = await axios.delete(
        `${API_ENDPOINT}/api/files/${encodeURIComponent(id)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data.deleted || fileKey;
    } catch (error: any) {
      console.error("Error deleting file:", error);
      console.error("Response status:", error.response?.status);
      console.error("Response data:", error.response?.data);
      throw new Error(error.response?.data?.message || "Failed to delete file");
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  getFileIcon(fileName: string): string {
    const extension = fileName.split(".").pop()?.toLowerCase();
    switch (extension) {
      case "pdf":
        return "📄";
      case "doc":
      case "docx":
        return "📝";
      case "xls":
      case "xlsx":
        return "📊";
      case "ppt":
      case "pptx":
        return "📋";
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
        return "🖼️";
      case "mp4":
      case "avi":
      case "mov":
        return "🎥";
      case "mp3":
      case "wav":
        return "🎵";
      case "zip":
      case "rar":
        return "📦";
      default:
        return "📁";
    }
  }
}

export const fileService = new FileService();
