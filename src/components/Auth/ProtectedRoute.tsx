import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../../firebaseConfig';

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { currentUser, authLoading } = useAuth();
  const location = useLocation();
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      if (!currentUser) {
        setRole(null);
        setLoading(false);
        return;
      }
      try {
        const userRef = doc(firestore, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setRole(userSnap.data().role);
        } else {
          setRole('client');
        }
      } catch {
        setRole('client');
      }
      setLoading(false);
    };
    fetchRole();
  }, [currentUser]);

  if (authLoading || loading) {
    // Vous pouvez afficher un spinner de chargement global ici ou un simple message
    return <div className="min-h-screen flex items-center justify-center bg-page-bg"><p className="text-text-main">Chargement de l'authentification...</p></div>;
  }

  if (!currentUser) {
    // Rediriger vers la page de connexion, en conservant l'URL de provenance
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role || 'client')) {
    // Cas spécial : pending_seller
    if (role === 'pending_seller') {
      return <Navigate to="/pending-validation" replace />;
    }
    // Sinon, rediriger vers dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />; // Si l'utilisateur est connecté, afficher le contenu de la route
};

export default ProtectedRoute;