// App.tsx
import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Home from './components/Home/Home'; // Assurez-vous que le chemin est correct
import Register from './components/Register/Register.jsx'; // Importer explicitement le fichier .jsx
import Login from './components/Login/Login'; // Importer le nouveau composant Login
import Dashboard from './pages/Dashboard'; // Importer le Dashboard
import Header from './components/Layout/Header'; // Importer le Header
import ManageBrocante from './pages/ManageBrocante'; // Importer la nouvelle page
import BrocanteLive from './pages/BrocanteLive'; // Importer la nouvelle page
import Profile from './pages/Profile'; // Importer la page Profil
import Cart from './pages/Cart';
import OrderTracking from './pages/OrderTracking';
import NotificationsPage from './pages/NotificationsPage';
import ChatSupport from './pages/ChatSupport';
import LoyaltyProgram from './pages/LoyaltyProgram';
import SettingsPage from './pages/SettingsPage';
import ConsentBanner from './components/ConsentBanner';
import PrivacyPolicy from './pages/PrivacyPolicy';
import { useAuth } from './contexts/AuthContext'; // Importer useAuth
import { firestore } from './firebaseConfig';
import { collection, onSnapshot, query, where, doc, getDoc, getDocs } from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { sendAdminLoginAlert } from './services/sendAdminLoginAlert';
import { DiscussionSelectionProvider } from './contexts/DiscussionSelectionContext';
import GlobalChatListener from './contexts/GlobalChatListener';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import SearchResults from './pages/SearchResults';
import AdminDashboard from './pages/AdminDashboard';
import SellerOrders from './pages/SellerOrders';
import SellerStats from './pages/SellerStats';
import SellerDashboard from './pages/SellerDashboard';
import ScraperPage from './pages/ScraperPage';
import ScrappingSites from './pages/ScrappingSites';
import ActionProducts from './pages/ActionProducts';
import CarrefourProducts from './pages/CarrefourProducts';
import LidlProducts from './pages/LidlProducts';
import SellerCart from './pages/SellerCart';
import AdminSupport from './pages/AdminSupport';
import SellerDiscussions from './pages/SellerDiscussions';
import CustomerDiscussions from './pages/CustomerDiscussions';
import SellerMobileMoney from './pages/SellerMobileMoney';
import Footer from './components/Layout/Footer';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Étendre l'interface Window pour inclure clearTutorialData
declare global {
  interface Window { clearTutorialData: () => void; }
}

function App() {
  const location = useLocation();
  const { currentUser, authLoading } = useAuth(); // Utiliser le contexte

  // Ajouter la déclaration du state notificationCount
  const [notificationCount, setNotificationCount] = useState(0);

  // Supprimer toutes les variables, hooks, et fonctions liés au tutoriel Joyride
  // const [runOnboardingTour, setRunOnboardingTour] = useState(false);
  // const [onboardingTourStepIndex, setOnboardingTourStepIndex] = useState(0);
  // const [runDashboardTour, setRunDashboardTour] = useState(false);
  // const [dashboardTourStepIndex, setDashboardTourStepIndex] = useState(0);
  // const onboardingTourSteps = useMemo(() => [...], []);
  // const dashboardTourSteps = [...];
  // const handleOnboardingJoyrideCallback = useCallback((data: CallBackProps) => { ... }, [navigate, location.pathname, onboardingTourSteps]);
  // const handleDashboardJoyrideCallback = useCallback((data: CallBackProps) => { ... }, [dashboardTourSteps, currentUser?.uid]);
  // const startOnboardingTour = useCallback(() => { ... }, [navigate, location.pathname, onboardingTourSteps]);
  // const startDashboardTour = useCallback(() => { ... }, []);
  // const clearTutorialData = useCallback(() => { ... }, [currentUser?.uid]);

  // Nettoyer les classes CSS du tutoriel au démontage du composant
  useEffect(() => {
    return () => {
      // Nettoyer les classes CSS si le composant se démonte pendant le tutoriel
      document.body.classList.remove('joyride-active');
      document.documentElement.classList.remove('joyride-scroll');
    };
  }, []);

  // Effet pour arrêter le tutoriel d'onboarding si l'utilisateur se connecte et quitte les pages d'onboarding
  useEffect(() => {
    if (currentUser && !['/', '/login', '/register'].includes(location.pathname)) {
      console.log('[App.tsx] User is now authenticated and has navigated away from onboarding pages while onboarding tour was active. Stopping onboarding tour.');
      // setRunOnboardingTour(false); // This line was removed
      // setOnboardingTourStepIndex(0); // This line was removed
    }
  }, [currentUser, location.pathname]);


  // Supprimer le useEffect inutile (dashboard tour toujours faux)

  useEffect(() => {
    if (!currentUser) {
      setNotificationCount(0);
      return;
    }
    
    console.log('[DEBUG][App] Setting up notification listener for user:', currentUser.uid);
    
    // Système simplifié : écouter directement tous les messages non lus
    const unsubscribes = [];
    
    // Fonction pour écouter les messages non lus d'un chat spécifique
    const listenToChat = async (chatId) => {
      const msgsRef = collection(firestore, 'clientSellerChats', chatId, 'messages');
      const q = query(msgsRef, where('read', '==', false));
      
      const unsub = onSnapshot(q, (msgsSnap) => {
        // Compter seulement les messages envoyés par quelqu'un d'autre
        const unreadMessages = msgsSnap.docs.filter(doc => {
          const msg = doc.data();
          return msg.senderUid !== currentUser.uid;
        });
        
        console.log(`[DEBUG][App] Chat ${chatId}: ${unreadMessages.length} messages non lus`);
        
        // Mettre à jour le compteur global
        updateGlobalCount();
      });
      
      unsubscribes.push(unsub);
    };
    
    // Fonction pour mettre à jour le compteur global
    const updateGlobalCount = async () => {
      try {
        // Récupérer tous les chats de l'utilisateur
        const chatsRef = collection(firestore, 'clientSellerChats');
        const chatsSnap = await getDocs(chatsRef);
        const userChats = chatsSnap.docs.filter(doc => doc.id.includes(currentUser.uid));
        
        let totalUnread = 0;
        
        // Compter les messages non lus dans chaque chat
        for (const chatDoc of userChats) {
          const chatId = chatDoc.id;
          const msgsRef = collection(firestore, 'clientSellerChats', chatId, 'messages');
          const q = query(msgsRef, where('read', '==', false));
          const msgsSnap = await getDocs(q);
          
          const unreadInChat = msgsSnap.docs.filter(doc => {
            const msg = doc.data();
            return msg.senderUid !== currentUser.uid;
          }).length;
          
          totalUnread += unreadInChat;
        }
        
        console.log('[DEBUG][App] Total unread messages:', totalUnread);
        setNotificationCount(totalUnread);
      } catch (error) {
        console.error('[DEBUG][App] Erreur lors du comptage:', error);
      }
    };
    
    // Initialiser l'écoute pour tous les chats existants
    const initializeListeners = async () => {
      try {
        const chatsRef = collection(firestore, 'clientSellerChats');
        const chatsSnap = await getDocs(chatsRef);
        const userChats = chatsSnap.docs.filter(doc => doc.id.includes(currentUser.uid));
        
        console.log('[DEBUG][App] Found user chats:', userChats.map(doc => doc.id));
        
        // Écouter chaque chat
        userChats.forEach(chatDoc => {
          listenToChat(chatDoc.id);
        });
        
        // Écouter les nouveaux chats
        const unsubNewChats = onSnapshot(chatsRef, (snap) => {
          const newUserChats = snap.docs.filter(doc => doc.id.includes(currentUser.uid));
          newUserChats.forEach(chatDoc => {
            const chatId = chatDoc.id;
            // Vérifier si on écoute déjà ce chat
            if (!unsubscribes.some(unsub => unsub.chatId === chatId)) {
              listenToChat(chatId);
            }
          });
        });
        
        unsubscribes.push(unsubNewChats);
        
        // Calculer le compteur initial
        updateGlobalCount();
      } catch (error) {
        console.error('[DEBUG][App] Erreur lors de l\'initialisation:', error);
      }
    };
    
    initializeListeners();
    
    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [currentUser]);

  // Envoi d'une alerte email à chaque connexion admin (vérification du rôle)
  React.useEffect(() => {
    const checkAndSendAdminAlert = async () => {
      if (currentUser) {
        const alertKey = `adminAlertSent_${currentUser.uid}`;
        if (sessionStorage.getItem(alertKey)) {
          console.log('ℹ️ Alerte admin déjà envoyée pour cette session.', alertKey);
          return;
        }
        // Vérifier le document admin avec l'ID spécifique
        const adminRef = doc(firestore, 'users', 'qR4H3gbT9iFP3CU90VVE');
        try {
          const adminSnap = await getDoc(adminRef);
          if (!adminSnap.exists()) return;
          const adminData = adminSnap.data();
          const isAdminRole = adminData.role === 'admin';
          const isCorrectEmail = currentUser.email === 'edimaevina@gmail.com';
          const isCorrectUid = adminData.uid === currentUser.uid;
          if (isAdminRole && isCorrectEmail && isCorrectUid) {
            await sendAdminLoginAlert({
              email: currentUser.email,
              device: window.navigator.userAgent,
              date: new Date().toLocaleString()
            });
            sessionStorage.setItem(alertKey, 'true');
            console.log('✅ Alerte de connexion admin envoyée et clé sessionStorage créée', alertKey);
          }
        } catch (error) {
          console.error('❌ Erreur lors de la récupération des données admin:', error);
        }
      }
    };
    checkAndSendAdminAlert();
  }, [currentUser]);

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-page-bg"><p className="text-text-main text-xl">Chargement de JETA...</p></div>;
  }

  return (
    <DiscussionSelectionProvider>
      <div className="flex flex-col min-h-screen">
        <GlobalChatListener />
        {currentUser && !['/', '/login', '/register'].includes(location.pathname) && (
          <Header
            isConnected={!!currentUser}
            userName={currentUser?.displayName || currentUser?.email || ''}
            notificationCount={notificationCount}
          />
        )}
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/politique-confidentialite" element={<PrivacyPolicy />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/search" element={<SearchResults />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/manage-brocante" element={<ManageBrocante />} />
              <Route path="/brocante-live" element={<BrocanteLive />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/order-tracking" element={<OrderTracking />} />
              <Route path="/notifications-page" element={<NotificationsPage />} />
              <Route path="/chat-support" element={<ChatSupport />} />
              <Route path="/loyalty-program" element={<LoyaltyProgram />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin-dashboard" element={<AdminDashboard />} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={['seller']} />}>
              <Route path="/manage-brocante" element={<ManageBrocante />} />
              <Route path="/seller-orders" element={<SellerOrders />} />
              <Route path="/seller-stats" element={<SellerStats />} />
            </Route>
            <Route path="/vendeur" element={<SellerDashboard />} />
            <Route path="/scraper" element={<ScraperPage />} />
            <Route path="/seller/scrapping" element={<ScrappingSites />} />
            <Route path="/seller/scrapping/action" element={<ActionProducts />} />
            <Route path="/seller/scrapping/carrefour" element={<CarrefourProducts />} />
            <Route path="/seller/scrapping/lidl" element={<LidlProducts />} />
            <Route path="/seller-cart" element={<SellerCart />} />
            <Route path="/admin-support" element={<AdminSupport />} />
            <Route path="/seller-discussions" element={<SellerDiscussions />} />
            <Route path="/customer-discussions" element={<CustomerDiscussions />} />
            <Route path="/seller-mobile-money" element={<SellerMobileMoney />} />
          </Routes>
          <ConsentBanner />
        </main>
        {/* Tutoriel onboarding Joyride désactivé */}
        {/*
        {!authLoading && (
          <Joyride
            steps={onboardingTourSteps}
            run={runOnboardingTour}
            stepIndex={onboardingTourStepIndex}
            continuous
            showProgress
            showSkipButton
            callback={handleOnboardingJoyrideCallback}
            styles={{
              options: {
                arrowColor: '#FFF8E1',
                backgroundColor: '#FFF8E1',
                primaryColor: '#4FC3F7',
                textColor: '#5D503C',
                zIndex: 10000, 
              },
            }}
            tooltipComponent={CustomJoyrideTooltip}
          />
        )}
        {!authLoading && currentUser && ( 
          <Joyride
            steps={dashboardTourSteps}
            run={runDashboardTour}
            stepIndex={dashboardTourStepIndex}
            continuous
            showProgress
            showSkipButton
            callback={handleDashboardJoyrideCallback}
            scrollToFirstStep={true}
            scrollOffset={120}
            disableScrolling={false}
            disableScrollParentFix={false}
            scrollDuration={300}
            hideCloseButton={false}
            disableOverlay={true}
            styles={{
              options: {
                arrowColor: '#FFF8E1',
                backgroundColor: '#FFF8E1',
                primaryColor: '#4FC3F7',
                textColor: '#5D503C',
                zIndex: 10001,
              },
            }}
            tooltipComponent={CustomJoyrideTooltip}
          />
        )}
        */}
        {currentUser && !['/', '/login', '/register'].includes(location.pathname) && (
          <Footer />
        )}
        <ToastContainer position="bottom-right" autoClose={4000} hideProgressBar={false} newestOnTop closeOnClick pauseOnFocusLoss draggable pauseOnHover theme="colored" />
      </div>
    </DiscussionSelectionProvider>
  );
}

export default App;
