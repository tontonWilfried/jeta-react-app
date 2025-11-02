import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { firestore } from '../firebaseConfig';
import { FaChartBar, FaShoppingBag, FaMoneyBillWave, FaBoxOpen } from 'react-icons/fa';
import { FiTrendingUp } from 'react-icons/fi';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';

export default function SellerStats() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ produits: 0, vendus: 0, chiffreAffaires: 0, stockFaible: 0 });
  const [monthlySales, setMonthlySales] = useState([]); // [{month, ventes, ca}]
  const [stockHistory, setStockHistory] = useState([]); // [{date, stockFaible}]
  const [advice, setAdvice] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
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
      // 4. Calculer les stats dynamiquement
      const produits = productsList.length;
      const vendus = sellerOrderItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const chiffreAffaires = sellerOrderItems
        .filter(item => item.status === 'paid')
        .reduce((sum, item) => sum + ((item.pricePerItem || 0) * (item.quantity || 0)), 0);
      const LOW_STOCK_THRESHOLD = 15;
      const stockFaible = productsList.filter(p => typeof p.stock === 'number' && p.stock < LOW_STOCK_THRESHOLD).length;
      setStats({ produits, vendus, chiffreAffaires, stockFaible });

      // 5. Statistiques mensuelles (ventes, CA)
      const salesByMonth = {};
      sellerOrderItems.forEach(item => {
        if (!item.createdAt) return;
        const date = item.createdAt.seconds ? new Date(item.createdAt.seconds * 1000) : new Date(item.createdAt);
        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!salesByMonth[month]) salesByMonth[month] = { ventes: 0, ca: 0 };
        salesByMonth[month].ventes += item.quantity || 0;
        if (item.status === 'paid') salesByMonth[month].ca += (item.pricePerItem || 0) * (item.quantity || 0);
      });
      const monthlySalesArr = Object.entries(salesByMonth).map(([month, d]) => ({ month, ...d }));
      monthlySalesArr.sort((a, b) => a.month.localeCompare(b.month));
      setMonthlySales(monthlySalesArr);

      // 6. Historique du stock faible (par date de produit)
      const stockHistoryArr = productsList.map(p => {
        const date = p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000) : (p.createdAt ? new Date(p.createdAt) : null);
        return date ? { date: date.toLocaleDateString(), stock: p.stock } : null;
      }).filter(Boolean);
      setStockHistory(stockHistoryArr);

      // 7. Conseils personnalisés
      const advices = [];
      if (monthlySalesArr.length > 1) {
        const last = monthlySalesArr[monthlySalesArr.length - 1];
        const prev = monthlySalesArr[monthlySalesArr.length - 2];
        if (last.ventes > prev.ventes) advices.push('Vos ventes sont en hausse ce mois-ci, continuez ainsi !');
        else if (last.ventes < prev.ventes) advices.push('Vos ventes baissent, pensez à promouvoir vos produits ou ajuster vos prix.');
        if (last.ca > prev.ca) advices.push('Votre chiffre d’affaires progresse, félicitations !');
        else if (last.ca < prev.ca) advices.push('Votre chiffre d’affaires diminue, analysez vos produits les moins performants.');
      }
      if (stockFaible > 0) advices.push(`Attention : ${stockFaible} produit(s) ont un stock faible. Pensez à réapprovisionner !`);
      if (vendus === 0) advices.push('Aucune vente enregistrée. Essayez d’ajouter plus de produits attractifs ou de partager votre boutique.');
      setAdvice(advices);
      setLoading(false);
    };
    fetchStats();
  }, [currentUser]);

  return (
    <div className="min-h-screen bg-[#f6fafd] py-8 px-4 relative">
      {/* Bouton retour */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/80 hover:bg-[#e3f3fa] shadow text-[#4FC3F7] font-semibold text-base z-30 border border-[#e3f3fa]"
        style={{backdropFilter: 'blur(2px)'}}
      >
        <FiArrowLeft className="w-5 h-5" /> Retour
      </button>
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col items-center justify-center mb-10 animate-fadeInUp">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#4FC3F7] mb-2 flex items-center gap-3">
            <FaChartBar className="inline-block text-[#4FC3F7]" size={36} /> Statistiques vendeur
          </h1>
          <p className="text-base sm:text-lg text-gray-600 text-center max-w-2xl">
            Suivez vos performances, visualisez vos tendances et recevez des conseils personnalisés pour booster votre activité sur JETA.
          </p>
        </div>
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <span className="animate-spin text-[#4FC3F7] text-3xl"><FaChartBar /></span>
            <span className="ml-3 text-[#4FC3F7] font-semibold">Chargement des statistiques...</span>
          </div>
        ) : (
          <>
            {/* Cartes stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-2xl shadow-md border-2 border-white p-8 flex flex-col items-center">
                <FaBoxOpen className="text-[#4FC3F7] mb-2 text-3xl" />
                <div className="text-2xl font-bold text-[#4FC3F7]">{stats.produits}</div>
                <div className="text-gray-600 font-semibold mt-1">Produits en vente</div>
              </div>
              <div className="bg-white rounded-2xl shadow-md border-2 border-white p-8 flex flex-col items-center">
                <FaShoppingBag className="text-[#00C853] mb-2 text-3xl" />
                <div className="text-2xl font-bold text-[#00C853]">{stats.vendus}</div>
                <div className="text-gray-600 font-semibold mt-1">Produits vendus</div>
              </div>
              <div className="bg-white rounded-2xl shadow-md border-2 border-white p-8 flex flex-col items-center">
                <FaMoneyBillWave className="text-[#00C853] mb-2 text-3xl" />
                <div className="text-2xl font-bold text-[#00C853]">{stats.chiffreAffaires.toLocaleString()} FCFA</div>
                <div className="text-gray-600 font-semibold mt-1">Chiffre d'affaires</div>
              </div>
              <div className="bg-white rounded-2xl shadow-md border-2 border-white p-8 flex flex-col items-center">
                <FiTrendingUp className="text-[#4FC3F7] mb-2 text-3xl" />
                <div className="text-2xl font-bold text-[#4FC3F7]">{stats.stockFaible}</div>
                <div className="text-gray-600 font-semibold mt-1">Stock faible</div>
              </div>
            </div>
            {/* Graphiques */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="bg-white rounded-2xl shadow-md border-2 border-white p-6">
                <h2 className="text-lg font-bold text-[#4FC3F7] mb-2">Ventes & CA par mois</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlySales} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="ventes" fill="#4FC3F7" name="Ventes" />
                    <Bar dataKey="ca" fill="#00C853" name="Chiffre d'affaires" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-2xl shadow-md border-2 border-white p-6">
                <h2 className="text-lg font-bold text-[#4FC3F7] mb-2">Historique du stock (création produits)</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={stockHistory} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="stock" stroke="#4FC3F7" name="Stock initial" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* Conseils */}
            <div className="bg-white rounded-2xl shadow-md border-2 border-white p-6 mb-8">
              <h2 className="text-lg font-bold text-[#4FC3F7] mb-2">Conseils personnalisés</h2>
              {advice.length === 0 ? (
                <div className="text-gray-500">Aucun conseil pour l’instant. Continuez à vendre !</div>
              ) : (
                <ul className="list-disc pl-5 space-y-1">
                  {advice.map((a, i) => <li key={i} className="text-gray-700">{a}</li>)}
                </ul>
              )}
            </div>
          </>
        )}
        {!loading && stats.produits === 0 && stats.vendus === 0 && stats.chiffreAffaires === 0 && (
          <div className="text-center text-gray-400 mt-8">Aucune donnée à afficher pour l’instant.</div>
        )}
      </div>
    </div>
  );
} 