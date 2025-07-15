// Profile.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { firestore, auth } from '../firebaseConfig';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { toast } from 'react-toastify';
import { FiUser, FiShoppingBag, FiHeart, FiEdit, FiSave, FiX, FiEye, FiEyeOff } from 'react-icons/fi';

const Profile = () => {
  const { currentUser, userData } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [ordersPage, setOrdersPage] = useState(1);
  const ORDERS_PER_PAGE = 20;
  // Filtres pour l'historique des commandes (version BrocanteLive)
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [orderCategoryFilter, setOrderCategoryFilter] = useState('');
  const [orderTypeFilter, setOrderTypeFilter] = useState('');
  const [orderMinPrice, setOrderMinPrice] = useState('');
  const [orderMaxPrice, setOrderMaxPrice] = useState('');
  const [orderSortBy, setOrderSortBy] = useState('createdAt');
  const [orderSortOrder, setOrderSortOrder] = useState('desc');
  const [openOrders, setOpenOrders] = useState([]);
  const [userProfileData, setUserProfileData] = useState(null);

  // Filtrage et tri JS des commandes (sur le premier produit de chaque commande)
  let filteredOrders = orders;
  if (orderSearchTerm) {
    const search = orderSearchTerm.trim().toLowerCase();
    filteredOrders = filteredOrders.filter(order =>
      order.items && order.items[0] && (order.items[0].productName || '').toLowerCase().includes(search)
    );
  }
  if (orderCategoryFilter) {
    filteredOrders = filteredOrders.filter(order =>
      order.items && order.items[0] && order.items[0].category === orderCategoryFilter
    );
  }
  if (orderTypeFilter) {
    filteredOrders = filteredOrders.filter(order =>
      order.items && order.items[0] && order.items[0].type === orderTypeFilter
    );
  }
  if (orderMinPrice) {
    filteredOrders = filteredOrders.filter(order =>
      order.items && order.items[0] && order.items[0].price >= parseFloat(orderMinPrice)
    );
  }
  if (orderMaxPrice) {
    filteredOrders = filteredOrders.filter(order =>
      order.items && order.items[0] && order.items[0].price <= parseFloat(orderMaxPrice)
    );
  }
  // Tri
  filteredOrders = filteredOrders.slice().sort((a, b) => {
    let aVal, bVal;
    if (orderSortBy === 'createdAt') {
      aVal = a.createdAt ? (typeof a.createdAt.toDate === 'function' ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime()) : 0;
      bVal = b.createdAt ? (typeof b.createdAt.toDate === 'function' ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime()) : 0;
    } else if (orderSortBy === 'price') {
      aVal = a.items && a.items[0] ? a.items[0].price : 0;
      bVal = b.items && b.items[0] ? b.items[0].price : 0;
    } else {
      aVal = 0; bVal = 0;
    }
    return orderSortOrder === 'asc' ? aVal - bVal : bVal - aVal;
  });

  // Extraire toutes les catégories et types présents dans les commandes filtrées (pas toutes les commandes)
  const allOrderCategories = Array.from(new Set(filteredOrders.flatMap(order => (order.items || []).map(item => item.category || '')))).filter(Boolean);
  const allOrderTypes = Array.from(new Set(filteredOrders.flatMap(order => (order.items || []).map(item => item.type || '')))).filter(Boolean);

  const totalOrdersPages = Math.ceil(filteredOrders.length / ORDERS_PER_PAGE);
  const paginatedOrders = filteredOrders.slice((ordersPage - 1) * ORDERS_PER_PAGE, ordersPage * ORDERS_PER_PAGE);

  // États pour le formulaire de profil
  const [profileForm, setProfileForm] = useState({
    displayName: '',
    email: '',
    telephone: '',
    ville: '',
    quartier: ''
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // États pour le changement de mot de passe
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Liste fixe des villes principales du Cameroun
  const CITIES = [
    'Yaoundé', 'Douala', 'Bafoussam', 'Garoua', 'Maroua', 'Bamenda', 'Ngaoundéré', 'Kumba',
    'Ebolowa', 'Kribi', 'Bertoua', 'Limbé', 'Nkongsamba', 'Edéa', 'Foumban', 'Dschang'
  ];

  // Charger les données du profil
  useEffect(() => {
    if (currentUser) {
      setProfileForm({
        displayName: userData?.displayName || currentUser.displayName || '',
        email: currentUser.email || '',
        telephone: userData?.telephone || userData?.phoneNumber || '',
        ville: userData?.ville || '',
        quartier: userData?.quartier || ''
      });
    }
  }, [currentUser, userData]);

  // Charger l'historique des commandes
  useEffect(() => {
    if (activeTab === 'orders' && currentUser) {
      loadOrders();
    }
  }, [activeTab, currentUser]);

  // Charger les favoris
  useEffect(() => {
    if (activeTab === 'favorites' && currentUser) {
      loadFavorites();
    }
  }, [activeTab, currentUser]);

  // Charger les infos Firestore utilisateur au montage et après update
  const fetchUserProfileData = async () => {
    if (!currentUser) return;
    try {
      const userRef = doc(firestore, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setUserProfileData(userSnap.data());
      }
    } catch (e) { /* ignore */ }
  };
  useEffect(() => {
    fetchUserProfileData();
  }, [currentUser]);

  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const ordersRef = collection(firestore, 'orders');
      const q = query(ordersRef, where('userId', '==', currentUser.uid), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const ordersList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOrders(ordersList);
    } catch (error) {
      console.error('Erreur lors du chargement des commandes:', error);
      toast.error('Impossible de charger l\'historique des commandes');
    } finally {
      setLoadingOrders(false);
    }
  };

  const loadFavorites = async () => {
    setLoadingFavorites(true);
    try {
      const favoritesRef = doc(firestore, 'favorites', currentUser.uid);
      const favoritesDoc = await getDoc(favoritesRef);
      if (favoritesDoc.exists()) {
        const favoritesData = favoritesDoc.data();
        const favoritesList = favoritesData.items || [];
        
        // Récupérer les détails des produits favoris
        const favoritesWithDetails = await Promise.all(
          favoritesList.map(async (favorite) => {
            try {
              const productRef = doc(firestore, 'products', favorite.productId);
              const productDoc = await getDoc(productRef);
              if (productDoc.exists()) {
                return {
                  ...favorite,
                  product: { id: productDoc.id, ...productDoc.data() }
                };
              }
              return null;
            } catch (error) {
              console.error('Erreur lors du chargement du produit:', error);
              return null;
            }
          })
        );
        
        setFavorites(favoritesWithDetails.filter(Boolean));
      } else {
        setFavorites([]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des favoris:', error);
      toast.error('Impossible de charger vos favoris');
    } finally {
      setLoadingFavorites(false);
    }
  };

  const handleProfileUpdate = async () => {
    setLoading(true);
    try {
      // Récupérer les anciennes données du profil
      const userRef = doc(firestore, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);
      const oldData = userSnap.exists() ? userSnap.data() : {};
      // Merger les anciennes valeurs avec les nouvelles (ne pas écraser par des champs vides)
      const mergedData = {
        ...oldData,
        displayName: profileForm.displayName || oldData.displayName || '',
        email: profileForm.email || oldData.email || '',
        telephone: profileForm.telephone || oldData.telephone || '',
        ville: profileForm.ville || oldData.ville || '',
        quartier: profileForm.quartier || oldData.quartier || '',
      };
      await updateDoc(userRef, mergedData);
      toast.success('Profil mis à jour !');
      setIsEditingProfile(false);
      fetchUserProfileData();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour du profil');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentUser || !currentUser.email) return;
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('Le nouveau mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setIsChangingPassword(true);
    try {
      // Réauthentifier l'utilisateur
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        passwordForm.currentPassword
      );
      await reauthenticateWithCredential(currentUser, credential);

      // Changer le mot de passe
      await updatePassword(currentUser, passwordForm.newPassword);

      toast.success('Mot de passe modifié avec succès !');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      console.error('Erreur lors du changement de mot de passe:', error);
      if (error.code === 'auth/wrong-password') {
        toast.error('Mot de passe actuel incorrect');
      } else {
        toast.error('Erreur lors du changement de mot de passe');
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const getOrderStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getOrderStatusLabel = (status) => {
    switch (status) {
      case 'paid': return 'Payée';
      case 'pending': return 'En attente';
      case 'cancelled': return 'Annulée';
      default: return status || 'En attente';
    }
  };

  return (
    <div className="bg-page-bg text-main min-h-screen">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-primary-dark p-6 text-white">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
            Mon Profil
          </h1>
            <p className="text-lg opacity-90">
              Gérez vos informations personnelles et suivez vos activités
            </p>
          </div>

          {/* Navigation par onglets */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'profile', label: 'Informations', icon: FiUser },
                { id: 'orders', label: 'Mes Commandes', icon: FiShoppingBag },
                { id: 'favorites', label: 'Mes Favoris', icon: FiHeart }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Contenu des onglets */}
          <div className="p-6">
            {/* Onglet Profil */}
            {activeTab === 'profile' && (
              <div className="space-y-8">
                {/* Informations personnelles */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-800">Informations personnelles</h2>
                    {!isEditingProfile ? (
                      <button
                        onClick={() => setIsEditingProfile(true)}
                        className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors"
                      >
                        <FiEdit className="w-4 h-4" />
                        Modifier
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={handleProfileUpdate}
                          disabled={loading}
                          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          <FiSave className="w-4 h-4" />
                          {loading ? 'Sauvegarde...' : 'Sauvegarder'}
                        </button>
                        <button
                          onClick={() => {
                            setIsEditingProfile(false);
                            setProfileForm({
                              displayName: userData?.displayName || currentUser.displayName || '',
                              email: currentUser.email || '',
                              telephone: userData?.telephone || userData?.phoneNumber || '',
                              ville: userData?.ville || '',
                              quartier: userData?.quartier || ''
                            });
                          }}
                          className="flex items-center gap-2 bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                        >
                          <FiX className="w-4 h-4" />
                          Annuler
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
                      <input
                        type="text"
                        value={profileForm.displayName}
                        onChange={(e) => setProfileForm({...profileForm, displayName: e.target.value})}
                        disabled={!isEditingProfile}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={profileForm.email}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">L'email ne peut pas être modifié</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                      <input
                        type="tel"
                        value={isEditingProfile ? profileForm.telephone : (userProfileData?.telephone || '')}
                        onChange={(e) => setProfileForm({...profileForm, telephone: e.target.value})}
                        disabled={!isEditingProfile}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                      {isEditingProfile ? (
                        <select
                          value={profileForm.ville}
                          onChange={e => setProfileForm({ ...profileForm, ville: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 bg-white text-gray-800 font-semibold transition"
                          required
                        >
                          <option value="">Choisir une ville</option>
                          {CITIES.map(city => (
                            <option key={city} value={city}>{city}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={userProfileData?.ville || ''}
                          disabled
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
                        />
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quartier</label>
                      <input
                        type="text"
                        value={isEditingProfile ? profileForm.quartier : (userProfileData?.quartier || '')}
                        onChange={(e) => setProfileForm({...profileForm, quartier: e.target.value})}
                        disabled={!isEditingProfile}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                      />
                    </div>
                  </div>
                </div>
                {/* Fin infos personnelles */}
              </div>
            )}

            {/* Onglet Commandes */}
            {activeTab === 'orders' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Historique des commandes</h2>
                {/* Filtres de tri version BrocanteLive */}
                <form onSubmit={e => e.preventDefault()} className="flex flex-wrap gap-4 mb-6 items-end">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Recherche</label>
                    <input
                      type="text"
                      placeholder="Nom du produit..."
                      value={orderSearchTerm}
                      onChange={e => { setOrderSearchTerm(e.target.value); setOrdersPage(1); }}
                      className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Trier par</label>
                    <select
                      value={orderSortBy}
                      onChange={e => { setOrderSortBy(e.target.value); setOrdersPage(1); }}
                      className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    >
                      <option value="createdAt">Date d'ajout</option>
                      <option value="price">Prix</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ordre</label>
                    <select
                      value={orderSortOrder}
                      onChange={e => { setOrderSortOrder(e.target.value); setOrdersPage(1); }}
                      className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    >
                      <option value="desc">Décroissant</option>
                      <option value="asc">Croissant</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOrderSearchTerm('');
                      setOrderCategoryFilter('');
                      setOrderTypeFilter('');
                      setOrderMinPrice('');
                      setOrderMaxPrice('');
                      setOrderSortBy('createdAt');
                      setOrderSortOrder('desc');
                      setOrdersPage(1);
                    }}
                    className="bg-subtle-border text-text-main px-6 py-2 rounded-lg font-semibold shadow hover:bg-gray-200 transition-colors duration-200"
                  >
                    Effacer les filtres
                  </button>
                </form>
                {loadingOrders ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-gray-500 mt-2">Chargement des commandes...</p>
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-8">
                    <FiShoppingBag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Aucune commande trouvée</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      {paginatedOrders.map((order) => {
                        const hasManyItems = order.items && order.items.length > 2;
                        const isOpen = openOrders.includes(order.id);
                        return (
                          <div key={order.id} className="bg-[#f6fafd] rounded-xl shadow-md border-2 border-white flex flex-col gap-3 p-5 mb-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold shadow-sm bg-yellow-100 text-yellow-800`} style={{minWidth: '90px', textAlign: 'center'}}>{getOrderStatusLabel(order.status)}</span>
                              <span className="text-xs text-gray-500">{order.createdAt ? (typeof order.createdAt.toDate === 'function' ? order.createdAt.toDate().toLocaleDateString('fr-FR') : new Date(order.createdAt).toLocaleDateString('fr-FR')) : 'Date inconnue'}</span>
                            </div>
                            {/* Liste des produits */}
                            <div className="flex flex-col gap-2">
                              {order.items && (hasManyItems ? (
                                <>
                                  <div className="flex items-center gap-3 bg-white rounded-lg p-2 border border-gray-100">
                                    <img
                                      src={order.items[0].imageUrl || 'https://via.placeholder.com/60'}
                                      alt={order.items[0].productName || 'Produit'}
                                      className="w-14 h-14 object-contain rounded-lg bg-white border border-gray-200"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-bold text-[#4FC3F7] leading-tight line-clamp-2 text-left" title={order.items[0].productName}>{order.items[0].productName || '-'}</div>
                                      <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-3">
                                        <span>Type : <span className="font-semibold">{order.items[0].type === 'neuf' ? 'Neuf' : order.items[0].type === 'occasion' ? 'Occasion' : order.items[0].type || '-'}</span></span>
                                        <span>Quantité : <span className="font-semibold">{order.items[0].quantity || 1}</span></span>
                                        <span>Prix unitaire : <span className="font-semibold">{(order.items[0].price && order.items[0].price > 0 ? order.items[0].price : (order.items[0].pricePerItem || 0)).toLocaleString()} FCFA</span></span>
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setOpenOrders(prev => isOpen ? prev.filter(id => id !== order.id) : [...prev, order.id])}
                                    className="text-primary font-semibold text-sm flex items-center gap-1 hover:underline mt-1 ml-2"
                                  >
                                    {isOpen ? 'Masquer les articles' : `Voir tous les articles (${order.items.length})`}
                                  </button>
                                  {isOpen && (
                                    <div className="flex flex-col gap-2 mt-2 animate-fadeIn">
                                      {order.items.slice(1).map((item, idx) => (
                                        <div key={item.productId || idx} className="flex items-center gap-3 bg-white rounded-lg p-2 border border-gray-100">
                                          <img
                                            src={item.imageUrl || 'https://via.placeholder.com/60'}
                                            alt={item.productName || 'Produit'}
                                            className="w-14 h-14 object-contain rounded-lg bg-white border border-gray-200"
                                          />
                                          <div className="flex-1 min-w-0">
                                            <div className="text-sm font-bold text-[#4FC3F7] leading-tight line-clamp-2 text-left" title={item.productName}>{item.productName || '-'}</div>
                                            <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-3">
                                              <span>Type : <span className="font-semibold">{item.type === 'neuf' ? 'Neuf' : item.type === 'occasion' ? 'Occasion' : item.type || '-'}</span></span>
                                              <span>Quantité : <span className="font-semibold">{item.quantity || 1}</span></span>
                                              <span>Prix unitaire : <span className="font-semibold">{(item.price && item.price > 0 ? item.price : (item.pricePerItem || 0)).toLocaleString()} FCFA</span></span>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </>
                              ) : (
                                order.items.map((item, idx) => (
                                  <div key={item.productId || idx} className="flex items-center gap-3 bg-white rounded-lg p-2 border border-gray-100">
                                    <img
                                      src={item.imageUrl || 'https://via.placeholder.com/60'}
                                      alt={item.productName || 'Produit'}
                                      className="w-14 h-14 object-contain rounded-lg bg-white border border-gray-200"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-bold text-[#4FC3F7] leading-tight line-clamp-2 text-left" title={item.productName}>{item.productName || '-'}</div>
                                      <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-3">
                                        <span>Type : <span className="font-semibold">{item.type === 'neuf' ? 'Neuf' : item.type === 'occasion' ? 'Occasion' : item.type || '-'}</span></span>
                                        <span>Quantité : <span className="font-semibold">{item.quantity || 1}</span></span>
                                        <span>Prix unitaire : <span className="font-semibold">{(item.price && item.price > 0 ? item.price : (item.pricePerItem || 0)).toLocaleString()} FCFA</span></span>
                                      </div>
                                    </div>
                                  </div>
                                ))
                              ))}
                            </div>
                            {/* Total */}
                            <div className="flex justify-end mt-2">
                              <span className="text-[#00C853] font-bold text-lg">Total : {order.totalAmount ? order.totalAmount.toLocaleString() : 0} FCFA</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Pagination commandes */}
                    {totalOrdersPages > 1 && (
                      <div className="flex justify-center mt-8 gap-2">
                        {Array.from({ length: totalOrdersPages }, (_, i) => (
                          <button
                            key={i}
                            onClick={() => setOrdersPage(i + 1)}
                            className={`px-4 py-2 rounded-lg font-semibold shadow transition-colors duration-200 ${ordersPage === i + 1 ? 'bg-[#4FC3F7] text-white' : 'bg-gray-100 text-[#4FC3F7] hover:bg-blue-50'}`}
                          >
                            Page {i + 1}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Onglet Favoris */}
            {activeTab === 'favorites' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Mes produits favoris</h2>
                {loadingFavorites ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-gray-500 mt-2">Chargement des favoris...</p>
                  </div>
                ) : favorites.length === 0 ? (
                  <div className="text-center py-8">
                    <FiHeart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Aucun produit favori</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {favorites.map((favorite) => (
                      <div key={favorite.productId} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center gap-3">
                          <img
                            src={favorite.product?.imageUrl || 'https://via.placeholder.com/60'}
                            alt={favorite.product?.name || 'Produit'}
                            className="w-16 h-16 object-cover rounded-lg"
                          />
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-800 truncate">
                              {favorite.product?.name || 'Produit supprimé'}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {favorite.product?.price ? `${favorite.product.price.toLocaleString()} FCFA` : 'Prix non disponible'}
                            </p>
                            <p className="text-xs text-gray-500">
                              Ajouté le {new Date(favorite.addedAt).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;
