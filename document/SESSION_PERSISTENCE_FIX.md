# Session Persistence Fix - "Already Signed In User" Error

## Problem
When users logged in and opened a new browser tab:
1. The new tab didn't recognize they were already authenticated
2. If they tried to log in again, they got "There is already a signed in user" error
3. The login page showed even though the user had an active Cognito session

## Root Cause

### How Authentication Was Working (Before):
```
User opens new tab
  ↓
Redux store initializes (empty state: isAuthenticated = false)
  ↓
LoginPage renders
  ↓
useAuth hook runs checkAuthStatus() in background
  ↓
User sees login form and tries to login
  ↓
Amplify says "already signed in" (session exists in localStorage)
  ↓
ERROR: Race condition between UI and auth check
```

### The Issues:
1. **Redux state is per-tab** - Each browser tab has its own Redux store instance
2. **Amplify session is shared** - Stored in localStorage/cookies, shared across tabs
3. **No global auth initialization** - Auth check happened per-component, not at app startup
4. **Race condition** - User could interact with login form before auth check completed

## Solution

### New Authentication Flow:
```
User opens new tab
  ↓
App starts
  ↓
AuthInitializer wraps entire app
  ↓
Shows loading spinner
  ↓
Checks Amplify session (checkAuthStatus)
  ↓
Updates Redux store with user info
  ↓
Renders app with correct auth state
  ↓
LoginPage sees isAuthenticated=true → redirects to dashboard
```

### Changes Made:

#### 1. Created `AuthInitializer` Component
**File:** `frontend/src/components/auth/AuthInitializer.tsx`

This component:
- Wraps the entire app
- Checks for existing Amplify session on startup
- Shows loading spinner while checking
- Only renders children after auth state is determined
- Ensures Redux store is synced with Amplify session before any routes render

```typescript
export const AuthInitializer = ({ children }: AuthInitializerProps) => {
  const { checkAuthStatus, isLoading } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeAuth = async () => {
      await checkAuthStatus();
      setIsInitialized(true);
    };
    initializeAuth();
  }, [checkAuthStatus]);

  if (!isInitialized || isLoading) {
    return <CircularProgress />; // Show loading
  }

  return <>{children}</>;
};
```

#### 2. Updated `App.tsx`
Wrapped all routes with `AuthInitializer`:

```typescript
function App() {
  return (
    <Router>
      <AuthInitializer>
        <Routes>
          {/* All routes */}
        </Routes>
      </AuthInitializer>
    </Router>
  );
}
```

#### 3. Updated `useAuth` Hook
Removed the per-component auth check since it's now done globally:

**Before:**
```typescript
export const useAuth = () => {
  // ...
  useEffect(() => {
    checkAuthStatus(); // ❌ Ran in every component
  }, []);
  // ...
}
```

**After:**
```typescript
export const useAuth = () => {
  // ✅ No automatic check, only when explicitly called
  const checkAuthStatus = useCallback(async () => {
    // ...
  }, [dispatch]);
  // ...
}
```

#### 4. Updated `LoginPage`
Added redirect for already-authenticated users:

```typescript
export const LoginPage = () => {
  const { isAuthenticated } = useAuth();
  
  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);
  
  // ... rest of component
}
```

## How It Works Now

### Scenario 1: User Opens New Tab (Already Logged In)
```
1. App starts → AuthInitializer runs
2. Shows loading spinner
3. checkAuthStatus() finds Amplify session in localStorage
4. Updates Redux: isAuthenticated = true, user = {...}
5. Renders app
6. User navigates to /login → LoginPage sees isAuthenticated=true
7. Immediately redirects to /dashboard
8. ✅ User sees their dashboard, no login needed
```

### Scenario 2: User Opens New Tab (Not Logged In)
```
1. App starts → AuthInitializer runs
2. Shows loading spinner
3. checkAuthStatus() finds no Amplify session
4. Updates Redux: isAuthenticated = false
5. Renders app
6. ProtectedRoute sees isAuthenticated=false
7. Redirects to /login
8. ✅ User sees login page
```

### Scenario 3: User Logs In
```
1. User submits login form
2. signIn() creates Amplify session
3. checkAuthStatus() updates Redux
4. isAuthenticated = true
5. Navigate to /dashboard
6. ✅ User sees dashboard
```

### Scenario 4: User Opens Another Tab After Login
```
1. App starts → AuthInitializer runs
2. checkAuthStatus() finds existing Amplify session
3. Updates Redux with user info
4. ✅ User is already logged in, no login needed
```

## Benefits

1. **No More "Already Signed In" Error** - Auth state is checked before user can interact
2. **Seamless Multi-Tab Experience** - Opening new tabs preserves login state
3. **Better UX** - Loading spinner instead of flash of login page
4. **Cleaner Code** - Single auth check at app level, not scattered across components
5. **Prevents Race Conditions** - UI doesn't render until auth state is determined

## Testing

### Test Case 1: New Tab While Logged In
```bash
1. Log in to the app
2. Open a new tab with the same URL
3. Expected: Brief loading spinner, then dashboard (no login page)
4. ✅ Should NOT see login page
5. ✅ Should NOT get "already signed in" error
```

### Test Case 2: New Tab While Logged Out
```bash
1. Make sure you're logged out
2. Open a new tab
3. Expected: Brief loading spinner, then login page
4. ✅ Should see login page
```

### Test Case 3: Login Then New Tab
```bash
1. Log in
2. Open new tab
3. Try to navigate to /login manually
4. Expected: Immediately redirected to /dashboard
5. ✅ Cannot access login page while authenticated
```

### Test Case 4: Session Expiry
```bash
1. Log in
2. Wait for session to expire (or manually clear Amplify session)
3. Refresh page
4. Expected: Redirected to login page
5. ✅ Expired session is detected
```

## Technical Details

### Amplify Session Storage
Amplify stores session tokens in:
- **localStorage**: `CognitoIdentityServiceProvider.*`
- **Cookies**: Session cookies (if configured)

These are shared across all tabs in the same browser.

### Redux Store
- Each tab has its own Redux store instance
- Not shared between tabs
- Must be synced with Amplify session on startup

### Auth Check Flow
```typescript
checkAuthStatus() {
  1. Call getCurrentUser() → Gets user from Amplify session
  2. Call fetchUserAttributes() → Gets user profile
  3. Dispatch setUser() → Updates Redux store
  4. isAuthenticated = true
}
```

## Files Modified
- ✅ `frontend/src/components/auth/AuthInitializer.tsx` (NEW)
- ✅ `frontend/src/App.tsx` (Updated)
- ✅ `frontend/src/hooks/useAuth.ts` (Updated)
- ✅ `frontend/src/pages/auth/LoginPage.tsx` (Updated)

## Deployment

To deploy this fix:

```bash
# 1. Build the frontend
cd frontend
npm run build

# 2. Deploy to S3 (or let GitHub Actions handle it)
aws s3 sync dist/ s3://YOUR_BUCKET/ --delete

# 3. Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

Or push to GitHub and let the workflow handle it:
```bash
git add .
git commit -m "Fix: Add session persistence for multi-tab authentication"
git push origin main
```

## Future Improvements

1. **Add session refresh** - Automatically refresh tokens before expiry
2. **Add session sync across tabs** - Use BroadcastChannel API to sync logout across tabs
3. **Add "Remember Me"** - Extend session duration
4. **Add session timeout warning** - Warn user before session expires

## Related Issues
- Fixes: "There is already a signed in user" error
- Fixes: Login page showing in new tabs when already authenticated
- Improves: Multi-tab user experience
- Prevents: Race conditions in auth state initialization
