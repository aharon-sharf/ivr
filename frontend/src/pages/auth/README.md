# Authentication Implementation

This directory contains the authentication flow implementation using AWS Cognito.

## Features Implemented

### 1. User Registration (Sign Up)
- Email and password-based registration
- Password complexity validation (min 8 chars, uppercase, lowercase, number, special char)
- Email verification with confirmation code
- Resend verification code functionality

### 2. User Login (Sign In)
- Email and password authentication
- JWT token management via AWS Cognito
- Automatic token refresh
- Remember redirect location after login

### 3. Password Reset
- Forgot password flow with email verification
- Reset password with confirmation code
- Password complexity validation

### 4. Protected Routes
- Route protection based on authentication status
- Role-based access control (RBAC)
- Automatic redirect to login for unauthenticated users
- Loading state during authentication check

### 5. Session Management
- Automatic token refresh using Cognito
- Secure token storage (handled by AWS Amplify)
- Token expiration: 1 hour (access token), 30 days (refresh token)
- Automatic logout on token expiration

## Components

### Pages
- `LoginPage.tsx` - User login form
- `SignUpPage.tsx` - User registration form
- `ConfirmSignUpPage.tsx` - Email verification form
- `ForgotPasswordPage.tsx` - Request password reset
- `ResetPasswordPage.tsx` - Confirm password reset
- `UnauthorizedPage.tsx` - Access denied page

### Components
- `ProtectedRoute.tsx` - HOC for protecting routes

### Hooks
- `useAuth.ts` - Custom hook for authentication operations

### Configuration
- `config/amplify.ts` - AWS Amplify configuration

## Environment Variables

Required environment variables in `.env`:

```env
VITE_AWS_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
VITE_COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_COGNITO_DOMAIN=your-domain.auth.us-east-1.amazoncognito.com
```

## User Roles

The system supports three user roles:
- `CampaignManager` - Can create and manage campaigns
- `Administrator` - Full system access
- `Analyst` - Read-only access to analytics

Roles are stored in Cognito user attributes as `custom:role`.

## Usage

### Protecting a Route

```tsx
import { ProtectedRoute } from './components/auth/ProtectedRoute';

<Route
  path="/campaigns"
  element={
    <ProtectedRoute requiredRole="CampaignManager">
      <CampaignsPage />
    </ProtectedRoute>
  }
/>
```

### Using Authentication Hook

```tsx
import { useAuth } from './hooks/useAuth';

function MyComponent() {
  const { user, isAuthenticated, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div>
      {isAuthenticated && <p>Welcome, {user?.name}!</p>}
      <button onClick={handleLogout}>Sign Out</button>
    </div>
  );
}
```

## API Integration

The API client (`src/api/client.ts`) automatically:
- Fetches the current Cognito access token
- Adds it to the Authorization header
- Handles 401 errors by redirecting to login

## Security Features

1. **Password Policy**: Enforced via Cognito
   - Minimum 8 characters
   - Requires uppercase, lowercase, number, and special character

2. **MFA Support**: Configured in Cognito (SMS and TOTP)

3. **Token Security**: 
   - Tokens managed by AWS Amplify (secure storage)
   - Automatic token refresh
   - Short-lived access tokens (1 hour)

4. **HTTPS Only**: All authentication requests use HTTPS

## Testing

To test the authentication flow:

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:5173/signup`

3. Create a test account

4. Check your email for the verification code

5. Verify your email and login

## Next Steps

- Implement MFA setup in user profile
- Add social login (Google, Facebook)
- Implement session timeout warnings
- Add audit logging for authentication events
