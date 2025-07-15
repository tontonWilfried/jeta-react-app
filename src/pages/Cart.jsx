// src/pages/Cart.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { firestore } from '../firebaseConfig';
import { collection, doc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { FaTrash, FaMinus, FaPlus, FaShoppingBag, FaCreditCard, FaMobileAlt, FaMoneyBillWave } from 'react-icons/fa';
import { toast } from 'react-toastify';

// Couleurs Tailwind
const OM_CLASS = 'text-orange-400';
const MTN_CLASS = 'text-yellow-400';

const Cart = () => {
  // Patch défensif : empêche tout submit accidentel d'un <form>
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'FORM') e.preventDefault();
    };
    window.addEventListener('submit', handler, true);
    return () => window.removeEventListener('submit', handler, true);
  }, []);
  const { currentUser } = useAuth();
  const { cartItems, cartItemCount, loading, updateQuantity, removeFromCart, clearCart } = useCart();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('cash');
  const [productsData, setProductsData] = useState({});
  // Pour stocker les infos Mobile Money des vendeurs
  const [sellersMobileMoney, setSellersMobileMoney] = useState({});
  const [payerPhone, setPayerPhone] = useState('');
  const [deliveryType, setDeliveryType] = useState('delivery'); // 'delivery' ou 'pickup'
  const [selectedItems, setSelectedItems] = useState([]); // productId[]
  const [partialCheckoutLoading, setPartialCheckoutLoading] = useState(false);

  // Charger les données des produits
  useEffect(() => {
    if (cartItems.length > 0) {
      loadProductsData();
      loadSellersMobileMoney();
    }
  }, [cartItems]);

  const loadProductsData = async () => {
    try {
      const products = {};
      for (const item of cartItems) {
        const productRef = doc(firestore, 'products', item.productId);
        const productDoc = await getDoc(productRef);
        
        if (productDoc.exists()) {
          const productData = productDoc.data();
          products[item.productId] = {
            ...productData,
            isAvailable: productData.stock >= item.quantity && productData.isVisible
          };
        } else {
          products[item.productId] = {
            name: 'Produit supprimé',
            price: 0,
            imageUrl: 'https://via.placeholder.com/80',
            stock: 0,
            sellerName: 'Vendeur',
            isAvailable: false
          };
        }
      }
      setProductsData(products);
    } catch (error) {
      console.error('Erreur lors du chargement des produits:', error);
    }
  };

  // Récupérer les infos Mobile Money de chaque vendeur du panier
  const loadSellersMobileMoney = async () => {
    const sellers = {};
    const uniqueSellerUids = Array.from(new Set(cartItems.map(item => item.sellerUid)));
    for (const uid of uniqueSellerUids) {
      try {
        const userRef = doc(firestore, 'users', uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          sellers[uid] = {
            orangeName: data.orangeName || '',
            orangeNumber: data.orangeNumber || '',
            mtnName: data.mtnName || '',
            mtnNumber: data.mtnNumber || '',
          };
        }
      } catch {}
    }
    setSellersMobileMoney(sellers);
  };

  // Calculer le total du panier
  const cartTotal = cartItems.reduce((total, item) => {
    return total + (item.price || 0) * item.quantity;
  }, 0);
  const deliveryFee = deliveryType === 'delivery' ? 1000 : 0;
  const totalWithDelivery = cartTotal + deliveryFee;

  // Calcul du total sélectionné
  const selectedTotal = cartItems.filter(item => selectedItems.includes(item.productId)).reduce((total, item) => total + (item.price || 0) * item.quantity, 0);
  const selectedTotalWithDelivery = selectedTotal + (deliveryType === 'delivery' && selectedItems.length > 0 ? 1000 : 0);

  // Passer la commande
  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      toast.error('Votre panier est vide');
      return;
    }
    if (selectedPaymentMethod === 'mobile_money' && (!payerPhone || payerPhone.trim().length < 8)) {
      toast.error('Merci de renseigner le numéro utilisé pour le paiement Mobile Money.');
      return;
    }

    setCheckoutLoading(true);
    try {
      // Récupérer les informations du profil utilisateur
      let userProfile = {};
      try {
        const userDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
        if (userDoc.exists()) {
          userProfile = userDoc.data();
        }
      } catch (error) {
        console.error('Erreur lors de la récupération du profil:', error);
      }

      // Créer la commande avec les données complètes des produits
      const orderItems = cartItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        pricePerItem: item.price,
        productName: item.productName,
        imageUrl: item.imageUrl,
        sellerUid: item.sellerUid,
        sellerName: item.sellerName
      }));

      const orderData = {
        userId: currentUser.uid,
        items: orderItems,
        total: cartTotal,
        deliveryFee: deliveryFee,
        totalAmount: totalWithDelivery,
        status: 'pending',
        paymentMethod: selectedPaymentMethod,
        deliveryType: deliveryType, // Ajouté
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        buyerName: currentUser.displayName || currentUser.name || currentUser.email || currentUser.uid,
        buyerEmail: currentUser.email || '',
        paymentDetails: {
          method: selectedPaymentMethod,
          transactionId: null,
          payerPhone: selectedPaymentMethod === 'mobile_money' ? payerPhone : null,
        },
        shippingAddress: {
          fullName: userProfile.displayName || currentUser.displayName || '',
          phoneNumber: userProfile.telephone || userProfile.phoneNumber || '',
          quartier: userProfile.quartier || '',
          city: userProfile.ville || '',
          country: 'Cameroun'
        }
      };

      const orderRef = await addDoc(collection(firestore, 'orders'), orderData);

      // Vider le panier
      await clearCart();
      
      
      // Rediriger vers le suivi de commande
      // navigate(`/order-tracking/${orderRef.id}`);
      
    } catch (error) {
      console.error('Erreur lors du passage de commande:', error);
      toast.error('Erreur lors du passage de commande');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Paiement partiel (seulement les articles sélectionnés)
  const handlePartialCheckout = async () => {
    if (selectedItems.length === 0) return;
    if (selectedPaymentMethod === 'mobile_money' && (!payerPhone || payerPhone.trim().length < 8)) {
      toast.error('Merci de renseigner le numéro utilisé pour le paiement Mobile Money.');
      return;
    }
    setPartialCheckoutLoading(true);
    try {
      let userProfile = {};
      try {
        const userDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
        if (userDoc.exists()) {
          userProfile = userDoc.data();
        }
      } catch {}
      const orderItems = cartItems.filter(item => selectedItems.includes(item.productId)).map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        pricePerItem: item.price,
        productName: item.productName,
        imageUrl: item.imageUrl,
        sellerUid: item.sellerUid,
        sellerName: item.sellerName
      }));
      const orderData = {
        userId: currentUser.uid,
        items: orderItems,
        total: selectedTotal,
        deliveryFee: deliveryType === 'delivery' ? 1000 : 0,
        totalAmount: selectedTotalWithDelivery,
        status: 'pending',
        paymentMethod: selectedPaymentMethod,
        deliveryType: deliveryType,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        buyerName: currentUser.displayName || currentUser.name || currentUser.email || currentUser.uid,
        buyerEmail: currentUser.email || '',
        paymentDetails: {
          method: selectedPaymentMethod,
          transactionId: null,
          payerPhone: selectedPaymentMethod === 'mobile_money' ? payerPhone : null,
        },
        shippingAddress: {
          fullName: userProfile.displayName || currentUser.displayName || '',
          phoneNumber: userProfile.telephone || userProfile.phoneNumber || '',
          quartier: userProfile.quartier || '',
          city: userProfile.ville || '',
          country: 'Cameroun'
        }
      };
      await addDoc(collection(firestore, 'orders'), orderData);
      // Retirer du panier les articles payés
      for (const pid of selectedItems) {
        removeFromCart(pid);
      }
      setSelectedItems([]);
      toast.success('Commande partielle enregistrée !');
    } catch (error) {
      toast.error('Erreur lors du paiement partiel');
    } finally {
      setPartialCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-page-bg text-main min-h-screen">
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white shadow-xl rounded-lg p-6 md:p-10">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex space-x-4">
                    <div className="w-20 h-20 bg-gray-200 rounded"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-page-bg text-main min-h-screen">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-xl rounded-lg p-6 md:p-10">
          <h1 className="text-3xl md:text-4xl font-bold text-primary mb-6">
            Mon Panier ({cartItemCount} article{cartItemCount > 1 ? 's' : ''})
          </h1>
          
          {cartItems.length === 0 ? (
            <div className="text-center py-10">
              <FaShoppingBag className="text-6xl text-gray-300 mx-auto mb-4" />
              <p className="text-xl text-gray-500 mb-4">Votre panier est actuellement vide.</p>
              <Link
                to="/brocante-live"
                className="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-lg font-semibold transition-colors duration-300"
              >
                Commencer mes achats
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Liste des articles */}
              <div className="lg:col-span-2">
                <h2 className="text-xl font-semibold text-primary mb-4">Articles dans votre panier</h2>
                <div className="space-y-4">
                  {cartItems.map((item) => (
                    <div key={item.productId} className={`border rounded-lg p-4 bg-white`}>
                      <div className="flex space-x-4">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item.productId)}
                          onChange={e => {
                            if (e.target.checked) setSelectedItems([...selectedItems, item.productId]);
                            else setSelectedItems(selectedItems.filter(id => id !== item.productId));
                          }}
                          className="w-5 h-5 text-primary mt-2"
                        />
                        <img
                          src={item.imageUrl || 'https://via.placeholder.com/80'}
                          alt={item.productName}
                          className="w-20 h-20 object-cover rounded-lg"
                        />
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{item.productName}</h3>
                          <p className="text-gray-600 text-sm">Vendeur: {item.sellerName}</p>
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => { console.log('click -', item.productId, item.quantity - 1); updateQuantity(item.productId, item.quantity - 1); }}
                                className="p-1 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                                disabled={item.quantity <= 1}
                              >
                                <FaMinus className="w-3 h-3" />
                              </button>
                              <span className="w-8 text-center">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => { console.log('click +', item.productId, item.quantity + 1); updateQuantity(item.productId, item.quantity + 1); }}
                                className="p-1 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                              >
                                <FaPlus className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-lg">{item.price * item.quantity} FCFA</p>
                              <p className="text-sm text-gray-500">{item.price} FCFA l'unité</p>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => { console.log('click remove', item.productId); removeFromCart(item.productId); }}
                          className="text-red-500 hover:text-red-700 p-2"
                        >
                          <FaTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Résumé de la commande */}
              <div className="lg:col-span-1">
                <div className="bg-gray-50 rounded-lg p-6 sticky top-4">
                  <h2 className="text-xl font-semibold text-primary mb-4">Résumé de la commande</h2>
                  
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between">
                      <span>Sous-total ({cartItemCount} article{cartItemCount > 1 ? 's' : ''})</span>
                      <span>{cartTotal} FCFA</span>
                    </div>
                    {/* Paiement partiel */}
                    <div className="flex flex-col gap-2 mb-2">
                      <button
                        onClick={handlePartialCheckout}
                        disabled={selectedItems.length === 0 || partialCheckoutLoading}
                        className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors duration-300 mb-2 ${selectedItems.length === 0 || partialCheckoutLoading ? 'bg-gray-300 cursor-not-allowed' : 'bg-primary text-white hover:bg-primary-dark'}`}
                      >
                        {partialCheckoutLoading ? 'Paiement...' : `Payer la sélection (${selectedTotalWithDelivery.toLocaleString()} FCFA)`}
                      </button>
                    </div>
                    {/* Choix livraison ou retrait */}
                    <div className="flex flex-col gap-2 mb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="deliveryType"
                          value="delivery"
                          checked={deliveryType === 'delivery'}
                          onChange={() => setDeliveryType('delivery')}
                        />
                        <span className="font-medium text-main">livraison à domicile</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="deliveryType"
                          value="pickup"
                          checked={deliveryType === 'pickup'}
                          onChange={() => setDeliveryType('pickup')}
                        />
                        <span className="font-medium text-main">pas de frais de livraison</span>
                      </label>
                    </div>
                    <div className="flex justify-between">
                      <span>Livraison</span>
                      <span className="text-main">{deliveryFee} FCFA</span>
                    </div>
                    <hr className="border-gray-300" />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span>{totalWithDelivery} FCFA</span>
                    </div>
                  </div>

                  {/* Méthode de paiement */}
                  <div className="mb-6">
                    <h3 className="font-semibold text-primary mb-3">Méthode de paiement</h3>
                    <div className="space-y-2">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="radio"
                          name="payment"
                          value="mobile_money"
                          checked={selectedPaymentMethod === 'mobile_money'}
                          onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                          className="text-primary"
                        />
                        <FaMobileAlt className="text-green-600" />
                        <span>Mobile Money (Orange/MTN)</span>
                      </label>
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="radio"
                          name="payment"
                          value="cash"
                          checked={selectedPaymentMethod === 'cash'}
                          onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                          className="text-primary"
                        />
                        <FaMoneyBillWave className="text-green-600" />
                        <span>Espèce (à la livraison)</span>
                      </label>
                    </div>
                    {/* Affichage infos Mobile Money vendeur et champ numéro paiement */}
                    {selectedPaymentMethod === 'mobile_money' && (
                      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-bold text-primary mb-2">Informations de paiement Mobile Money</h4>
                        {Object.keys(sellersMobileMoney).length === 0 ? (
                          <div className="text-gray-500 text-sm">Chargement des infos vendeur...</div>
                        ) : (
                          <ul className="mb-3 space-y-2">
                            {Object.entries(sellersMobileMoney).map(([uid, info]) => (
                              <li key={uid} className="text-sm">
                                <div className="mb-1">
                                  <span className="font-semibold">Vendeur :</span> {info.orangeName || info.mtnName || '-'}
                                </div>
                                {info.orangeNumber && (
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-mono">{info.orangeNumber}</span>
                                    <span className={`uppercase text-xs px-2 py-0.5 rounded ${OM_CLASS}`}>Orange Money</span>
                                    {info.orangeName && <span className="text-xs text-gray-500 ml-2">({info.orangeName})</span>}
                                  </div>
                                )}
                                {info.mtnNumber && (
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-mono">{info.mtnNumber}</span>
                                    <span className={`uppercase text-xs px-2 py-0.5 rounded ${MTN_CLASS}`}>MTN Mobile Money</span>
                                    {info.mtnName && <span className="text-xs text-gray-500 ml-2">({info.mtnName})</span>}
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                        <label className="block font-semibold text-primary mb-1 mt-2">Numéro utilisé pour le paiement <span className="text-red-500">*</span></label>
                        <input
                          type="tel"
                          value={payerPhone}
                          onChange={e => setPayerPhone(e.target.value)}
                          className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="Ex: 6XXXXXXXX"
                          required={selectedPaymentMethod === 'mobile_money'}
                        />
                        <p className="text-xs text-gray-500 mt-1">Saisis le numéro avec lequel tu vas effectuer le paiement Mobile Money pour faciliter la validation par le vendeur.</p>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleCheckout}
                    disabled={checkoutLoading || cartItems.length === 0}
                    className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors duration-300 ${
                      checkoutLoading || cartItems.length === 0
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-accent-green hover:bg-green-600 text-white'
                    }`}
                  >
                    {checkoutLoading ? 'Traitement...' : 'Passer la commande'}
                  </button>

                  <p className="text-xs text-gray-500 mt-3 text-center">
                    En passant cette commande, vous acceptez nos conditions de vente.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Cart;
