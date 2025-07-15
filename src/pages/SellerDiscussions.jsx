import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { firestore } from '../firebaseConfig';
import { FiMessageCircle, FiSearch, FiHeadphones } from 'react-icons/fi';
import DiscussionChat from './DiscussionChat';
import { useLocation } from 'react-router-dom';
import { useDiscussionSelection } from '../contexts/DiscussionSelectionContext';
import { onSnapshot } from 'firebase/firestore';
import ChatSupportClient from './ChatSupportClient';

const SellerDiscussions = () => {
  const { currentUser } = useAuth();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const clientUidFromUrl = params.get('clientUid');
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [selectedClientUid, setSelectedClientUid] = useState(clientUidFromUrl || null);
  const [searchClient, setSearchClient] = useState('');
  const [unreadCounts, setUnreadCounts] = useState({}); // { clientUid: count }
  const [lastMessages, setLastMessages] = useState({}); // { clientUid: { text, createdAt } }
  const { selectedDiscussionUid, setSelectedDiscussionUid } = useDiscussionSelection();

  // Charger la liste des clients du vendeur + infos messages
  useEffect(() => {
    if (!currentUser) return;
    const fetchClients = async () => {
      setLoadingClients(true);
      const ordersRef = collection(firestore, 'orders');
      const q = query(ordersRef);
      const snap = await getDocs(q);
      const clientUids = new Set();
      snap.docs.forEach(docSnap => {
        const order = docSnap.data();
        if (Array.isArray(order.items)) {
          order.items.forEach(item => {
            if (item.sellerUid === currentUser.uid && order.userId) clientUids.add(order.userId);
          });
        }
      });
      const clientsList = [];
      const unread = {};
      const lastMsg = {};
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
        // Récupérer les messages pour ce client
        const chatId = `${uid}_${currentUser.uid}`;
        const msgsSnap = await getDocs(query(collection(firestore, 'clientSellerChats', chatId, 'messages'), orderBy('createdAt', 'desc')));
        let unreadCount = 0;
        let last = null;
        msgsSnap.forEach(docSnap => {
          const msg = docSnap.data();
          if (!last) last = { text: msg.text, createdAt: msg.createdAt };
          if (msg.senderUid === uid && msg.read === false) unreadCount++;
        });
        unread[uid] = unreadCount;
        lastMsg[uid] = last;
      }
      // Trier par date du dernier message (plus récent en haut)
      clientsList.sort((a, b) => {
        const dateA = lastMsg[a.uid]?.createdAt?.toDate ? lastMsg[a.uid].createdAt.toDate() : new Date(0);
        const dateB = lastMsg[b.uid]?.createdAt?.toDate ? lastMsg[b.uid].createdAt.toDate() : new Date(0);
        return dateB - dateA;
      });
      setClients(clientsList);
      setUnreadCounts(unread);
      setLastMessages(lastMsg);
      setLoadingClients(false);
    };
    fetchClients();
  }, [currentUser, clientUidFromUrl]);

  // Synchroniser la sélection avec l'URL
  useEffect(() => {
    if (clientUidFromUrl) setSelectedClientUid(clientUidFromUrl);
  }, [clientUidFromUrl]);

  // Pré-sélectionner la discussion si le contexte est défini
  useEffect(() => {
    if (selectedDiscussionUid) {
      setSelectedClientUid(selectedDiscussionUid);
      setSelectedDiscussionUid(null); // reset après ouverture
    }
  }, [selectedDiscussionUid, setSelectedDiscussionUid]);

  // Badges non lus en temps réel
  useEffect(() => {
    if (!currentUser) return;
    let unsubscribes = [];
    const listenUnread = async () => {
      const ordersRef = collection(firestore, 'orders');
      const q = query(ordersRef);
      const snap = await getDocs(q);
      const clientUids = new Set();
      snap.docs.forEach(docSnap => {
        const order = docSnap.data();
        if (Array.isArray(order.items)) {
          order.items.forEach(item => {
            if (item.sellerUid === currentUser.uid && order.userId) clientUids.add(order.userId);
          });
        }
      });
      const unread = {};
      const lastMsg = {};
      for (const uid of clientUids) {
        const chatId = `${uid}_${currentUser.uid}`;
        const msgsRef = collection(firestore, 'clientSellerChats', chatId, 'messages');
        const unsub = onSnapshot(query(msgsRef, orderBy('createdAt', 'desc')), (msgsSnap) => {
          let unreadCount = 0;
          let last = null;
          msgsSnap.forEach(docSnap => {
            const msg = docSnap.data();
            if (!last) last = { text: msg.text, createdAt: msg.createdAt };
            if (msg.senderUid === uid && msg.read === false) unreadCount++;
          });
          unread[uid] = unreadCount;
          lastMsg[uid] = last;
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
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchClient.toLowerCase()) ||
    client.email.toLowerCase().includes(searchClient.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-page-bg p-6 font-poppins">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-8">
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
                      {unreadCounts[client.uid] > 0 && (
                        <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5 font-bold">{unreadCounts[client.uid]}</span>
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
          {selectedClientUid === 'support' ? (
            <ChatSupportClient />
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
    </div>
  );
};

export default SellerDiscussions; 