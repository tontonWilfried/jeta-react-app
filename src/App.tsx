// App.tsx
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
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
import BrocanteMap from './pages/BrocanteMap';
import SettingsPage from './pages/SettingsPage';
import HelpInfoPage from './pages/HelpInfoPage';
import NewsletterPage from './pages/NewsletterPage';
import Footer from './components/Layout/Footer'; // Importer le Footer
import ProtectedRoute from './components/Auth/ProtectedRoute'; // Importer ProtectedRoute
import { useAuth } from './contexts/AuthContext'; // Importer useAuth
import Joyride, { STATUS, type CallBackProps, type Step, ACTIONS, EVENTS } from 'react-joyride';
import CustomJoyrideTooltip from './components/Home/CustomJoyrideTooltip'; // Assurez-vous que le chemin est correct
import { ToastContainer } from 'react-toastify'; // Importez ToastContainer
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import { sendAdminLoginAlert } from './services/sendAdminLoginAlert';
import { firestore } from './firebaseConfig';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import PendingValidation from './pages/PendingValidation';
import SellerOrders from './pages/SellerOrders';
import SellerDashboard from './pages/SellerDashboard';
import ScraperPage from './pages/ScraperPage';
import ActionProducts from './pages/ActionProducts';
import ScrappingSites from './pages/ScrappingSites';
import SellerCart from './pages/SellerCart';
import AdminSupport from './pages/AdminSupport';
import AdminDashboard from './pages/AdminDashboard';
import SellerDiscussions from './pages/SellerDiscussions';
import GlobalChatListener from './contexts/GlobalChatListener';
import CustomerDiscussions from './pages/CustomerDiscussions';
import { DiscussionSelectionProvider } from './contexts/DiscussionSelectionContext';
import SellerMobileMoney from './pages/SellerMobileMoney';
import SearchResults from './pages/SearchResults';
import SellerStats from './pages/SellerStats';
import CarrefourProducts from './pages/CarrefourProducts';
import LidlProducts from './pages/LidlProducts';
import CdiscountProducts from './pages/CdiscountProducts';
import BackMarketProducts from './pages/BackMarketProducts';

// Étendre l'interface Window pour inclure clearTutorialData
declare global {
  interface Window { clearTutorialData: () => void; }
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, authLoading } = useAuth(); // Utiliser le contexte

  // États pour le tutoriel d'intégration
  const [runOnboardingTour, setRunOnboardingTour] = useState(false);
  const [onboardingTourStepIndex, setOnboardingTourStepIndex] = useState(0);

  // États pour le tutoriel du Dashboard
  const [runDashboardTour, setRunDashboardTour] = useState(false);
  const [dashboardTourStepIndex, setDashboardTourStepIndex] = useState(0);

  const [notificationCount, setNotificationCount] = useState(0);

  const onboardingTourSteps: Array<Step & { route?: string; preNavDelay?: number }> = useMemo(() => [
    // Étapes de la page d'accueil
    {
      target: '.jeta-title-step',
      content: "C'est le nom de notre Platforme web.",
      title: "Bienvenue sur JETA !",
      placement: 'bottom',
      disableBeacon: true,
      route: '/',
    },
    {
      target: '.jeta-slogan-step',
      content: 'Nous simplifions la gestion de vos achats pour les brocantes.',
      title: 'Notre Mission',
      placement: 'bottom',
      route: '/',
    },
    {
      target: '.start-button-step',
      content: 'Cliquez ici pour vous connecter ou créer un compte. Nous allons aller sur la page de connexion.',
      title: 'Prêt à commencer ?',
      placement: 'bottom', // Afficher le tooltip SOUS le bouton "COMMENCER"
      route: '/',
    },
    // Étapes de la page de connexion
    {
      target: '.login-title-step',
      content: 'Vous pouvez vous connecter avec votre email ou votre numéro de téléphone.',
      title: 'Page de Connexion',
      placement: 'bottom',
      route: '/login',
      preNavDelay: 150, // Petit délai pour s'assurer que la page est rendue
    },
    {
      target: '.login-auth-method-step',
      content: 'Choisissez votre méthode de connexion préférée.',
      title: 'Méthode de connexion',
      placement: 'bottom',
      route: '/login',
    },
    {
      target: '.login-register-link-step',
      content: "Si vous n'avez pas de compte, cliquez ici pour vous inscrire.",
      title: "Pas encore de compte ?",
      placement: 'bottom', // Afficher le tooltip SOUS le lien "S'inscrire"
      route: '/login',
    },
    // Étapes de la page d'inscription
    {
      target: '.register-title-step',
      content: "Créez votre compte JETA ici, par email ou téléphone.",
      title: "Page d'Inscription",
      placement: 'bottom',
      route: '/register',
      preNavDelay: 150,
    },
    {
      target: '.register-auth-method-step',
      content: "Choisissez comment vous souhaitez vous inscrire. Une fois inscrit et connecté, vous découvrirez votre tableau de bord !",
      title: "Méthode d'inscription",
      placement: 'bottom',
      route: '/register',
    },
    // NOUVELLE ÉTAPE : Guider l'utilisateur pour se connecter après l'inscription
    {
      target: '.login-submit-button-step', // Cible le bouton de connexion sur la page Login
      content: "Inscription réussie ! Maintenant, veuillez vous connecter avec vos identifiants pour accéder à votre tableau de bord.",
      title: 'Connexion Requise',
      placement: 'bottom', // Afficher le tooltip SOUS le bouton de connexion
      route: '/login',
      // Ce preNavDelay est pour la transition de /register à /login, si Joyride la gère.
      preNavDelay: 200, 
    },
  ], []);
  const dashboardTourSteps: Array<Step & { route?: string; preNavDelay?: number }> = [
    {
      target: '.dashboard-welcome-message-step',
      content: "Bienvenue sur votre tableau de bord ! D'ici, vous pouvez accéder à toutes les fonctionnalités de JETA.",
      title: 'Votre Espace JETA',
      placement: 'bottom',
      disableBeacon: true,
      route: '/dashboard',
      preNavDelay: 250,
    },
    // === CARTES PRINCIPALES ===
    {
      target: '.dashboard-orders-card-step',
      content: "Consultez l'état de vos commandes passées.",
      title: 'Vos Commandes Récentes',
      placement: 'auto',
      route: '/dashboard',
    },
    {
      target: '.dashboard-popular-items-card-step',
      content: "Découvrez les trésors les plus recherchés.",
      title: 'Articles Populaires',
      placement: 'auto',
      route: '/dashboard',
    },
    {
      target: '.dashboard-profile-card-step',
      content: "Mettez à jour vos informations et préférences.",
      title: 'Gérer votre Profil',
      placement: 'auto',
      route: '/dashboard',
    },
    {
      target: '.dashboard-manage-brocante-card-step',
      content: "Administrez vos articles, stocks et informations de vendeur.",
      title: 'Gérer votre Brocante',
      placement: 'auto',
      route: '/dashboard',
    },
    {
      target: '.dashboard-brocante-live-card-step',
      content: "Explorez les stands et découvrez les offres des autres vendeurs.",
      title: 'Brocante Connectée',
      placement: 'auto',
      route: '/dashboard',
    },
    {
      target: '.dashboard-cart-card-step',
      content: "Gérez vos articles sélectionnés et passez commande.",
      title: 'Mon Panier',
      placement: 'auto',
      route: '/dashboard',
    },
    {
      target: '.dashboard-order-tracking-card-step',
      content: "Consultez les statuts et détails de vos achats.",
      title: 'Suivi de Commandes',
      placement: 'auto',
      route: '/dashboard',
    },
    {
      target: '.dashboard-notifications-card-step',
      content: "Restez informé des nouveautés et alertes importantes.",
      title: 'Notifications',
      placement: 'auto',
      route: '/dashboard',
    },
    {
      target: '.dashboard-chat-card-step',
      content: "Discutez avec les vendeurs ou notre équipe.",
      title: 'Chat & Support',
      placement: 'auto',
      route: '/dashboard',
    },
    {
      target: '.dashboard-loyalty-card-step',
      content: "Accumulez des points et profitez de réductions.",
      title: 'Programme Fidélité',
      placement: 'auto',
      route: '/dashboard',
    },
    {
      target: '.dashboard-map-card-step',
      content: "Visualisez les stands et brocantes à proximité.",
      title: 'Carte des Brocantes',
      placement: 'auto',
      route: '/dashboard',
    },
    // === SECTION DÉCOUVREZ AUSSI ===
    {
      target: '.dashboard-promotions-card-step',
      content: "Ne manquez pas nos offres limitées sur une sélection d'articles.",
      title: 'Promotions Exclusives',
      placement: 'auto',
      route: '/dashboard',
    },
    {
      target: '.dashboard-featured-sellers-card-step',
      content: "Explorez les boutiques de nos meilleurs vendeurs et leurs trouvailles uniques.",
      title: 'Les Vendeurs à la Une',
      placement: 'auto',
      route: '/dashboard',
    },
    // === SECTION PLUS D'OPTIONS ===
    {
      target: '.dashboard-settings-card-step',
      content: "Gérez la langue et d'autres préférences.",
      title: 'Paramètres & Personnalisation',
      placement: 'auto',
      route: '/dashboard',
    },
    {
      target: '.dashboard-help-info-card-step',
      content: "Consultez la FAQ, politique de confidentialité, etc.",
      title: 'Aide & Informations',
      placement: 'auto',
      route: '/dashboard',
    },
    {
      target: '.dashboard-newsletter-card-step',
      content: "Inscrivez-vous pour recevoir nos actualités.",
      title: 'Newsletter JETA',
      placement: 'auto',
      route: '/dashboard',
    },
    // === ÉLÉMENTS DE NAVIGATION ===
    {
      target: '.header-logo-step',
      content: "Cliquez sur le logo JETA pour revenir à l'accueil de votre tableau de bord à tout moment.",
      title: 'Logo JETA',
      placement: 'bottom',
      route: '/dashboard',
    },
    {
      target: '.header-search-bar-step',
      content: "Utilisez la barre de recherche pour trouver rapidement ce que vous cherchez.",
      title: 'Barre de Recherche',
      placement: 'bottom',
      route: '/dashboard',
    },
    {
      target: '.header-profile-link-step',
      content: "Accédez directement à votre page de profil.",
      title: 'Accès Profil',
      placement: 'bottom',
      route: '/dashboard',
    },
    {
      target: '.header-cart-link-step',
      content: "Votre panier d'achats est toujours accessible ici.",
      title: 'Accès Panier',
      placement: 'bottom',
      route: '/dashboard',
    },
    {
      target: '.header-logout-button-step',
      content: "Lorsque vous avez terminé, vous pouvez vous déconnecter en toute sécurité.",
      title: 'Déconnexion',
      placement: 'bottom',
      route: '/dashboard',
    }
  ];

  const handleOnboardingJoyrideCallback = useCallback((data: CallBackProps) => {
    const { action, index, status, type } = data; 
    console.log('[App.tsx] Onboarding Joyride Callback:', data);
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunOnboardingTour(false);
      setOnboardingTourStepIndex(0);
    } else if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      if (action === ACTIONS.NEXT || action === ACTIONS.PREV) {
        const nextStepIndex = action === ACTIONS.NEXT ? index + 1 : index - 1;
        const nextStepConfig = onboardingTourSteps[nextStepIndex];

        if (nextStepConfig && nextStepConfig.route && location.pathname !== nextStepConfig.route) {
          console.log(`[App.tsx] Onboarding: Navigating to ${nextStepConfig.route} for step ${nextStepIndex}`);
          navigate(nextStepConfig.route);
          setTimeout(() => {
            setOnboardingTourStepIndex(nextStepIndex);
          }, nextStepConfig.preNavDelay || 50);
        } else if (nextStepConfig) {
          setOnboardingTourStepIndex(nextStepIndex);
        } else if (action === ACTIONS.NEXT) { 
          setRunOnboardingTour(false);
          setOnboardingTourStepIndex(0);
        }
      }
    }
  }, [navigate, location.pathname, onboardingTourSteps]);

  const handleDashboardJoyrideCallback = useCallback((data: CallBackProps) => {
    const { action, index, status, type } = data;
    console.log('[App.tsx] Dashboard Joyride Callback:', data);

    // Créer une clé spécifique à l'utilisateur pour le localStorage
    const userId = currentUser?.uid || 'anonymous';
    const completedKey = `dashboardTourCompleted_v1_${userId}`;
    const skippedKey = `dashboardTourSkipped_v1_${userId}`;

    if (status === STATUS.FINISHED) {
      setRunDashboardTour(false);
      setDashboardTourStepIndex(0);
      localStorage.setItem(completedKey, 'true');
    } else if (status === STATUS.SKIPPED) {
      setRunDashboardTour(false);
      setDashboardTourStepIndex(0);
      localStorage.setItem(skippedKey, 'true');
    } else if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      if (action === ACTIONS.NEXT || action === ACTIONS.PREV) {
        const nextStepIndex = action === ACTIONS.NEXT ? index + 1 : index - 1;
        if (dashboardTourSteps[nextStepIndex]) {
          setDashboardTourStepIndex(nextStepIndex);
        } else if (action === ACTIONS.NEXT) {
          setRunDashboardTour(false);
          setDashboardTourStepIndex(0);
          localStorage.setItem(completedKey, 'true');
        }
      }
    }
  }, [dashboardTourSteps, currentUser?.uid]);

  const startOnboardingTour = useCallback(() => {
    console.log('[App.tsx] startOnboardingTour called');
    setRunDashboardTour(false); 
    const firstStep = onboardingTourSteps[0];
    if (firstStep && firstStep.route && location.pathname !== firstStep.route) {
      navigate(firstStep.route);
      setTimeout(() => {
        setOnboardingTourStepIndex(0);
        setRunOnboardingTour(true);
      }, 200);
    } else {
      setOnboardingTourStepIndex(0);
      setRunOnboardingTour(true);
    }
  }, [navigate, location.pathname, onboardingTourSteps]);

  const startDashboardTour = useCallback(() => {
    console.log('[App.tsx] startDashboardTour called');
    setRunOnboardingTour(false); 
    setDashboardTourStepIndex(0);
    setRunDashboardTour(true);
  }, []);

  // Fonction utilitaire pour nettoyer le localStorage du tutoriel (pour les tests)
  const clearTutorialData = useCallback(() => {
    if (currentUser) {
      const userId = currentUser.uid;
      localStorage.removeItem(`dashboardTourCompleted_v1_${userId}`);
      localStorage.removeItem(`dashboardTourSkipped_v1_${userId}`);
      console.log('[App.tsx] Tutorial localStorage cleared for user:', userId);
    }
  }, [currentUser?.uid]);

  // Ajouter la fonction clearTutorialData aux développements/tests si nécessaire
  // Vous pouvez l'appeler de puis la console du navigateur : window.clearTutorialData()
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      window.clearTutorialData = clearTutorialData;
    }
  }, [clearTutorialData]);

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
    if (currentUser && runOnboardingTour && !['/', '/login', '/register'].includes(location.pathname)) {
      console.log('[App.tsx] User is now authenticated and has navigated away from onboarding pages while onboarding tour was active. Stopping onboarding tour.');
      setRunOnboardingTour(false);
      setOnboardingTourStepIndex(0); // Réinitialiser l'index aussi
    }
  }, [currentUser, location.pathname, runOnboardingTour]);


  // Effet pour démarrer le tutoriel du Dashboard lorsque l'utilisateur arrive sur /dashboard
  useEffect(() => {
    console.log('[DashboardTour Effect Check] currentUser:', !!currentUser, 'pathname:', location.pathname, 'runOnboarding:', runOnboardingTour, 'runDashboard:', runDashboardTour);
    if (currentUser && location.pathname === '/dashboard' && !runOnboardingTour && !runDashboardTour) {
      // Utiliser des clés spécifiques à l'utilisateur
      const userId = currentUser.uid;
      const tourCompleted = localStorage.getItem(`dashboardTourCompleted_v1_${userId}`);
      const tourSkipped = localStorage.getItem(`dashboardTourSkipped_v1_${userId}`); 
      console.log('[DashboardTour Effect Check] tourCompleted:', tourCompleted, 'tourSkipped:', tourSkipped, 'userId:', userId);

      if (!tourCompleted && !tourSkipped) { 
        console.log('[DashboardTour Effect Check] Conditions met to start dashboard tour. Setting timer.');
        const timer = setTimeout(() => {
          console.log('[DashboardTour Effect Check] Timer fired. Calling startDashboardTour.');
          startDashboardTour();
        }, 700); 
        return () => {
          console.log('[DashboardTour Effect Check] Cleanup timer for dashboard tour.');
          clearTimeout(timer);
        };
      } else {
        console.log('[DashboardTour Effect Check] Dashboard tour already completed or skipped.');
      }
    } else {
      console.log('[DashboardTour Effect Check] Conditions NOT met to start dashboard tour.');
    }
  }, [currentUser, location.pathname, runOnboardingTour, runDashboardTour, startDashboardTour]);

  useEffect(() => {
    if (!currentUser) {
      setNotificationCount(0);
      return;
    }
    
    // Écouter tous les messages non lus pour l'utilisateur connecté
    const chatsRef = collection(firestore, 'clientSellerChats');
    const unsubChats = onSnapshot(chatsRef, (chatsSnap) => {
      const chatIds = chatsSnap.docs.map(doc => doc.id).filter(chatId => chatId.includes(currentUser.uid));
      
      if (chatIds.length === 0) {
        setNotificationCount(0);
        return;
      }
      
      // Pour chaque chat, écouter les messages non lus
      const unsubs: Unsubscribe[] = [];
      const chatUnreadCounts = new Map(); // Map pour stocker le nombre de messages non lus par chat
      
      chatIds.forEach(chatId => {
        const msgsRef = collection(firestore, 'clientSellerChats', chatId, 'messages');
        const q = query(msgsRef, where('read', '==', false));
        const unsubMsgs = onSnapshot(q, (msgsSnap) => {
          // On ne compte que les messages non lus envoyés par quelqu'un d'autre
          const allUnreadMessages = msgsSnap.docs.filter(doc => doc.data().senderUid !== currentUser.uid);
          const unread = allUnreadMessages.length;
          
          chatUnreadCounts.set(chatId, unread);
          
          // Calculer le total de tous les chats
          let totalUnread = 0;
          chatUnreadCounts.forEach((count) => {
            totalUnread += count;
          });
          
          setNotificationCount(totalUnread);
        });
        unsubs.push(unsubMsgs);
      });
      
      // Nettoyage
      return () => {
        unsubs.forEach(unsub => unsub());
      };
    });
    
    return () => {
      unsubChats();
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
            <Route path="/search" element={<SearchResults />} />
            <Route path="/" element={<Home startOnboardingTour={startOnboardingTour} />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/manage-brocante" element={<ManageBrocante />} />
              <Route path="/brocante-live" element={<BrocanteLive />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/order-tracking" element={<OrderTracking />} />
              <Route path="/notifications-page" element={<NotificationsPage />} />
              <Route path="/chat-support" element={<ChatSupport />} />
              <Route path="/loyalty-program" element={<LoyaltyProgram />} />
              <Route path="/brocante-map" element={<BrocanteMap />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/help-info" element={<HelpInfoPage />} />
              <Route path="/newsletter" element={<NewsletterPage />} />
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
            <Route path="/pending-validation" element={<PendingValidation />} />
            <Route path="/vendeur" element={<SellerDashboard />} />
            <Route path="/scraper" element={<ScraperPage />} />
            <Route path="/seller/scrapping" element={<ScrappingSites />} />
            <Route path="/seller/scrapping/action" element={<ActionProducts />} />
            <Route path="/seller/scrapping/carrefour" element={<CarrefourProducts />} />
            <Route path="/seller/scrapping/lidl" element={<LidlProducts />} />
            <Route path="/seller/scrapping/cdiscount" element={<CdiscountProducts />} />
            <Route path="/seller/scrapping/backmarket" element={<BackMarketProducts />} />
            <Route path="/seller-cart" element={<SellerCart />} />
            <Route path="/admin-support" element={<AdminSupport />} />
            <Route path="/seller-discussions" element={<SellerDiscussions />} />
            <Route path="/customer-discussions" element={<CustomerDiscussions />} />
            <Route path="/seller-mobile-money" element={<SellerMobileMoney />} />
          </Routes>
        </main>
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
        {currentUser && !['/', '/login', '/register'].includes(location.pathname) && (
          <Footer />
        )}
        <ToastContainer position="bottom-right" autoClose={4000} hideProgressBar={false} newestOnTop closeOnClick pauseOnFocusLoss draggable pauseOnHover theme="colored" />
      </div>
    </DiscussionSelectionProvider>
  );
}

export default App;
