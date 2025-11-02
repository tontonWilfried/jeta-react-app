import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, orderBy, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { firestore } from '../firebaseConfig';
import { FiBox, FiTrendingUp, FiDollarSign, FiShoppingCart, FiPlusCircle, FiRefreshCw, FiShoppingBag, FiMessageCircle, FiSearch, FiHeadphones, FiCreditCard } from 'react-icons/fi';
import { FaMoneyBillWave, FaChartBar } from 'react-icons/fa';
import DiscussionChat from './DiscussionChat';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function SellerDashboard() {
  const { currentUser, userData } = useAuth();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [ordersWithBuyer, setOrdersWithBuyer] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ produits: 0, vendus: 0, chiffreAffaires: 0, stockFaible: 0 });
  const [notifications, setNotifications] = useState([]);
  const [showDiscussions, setShowDiscussions] = useState(false);
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [selectedClientUid, setSelectedClientUid] = useState(null);
  const [searchClient, setSearchClient] = useState('');
  const navigate = useNavigate();

  const displayName = userData?.displayName || userData?.name || currentUser?.displayName || currentUser?.name || currentUser?.email || 'Vendeur';

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      setLoading(true);
      // 1. Récupérer les produits du vendeur
      const productsRef = collection(firestore, 'products');
      const qProducts = query(productsRef, where('sellerUid', '==', currentUser.uid));
      const productsSnap = await getDocs(qProducts);
      const productsList = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // 2. Récupérer toutes les commandes
      const ordersRef = collection(firestore, 'orders');
      const qOrders = query(ordersRef, orderBy('createdAt', 'desc'));
      const ordersSnap = await getDocs(qOrders);
      // 3. Filtrer les items qui concernent ce vendeur
      let sellerOrderItems = [];
      ordersSnap.docs.forEach(orderDoc => {
        const order = orderDoc.data();
        if (Array.isArray(order.items)) {
          order.items.forEach(item => {
            if (item.sellerUid === currentUser.uid) {
              sellerOrderItems.push({
                ...item,
                orderId: orderDoc.id,
                orderNumber: order.orderNumber,
                createdAt: order.createdAt,
                status: item.status || order.status || order.paymentDetails?.status || '',
                buyerEmail: order.buyerEmail,
                buyerUid: order.buyerUid,
                buyernum: order.buyernum,
                totalAmount: order.totalAmount,
              });
            }
          });
        }
      });
      // 4. Récupérer le displayName de chaque acheteur unique
      const buyerUids = Array.from(new Set(sellerOrderItems.map(item => item.buyerUid).filter(Boolean)));
      const buyerMap = {};
      await Promise.all(buyerUids.map(async (uid) => {
        try {
          const userDoc = await getDoc(doc(firestore, 'users', uid));
          if (userDoc.exists()) {
            buyerMap[uid] = userDoc.data().displayName || '-';
          } else {
            buyerMap[uid] = '-';
          }
        } catch {
          buyerMap[uid] = '-';
        }
      }));
      // 5. Ajouter le displayName à chaque commande
      const sellerOrderItemsWithBuyer = sellerOrderItems.map(item => ({
        ...item,
        buyerName: item.buyerUid ? buyerMap[item.buyerUid] : '-',
      }));
      // 6. Calculer les stats dynamiquement
      const produits = productsList.length;
      const vendus = sellerOrderItemsWithBuyer.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const chiffreAffaires = sellerOrderItemsWithBuyer
        .filter(item => item.status === 'paid')
        .reduce((sum, item) => sum + ((item.pricePerItem || 0) * (item.quantity || 0)), 0);
      const LOW_STOCK_THRESHOLD = 15;
      const stockFaible = productsList.filter(p => typeof p.stock === 'number' && p.stock < LOW_STOCK_THRESHOLD).length;
      setProducts(productsList);
      setOrders(sellerOrderItemsWithBuyer);
      setStats({ produits, vendus, chiffreAffaires, stockFaible });
      setLoading(false);
    };
    fetchData();
    // Listener Firestore pour les nouvelles commandes "en attente de paiement"
    if (currentUser) {
      const ordersRef = collection(firestore, 'orders');
      const q = query(ordersRef, orderBy('createdAt', 'desc'));
      // Utilise localStorage pour mémoriser les commandes déjà notifiées
      const LS_KEY = `jeta_seller_notified_orders_${currentUser.uid}`;
      let lastSeenOrderIds = new Set(JSON.parse(localStorage.getItem(LS_KEY) || '[]'));
      const unsub = onSnapshot(q, (snap) => {
        const newPending = [];
        snap.docs.forEach(docSnap => {
          const order = docSnap.data();
          if (Array.isArray(order.items)) {
            order.items.forEach(item => {
              if (item.sellerUid === currentUser.uid && (item.status === 'pending' || order.status === 'pending')) {
                const uniqueId = docSnap.id + '-' + item.productId;
                if (!lastSeenOrderIds.has(uniqueId)) {
                  newPending.push({ id: uniqueId, orderId: docSnap.id, productName: item.productName });
                  lastSeenOrderIds.add(uniqueId);
                }
              }
            });
          }
        });
        if (newPending.length > 0) {
          newPending.forEach(cmd => {
            toast.info(`Nouvelle commande à traiter : ${cmd.productName ? cmd.productName : 'Produit'}`, {
              position: 'top-right',
              autoClose: 6000,
              hideProgressBar: false,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true,
              progress: undefined,
            });
          });
          // Met à jour localStorage pour ne plus notifier ces commandes
          localStorage.setItem(LS_KEY, JSON.stringify(Array.from(lastSeenOrderIds)));
        }
      });
      return () => unsub();
    }
  }, [currentUser]);

  // Charger la liste des clients du vendeur
  useEffect(() => {
    if (!showDiscussions || !currentUser) return;
    const fetchClients = async () => {
      setLoadingClients(true);
      // Chercher toutes les commandes où le vendeur est concerné
      const ordersRef = collection(firestore, 'orders');
      const q = query(ordersRef);
      const snap = await getDocs(q);
      // Extraire tous les buyerUid uniques pour ce vendeur
      const clientUids = new Set();
      snap.docs.forEach(docSnap => {
        const order = docSnap.data();
        if (Array.isArray(order.items)) {
          order.items.forEach(item => {
            if (item.sellerUid === currentUser.uid && order.userId) clientUids.add(order.userId);
          });
        }
      });
      // Récupérer les infos clients
      const clientsList = [];
      for (const uid of clientUids) {
        const userDoc = await getDoc(doc(firestore, 'users', uid));
        if (userDoc.exists()) {
          clientsList.push({
            uid,
            name: userDoc.data().displayName || userDoc.data().name || userDoc.data().email || 'Client',
            email: userDoc.data().email || '',
            avatar: userDoc.data().avatarUrl || '',
          });
        }
      }
      setClients(clientsList);
      setLoadingClients(false);
    };
    fetchClients();
  }, [showDiscussions, currentUser]);

  // Filtrage par recherche
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchClient.toLowerCase()) ||
    client.email.toLowerCase().includes(searchClient.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-page-bg font-poppins pt-8 pb-12 px-2 sm:px-6">
      <ToastContainer />
      <div className="max-w-6xl mx-auto">
        {/* Message de bienvenue */}
        <div className="flex flex-col items-center justify-center mb-10 animate-fadeInUp">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-dark drop-shadow-lg flex items-center gap-3 mb-2" style={{paddingBottom: '0.3em', marginBottom: '0.5em'}}>
            Bonjour, {displayName}
            <span className="animate-bounce"><FiShoppingBag className="inline-block text-primary-dark" size={44} /></span>
          </h1>
          <p className="text-lg sm:text-xl text-text-secondary font-medium text-center max-w-2xl">
            Bienvenue sur votre espace vendeur JETA. Retrouvez ici toutes vos statistiques, accès rapides et outils pour booster vos ventes !
          </p>
        </div>
        {/* Statistiques dynamiques (grille 1) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {/* Box 1 */}
          <div className="flex flex-col items-center">
            <div className="glass-card group mb-3">
              <FiBox className="text-accent-orange group-hover:scale-110 transition-transform duration-200" size={38} />
              <div className="text-3xl font-extrabold text-primary mt-2">{stats.produits}</div>
              <div className="text-accent-orange font-semibold text-base mt-1">Produits en vente</div>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="glass-card group mb-3">
              <FiTrendingUp className="text-primary group-hover:scale-110 transition-transform duration-200" size={38} />
              <div className="text-3xl font-extrabold text-primary mt-2">{stats.vendus}</div>
              <div className="text-primary font-semibold text-base mt-1">Produits vendus</div>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="glass-card group mb-3">
              <FaMoneyBillWave className="text-accent-green group-hover:scale-110 transition-transform duration-200" size={38} />
              <div className="text-3xl font-extrabold text-accent-green mt-2">{stats.chiffreAffaires.toLocaleString()} FCFA</div>
              <div className="text-accent-green font-semibold text-base mt-1">Chiffre d'affaires</div>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="glass-card group mb-3">
              <FiBox className="text-accent-red group-hover:scale-110 transition-transform duration-200 -rotate-12" size={38} />
              <div className="text-3xl font-extrabold text-accent-red mt-2">{stats.stockFaible}</div>
              <div className="text-accent-red font-semibold text-base mt-1">Stock faible</div>
            </div>
          </div>
        </div>
        {/* Grille d'actions (grille 2) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10 justify-center items-center">
          {/* Action : Gérer mes produits */}
          <div className="action-card group">
            <FiBox className="text-primary group-hover:scale-110 transition-transform duration-200 mb-3" size={38} />
            <div className="font-bold text-lg mb-2">Gérer mes produits</div>
            <Link to="/manage-brocante" className="action-btn group">
              <FiBox className="mr-1" size={18} />
              <span>Accéder</span>
            </Link>
          </div>
          {/* Action : Mes commandes */}
          <div className="action-card group">
            <FiShoppingCart className="text-primary group-hover:scale-110 transition-transform duration-200 mb-3" size={38} />
            <div className="font-bold text-lg mb-2">Mes commandes</div>
            <Link to="/seller-orders" className="action-btn group">
              <FiShoppingCart className="mr-1" size={18} />
              <span>Accéder</span>
            </Link>
          </div>
          {/* Action : Mon paiement Mobile Money */}
          <div className="action-card group">
            <FiCreditCard className="text-primary group-hover:scale-110 transition-transform duration-200 mb-3" size={38} />
            <div className="font-bold text-lg mb-2">Mon Mobile Money</div>
            <Link to="/seller-mobile-money" className="action-btn group">
              <FiCreditCard className="mr-1" size={18} />
              <span>Gérer</span>
            </Link>
          </div>
          {/* Action : Panier vendeur */}
          <div className="action-card group">
            <FiShoppingBag className="text-primary group-hover:scale-110 transition-transform duration-200 mb-3" size={38} />
            <div className="font-bold text-lg mb-2">Panier vendeur</div>
            <Link to="/seller-cart" className="action-btn group">
              <FiShoppingBag className="mr-1" size={18} />
              <span>Accéder</span>
            </Link>
          </div>
          {/* Action : Discussions */}
          <div className="action-card group">
            <FiMessageCircle className="text-primary group-hover:scale-110 transition-transform duration-200 mb-3" size={38} />
            <div className="font-bold text-lg mb-2">Discussions</div>
            <div className="text-gray-500 text-sm text-center mb-2"></div>
            <Link to="/seller-discussions" className="action-btn group">
              <FiMessageCircle className="mr-1" size={18} />
              <span>Accéder</span>
            </Link>
          </div>
          {/* Action : Scrapping */}
          <div className="action-card group">
            <FiRefreshCw className="text-primary group-hover:scale-110 transition-transform duration-200 mb-3" size={38} />
            <div className="font-bold text-lg mb-2">Scrapping</div>
            <Link to="/seller/scrapping" className="action-btn group">
              <FiRefreshCw className="mr-1" size={18} />
              <span>Lancer</span>
            </Link>
          </div>
          {/* Action : Brocante Live */}
          <div className="action-card group">
            <FiTrendingUp className="text-primary group-hover:scale-110 transition-transform duration-200 mb-3" size={38} />
            <div className="font-bold text-lg mb-2">Brocante Live</div>
            <Link to="/brocante-live" className="action-btn group">
              <FiTrendingUp className="mr-1" size={18} />
              <span>Accéder</span>
            </Link>
          </div>
          {/* Action : Voir les statistiques */}
          <div className="action-card group">
            <FaChartBar className="text-primary group-hover:scale-110 transition-transform duration-200 mb-3" size={38} />
            <div className="font-bold text-lg mb-2">Voir les statistiques</div>
            <Link to="/seller-stats" className="action-btn group">
              <FaChartBar className="mr-1" size={18} />
              <span>Accéder</span>
            </Link>
          </div>
        </div>
        {/* Suppression du bouton Discussions flottant en bas à droite */}
        {showDiscussions && (
          <div className="flex flex-col md:flex-row gap-8">
            {/* Colonne gauche : liste clients + support */}
            <div className="bg-white rounded-2xl shadow p-4 flex flex-col border border-[#b3e0f7] max-w-xs w-full min-h-[60vh]">
              <div className="flex items-center gap-2 mb-4">
                <FiMessageCircle className="text-[#00C853]" size={24} />
                <span className="font-bold text-lg text-[#00C853]">Discussions</span>
              </div>
              {/* Bouton support */}
              <button
                className="flex items-center gap-2 px-3 py-2 mb-3 rounded-xl bg-gradient-to-br from-[#e3f0ff] to-[#f6fafd] text-[#4FC3F7] font-semibold shadow hover:bg-[#b3e0f7] border border-[#b3e0f7] transition"
                onClick={() => setSelectedClientUid('support')}
              >
                <FiHeadphones /> Discuter avec le support
              </button>
              {/* Barre de recherche */}
              <div className="relative mb-3">
                <input
                  type="text"
                  value={searchClient}
                  onChange={e => setSearchClient(e.target.value)}
                  placeholder="Rechercher un client..."
                  className="w-full rounded-full border border-[#b3e0f7] px-4 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C853] bg-[#fafdff]"
                />
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b3e0f7]" />
              </div>
              {/* Liste clients */}
              <div className="flex-1 overflow-y-auto">
                {loadingClients ? (
                  <div className="text-center text-gray-400 py-8">Chargement...</div>
                ) : filteredClients.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">Aucun client trouvé.</div>
                ) : (
                  <ul className="space-y-2">
                    {filteredClients.map(client => (
                      <li key={client.uid}>
                        <button
                          className={`w-full text-left px-3 py-2 rounded-xl border flex items-center gap-3 ${selectedClientUid === client.uid ? 'bg-green-100 border-green-300 font-bold' : 'bg-gray-50 border-gray-200'} hover:bg-green-50 transition`}
                          onClick={() => setSelectedClientUid(client.uid)}
                        >
                          {client.avatar ? (
                            <img src={client.avatar} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-base text-[#00C853] font-bold">
                              {client.name[0]}
                            </div>
                          )}
                          <span className="truncate flex-1 text-[#00C853]">{client.name}</span>
                          <span className="text-xs bg-[#e3fae3] text-[#00C853] px-2 py-1 rounded-full font-semibold ml-2">Client</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            {/* Colonne droite : chat */}
            <div className="flex-1 min-w-[300px]">
              {selectedClientUid === 'support' ? (
                <div className="bg-white rounded-2xl shadow p-8 flex flex-col items-center justify-center border border-[#b3e0f7] min-h-[60vh] text-center">
                  <FiHeadphones className="text-[#4FC3F7] mb-3" size={40} />
                  <div className="font-bold text-xl mb-2 text-[#4FC3F7]">Support admin</div>
                  <div className="text-gray-500 mb-4">Posez vos questions, nous vous répondrons rapidement !</div>
                  {/* Ici tu peux intégrer le chat support si tu veux */}
                  <div className="text-gray-400">(Chat support à intégrer ici)</div>
                </div>
              ) : selectedClientUid ? (
                <DiscussionChat sellerUid={currentUser.uid} clientUid={selectedClientUid} isSeller={true} />
              ) : (
                <div className="bg-white rounded-2xl shadow p-8 flex flex-col items-center justify-center border border-[#b3e0f7] min-h-[60vh] text-center">
                  <FiMessageCircle className="text-[#00C853] mb-3" size={40} />
                  <div className="font-bold text-xl mb-2 text-[#00C853]">Bienvenue dans vos discussions</div>
                  <div className="text-gray-500">Sélectionnez un client à gauche pour démarrer une conversation.</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {/* Animations et styles glassmorphism */}
      <style>{`
        .glass-card {
          background: rgba(255,255,255,0.85);
          border-radius: 1.25rem;
          box-shadow: 0 4px 32px 0 rgba(79,195,247,0.10), 0 1.5px 8px 0 #e0cfae33;
          border: 1.5px solid #eaf6fb;
          padding: 2.2rem 1.2rem 1.6rem 1.2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          min-height: 170px;
          transition: box-shadow 0.2s, transform 0.2s;
        }
        .glass-card:hover {
          box-shadow: 0 8px 40px 0 rgba(79,195,247,0.18), 0 2px 12px 0 #e0cfae33;
          transform: translateY(-4px) scale(1.03);
        }
        .action-card {
          background: #fff;
          border-radius: 1.25rem;
          box-shadow: 0 4px 24px 0 rgba(79,195,247,0.10), 0 1.5px 8px 0 #e0cfae33;
          border: 1.5px solid #eaf6fb;
          padding: 2.2rem 1.2rem 1.6rem 1.2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          min-height: 170px;
          transition: box-shadow 0.2s, transform 0.2s;
        }
        .action-card:hover {
          box-shadow: 0 8px 40px 0 rgba(79,195,247,0.18), 0 2px 12px 0 #e0cfae33;
          transform: translateY(-4px) scale(1.03);
        }
        .action-btn {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          background: #4FC3F7;
          color: #fff;
          border-radius: 9999px;
          padding: 0.5rem 1.2rem;
          font-weight: 600;
          font-size: 1rem;
          box-shadow: 0 1.5px 6px #4FC3F711;
          border: none;
          min-width: unset;
          text-decoration: none;
          transition: background 0.18s, color 0.18s, box-shadow 0.18s, transform 0.18s;
          margin-top: 0.2rem;
        }
        .action-btn:hover {
          background: #0288D1;
          color: #fff;
          box-shadow: 0 4px 18px #4FC3F733;
          transform: translateY(-1.5px) scale(1.03);
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.8s cubic-bezier(0.23, 1, 0.32, 1) both;
        }
      `}</style>
    </div>
  );
} 