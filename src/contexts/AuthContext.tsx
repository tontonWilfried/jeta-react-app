import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { auth } from '../firebaseConfig'; // Ajustez le chemin si nécessaire
import { onAuthStateChanged, type User } from 'firebase/auth';

interface AuthContextType {
  currentUser: User | null;
  authLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });

    return unsubscribe; // Nettoyage lors du démontage
  }, []);

  const value = { currentUser, authLoading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};