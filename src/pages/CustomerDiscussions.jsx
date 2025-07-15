import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { firestore } from '../firebaseConfig';
import { FiMessageCircle, FiSearch, FiHeadphones } from 'react-icons/fi';
import DiscussionChat from './DiscussionChat';
import ChatSupportClient from './ChatSupportClient';
import { useLocation } from 'react-router-dom';
import { useDiscussionSelection } from '../contexts/DiscussionSelectionContext';
import { onSnapshot } from 'firebase/firestore';

const CustomerDiscussions = () => {
  const { currentUser } = useAuth();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const sellerUidFromUrl = params.get('sellerUid');
  const { selectedDiscussionUid, setSelectedDiscussionUid } = useDiscussionSelection();
  const [sellers, setSellers] = useState([]);
  const [loadingSellers, setLoadingSellers] = useState(true);
  const [selectedSellerUid, setSelectedSellerUid] = useState(sellerUidFromUrl || null);
  const [searchSeller, setSearchSeller] = useState('');
  const [unreadCounts, setUnreadCounts] = useState({}); // { sellerUid: count }
  const [lastMessages, setLastMessages] = useState({}); // { sellerUid: { text, createdAt } }

  // Charger la liste des vendeurs avec qui le client a eu des commandes
  useEffect(() => {
    if (!currentUser) return;
    const fetchSellers = async () => {
      setLoadingSellers(true);
      // Chercher toutes les commandes du client
      const ordersRef = collection(firestore, 'orders');
      const q = query(ordersRef, where('userId', '==', currentUser.uid));
      const snap = await getDocs(q);
      // Extraire tous les sellerUid uniques
      const sellerUids = new Set();
      snap.docs.forEach(docSnap => {
        const order = docSnap.data();
        if (Array.isArray(order.items)) {
          order.items.forEach(item => {
            if (item.sellerUid) sellerUids.add(item.sellerUid);
          });
        }
      });
      // Récupérer les infos vendeurs
      const sellersList = [];
      for (const uid of sellerUids) {
        const userDoc = await getDoc(doc(firestore, 'users', uid));
        if (userDoc.exists()) {
          sellersList.push({
            uid,
            name: userDoc.data().displayName || userDoc.data().name || userDoc.data().email || 'Vendeur',
            email: userDoc.data().email || '',
            avatar: userDoc.data().avatarUrl || '',
          });
        }
      }
      // Enrichir la liste avec le sellerUid de l'URL si besoin
      if (sellerUidFromUrl && !sellersList.some(s => s.uid === sellerUidFromUrl)) {
        sellersList.push({
          uid: sellerUidFromUrl,
          name: sellerUidFromUrl,
          email: '',
          avatar: '',
        });
      }
      setSellers(sellersList);
      setLoadingSellers(false);
    };
    fetchSellers();
  }, [currentUser, sellerUidFromUrl]);

  // Synchroniser la sélection avec l'URL
  useEffect(() => {
    if (sellerUidFromUrl) setSelectedSellerUid(sellerUidFromUrl);
  }, [sellerUidFromUrl]);

  // Pré-sélectionner la discussion si le contexte est défini
  useEffect(() => {
    if (selectedDiscussionUid) {
      setSelectedSellerUid(selectedDiscussionUid);
      setSelectedDiscussionUid(null);
    }
  }, [selectedDiscussionUid, setSelectedDiscussionUid]);

  // Badges non lus en temps réel
  useEffect(() => {
    if (!currentUser) return;
    let unsubscribes = [];
    const listenUnread = async () => {
      const ordersRef = collection(firestore, 'orders');
      const q = query(ordersRef, where('userId', '==', currentUser.uid));
      const snap = await getDocs(q);
      const sellerUids = new Set();
      snap.docs.forEach(docSnap => {
        const order = docSnap.data();
        if (Array.isArray(order.items)) {
          order.items.forEach(item => {
            if (item.sellerUid) sellerUids.add(item.sellerUid);
          });
        }
      });
      for (const uid of sellerUids) {
        const chatId = `${currentUser.uid}_${uid}`;
        const msgsRef = collection(firestore, 'clientSellerChats', chatId, 'messages');
        const unsub = onSnapshot(query(msgsRef, orderBy('createdAt', 'desc')), (msgsSnap) => {
          let unreadCount = 0;
          let last = null;
          msgsSnap.forEach(docSnap => {
            const msg = docSnap.data();
            if (!last) last = { text: msg.text, createdAt: msg.createdAt };
            if (msg.senderUid === uid && msg.read === false) unreadCount++;
          });
          setUnreadCounts(prev => ({ ...prev, [uid]: unreadCount }));
          setLastMessages(prev => ({ ...prev, [uid]: last }));
        });
        unsubscribes.push(unsub);
      }
    };
    listenUnread();
    return () => { unsubscribes.forEach(unsub => unsub()); };
  }, [currentUser]);

  // Filtrage par recherche
  const filteredSellers = sellers.filter(seller =>
    seller.name.toLowerCase().includes(searchSeller.toLowerCase()) ||
    seller.email.toLowerCase().includes(searchSeller.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-page-bg p-6 font-poppins">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-8">
        {/* Colonne gauche : liste vendeurs + support */}
        <div className="bg-white rounded-2xl shadow p-4 flex flex-col border border-[#b3e0f7] max-w-xs w-full min-h-[60vh]">
          <div className="flex items-center gap-2 mb-4">
            <FiMessageCircle className="text-[#4FC3F7]" size={24} />
            <span className="font-bold text-lg text-[#4FC3F7]">Discussions</span>
          </div>
          {/* Bouton support */}
          <button
            className="flex items-center gap-2 px-3 py-2 mb-3 rounded-xl bg-gradient-to-br from-[#e3f0ff] to-[#f6fafd] text-[#4FC3F7] font-semibold shadow hover:bg-[#b3e0f7] border border-[#b3e0f7] transition"
            onClick={() => setSelectedSellerUid('support')}
          >
            <FiHeadphones /> Discuter avec le support
          </button>
          {/* Barre de recherche */}
          <div className="relative mb-3">
            <input
              type="text"
              value={searchSeller}
              onChange={e => setSearchSeller(e.target.value)}
              placeholder="Rechercher un vendeur..."
              className="w-full rounded-full border border-[#b3e0f7] px-4 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-[#4FC3F7] bg-[#fafdff]"
            />
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b3e0f7]" />
          </div>
          {/* Liste vendeurs */}
          <div className="flex-1 overflow-y-auto">
            {loadingSellers ? (
              <div className="text-center text-gray-400 py-8">Chargement...</div>
            ) : filteredSellers.length === 0 ? (
              <div className="text-center text-gray-400 py-8">Aucun vendeur trouvé.</div>
            ) : (
              <ul className="space-y-2">
                {filteredSellers.map(seller => (
                  <li key={seller.uid}>
                    <button
                      className={`w-full text-left px-3 py-2 rounded-xl border flex items-center gap-3 ${selectedSellerUid === seller.uid ? 'bg-blue-100 border-blue-300 font-bold' : 'bg-gray-50 border-gray-200'} hover:bg-blue-50 transition`}
                      onClick={() => setSelectedSellerUid(seller.uid)}
                    >
                      {seller.avatar ? (
                        <img src={seller.avatar} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-base text-[#4FC3F7] font-bold">
                          {seller.name[0]}
                        </div>
                      )}
                      <span className="truncate flex-1 text-[#4FC3F7]">{seller.name}</span>
                      <span className="text-xs bg-[#e3f0ff] text-[#4FC3F7] px-2 py-1 rounded-full font-semibold ml-2">Vendeur</span>
                      {unreadCounts[seller.uid] > 0 && (
                        <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5 font-bold">{unreadCounts[seller.uid]}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {/* Colonne droite : chat */}
        <div className="flex-1 min-w-[300px]">
          {selectedSellerUid === 'support' ? (
            <ChatSupportClient />
          ) : selectedSellerUid ? (
            <DiscussionChat sellerUid={selectedSellerUid} clientUid={currentUser.uid} isSeller={false} />
          ) : (
            <div className="bg-white rounded-2xl shadow p-8 flex flex-col items-center justify-center border border-[#b3e0f7] min-h-[60vh] text-center">
              <FiMessageCircle className="text-[#4FC3F7] mb-3" size={40} />
              <div className="font-bold text-xl mb-2 text-[#4FC3F7]">Bienvenue dans vos discussions</div>
              <div className="text-gray-500">Sélectionnez un vendeur à gauche pour démarrer une conversation.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerDiscussions; 