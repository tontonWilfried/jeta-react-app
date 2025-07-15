import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, orderBy, addDoc, serverTimestamp, getDocs, doc, onSnapshot } from 'firebase/firestore';
import { firestore } from '../firebaseConfig';
import { FiHeadphones, FiSend } from 'react-icons/fi';

const ChatSupportClient = () => {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const chatContainerRef = useRef(null);
  const [role, setRole] = useState('client');

  useEffect(() => {
    if (!currentUser) return;
    // Récupérer le rôle utilisateur
    const fetchRole = async () => {
      try {
        const userDoc = await getDocs(query(collection(firestore, 'users'), orderBy('uid')));
        const user = userDoc.docs.find(d => d.id === currentUser.uid);
        if (user && user.data().role === 'seller') setRole('vendeur');
        else setRole('client');
      } catch {}
    };
    fetchRole();
    // Listener temps réel pour les messages support
    const q = query(
      collection(firestore, 'support_chats', currentUser.uid, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser]);

  // Scroll auto en bas du chat
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !currentUser) return;
    await addDoc(collection(firestore, 'support_chats', currentUser.uid, 'messages'), {
      text: input,
      sender: role,
      createdAt: serverTimestamp(),
      read: false,
    });
    setInput('');
  };

  return (
    <div className="bg-white rounded-2xl shadow p-4 flex flex-col border border-[#b3e0f7] min-h-[60vh]">
      <div className="flex items-center gap-3 mb-4 pb-2 border-b border-blue-50">
        <FiHeadphones className="text-[#4FC3F7]" size={28} />
        <div className="font-bold text-lg text-[#4FC3F7]">Support client</div>
      </div>
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto mb-2" style={{ maxHeight: '50vh' }}>
        {loading ? (
          <div className="text-center text-gray-400 py-8">Chargement...</div>
        ) : messages.length === 0 ? (
          <div className="text-gray-400">Aucun message</div>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.sender === 'support' ? 'justify-start' : 'justify-end'}`}>
                <div className={`rounded-2xl px-4 py-2 shadow text-sm max-w-[70%] break-words ${msg.sender === 'support' ? 'bg-gradient-to-br from-[#e3fae3] to-[#f6fafd] text-[#00C853] border border-[#b3f7b3]' : 'bg-gradient-to-br from-[#e3f0ff] to-[#f6fafd] text-[#1976d2] border border-[#b3cfff]'}`}>
                  <span className="block font-semibold mb-1 text-xs opacity-70">{msg.sender === 'support' ? 'Support' : 'Moi'}</span>
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

export default ChatSupportClient; 