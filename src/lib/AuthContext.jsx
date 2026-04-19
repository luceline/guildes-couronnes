import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44, pb } from '@/api/pocketbaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]                               = useState(null);
  const [isAuthenticated, setIsAuthenticated]         = useState(false);
  const [isLoadingAuth, setIsLoadingAuth]             = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError]                     = useState({ type: 'auth_required', message: 'Connexion requise' });
  const [showLoginForm, setShowLoginForm]             = useState(false);

  useEffect(() => {
    checkAuth();

    // Écouter les changements d'état auth (refresh token, logout)
    const unsub = pb.authStore.onChange(() => {
      if (pb.authStore.isValid) {
        const model = pb.authStore.model;
        setUser({ email: model.email, id: model.id, name: model.name });
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    });

    return () => unsub();
  }, []);

  const checkAuth = async () => {
    setIsLoadingAuth(true);
    try {
      if (pb.authStore.isValid) {
        // Token valide en localStorage — rafraîchir
        try {
          await pb.collection('users').authRefresh();
          const model = pb.authStore.model;
          setUser({ email: model.email, id: model.id, name: model.name });
          setIsAuthenticated(true);
        } catch {
          // Token expiré
          pb.authStore.clear();
          setAuthError({ type: 'auth_required', message: 'Session expirée' });
          setIsAuthenticated(false);
        }
      } else {
        setAuthError({ type: 'auth_required', message: 'Connexion requise' });
        setIsAuthenticated(false);
      }
    } catch (e) {
      console.error('checkAuth error:', e);
      setAuthError({ type: 'auth_required', message: 'Erreur de connexion' });
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const signIn = async (email, password) => {
    try {
      const result = await base44.auth.signInWithEmail(email, password);
      setUser(result);
      setIsAuthenticated(true);
      setAuthError(null);
      return result;
    } catch (e) {
      const msg = e?.data?.message || 'Email ou mot de passe incorrect';
      setAuthError({ type: 'signin_failed', message: msg });
      throw e;
    }
  };

  const signInWithGoogle = async () => {
    try {
      const result = await base44.auth.signInWithGoogle();
      setUser(result);
      setIsAuthenticated(true);
      setAuthError(null);
      return result;
    } catch (e) {
      setAuthError({ type: 'signin_failed', message: 'Connexion Google échouée' });
      throw e;
    }
  };

  const signUp = async (email, password, name) => {
    try {
      const result = await base44.auth.signUp(email, password, name);
      setUser(result);
      setIsAuthenticated(true);
      setAuthError(null);
      return result;
    } catch (e) {
      const msg = e?.data?.message || 'Erreur lors de l\'inscription';
      setAuthError({ type: 'signup_failed', message: msg });
      throw e;
    }
  };

  const logout = () => {
    base44.auth.logout();
    setUser(null);
    setIsAuthenticated(false);
  };

  const navigateToLogin = () => {
    setShowLoginForm(true);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      signIn,
      signInWithGoogle,
      signUp,
      logout,
      navigateToLogin,
      showLoginForm,
      setShowLoginForm,
      checkAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export default AuthContext;
