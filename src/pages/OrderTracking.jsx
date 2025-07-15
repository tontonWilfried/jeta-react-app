// src/pages/OrderTracking.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, orderBy, doc, updateDoc } from 'firebase/firestore';
import { firestore } from '../firebaseConfig';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  default: 'bg-gray-100 text-gray-800',
};

export default function OrderTracking() {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!currentUser) return;
      setLoading(true);
      const ordersRef = collection(firestore, 'orders');
      const q = query(ordersRef, where('buyerUid', '==', currentUser.uid), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const ordersList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(ordersList);
      setLoading(false);
    };
    fetchOrders();
  }, [currentUser]);

  const getStatusLabel = (status) => {
    if (!status) return 'En attente';
    switch (status.toLowerCase()) {
      case 'pending': return 'En attente';
      case 'paid': return 'Payée';
      case 'shipped': return 'Expédiée';
      case 'delivered': return 'Livrée';
      case 'cancelled': return 'Annulée';
      default: return status;
    }
  };

  const getStatusColor = (status) => {
    if (!status) return statusColors['pending'];
    return statusColors[status.toLowerCase()] || statusColors['default'];
  };

  // Fonction pour payer les articles sélectionnés
  const handlePartialPay = async () => {
    if (!selectedOrder || selectedItems.length === 0) return;
    setPaying(true);
    try {
      // Mise à jour Firestore : on marque les items sélectionnés comme payés
      const orderRef = doc(firestore, 'orders', selectedOrder.id);
      const newItems = selectedOrder.items.map((item, idx) =>
        selectedItems.includes(idx) ? { ...item, paid: true } : item
      );
      await updateDoc(orderRef, { items: newItems });
      // Mettre à jour localement
      setSelectedOrder({ ...selectedOrder, items: newItems });
      setOrders(orders.map(o => o.id === selectedOrder.id ? { ...o, items: newItems } : o));
      setSelectedItems([]);
    } catch (e) {
      alert('Erreur lors du paiement partiel');
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 bg-page-bg min-h-screen font-poppins">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-6 text-left">Suivi de mes commandes</h1>
        {loading ? (
          <p className="text-gray-500">Chargement...</p>
        ) : orders.length === 0 ? (
          <p className="text-gray-500">Vous n'avez pas encore passé de commande.</p>
        ) : (
          <div className="space-y-6">
            {orders.map(order => (
              <div key={order.id} className="bg-white rounded-xl shadow p-6 border border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <div>
                    <div className="font-semibold text-lg">Commande #{order.orderNumber || order.id.slice(-6)}</div>
                    <div className="text-gray-500 text-sm">Passée le {order.createdAt ? (typeof order.createdAt.toDate === 'function' ? order.createdAt.toDate().toLocaleDateString() : new Date(order.createdAt).toLocaleDateString()) : '-'}</div>
                  </div>
                  <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(order.status || order.paymentDetails?.status)}`}>
                    {getStatusLabel(order.status || order.paymentDetails?.status)}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <div className="text-gray-700 font-medium">Montant total : <span className="text-primary font-bold">{order.totalAmount ? order.totalAmount.toLocaleString() : 0} FCFA</span></div>
                  <button onClick={() => setSelectedOrder(order)} className="text-primary underline font-semibold hover:text-primary-dark transition">Voir le détail</button>
                </div>
                {/* Détail rapide des produits */}
                <div className="flex flex-wrap gap-4 mt-2">
                  {order.items && order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded p-2">
                      {item.imageUrl && <img src={item.imageUrl} alt="Produit" className="w-10 h-10 object-cover rounded" />}
                      <div>
                        <div className="font-semibold">{item.productName || '-'}</div>
                        <div className="text-xs text-gray-500">x{item.quantity} à {item.pricePerItem} FCFA</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modale de détail de commande */}
        {selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-lg p-8 max-w-lg w-full relative">
              <button onClick={() => setSelectedOrder(null)} className="absolute top-2 right-2 text-gray-500 hover:text-primary text-2xl">&times;</button>
              <h2 className="text-xl font-bold mb-4">Détail de la commande #{selectedOrder.orderNumber || selectedOrder.id.slice(-6)}</h2>
              <div className="mb-4">
                <div className="text-gray-700 font-medium mb-2">Produits commandés :</div>
                <ul className="space-y-2">
                  {selectedOrder.items && selectedOrder.items.map((item, idx) => (
                    <li key={idx} className={`flex items-center gap-3 bg-gray-50 rounded p-2 ${item.paid ? 'opacity-60' : ''}`}>
                      {item.imageUrl && <img src={item.imageUrl} alt="Produit" className="w-12 h-12 object-cover rounded" />}
                      <div className="flex-1">
                        <div className="font-semibold">{item.productName || '-'}</div>
                        <div className="text-xs text-gray-500">x{item.quantity} à {item.pricePerItem} FCFA</div>
                        <div className="text-xs text-gray-400">Vendu par : {item.sellerUid || '-'}</div>
                      </div>
                      {item.paid ? (
                        <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded">Payé</span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(idx)}
                          onChange={e => {
                            if (e.target.checked) setSelectedItems([...selectedItems, idx]);
                            else setSelectedItems(selectedItems.filter(i => i !== idx));
                          }}
                          className="w-5 h-5 text-primary"
                        />
                      )}
                    </li>
                  ))}
                </ul>
                {/* Montant à payer pour la sélection */}
                {selectedItems.length > 0 && (
                  <div className="mt-4 text-right font-bold text-lg text-primary">
                    Montant à payer : {selectedItems.reduce((sum, idx) => sum + (selectedOrder.items[idx].pricePerItem * selectedOrder.items[idx].quantity), 0).toLocaleString()} FCFA
                  </div>
                )}
                {/* Bouton payer la sélection */}
                <div className="mt-4 flex justify-end">
                  <button
                    className="bg-primary text-white px-4 py-2 rounded font-semibold hover:bg-primary-dark transition disabled:opacity-50"
                    disabled={selectedItems.length === 0 || paying}
                    onClick={handlePartialPay}
                  >
                    {paying ? 'Paiement...' : 'Payer la sélection'}
                  </button>
                </div>
              </div>
              <div className="mb-4">
                <div className="text-gray-700 font-medium mb-2">Adresse de livraison :</div>
                <div className="text-sm text-gray-600">
                  {selectedOrder.shippingAddress?.fullName && <div><b>Nom :</b> {selectedOrder.shippingAddress.fullName}</div>}
                  {selectedOrder.shippingAddress?.phoneNumber && <div><b>Téléphone :</b> {selectedOrder.shippingAddress.phoneNumber}</div>}
                  {selectedOrder.shippingAddress?.street && <div><b>Adresse :</b> {selectedOrder.shippingAddress.street}</div>}
                  {selectedOrder.shippingAddress?.city && <div><b>Ville :</b> {selectedOrder.shippingAddress.city}</div>}
                  {selectedOrder.shippingAddress?.country && <div><b>Pays :</b> {selectedOrder.shippingAddress.country}</div>}
                  {selectedOrder.shippingAddress?.zipCode && <div><b>Code postal :</b> {selectedOrder.shippingAddress.zipCode}</div>}
                </div>
              </div>
              <div className="mb-4">
                <div className="text-gray-700 font-medium mb-2">Paiement :</div>
                <div className="text-sm text-gray-600">
                  <div><b>Méthode :</b> {selectedOrder.paymentDetails?.method || '-'}</div>
                  <div><b>Statut :</b> {getStatusLabel(selectedOrder.status || selectedOrder.paymentDetails?.status)}</div>
                  <div><b>Transaction ID :</b> {selectedOrder.paymentDetails?.transactionId || '-'}</div>
                </div>
              </div>
              <div className="mb-4">
                <div className="text-gray-700 font-medium mb-2">Montant total :</div>
                <div className="text-lg font-bold text-primary">{selectedOrder.totalAmount ? selectedOrder.totalAmount.toLocaleString() : 0} FCFA</div>
              </div>
              {/* Actions optionnelles */}
              <div className="flex gap-3 mt-4">
                <button className="bg-primary text-white px-4 py-2 rounded font-semibold hover:bg-primary-dark transition">Contacter le support</button>
                {/* <button className="bg-gray-200 text-gray-700 px-4 py-2 rounded font-semibold hover:bg-gray-300 transition">Annuler la commande</button> */}
                {/* <button className="bg-green-200 text-green-700 px-4 py-2 rounded font-semibold hover:bg-green-300 transition">Télécharger la facture</button> */}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
