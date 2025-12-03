import { useEffect, useState, ReactNode } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../../hooks/useAuth';

interface AuthInitializerProps {
  children: ReactNode;
}

/**
 * AuthInitializer checks for existing Amplify session on app startup
 * This ensures that when users open new tabs, their session is restored
 * before any routes are rendered.
 */
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

  // Show loading spinner while checking auth status
  if (!isInitialized || isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: 'background.default',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return <>{children}</>;
};
