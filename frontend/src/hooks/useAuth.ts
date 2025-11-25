import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  signIn,
  signUp,
  signOut,
  confirmSignUp,
  resendSignUpCode,
  resetPassword,
  confirmResetPassword,
  getCurrentUser,
  fetchAuthSession,
  fetchUserAttributes,
} from 'aws-amplify/auth';
import { setUser, clearUser, setLoading, setError } from '../store/slices/authSlice';
import { RootState } from '../store';
import type { User } from '../types';

interface SignUpParams {
  email: string;
  password: string;
  name: string;
}

interface SignInParams {
  email: string;
  password: string;
}

interface ConfirmSignUpParams {
  email: string;
  code: string;
}

interface ResetPasswordParams {
  email: string;
}

interface ConfirmResetPasswordParams {
  email: string;
  code: string;
  newPassword: string;
}

export const useAuth = () => {
  const dispatch = useDispatch();
  const { user, isAuthenticated, isLoading, error } = useSelector(
    (state: RootState) => state.auth
  );

  // Check if user is authenticated on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = useCallback(async () => {
    try {
      dispatch(setLoading(true));
      const currentUser = await getCurrentUser();
      const attributes = await fetchUserAttributes();
      
      const userData: User = {
        id: currentUser.userId,
        email: attributes.email || '',
        name: attributes.name || attributes.email || '',
        role: (attributes['custom:role'] as User['role']) || 'Analyst',
      };

      dispatch(setUser(userData));
    } catch (err) {
      dispatch(clearUser());
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  const handleSignUp = useCallback(
    async ({ email, password, name }: SignUpParams) => {
      try {
        dispatch(setLoading(true));
        await signUp({
          username: email,
          password,
          options: {
            userAttributes: {
              email,
              name,
            },
          },
        });
        return { success: true };
      } catch (err: any) {
        const errorMessage = err.message || 'Sign up failed';
        dispatch(setError(errorMessage));
        return { success: false, error: errorMessage };
      } finally {
        dispatch(setLoading(false));
      }
    },
    [dispatch]
  );

  const handleConfirmSignUp = useCallback(
    async ({ email, code }: ConfirmSignUpParams) => {
      try {
        dispatch(setLoading(true));
        await confirmSignUp({
          username: email,
          confirmationCode: code,
        });
        return { success: true };
      } catch (err: any) {
        const errorMessage = err.message || 'Confirmation failed';
        dispatch(setError(errorMessage));
        return { success: false, error: errorMessage };
      } finally {
        dispatch(setLoading(false));
      }
    },
    [dispatch]
  );

  const handleResendCode = useCallback(
    async (email: string) => {
      try {
        await resendSignUpCode({ username: email });
        return { success: true };
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to resend code';
        return { success: false, error: errorMessage };
      }
    },
    []
  );

  const handleSignIn = useCallback(
    async ({ email, password }: SignInParams) => {
      try {
        dispatch(setLoading(true));
        const { isSignedIn } = await signIn({
          username: email,
          password,
        });

        if (isSignedIn) {
          await checkAuthStatus();
          return { success: true };
        }

        return { success: false, error: 'Sign in failed' };
      } catch (err: any) {
        const errorMessage = err.message || 'Sign in failed';
        dispatch(setError(errorMessage));
        return { success: false, error: errorMessage };
      } finally {
        dispatch(setLoading(false));
      }
    },
    [dispatch, checkAuthStatus]
  );

  const handleSignOut = useCallback(async () => {
    try {
      dispatch(setLoading(true));
      await signOut();
      dispatch(clearUser());
      return { success: true };
    } catch (err: any) {
      const errorMessage = err.message || 'Sign out failed';
      dispatch(setError(errorMessage));
      return { success: false, error: errorMessage };
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  const handleResetPassword = useCallback(
    async ({ email }: ResetPasswordParams) => {
      try {
        dispatch(setLoading(true));
        await resetPassword({ username: email });
        return { success: true };
      } catch (err: any) {
        const errorMessage = err.message || 'Password reset failed';
        dispatch(setError(errorMessage));
        return { success: false, error: errorMessage };
      } finally {
        dispatch(setLoading(false));
      }
    },
    [dispatch]
  );

  const handleConfirmResetPassword = useCallback(
    async ({ email, code, newPassword }: ConfirmResetPasswordParams) => {
      try {
        dispatch(setLoading(true));
        await confirmResetPassword({
          username: email,
          confirmationCode: code,
          newPassword,
        });
        return { success: true };
      } catch (err: any) {
        const errorMessage = err.message || 'Password reset confirmation failed';
        dispatch(setError(errorMessage));
        return { success: false, error: errorMessage };
      } finally {
        dispatch(setLoading(false));
      }
    },
    [dispatch]
  );

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.accessToken?.toString() || null;
    } catch (err) {
      return null;
    }
  }, []);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    signUp: handleSignUp,
    confirmSignUp: handleConfirmSignUp,
    resendCode: handleResendCode,
    signIn: handleSignIn,
    signOut: handleSignOut,
    resetPassword: handleResetPassword,
    confirmResetPassword: handleConfirmResetPassword,
    getAccessToken,
    checkAuthStatus,
  };
};
