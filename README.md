# FileVault Frontend

A modern, secure file management application built with React, TypeScript, and AWS Amplify.

## Features

- **Secure Authentication**: User registration, login, and email verification
- **Role-Based Access Control**: Admin, Editor, and Viewer roles with different permissions
- **File Management**: Upload, download, list, and delete files
- **Modern UI**: Built with shadcn/ui components and Tailwind CSS
- **AWS Integration**: Seamless integration with AWS Cognito and S3

## Technologies

This project is built with:

- **Vite** - Fast build tool and development server
- **TypeScript** - Type-safe JavaScript
- **React** - UI library
- **shadcn/ui** - Modern UI components
- **Tailwind CSS** - Utility-first CSS framework
- **AWS Amplify** - Authentication and cloud services
- **React Router** - Client-side routing
- **React Hook Form** - Form management
- **Zod** - Schema validation

## Getting Started

### Prerequisites

- Node.js (version 18 or higher)
- npm or yarn package manager
- AWS account with Cognito and S3 configured

### Installation

1. Clone the repository:
```sh
git clone <YOUR_GIT_URL>
cd filevault/frontend
```

2. Install dependencies:
```sh
npm install
```

3. Configure AWS Amplify:
   - Update `src/config/aws-config.ts` with your AWS configuration
   - Ensure your Cognito User Pool and S3 bucket are properly configured

4. Start the development server:
```sh
npm run dev
```

The application will be available at `http://localhost:8080`.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build:dev` - Build for development
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui components
│   └── ProtectedRoute.tsx
├── config/             # Configuration files
├── contexts/           # React contexts (Auth)
├── hooks/              # Custom React hooks
├── lib/                # Utility functions
├── pages/              # Page components
└── main.tsx           # Application entry point
```

## Environment Variables

Create a `.env` file in the frontend directory with the following variables:

```
VITE_AWS_REGION=your-aws-region
VITE_USER_POOL_ID=your-cognito-user-pool-id
VITE_USER_POOL_CLIENT_ID=your-cognito-client-id
VITE_IDENTITY_POOL_ID=your-identity-pool-id
VITE_S3_BUCKET=your-s3-bucket-name
```

## Deployment

The frontend can be deployed to various platforms:

1. **AWS Amplify**: Connect your GitHub repository for automatic deployments
2. **Vercel**: Deploy with `vercel --prod`
3. **Netlify**: Connect your repository for automatic deployments
4. **Static Hosting**: Build with `npm run build` and deploy the `dist` folder

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test your changes
5. Submit a pull request

## License

This project is licensed under the MIT License.