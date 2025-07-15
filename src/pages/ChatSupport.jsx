// src/pages/ChatSupport.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { firestore } from '../firebaseConfig';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, setDoc, doc } from 'firebase/firestore';

const ChatSupport = () => {
  const { currentUser, userData } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  const userId = currentUser?.uid;
  const userName = userData?.displayName || userData?.name || currentUser?.displayName || currentUser?.name || currentUser?.email || 'Utilisateur';

  // Récupérer les messages en temps réel pour ce user
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    const q = query(
      collection(firestore, 'support_chats', userId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [userId]);

  // Scroll auto en bas
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    if (isNearBottom || messages.length <= 2) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  // Envoi d'un message
  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !userId) return;
    // S'assurer que le doc parent existe
    await setDoc(doc(firestore, 'support_chats', userId), { createdAt: serverTimestamp() }, { merge: true });
    await addDoc(collection(firestore, 'support_chats', userId, 'messages'), {
      text: newMessage.trim(),
      sender: 'user',
      userName,
      createdAt: serverTimestamp(),
      read: false,
    });
    setNewMessage('');
  };

  return (
    <div className="bg-page-bg text-main min-h-screen">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-xl rounded-lg p-6 md:p-10 max-w-2xl mx-auto flex flex-col min-h-[70vh]">
          <h1 className="text-3xl md:text-4xl font-bold text-primary mb-6">
            Chat & Support Client
          </h1>
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto mb-4 px-1" style={{ maxHeight: '55vh' }}>
            {loading ? (
              <div className="text-center text-gray-400 py-8">Chargement du chat...</div>
            ) : messages.length === 0 ? (
              <div className="text-center text-gray-400 py-8">Aucun message. Démarrez la conversation !</div>
            ) : (
              <div className="flex flex-col gap-3">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`rounded-2xl px-4 py-2 shadow text-sm max-w-[70%] break-words ${
                        msg.sender === 'user'
                          ? 'bg-gradient-to-br from-[#e3f0ff] to-[#f6fafd] text-[#1976d2] border border-[#b3cfff]'
                          : 'bg-gradient-to-br from-[#e3fae3] to-[#f6fafd] text-[#00C853] border border-[#b3f7b3]'
                      }`}
                    >
                      <span className="block font-semibold mb-1 text-xs opacity-70">
                        {msg.sender === 'user' ? 'Moi' : 'Support'}
                      </span>
                      {msg.text}
                      {msg.createdAt?.toDate && (
                        <span className="block text-[0.8em] text-gray-400 mt-1 text-right font-mono">{msg.createdAt.toDate().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
          <form onSubmit={handleSend} className="flex gap-2 mt-auto">
            <input
              type="text"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Écrivez votre message..."
              className="flex-1 rounded-full border border-[#4FC3F7] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4FC3F7] bg-[#fafdff]"
              autoComplete="off"
              maxLength={500}
            />
            <button
              type="submit"
              className="bg-[#4FC3F7] text-white px-6 py-2 rounded-full font-bold shadow hover:bg-[#0288D1] transition disabled:opacity-50"
              disabled={!newMessage.trim()}
            >
              Envoyer
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default ChatSupport;
