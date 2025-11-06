# Phase 4: Frontend Application

## 🎯 Objectives

Phase 4 builds the React frontend application. We implement:
- Modern React UI with TypeScript
- Authentication flows and protected routes
- File management interface
- Role-based UI components
- AWS Amplify integration
- State management with React Context

## 📋 Table of Contents

1. [Application Architecture](#application-architecture)
2. [Authentication UI](#authentication-ui)
3. [File Management](#file-management)
4. [Role-Based Components](#role-based-components)
5. [State Management](#state-management)
6. [AWS SDK Integration](#aws-sdk-integration)

---

## 🏗️ Application Architecture

### Project Structure

```
frontend/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── ui/            # shadcn/ui components
│   │   ├── ProtectedRoute.tsx
│   │   ├── InactivityWarning.tsx
│   │   └── MFASetup.tsx
│   ├── contexts/          # React contexts
│   │   └── AuthContext.tsx
│   ├── pages/            # Page components
│   │   ├── Auth.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Files.tsx
│   │   ├── Upload.tsx
│   │   ├── Users.tsx
│   │   └── Profile.tsx
│   ├── services/         # API service layers
│   │   ├── fileService.ts
│   │   └── userService.ts
│   ├── config/          # Configuration
│   │   └── aws-config.ts
│   └── main.tsx        # Application entry
```

### Technology Stack

- **React 18**: UI library with hooks
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool
- **Tailwind CSS**: Utility-first styling
- **shadcn/ui**: Modern component library
- **AWS Amplify**: Authentication SDK
- **Axios**: HTTP client
- **React Router**: Client-side routing

### AWS Configuration

```typescript
// config/aws-config.ts
import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
      region: import.meta.env.VITE_REGION
    }
  }
});
```

**Environment Variables:**
```env
VITE_REGION=us-east-1
VITE_USER_POOL_ID=us-east-1_XXXXXXXXX
VITE_USER_POOL_CLIENT_ID=XXXXXXXXX
VITE_API_ENDPOINT=https://api-id.execute-api.us-east-1.amazonaws.com/dev
```

---

## 🔐 Authentication UI

### Auth Context

Centralized authentication state management:

```typescript
// contexts/AuthContext.tsx
interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  setupMFA: () => Promise<{ secretCode: string; qrCode: string }>;
  isMFAEnabled: () => Promise<boolean>;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      
      if (idToken) {
        const decoded = jwtDecode<JWTPayload>(idToken);
        setUser({
          email: decoded.email,
          fullName: decoded.name || '',
          role: decoded['cognito:groups']?.[0] || 'Viewer',
          token: idToken,
          sub: decoded.sub
        });
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // ... other methods
};
```

### Login Page

```typescript
// pages/Auth.tsx
const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Login failed');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin}>
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit">Sign In</Button>
        </form>
      </CardContent>
    </Card>
  );
};
```

### Registration Flow

```typescript
const handleRegister = async () => {
  try {
    await register(fullName, email, password);
    setShowVerification(true);
    toast.success('Verification code sent to your email');
  } catch (error: any) {
    toast.error(error.message || 'Registration failed');
  }
};

const handleVerify = async () => {
  try {
    await confirmSignUp(email, code);
    toast.success('Account verified! Please sign in.');
    navigate('/auth');
  } catch (error: any) {
    toast.error(error.message || 'Verification failed');
  }
};
```

### Protected Routes

```typescript
// components/ProtectedRoute.tsx
export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
};
```

**Usage:**
```typescript
<Routes>
  <Route path="/auth" element={<Auth />} />
  <Route
    path="/dashboard"
    element={
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    }
  />
</Routes>
```

### Auto-Logout on Inactivity

```typescript
// InactivityWarning component
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const WARNING_TIME = 1 * 60 * 1000; // 1 minute warning

useEffect(() => {
  const resetTimer = () => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setShowWarning(true);
      countdownRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 0) {
            logout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, INACTIVITY_TIMEOUT);
  };

  document.addEventListener('mousedown', resetTimer);
  document.addEventListener('keypress', resetTimer);

  return () => {
    clearTimeout(timerRef.current);
    clearInterval(countdownRef.current);
  };
}, []);
```

---

## 📁 File Management

### File Service

```typescript
// services/fileService.ts
class FileService {
  private async getAuthToken(): Promise<string> {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    if (!token) {
      throw new Error('No authentication token available');
    }
    return token;
  }

  async getUploadUrl(
    filename: string,
    contentType?: string,
    targetUserId?: string
  ): Promise<UploadUrlResponse> {
    const token = await this.getAuthToken();
    const response = await axios.post(
      `${API_ENDPOINT}/api/files/upload-url`,
      { filename, contentType, targetUserId },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  }

  async uploadFile(
    file: File,
    uploadUrl: string,
    requiredHeaders: Record<string, string>,
    onProgress?: (progress: FileUploadProgress) => void
  ): Promise<void> {
    await axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type,
        ...requiredHeaders
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          onProgress({
            loaded: progressEvent.loaded,
            total: progressEvent.total,
            percentage: Math.round((progressEvent.loaded * 100) / progressEvent.total)
          });
        }
      }
    });
  }

  async listFiles(): Promise<FileListResponse> {
    const token = await this.getAuthToken();
    const response = await axios.get(`${API_ENDPOINT}/api/files`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  async downloadFile(fileKey: string, fileName: string, fileId?: string): Promise<void> {
    const token = await this.getAuthToken();
    const response = await axios.get(
      `${API_ENDPOINT}/api/files/${fileId || fileKey}/download`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const { downloadUrl } = response.data;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
```

### Upload Page

```typescript
// pages/Upload.tsx
const Upload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();
  const fileService = new FileService();

  const handleUpload = async () => {
    if (!file) return;

    try {
      setUploading(true);
      
      // Get presigned URL
      const { uploadUrl, requiredHeaders } = await fileService.getUploadUrl(
        file.name,
        file.type
      );

      // Upload to S3
      await fileService.uploadFile(
        file,
        uploadUrl,
        requiredHeaders,
        (progress) => {
          setProgress(progress.percentage);
        }
      );

      toast.success('File uploaded successfully');
      navigate('/files');
    } catch (error: any) {
      toast.error(error.message || 'Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload File</CardTitle>
      </CardHeader>
      <CardContent>
        <Input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        {uploading && (
          <Progress value={progress} />
        )}
        <Button onClick={handleUpload} disabled={!file || uploading}>
          Upload
        </Button>
      </CardContent>
    </Card>
  );
};
```

### Files List Page

```typescript
// pages/Files.tsx
const Files = () => {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const fileService = new FileService();

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const response = await fileService.listFiles();
      setFiles(response.files || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (file: FileInfo) => {
    try {
      await fileService.downloadFile(file.key, file.fileName, file.fileId);
      toast.success('Download started');
    } catch (error: any) {
      toast.error(error.message || 'Download failed');
    }
  };

  const handleDelete = async (file: FileInfo) => {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      await fileService.deleteFile(file.fileId || file.key);
      toast.success('File deleted');
      loadFiles();
    } catch (error: any) {
      toast.error(error.message || 'Delete failed');
    }
  };

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => (
            <TableRow key={file.fileId}>
              <TableCell>{file.fileName}</TableCell>
              <TableCell>{formatBytes(file.size)}</TableCell>
              <TableCell>{file.ownerEmail}</TableCell>
              <TableCell>
                <Button onClick={() => handleDownload(file)}>Download</Button>
                {canDelete(file) && (
                  <Button onClick={() => handleDelete(file)} variant="destructive">
                    Delete
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
```

---

## 👮 Role-Based Components

### Role-Based Rendering

```typescript
const canManageUsers = user?.role === 'Admin';
const canUpload = ['Admin', 'Editor', 'Viewer'].includes(user?.role || '');
const canDelete = (file: FileInfo) => {
  if (user?.role === 'Admin') return true;
  if (file.ownerId === user?.sub) return true;
  // Editors can delete delegated viewers' files
  if (user?.role === 'Editor' && file.ownerRole === 'Viewer') {
    return delegatedViewers.includes(file.ownerId);
  }
  return false;
};
```

### Conditional Navigation

```typescript
<SidebarMenu>
  <SidebarMenuItem>
    <SidebarMenuButton onClick={() => navigate('/files')}>
      <FileText /> Files
    </SidebarMenuButton>
  </SidebarMenuItem>
  
  {canUpload && (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={() => navigate('/upload')}>
        <Upload /> Upload
      </SidebarMenuButton>
    </SidebarMenuItem>
  )}
  
  {canManageUsers && (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={() => navigate('/users')}>
        <Users /> Manage Users
      </SidebarMenuButton>
    </SidebarMenuItem>
  )}
</SidebarMenu>
```

### Role Badges

```typescript
const getRoleConfig = (role: string) => {
  switch (role) {
    case 'Admin':
      return {
        color: 'bg-red-500 text-white',
        icon: Shield,
        description: 'Full system access'
      };
    case 'Editor':
      return {
        color: 'bg-blue-500 text-white',
        icon: Edit3,
        description: 'Upload and download files'
      };
    case 'Viewer':
      return {
        color: 'bg-green-500 text-white',
        icon: Eye,
        description: 'Read-only access'
      };
  }
};

<Badge className={roleConfig.color}>
  <RoleIcon /> {user.role}
</Badge>
```

---

## 🔄 State Management

### Auth Context Pattern

```typescript
// Centralized auth state
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Provider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  // ... methods
  
  return (
    <AuthContext.Provider value={{ user, login, logout, ... }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### Local State for UI

```typescript
// Component-level state for UI interactions
const [files, setFiles] = useState<FileInfo[]>([]);
const [loading, setLoading] = useState(false);
const [searchTerm, setSearchTerm] = useState('');
```

### Optimistic Updates

```typescript
const handleDelete = async (file: FileInfo) => {
  // Optimistic update
  setFiles(files.filter(f => f.fileId !== file.fileId));
  
  try {
    await fileService.deleteFile(file.fileId);
    toast.success('File deleted');
  } catch (error) {
    // Rollback on error
    setFiles([...files, file]);
    toast.error('Delete failed');
  }
};
```

---

## 🔌 AWS SDK Integration

### Amplify Auth

```typescript
import {
  signIn,
  signUp,
  signOut,
  getCurrentUser,
  fetchAuthSession,
  confirmSignUp
} from 'aws-amplify/auth';

// Login
const result = await signIn({ username: email, password });

// Get session
const session = await fetchAuthSession();
const idToken = session.tokens?.idToken?.toString();

// Logout
await signOut();
```

### API Calls with Auth

```typescript
// Automatic token injection
const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
};
```

### Error Handling

```typescript
try {
  await fileService.uploadFile(file, uploadUrl, headers);
} catch (error: any) {
  if (error.response?.status === 401) {
    // Token expired
    await logout();
    navigate('/auth');
  } else if (error.response?.status === 403) {
    // Insufficient permissions
    toast.error('You do not have permission to perform this action');
  } else {
    // Generic error
    toast.error(error.message || 'An error occurred');
  }
}
```

---

## 🎨 UI Components

### shadcn/ui Integration

```typescript
// Using pre-built components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
```

### Custom Components

```typescript
// components/FileUpload.tsx
export const FileUpload: React.FC<{
  onUploadComplete: () => void;
  targetUserId?: string;
}> = ({ onUploadComplete, targetUserId }) => {
  // Upload logic
};
```

---

## 🧪 Testing

### Component Testing

```typescript
// __tests__/Auth.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Auth } from '@/pages/Auth';

test('renders login form', () => {
  render(<Auth />);
  expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
});

test('handles login', async () => {
  render(<Auth />);
  fireEvent.change(screen.getByPlaceholderText('Email'), {
    target: { value: 'test@example.com' }
  });
  fireEvent.click(screen.getByText('Sign In'));
  // Assert login behavior
});
```

### Integration Testing

```typescript
// Test file upload flow
test('uploads file successfully', async () => {
  const mockGetUploadUrl = jest.fn().mockResolvedValue({
    uploadUrl: 'https://s3...',
    requiredHeaders: {}
  });
  
  // Test upload flow
});
```

---

## 🔄 Next Steps

After completing Phase 4, proceed to:
- **[Phase 5: Advanced Features](./phase5-advanced-features.md)** - MFA, user management, delegation

---

## 📚 Key Learnings

1. **React Context**: Centralized state management
2. **Protected Routes**: Secure navigation
3. **AWS Amplify**: Simplified authentication
4. **TypeScript**: Type safety for better DX
5. **Component Library**: shadcn/ui for rapid development
6. **Error Handling**: User-friendly error messages

---

## 🐛 Common Issues

### Issue: CORS errors

**Solution:**
- Check API Gateway CORS configuration
- Verify frontend origin
- Check preflight requests

### Issue: Token expired

**Solution:**
- Implement token refresh
- Handle 401 errors gracefully
- Redirect to login

### Issue: State not updating

**Solution:**
- Check React dependencies
- Verify context provider
- Use proper state setters

---

**Phase 4 Complete! ✅** You now have a modern, secure React frontend.

