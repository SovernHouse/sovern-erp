import { useState, useEffect, useContext, createContext, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is already logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          setIsLoading(false);
          return;
        }

        const response = await authAPI.getCurrentUser();
        // Response interceptor already unwraps { success, data } envelope
        const userData = response.data;
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        setError(null);
      } catch (err) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = useCallback(async (email, password) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authAPI.login({ email, password });
      // Response interceptor already unwraps { success, data } envelope
      const responseData = response.data;
      const userData = responseData.user;
      const token = responseData.tokens?.accessToken || responseData.token;

      localStorage.setItem('authToken', token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);

      return { success: true };
    } catch (err) {
      let message;
      if (err.code === 'ERR_NETWORK' || !err.response) {
        message = 'Cannot connect to server. Please ensure the backend is running on port 5000.';
      } else if (err.response?.status === 401 || err.response?.status === 403) {
        message = err.response?.data?.error?.message || 'Invalid email or password';
      } else if (err.response?.status === 422 || err.response?.status === 400) {
        message = err.response?.data?.error?.message || err.response?.data?.message || 'Validation error. Check your input.';
      } else {
        message = err.response?.data?.error?.message || err.response?.data?.message || 'Login failed. Server returned status ' + (err.response?.status || 'unknown');
      }
      console.error('[Login Error]', { status: err.response?.status, code: err.code, data: err.response?.data, message: err.message });
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      setUser(null);
      setError(null);
    }
  }, []);

  const forgotPassword = useCallback(async (email) => {
    setError(null);
    try {
      await authAPI.forgotPassword(email);
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Password reset failed';
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const value = {
    user,
    isLoading,
    error,
    login,
    logout,
    forgotPassword,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
