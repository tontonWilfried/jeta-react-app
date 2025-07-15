import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom'; // Importer Link
import {
  FaShoppingBag,
  FaTags,
  FaUserEdit,
  FaStore,
  FaBroadcastTower,
  FaShoppingCart,
  FaTruckLoading,
  FaBell,
  FaWifi,
  FaComments,
  FaStar,
  FaMapMarkedAlt,
  FaGift,
  FaUsers,
  FaCog,
  FaQuestionCircle,
  FaNewspaper
} from 'react-icons/fa'; // Icônes pour le Dashboard
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '../firebaseConfig';
import AdminDashboard from './AdminDashboard';
import SellerDashboard from './SellerDashboard';
import ClientDashboard from './ClientDashboard';

const Dashboard = () => {
  const { currentUser } = useAuth();
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      if (!currentUser) {
        setRole(null);
        setLoading(false);
        return;
      }
      try {
        // Recherche par champ uid
        const q = query(collection(firestore, 'users'), where('uid', '==', currentUser.uid));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data();
          const role = userData.role;
          console.log('[DASHBOARD] Rôle Firestore récupéré (par champ uid):', role);
          setRole(role);
        } else {
          setRole('client');
        }
      } catch (e) {
        setRole('client');
      }
      setLoading(false);
    };
    fetchRole();
  }, [currentUser]);

  if (loading || role === null) {
    return <div className="min-h-screen flex items-center justify-center">Chargement du dashboard...</div>;
  }
  console.log('[DASHBOARD] Valeur brute du rôle:', role, 'Type:', typeof role, 'Longueur:', role && role.length);
  if (role === 'admin') {
    console.log('[DASHBOARD] Affichage du dashboard admin');
    return <AdminDashboard />;
  }
  if (role === 'seller') {
    console.log('[DASHBOARD] Affichage du dashboard vendeur');
    return <SellerDashboard />;
  }
  console.log('[DASHBOARD] Affichage du dashboard client');
  return <ClientDashboard />;
};

export default Dashboard;
