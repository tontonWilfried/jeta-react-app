import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, orderBy, addDoc, serverTimestamp, onSnapshot, doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from '../firebaseConfig';
import { FiSend } from 'react-icons/fi';
import { toast } from 'react-toastify';

const DiscussionChat = ({ sellerUid, clientUid, isSeller }) => {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [otherUser, setOtherUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const chatContainerRef = useRef(null);
  const lastNotifiedMsgId = useRef(null); // Ajout pour éviter les doublons

  // Générer un ID unique pour le fil client-vendeur (toujours clientUid_sellerUid)
  const realClientUid = clientUid;
  const realSellerUid = sellerUid;
  const chatId = realClientUid && realSellerUid ? `${realClientUid}_${realSellerUid}` : null;
  // Déterminer le type d'utilisateur courant
  const senderType = isSeller ? 'seller' : 'client';

  // Charger l'autre utilisateur (nom/avatar)
  useEffect(() => {
    const fetchOtherUser = async () => {
      const otherUid = isSeller ? clientUid : sellerUid;
      if (!otherUid) return;
      const userDoc = await getDoc(doc(firestore, 'users', otherUid));
      if (userDoc.exists()) {
        setOtherUser({
          name: userDoc.data().displayName || userDoc.data().name || userDoc.data().email || (isSeller ? 'Client' : 'Vendeur'),
          avatar: userDoc.data().avatarUrl || '',
        });
      }
    };
    fetchOtherUser();
  }, [sellerUid, clientUid, isSeller]);

  // Temps réel Firestore pour les messages
  useEffect(() => {
    if (!chatId) return;
    setLoading(true);
    const q = query(
      collection(firestore, 'clientSellerChats', chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const newMessages = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(newMessages);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [chatId]);

  // Scroll auto en bas du chat
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    // Toujours scroller tout en bas dès qu'il y a un nouveau message
    container.scrollTop = container.scrollHeight;
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !chatId) return;
    
    try {
      // S'assurer que le document de chat parent existe
      const chatDocRef = doc(firestore, 'clientSellerChats', chatId);
      await setDoc(chatDocRef, {
        createdAt: serverTimestamp(),
        lastMessage: input,
        lastMessageTime: serverTimestamp(),
      }, { merge: true });
      
      // Ajouter le message
      await addDoc(collection(firestore, 'clientSellerChats', chatId, 'messages'), {
        text: input,
        senderUid: currentUser.uid,
        senderType,
        createdAt: serverTimestamp(),
        read: false,
      });
      
      setInput('');
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
    }
  };

  // Marquer les messages comme lus seulement quand l'utilisateur les voit vraiment
  useEffect(() => {
    if (!chatId || !currentUser || !messages.length) return;
    
    // Marquer comme lu seulement les messages reçus qui sont visibles
    const unreadMessages = messages.filter(msg => 
      msg.senderUid !== currentUser.uid && msg.read === false
    );
    
    if (unreadMessages.length > 0) {
      // Ajouter un délai pour s'assurer que l'utilisateur a vraiment vu les messages
      const timer = setTimeout(() => {
        unreadMessages.forEach(msg => {
          const msgRef = doc(firestore, 'clientSellerChats', chatId, 'messages', msg.id);
          import('firebase/firestore').then(({ updateDoc }) => {
            updateDoc(msgRef, { read: true }).catch(error => {
              console.error('Erreur lors du marquage comme lu:', error);
            });
          });
        });
      }, 2000); // Délai de 2 secondes pour s'assurer que l'utilisateur a vu les messages
      
      return () => clearTimeout(timer);
    }
  }, [chatId, currentUser, messages]);

  return (
    <div className="bg-white rounded-2xl shadow p-4 flex flex-col border border-[#b3e0f7] min-h-[60vh]">
      {/* Header autre utilisateur */}
      <div className="flex items-center gap-3 mb-4 pb-2 border-b border-blue-50">
        {otherUser?.avatar ? (
          <img src={otherUser.avatar} alt="avatar" className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-xl text-[#4FC3F7] font-bold">
            {otherUser?.name?.[0]}
          </div>
        )}
        <div className="font-bold text-lg text-[#4FC3F7]">{otherUser?.name || (isSeller ? 'Client' : 'Vendeur')}</div>
      </div>
      {/* Fil de discussion */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto mb-2" style={{ maxHeight: '50vh' }}>
        {loading ? (
          <div className="text-center text-gray-400 py-8">Chargement...</div>
        ) : messages.length === 0 ? (
          <div className="text-gray-400">Aucun message</div>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.senderUid === currentUser.uid ? 'justify-end' : 'justify-start'}`}>
                <div className={`rounded-2xl px-4 py-2 shadow text-sm max-w-[70%] break-words ${msg.senderUid === currentUser.uid ? 'bg-gradient-to-br from-[#e3f0ff] to-[#f6fafd] text-[#1976d2] border border-[#b3cfff]' : 'bg-gradient-to-br from-[#e3fae3] to-[#f6fafd] text-[#00C853] border border-[#b3f7b3]'}`}>
                  <span className="block font-semibold mb-1 text-xs opacity-70">{msg.senderUid === currentUser.uid ? 'Moi' : otherUser?.name || (isSeller ? 'Client' : 'Vendeur')}</span>
                  {msg.text}
                  {msg.createdAt?.toDate && (
                    <span className="block text-[0.8em] text-gray-400 mt-1 text-right font-mono">{msg.createdAt.toDate().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Input */}
      <form onSubmit={sendMessage} className="flex gap-2 mt-auto">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Écrire un message..."
          className="flex-1 rounded-full border border-[#4FC3F7] px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4FC3F7] bg-[#fafdff]"
          autoComplete="off"
          maxLength={500}
        />
        <button
          type="submit"
          className="bg-[#4FC3F7] text-white px-5 py-2 rounded-full font-bold shadow hover:bg-[#0288D1] transition disabled:opacity-50"
          disabled={!input.trim()}
        >
          <FiSend size={20} />
        </button>
      </form>
    </div>
  );
};

export default DiscussionChat; 