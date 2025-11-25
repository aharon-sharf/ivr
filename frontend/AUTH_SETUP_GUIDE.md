# Authentication Setup Guide

## Quick Start Guide for Testing Authentication

### Prerequisites

1. **AWS Account** with Cognito User Pool created
2. **Node.js** v18+ installed
3. **npm** or **yarn** package manager

### Step 1: Configure AWS Cognito

If you haven't already set up a Cognito User Pool:

1. Go to AWS Console → Cognito
2. Create a new User Pool
3. Configure the following settings:
   - **Sign-in options**: Email
   - **Password policy**: 
     - Minimum length: 8
     - Require uppercase, lowercase, numbers, and special characters
   - **MFA**: Optional (SMS or TOTP)
   - **User account recovery**: Email
   - **Self-service sign-up**: Enabled
   - **Email verification**: Required
   
4. Create an App Client:
   - **App type**: Public client
   - **Authentication flows**: 
     - ALLOW_USER_PASSWORD_AUTH
     - ALLOW_REFRESH_TOKEN_AUTH
   - **OAuth 2.0 grant types**: Authorization code grant
   - **OAuth scopes**: email, openid, profile
   
5. Configure the Hosted UI domain (optional but recommended)

6. Note down:
   - User Pool ID (e.g., `us-east-1_XXXXXXXXX`)
   - App Client ID (e.g., `XXXXXXXXXXXXXXXXXXXXXXXXXX`)
   - Cognito Domain (e.g., `your-domain.auth.us-east-1.amazoncognito.com`)

### Step 2: Configure Environment Variables

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and fill in your Cognito details:
   ```env
   VITE_API_BASE_URL=http://localhost:4000/api
   VITE_AWS_REGION=us-east-1
   VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
   VITE_COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
   VITE_COGNITO_DOMAIN=your-domain.auth.us-east-1.amazoncognito.com
   ```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Start Development Server

```bash
npm run dev
```

The application should start at `http://localhost:5173`

### Step 5: Test Authentication Flow

#### Test Sign Up

1. Navigate to `http://localhost:5173`
2. You should be redirected to `/login`
3. Click "Sign up" link
4. Fill in the registration form:
   - Full Name: `Test User`
   - Email: `test@example.com`
   - Password: `Test123!@#` (must meet complexity requirements)
   - Confirm Password: `Test123!@#`
5. Click "Sign Up"
6. Check your email for the verification code

#### Test Email Verification

1. You should be redirected to `/confirm-signup`
2. Enter the 6-digit verification code from your email
3. Click "Verify Email"
4. You should be redirected to `/login`

#### Test Login

1. Enter your email and password
2. Click "Sign In"
3. You should be redirected to `/dashboard`
4. You should see your user information displayed

#### Test Protected Routes

1. While logged in, try accessing `/dashboard` - should work
2. Click "Sign Out"
3. Try accessing `/dashboard` - should redirect to `/login`

#### Test Password Reset

1. On the login page, click "Forgot password?"
2. Enter your email
3. Click "Send Reset Code"
4. Check your email for the reset code
5. Enter the code and new password
6. Click "Reset Password"
7. You should be redirected to login
8. Login with your new password

### Step 6: Test Role-Based Access (Optional)

To test role-based access control:

1. In AWS Cognito Console, go to your User Pool
2. Select your test user
3. Add a custom attribute:
   - Attribute name: `custom:role`
   - Value: `CampaignManager` or `Administrator` or `Analyst`
4. Save the changes
5. Login again to see the role reflected in the dashboard

### Troubleshooting

#### Issue: "Cannot find module 'aws-amplify'"
**Solution**: Run `npm install` in the frontend directory

#### Issue: "User Pool not found"
**Solution**: Check that your `VITE_COGNITO_USER_POOL_ID` is correct in `.env`

#### Issue: "Invalid client id"
**Solution**: Check that your `VITE_COGNITO_CLIENT_ID` is correct in `.env`

#### Issue: "Email not verified"
**Solution**: Check your email for the verification code and complete the verification step

#### Issue: "Password does not meet requirements"
**Solution**: Ensure password has:
- At least 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

#### Issue: TypeScript errors in IDE
**Solution**: 
1. Ensure all dependencies are installed: `npm install`
2. Restart your IDE/editor
3. If using VS Code, reload the window (Cmd/Ctrl + Shift + P → "Reload Window")

### Development Tips

1. **Hot Reload**: The dev server supports hot module replacement. Changes to code will automatically reload.

2. **Redux DevTools**: Install Redux DevTools browser extension to inspect authentication state.

3. **Network Tab**: Use browser DevTools Network tab to inspect API calls and JWT tokens.

4. **Console Logs**: Check browser console for any authentication errors.

5. **Cognito Console**: Monitor user sign-ups and logins in AWS Cognito Console.

### Production Deployment

Before deploying to production:

1. Update environment variables for production Cognito pool
2. Configure proper CORS settings in Cognito
3. Set up custom domain for Cognito Hosted UI
4. Enable MFA for admin users
5. Configure proper password policies
6. Set up CloudWatch logging for authentication events
7. Review and configure token expiration times

### Security Checklist

- ✅ JWT tokens are not stored in localStorage (handled by Amplify)
- ✅ Password complexity requirements enforced
- ✅ Email verification required
- ✅ HTTPS enforced in production
- ✅ Token refresh handled automatically
- ✅ Protected routes require authentication
- ✅ Role-based access control implemented
- ✅ MFA support configured in Cognito

### Next Steps

Now that authentication is working, you can:
1. Implement campaign management UI (Task 11.3)
2. Add contact upload functionality (Task 11.4)
3. Build audio recording features (Task 11.5)
4. Create the IVR flow builder (Task 11.6)

All these features will automatically use the authentication system you just set up!
