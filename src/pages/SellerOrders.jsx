import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, orderBy, getDocs, doc, getDoc, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import { firestore } from '../firebaseConfig';
import { FaChevronDown } from 'react-icons/fa';
import { FiShoppingBag, FiShoppingCart, FiArrowLeft } from 'react-icons/fi';
import DatePicker, { registerLocale } from 'react-datepicker';
import fr from 'date-fns/locale/fr';
import 'react-datepicker/dist/react-datepicker.css';
import { useNavigate } from 'react-router-dom';
registerLocale('fr', fr);

const statusLabels = {
  pending: 'En attente',
  paid: 'Payée',
  cancelled: 'Annulée',
};
const statusColors = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  paid: 'bg-blue-50 text-blue-700 border-blue-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  default: 'bg-gray-50 text-gray-700 border-gray-200',
};
const statusOptions = [
  { value: 'pending', label: 'En attente' },
  { value: 'paid', label: 'Payée' },
  { value: 'cancelled', label: 'Annulée' },
];

export default function SellerOrders() {
  const { currentUser, userData } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [sellerNames, setSellerNames] = useState({});
  const [openDropdown, setOpenDropdown] = useState(null); // Pour custom dropdown
  const displayName = userData?.displayName || userData?.name || currentUser?.displayName || currentUser?.name || currentUser?.email || 'Vendeur';
  const navigate = useNavigate();

  // Pagination pour commandes
  const ORDERS_PER_PAGE = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState(null); // Changé de '' à null
  const COMMANDES_PAR_PAGE = 16;

  // Grouper les commandes par jour (doit être AVANT toute utilisation)
  const commandesParJour = {};
  orders.forEach(order => {
    const date = order.createdAt && typeof order.createdAt.toDate === 'function'
      ? order.createdAt.toDate().toLocaleDateString()
      : order.createdAt
        ? new Date(order.createdAt).toLocaleDateString()
        : 'Date inconnue';
    if (!commandesParJour[date]) commandesParJour[date] = [];
    commandesParJour[date].push(order);
  });
  const datesDisponibles = Object.keys(commandesParJour).sort((a, b) => new Date(b) - new Date(a));

  // Ajout pour la gestion des bornes min/max du calendrier
  const today = new Date();
  const allOrderDates = orders.map(order => {
    if (order.createdAt && typeof order.createdAt.toDate === 'function') {
      const d = order.createdAt.toDate();
      return d > today ? today : d;
    } else if (order.createdAt) {
      const d = new Date(order.createdAt);
      return d > today ? today : d;
    }
    return null;
  }).filter(Boolean);
  const minDate = allOrderDates.length > 0 ? new Date(Math.min(...allOrderDates.map(d => d.getTime()))) : null;
  const maxDate = today;
  
  // Pour react-datepicker, on utilise directement selectedDate comme objet Date
  // selectedDateObj n'est plus nécessaire car selectedDate sera maintenant un objet Date

  useEffect(() => {
    setCurrentPage(1); // Remettre à la page 1 quand on change de date
  }, [selectedDate]);
  
  // Convertir selectedDate (objet Date) en chaîne pour l'affichage et le filtrage
  const selectedDateString = selectedDate ? selectedDate.toLocaleDateString() : '';
  const commandesDuJour = commandesParJour[selectedDateString] || [];
  const totalPages = Math.ceil(commandesDuJour.length / COMMANDES_PAR_PAGE);
  const commandesPage = commandesDuJour.slice((currentPage - 1) * COMMANDES_PAR_PAGE, currentPage * COMMANDES_PAR_PAGE);
  const paginatedOrders = orders.slice((currentPage - 1) * ORDERS_PER_PAGE, currentPage * ORDERS_PER_PAGE);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!currentUser) return;
      setLoading(true);
      const ordersRef = collection(firestore, 'orders');
      const q = query(ordersRef, orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      let sellerOrderItems = [];
      let sellerUidsSet = new Set();
      for (const docSnap of snap.docs) {
        const order = docSnap.data();
        if (Array.isArray(order.items)) {
          for (const item of order.items) {
            if (item.sellerUid === currentUser.uid) {
              let buyerName = order.buyerName || '';
              let buyerEmail = order.buyerEmail || '';
              let buyerUid = order.buyerUid || '';
              sellerOrderItems.push({
                ...item,
                orderId: docSnap.id,
                orderNumber: order.orderNumber,
                createdAt: order.createdAt,
                status: item.status || order.status || order.paymentDetails?.status || 'pending',
                buyerName,
                buyerEmail,
                buyerUid,
                totalAmount: order.totalAmount,
                shippingAddress: order.shippingAddress,
                paymentDetails: order.paymentDetails,
                allItems: order.items,
                sellerUid: item.sellerUid,
              });
              sellerUidsSet.add(item.sellerUid);
            }
          }
        }
      }
      // Récupérer le nom de chaque vendeur unique
      const sellerUids = Array.from(sellerUidsSet);
      const namesMap = {};
      await Promise.all(sellerUids.map(async (uid) => {
        try {
          const vendeurDoc = await getDoc(doc(firestore, 'users', uid));
          if (vendeurDoc.exists()) {
            namesMap[uid] = vendeurDoc.data().displayName || vendeurDoc.data().name || vendeurDoc.data().email || '-';
          } else {
            namesMap[uid] = '-';
          }
        } catch {
          namesMap[uid] = '-';
        }
      }));
      setSellerNames(namesMap);
      // Associer le nom du vendeur à chaque commande
      sellerOrderItems = sellerOrderItems.map(item => ({
        ...item,
        sellerName: namesMap[item.sellerUid] || '-',
      }));
      setOrders(sellerOrderItems);
      setLoading(false);
    };
    fetchOrders();
  }, [currentUser]);

  const getStatusLabel = (status) => statusLabels[status] || status || 'En attente';
  const getStatusColor = (status) => statusColors[status] || statusColors['default'];

  const handleStatusChange = async (orderId, newStatus, productId, quantity, previousStatus) => {
    setUpdating(true);
    try {
      const orderRef = doc(firestore, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) throw new Error('Commande introuvable');
      const orderData = orderSnap.data();
      
      // Vérifier le stock si on passe à "Payée"
      if (newStatus === 'paid') {
        const productRef = doc(firestore, 'products', productId);
        const productSnap = await getDoc(productRef);
        if (!productSnap.exists()) throw new Error('Produit introuvable');
        const productData = productSnap.data();
        if (productData.stock < quantity) {
          alert("Stock insuffisant pour valider le paiement. Veuillez ajuster la quantité ou réapprovisionner le stock.");
          setUpdating(false);
          setOpenDropdown(null);
          return;
        }
        
        // Diminuer le stock
        await updateDoc(productRef, {
          stock: increment(-quantity)
        });
      }
      
      // Si on repasse de 'paid' à 'cancelled', remettre le stock
      if (orderData.items) {
        const prevItem = orderData.items.find(item => item.productId === productId);
        if (prevItem && prevItem.status === 'paid' && newStatus === 'cancelled') {
          const productRef = doc(firestore, 'products', productId);
          await updateDoc(productRef, {
            stock: increment(quantity)
          });
        }
      }
      
      // Mettre à jour le statut du bon item
      const newItems = (orderData.items || []).map(item =>
        item.productId === productId ? { ...item, status: newStatus } : item
      );
      await updateDoc(orderRef, { items: newItems });
      setOrders(orders => orders.map(o =>
        o.orderId === orderId && o.productId === productId
          ? { ...o, status: newStatus }
          : o
      ));
    } catch (e) {
      alert(e.message || "Erreur lors de la mise à jour du statut");
    }
    setUpdating(false);
    setOpenDropdown(null);
  };

  // Custom dropdown stylé
  const StatusDropdown = ({ value, onChange, disabled, orderId, productId }) => (
    <div className="relative w-full max-w-[140px]">
      <button
        type="button"
        className={`flex items-center justify-between w-full px-3 py-1.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary text-xs font-semibold shadow-sm transition bg-white hover:bg-primary/10 ${getStatusColor(value)} ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        onClick={() => setOpenDropdown(openDropdown === orderId + '-' + productId ? null : orderId + '-' + productId)}
        disabled={disabled}
      >
        <span>{getStatusLabel(value)}</span>
        <FaChevronDown className="ml-2 text-xs" />
      </button>
      {openDropdown === orderId + '-' + productId && (
        <div className="absolute z-10 mt-1 left-0 w-full bg-white border rounded-lg shadow-lg py-1 animate-fade-in">
          {statusOptions.map(opt => (
            <button
              key={opt.value}
              className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-primary/10 ${value === opt.value ? 'font-bold text-primary' : ''}`}
              onClick={() => onChange(opt.value)}
              disabled={disabled}
            >
              {getStatusLabel(opt.value)}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  useEffect(() => {
    if (datesDisponibles.length > 0 && !selectedDate) {
      // Vérifier que la première date est valide avant de la sélectionner
      const firstDate = datesDisponibles[0];
      if (firstDate && firstDate.trim()) {
        // Convertir le format dd/MM/yyyy vers un objet Date
        const [day, month, year] = firstDate.split('/');
        const testDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(testDate.getTime())) {
          setSelectedDate(testDate);
        }
      }
    }
  }, [datesDisponibles, selectedDate]);

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
      <div className="flex flex-col items-center justify-center mb-10 animate-fadeInUp pt-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-dark drop-shadow-lg flex items-center gap-3 mb-2" style={{paddingBottom: '0.3em', marginBottom: '0.5em'}}>
          <span className="animate-bounce"><FiShoppingCart className="inline-block text-primary-dark" size={44} /></span>
          Mes commandes reçues
        </h1>
        <p className="text-lg sm:text-xl text-text-secondary font-medium text-center max-w-2xl">
          Consulte et gère toutes les commandes de tes clients ici.
        </p>
      </div>
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-3xl md:text-4xl font-bold text-[#4FC3F7] mb-8 text-left">Mes commandes reçues</h1>
        {loading ? (
          <div className="text-center text-gray-400 py-12 text-lg">Chargement...</div>
        ) : orders.length === 0 ? (
          <div className="text-center text-gray-400 py-12 text-lg">Aucune commande reçue pour l'instant.</div>
        ) : (
          <>
            <div className="mb-6 flex flex-col sm:flex-row items-center gap-3">
              <label htmlFor="date-select" className="font-semibold text-primary">Choisir une date :</label>
              <DatePicker
                id="date-select"
                selected={selectedDate}
                onChange={date => setSelectedDate(date)}
                minDate={minDate}
                maxDate={maxDate}
                locale="fr"
                dateFormat="dd/MM/yyyy"
                placeholderText="Sélectionner une date"
                className="px-4 py-2 rounded-2xl border-2 border-primary bg-white text-primary font-semibold shadow focus:outline-none focus:ring-2 focus:ring-primary w-[220px] text-center"
                calendarClassName="!border-primary !rounded-3xl !shadow-2xl !bg-[#f6fafd] !p-4 !mt-2 !border-2"
                dayClassName={date => `!rounded-full !font-bold transition-all duration-150 ${selectedDate && selectedDate instanceof Date && !isNaN(selectedDate.getTime()) && date.toDateString() === selectedDate.toDateString() ? '!bg-[#4FC3F7] !text-white' : 'hover:!bg-[#4FC3F7]/20 hover:!text-[#4FC3F7]'}`}
                weekDayClassName={date => "!text-[#4FC3F7] !font-semibold"}
                popperClassName="z-[9999]"
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
                openToDate={minDate && minDate instanceof Date && !isNaN(minDate.getTime()) ? minDate : undefined}
                renderCustomHeader={({ date, decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled }) => (
                  <div className="flex items-center justify-between mb-2 px-2">
                    <button onClick={decreaseMonth} disabled={prevMonthButtonDisabled} className="text-primary rounded-full px-2 py-1 hover:bg-primary/10 disabled:opacity-40">&lt;</button>
                    <span className="font-bold text-primary text-lg">{date.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}</span>
                    <button onClick={increaseMonth} disabled={nextMonthButtonDisabled} className="text-primary rounded-full px-2 py-1 hover:bg-primary/10 disabled:opacity-40">&gt;</button>
                  </div>
                )}
              />
            </div>
            {selectedDate && commandesParJour[selectedDateString] && (
              <div className="mb-10">
                <h2 className="text-xl font-bold text-primary mb-4">{selectedDateString}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {commandesPage.map((order, idx) => (
                    <div key={order.orderId + '-' + idx} className="bg-[#f6fafd] rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 flex flex-col border-2 border-white">
                <div className="w-full aspect-[3/2] overflow-hidden rounded-t-lg bg-white relative flex items-center justify-center">
                  <img
                    src={order.imageUrl || 'https://via.placeholder.com/150'}
                    alt={order.productName}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="p-4 flex flex-col flex-grow text-left">
                  <h3 className="text-base font-bold text-[#4FC3F7] mb-1 truncate capitalize leading-tight tracking-wide">{order.productName || '-'}</h3>
                  <p className="text-xs text-gray-500 mb-1 line-clamp-2 min-h-[20px]">Commande #{order.orderNumber || order.orderId.slice(-6)}</p>
                  <div className="text-xs text-gray-700 mb-1">
                    {order.quantity && (
                      <span>Quantité : {order.quantity}</span>
                    )}
                    {order.quantity && order.pricePerItem && <span> | </span>}
                    {order.pricePerItem && (
                      <span>Prix unitaire : {order.pricePerItem.toLocaleString()} FCFA</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-700 mb-1">
                    Acheteur : <span className="font-medium text-gray-700">{order.buyerName || order.buyerEmail || order.buyerUid || '-'}</span>
                  </div>
                  <div className="text-xs text-gray-700 mb-1">
                    Date : <span className="font-medium text-gray-700">{order.createdAt ? (typeof order.createdAt.toDate === 'function' ? order.createdAt.toDate().toLocaleDateString() : new Date(order.createdAt).toLocaleDateString()) : '-'}</span>
                  </div>
                  <div className="text-xs text-gray-700 mb-1">
                    Statut : <span className={`font-semibold px-2 py-1 rounded-full border ${getStatusColor(order.status)}`}>{getStatusLabel(order.status)}</span>
                  </div>
                  {order.paymentDetails?.method === 'mobile_money' && order.paymentDetails?.payerPhone && (
                    <div className="text-xs text-blue-700 mb-1">
                      <b>Numéro utilisé pour le paiement :</b> <span className="font-mono">{order.paymentDetails.payerPhone}</span>
                    </div>
                  )}
                  <div className="text-sm font-semibold mb-2">
                    Montant total : <span className="text-[#00C853] font-bold">{(order.pricePerItem * order.quantity).toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex justify-center items-center gap-3 mt-4">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="px-4 py-2 rounded-md bg-gray-100 text-[#4FC3F7] font-semibold hover:bg-blue-50 transition-colors text-sm shadow"
                    >
                      Détail
                    </button>
                    <StatusDropdown
                      value={order.status}
                      onChange={val => handleStatusChange(order.orderId, val, order.productId, order.quantity, order.status)}
                      disabled={updating}
                      orderId={order.orderId}
                      productId={order.productId}
                    />
                  </div>
                </div>
              </div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex justify-center mt-6 gap-2">
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i + 1)}
                        className={`px-4 py-2 rounded-lg font-semibold shadow transition-colors duration-200 ${
                          currentPage === i + 1 ? 'bg-[#4FC3F7] text-white' : 'bg-gray-100 text-[#4FC3F7] hover:bg-blue-50'
                        }`}
                      >
                        Page {i + 1}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Modale de détail */}
        {selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-[#f6fafd] rounded-lg shadow-lg p-6 max-w-md w-full relative border-2 border-white">
              <button onClick={() => setSelectedOrder(null)} className="absolute top-2 right-2 text-gray-400 hover:text-[#4FC3F7] text-2xl">&times;</button>
              <h2 className="text-xl font-bold mb-3 text-[#4FC3F7]">Détail de la commande #{selectedOrder.orderNumber || selectedOrder.orderId.slice(-6)}</h2>
              <div className="mb-3 flex items-center gap-3 bg-white rounded-xl p-2">
                <img src={selectedOrder.imageUrl || 'https://via.placeholder.com/150'} alt="Produit" className="w-16 h-16 object-contain rounded-xl" />
                <div>
                  <div className="font-semibold text-[#4FC3F7]">{selectedOrder.productName || '-'}</div>
                  <div className="text-xs text-gray-500">x{selectedOrder.quantity} à {selectedOrder.pricePerItem ? selectedOrder.pricePerItem.toLocaleString() : 0} FCFA</div>
                </div>
              </div>
              <div className="mb-2 text-sm text-gray-600"><b>Acheteur :</b> {selectedOrder.buyerName || selectedOrder.buyerEmail || selectedOrder.buyerUid || '-'}</div>
              <div className="mb-2 text-sm text-gray-600"><b>Date :</b> {selectedOrder.createdAt ? (typeof selectedOrder.createdAt.toDate === 'function' ? selectedOrder.createdAt.toDate().toLocaleDateString() : new Date(selectedOrder.createdAt).toLocaleDateString()) : '-'}</div>
              <div className="mb-2 text-sm text-gray-600"><b>Statut :</b> <span className={`font-semibold px-2 py-1 rounded-full border ${getStatusColor(selectedOrder.status)}`}>{getStatusLabel(selectedOrder.status)}</span></div>
              {selectedOrder.paymentDetails?.method === 'mobile_money' && selectedOrder.paymentDetails?.payerPhone && (
                <div className="mb-2 text-sm text-blue-700"><b>Numéro utilisé pour le paiement :</b> <span className="font-mono">{selectedOrder.paymentDetails.payerPhone}</span></div>
              )}
              <div className="mb-2 text-sm text-gray-600"><b>Montant total :</b> <span className="font-bold text-[#00C853]">{selectedOrder.totalAmount ? selectedOrder.totalAmount.toLocaleString() : 0} FCFA</span></div>
              <div className="flex gap-3 mt-4">
                <button className="bg-[#4FC3F7] text-white px-4 py-2 rounded font-semibold hover:bg-[#0288D1] transition text-sm">Contacter le support</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
} 