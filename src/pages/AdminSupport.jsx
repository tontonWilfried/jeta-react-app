import React, { useEffect, useState, useRef } from 'react';
import { firestore } from '../firebaseConfig';
import { collection, getDocs, query, orderBy, addDoc, serverTimestamp, doc, getDoc, onSnapshot, where, updateDoc } from 'firebase/firestore';
import { FiMessageCircle, FiSearch, FiHeadphones, FiFilter, FiUser, FiClock, FiMoreHorizontal, FiX, FiSend, FiCheck, FiArrowLeft } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function AdminSupport() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]); // [{userId, userInfo, messages: [...], role, unreadCount, lastMsg}]
  const [selectedChat, setSelectedChat] = useState(null); // userId
  const [adminMessage, setAdminMessage] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); // 'all', 'vendeur', 'client'
  const [showFilters, setShowFilters] = useState(false); // State for filter visibility
  const chatContainerRef = useRef(null);
  const userMapRef = useRef({});
  const listenersReadyRef = useRef({});
  const inputRef = useRef(null); // Ref for the input field
  const [isTyping, setIsTyping] = useState(false); // State for typing indicator
  const navigate = useNavigate();

  // Listener temps réel sur tous les fils support pour les badges non lus et tri dynamique
  useEffect(() => {
    if (!currentUser) return;
    let unsubs = [];
    let isMounted = true;
    (async () => {
      // Charger tous les utilisateurs
      const usersSnap = await getDocs(query(collection(firestore, 'users'), where('role', 'in', ['seller', 'client', 'pending_seller'])));
      const userIds = usersSnap.docs.map(docu => docu.id);
      usersSnap.docs.forEach(docu => {
        const data = docu.data();
        userMapRef.current[docu.id] = {
          userId: docu.id,
          userInfo: { id: docu.id, ...data },
          role: data.role === 'seller' || data.role === 'pending_seller' ? 'vendeur' : 'client',
          messages: [],
          lastMsg: null,
          unreadCount: 0,
          isOnline: false, // Added for online status
        };
        listenersReadyRef.current[docu.id] = false;
      });
      // Pour chaque user, écouter son fil support
      userIds.forEach(userId => {
        const q = query(collection(firestore, 'support_chats', userId, 'messages'));
        const unsub = onSnapshot(q, (snap) => {
          let unreadCount = 0;
        let lastMsg = null;
          const messages = snap.docs.map(doc => {
            const data = doc.data();
            if (data.sender !== 'support' && data.read === false) unreadCount++;
            if (!lastMsg || (data.createdAt?.toDate && data.createdAt.toDate() > lastMsg?.createdAt?.toDate?.())) {
              lastMsg = data;
            }
            return { id: doc.id, ...data };
          });
          userMapRef.current[userId] = {
            ...userMapRef.current[userId],
            unreadCount,
            lastMsg,
            messages,
          };
          listenersReadyRef.current[userId] = true;
          // On ne trie et setUsers que si tous les listeners ont répondu au moins une fois
          if (Object.values(listenersReadyRef.current).every(Boolean)) {
            const sorted = Object.values(userMapRef.current).sort((a, b) => {
        if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
        if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
        if (a.lastMsg && b.lastMsg) {
          const aTime = a.lastMsg.createdAt?.toDate ? a.lastMsg.createdAt.toDate().getTime() : 0;
          const bTime = b.lastMsg.createdAt?.toDate ? b.lastMsg.createdAt.toDate().getTime() : 0;
          return bTime - aTime;
        }
        if (a.lastMsg) return -1;
        if (b.lastMsg) return 1;
        // Aucun fil : trier alpha
        const aName = (a.userInfo.displayName || a.userInfo.name || a.userInfo.email || '').toLowerCase();
        const bName = (b.userInfo.displayName || b.userInfo.name || b.userInfo.email || '').toLowerCase();
        return aName.localeCompare(bName);
      });
            setUsers(sorted);
          }
        });
        unsubs.push(unsub);
      });
    })();
    return () => { unsubs.forEach(u => u()); isMounted = false; };
  }, [currentUser]);

  // Scroll auto en bas du chat
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [selectedChat, users]);

  // Listener temps réel sur le chat sélectionné
  useEffect(() => {
    if (!selectedChat) return;
    const q = query(collection(firestore, 'support_chats', selectedChat, 'messages'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setUsers(users => users.map(c => c.userId === selectedChat ? { ...c, messages: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) } : c));
    });
    return () => unsub();
  }, [selectedChat]);

  // Fonction pour marquer tous les messages non lus comme lus quand l'admin ouvre une discussion
  const markSupportMessagesAsRead = async (userId) => {
    const msgsRef = collection(firestore, 'support_chats', userId, 'messages');
    const q = query(msgsRef, where('read', '==', false));
    const msgsSnap = await getDocs(q);
    const updatePromises = msgsSnap.docs.map(msgDoc => updateDoc(msgDoc.ref, { read: true }));
    await Promise.all(updatePromises);
  };

  // Appeler markSupportMessagesAsRead à chaque fois qu'on sélectionne une discussion
  useEffect(() => {
    if (selectedChat) {
      markSupportMessagesAsRead(selectedChat);
    }
  }, [selectedChat]);

  // Auto-sélection du chat depuis la page notifications
  useEffect(() => {
    const selectedChatFromNotifications = localStorage.getItem('adminSelectedSupportChat');
    if (selectedChatFromNotifications && users.some(u => u.userId === selectedChatFromNotifications)) {
      setSelectedChat(selectedChatFromNotifications);
      localStorage.removeItem('adminSelectedSupportChat'); // Nettoyer après utilisation
    }
  }, [users]);

  // Envoi d'un message admin (création du fil si besoin)
  const handleSendAdminMessage = async (e) => {
    e.preventDefault();
    if (!adminMessage.trim() || !selectedChat) return;
    // Créer le fil si besoin
    const chatRef = doc(firestore, 'support_chats', selectedChat);
    const chatSnap = await getDoc(chatRef);
    if (!chatSnap.exists()) {
      await addDoc(collection(firestore, 'support_chats'), { id: selectedChat }); // Optionnel, pour créer le doc parent
    }
    await addDoc(collection(firestore, 'support_chats', selectedChat, 'messages'), {
      text: adminMessage.trim(),
      sender: 'support',
      createdAt: serverTimestamp(),
      read: false,
    });
    setAdminMessage('');
    // Refresh messages
    const messagesSnap = await getDocs(query(collection(firestore, 'support_chats', selectedChat, 'messages'), orderBy('createdAt', 'asc')));
    const messages = messagesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setUsers(users => users.map(c => c.userId === selectedChat ? { ...c, messages } : c));
  };

  // Filtrage par recherche + filtre rôle
  const filteredUsers = users.filter(user =>
    (roleFilter === 'all' || user.role === roleFilter) &&
    ((user.userInfo.displayName || user.userInfo.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (user.userInfo.email || '').toLowerCase().includes(search.toLowerCase()))
  );

  // Total unread messages for the header
  const totalUnread = users.reduce((sum, user) => sum + user.unreadCount, 0);

  // Correction : définir selectedChatObj dans le scope du composant
  const selectedChatObj = users.find(c => c.userId === selectedChat);

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
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-3xl shadow-xl p-8 mb-8 border border-primary/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="flex items-center gap-5 w-full">
            <div className="bg-primary/10 p-4 rounded-2xl flex items-center justify-center shadow-sm">
              <FiHeadphones className="text-primary" size={32} />
            </div>
            <div className="flex flex-col items-center justify-center w-full">
              <h1 className="text-3xl font-extrabold text-primary tracking-tight mb-1 text-center w-full">Support JETA</h1>
              <p className="text-gray-500 text-base font-medium text-center w-full">Gérez les demandes de support utilisateurs</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-5 mt-4 sm:mt-0">
            {totalUnread > 0 && (
              <div className="bg-accent-green/90 text-white px-5 py-2 rounded-full font-bold text-sm shadow animate-pulse">
                {totalUnread} nouveau{totalUnread > 1 ? 'x' : ''} message{totalUnread > 1 ? 's' : ''}
              </div>
            )}
            <div className="text-sm text-gray-400 font-semibold">
              {filteredUsers.length} utilisateur{filteredUsers.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar - Liste des utilisateurs */}
          <div className="lg:col-span-1">
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-primary/20 h-[calc(100vh-200px)] flex flex-col">
              {/* Header sidebar */}
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-lg text-primary">Conversations</h2>
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="p-2 hover:bg-primary/10 rounded-full transition-colors"
                  >
                    <FiFilter className="text-primary" size={18} />
                  </button>
                </div>

                {/* Filtres */}
                <div className={`space-y-3 overflow-hidden transition-all duration-300 ${showFilters ? 'max-h-40' : 'max-h-0'}`}> 
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setRoleFilter('all')}
                      className={`px-4 py-2 rounded-full font-medium text-sm transition-all ${
                        roleFilter === 'all' 
                          ? 'bg-primary text-white shadow-lg' 
                          : 'bg-gray-100 text-primary hover:bg-gray-200'
                      }`}
                    >
                      Tous ({users.length})
                    </button>
                    <button
                      onClick={() => setRoleFilter('vendeur')}
                      className={`px-4 py-2 rounded-full font-medium text-sm transition-all ${
                        roleFilter === 'vendeur' 
                          ? 'bg-primary text-white shadow-lg' 
                          : 'bg-gray-100 text-primary hover:bg-gray-200'
                      }`}
                    >
                      Vendeurs ({users.filter(u => u.role === 'vendeur').length})
                    </button>
                    <button
                      onClick={() => setRoleFilter('client')}
                      className={`px-4 py-2 rounded-full font-medium text-sm transition-all ${
                        roleFilter === 'client' 
                          ? 'bg-accent-green text-white shadow-lg' 
                          : 'bg-gray-100 text-accent-green hover:bg-gray-200'
                      }`}
                    >
                      Clients ({users.filter(u => u.role === 'client').length})
                    </button>
                  </div>
                </div>

          {/* Barre de recherche */}
                <div className="relative mt-4">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un utilisateur..."
                    className="w-full bg-gray-50 border border-primary rounded-2xl px-4 py-3 pl-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                  <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/60" size={18} />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/60 hover:text-primary"
                    >
                      <FiX size={18} />
                    </button>
                  )}
                </div>
              </div>

              {/* Liste des utilisateurs */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-12">
                    <FiUser className="mx-auto text-gray-300 mb-4" size={48} />
                    <p className="text-gray-500">Aucun utilisateur trouvé</p>
                  </div>
                ) : (
                  filteredUsers.map(user => (
                    <div
                      key={user.userId}
                      onClick={() => setSelectedChat(user.userId)}
                      className={`relative p-4 rounded-2xl cursor-pointer transition-all duration-200 group ${
                        selectedChat === user.userId
                          ? 'bg-primary text-white shadow-lg transform scale-[1.02]'
                          : 'bg-white hover:bg-primary/10 shadow-sm hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                      {user.userInfo.avatarUrl ? (
                            <img
                              src={user.userInfo.avatarUrl}
                              alt="Avatar"
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                              selectedChat === user.userId
                                ? 'bg-white/20 text-white'
                                : user.role === 'vendeur'
                                ? 'bg-primary/10 text-primary'
                                : 'bg-accent-green/10 text-accent-green'
                            }`}>
                              {(user.userInfo.displayName || user.userInfo.name || 'U')[0].toUpperCase()}
                            </div>
                          )}
                          {user.isOnline && (
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-accent-green rounded-full border-2 border-white"></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className={`font-semibold truncate ${
                              selectedChat === user.userId ? 'text-white' : 'text-primary'
                            }`}>
                              {user.userInfo.displayName || user.userInfo.name || user.userInfo.email || user.userId}
                            </h3>
                      {user.unreadCount > 0 && (
                              <div className="bg-accent-red text-white text-xs rounded-full px-2 py-1 font-bold min-w-[20px] text-center">
                                {user.unreadCount}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                              selectedChat === user.userId
                                ? 'bg-white/20 text-white'
                                : user.role === 'vendeur'
                                ? 'bg-primary/10 text-primary'
                                : 'bg-accent-green/10 text-accent-green'
                            }`}>
                              {user.role === 'vendeur' ? 'Vendeur' : 'Client'}
                            </span>
                            {user.lastMsg && (
                              <span className={`text-xs flex items-center gap-1 ${
                                selectedChat === user.userId ? 'text-white/70' : 'text-gray-500'
                              }`}>
                                <FiClock size={12} />
                                {user.lastMsg.createdAt?.toDate && 
                                  user.lastMsg.createdAt.toDate().toLocaleTimeString('fr-FR', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })
                                }
                              </span>
                            )}
                          </div>
                          {user.lastMsg && (
                            <p className={`text-sm mt-1 truncate ${
                              selectedChat === user.userId ? 'text-white/80' : 'text-gray-600'
                            }`}>
                              {user.lastMsg.sender === 'support' ? 'Vous: ' : ''}
                              {user.lastMsg.text}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Zone de chat */}
          <div className="lg:col-span-2">
            {selectedChat ? (
              <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-primary/20 h-[calc(100vh-200px)] flex flex-col">
                {/* Header du chat */}
                <div className="p-6 border-b border-gray-100 bg-primary rounded-t-3xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        {selectedChatObj?.userInfo.avatarUrl ? (
                          <img
                            src={selectedChatObj.userInfo.avatarUrl}
                            alt="Avatar"
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg">
                            {(selectedChatObj?.userInfo.displayName || selectedChatObj?.userInfo.name || 'U')[0].toUpperCase()}
                          </div>
                        )}
                        {selectedChatObj?.isOnline && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-accent-green rounded-full border-2 border-white"></div>
                        )}
                      </div>
                      <div>
                        <h2 className="font-bold text-white text-lg">
                          {selectedChatObj?.userInfo.displayName || selectedChatObj?.userInfo.name || selectedChatObj?.userInfo.email}
                        </h2>
                        <p className="text-white/80 text-sm">
                          {selectedChatObj?.role === 'vendeur' ? 'Vendeur' : 'Client'} • 
                          {selectedChatObj?.isOnline ? ' En ligne' : ' Hors ligne'}
                        </p>
                      </div>
                    </div>
                    <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                      <FiMoreHorizontal className="text-white" size={20} />
                    </button>
          </div>
        </div>

                {/* Messages */}
                <div
                  ref={chatContainerRef}
                  className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50"
                >
                  {selectedChatObj?.messages.length === 0 ? (
                    <div className="text-center py-12">
                      <FiMessageCircle className="mx-auto text-gray-300 mb-4" size={48} />
                      <p className="text-gray-500">Aucun message pour le moment</p>
                      <p className="text-gray-400 text-sm mt-2">Envoyez un message pour commencer la conversation</p>
                    </div>
                  ) : (
                    selectedChatObj?.messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender === 'support' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-3 shadow-sm ${
                            msg.sender === 'support'
                              ? 'bg-primary text-white'
                              : 'bg-white text-gray-800 border border-primary'
                          }`}
                        >
                          <div className={`text-xs font-medium mb-1 ${
                            msg.sender === 'support' ? 'text-white/70' : 'text-primary'
                          }`}>
                            {msg.sender === 'support' ? 'Support' : selectedChatObj.userInfo.displayName || 'Utilisateur'}
                          </div>
                          <p className="text-sm leading-relaxed">{msg.text}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className={`text-xs ${
                              msg.sender === 'support' ? 'text-white/60' : 'text-gray-400'
                            }`}>
                              {msg.createdAt?.toDate &&
                                msg.createdAt.toDate().toLocaleString('fr-FR', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              }
                            </span>
                            {msg.sender === 'support' && msg.read && (
                              <FiCheck className="text-white/60" size={14} />
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  {isTyping && (
                    <div className="flex justify-end">
                      <div className="bg-gray-200 rounded-2xl px-4 py-3 max-w-[70%]">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
              </div>

                {/* Zone de saisie */}
                <div className="p-6 border-t border-gray-100 bg-white rounded-b-3xl">
                  <form onSubmit={handleSendAdminMessage} className="flex gap-4">
                <input
                      ref={inputRef}
                  type="text"
                  value={adminMessage}
                  onChange={e => setAdminMessage(e.target.value)}
                      placeholder="Tapez votre message..."
                      className="flex-1 bg-gray-50 border border-primary rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  maxLength={500}
                      disabled={isTyping}
                />
                <button
                  type="submit"
                      disabled={!adminMessage.trim() || isTyping}
                      className="bg-primary text-white px-6 py-3 rounded-2xl font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                      <FiSend size={18} />
                  Envoyer
                </button>
              </form>
                </div>
            </div>
          ) : (
              <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-primary/20 h-[calc(100vh-200px)] flex flex-col items-center justify-center text-center">
                <div className="bg-primary p-6 rounded-3xl mb-6">
                  <FiMessageCircle className="text-white" size={48} />
                </div>
                <h2 className="text-2xl font-bold text-primary mb-2">Bienvenue sur le support JETA</h2>
                <p className="text-gray-600 mb-4">Sélectionnez une conversation pour commencer</p>
                <div className="text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-full">
                  {totalUnread > 0 && `${totalUnread} message${totalUnread > 1 ? 's' : ''} non lu${totalUnread > 1 ? 's' : ''} • `}
                  {users.length} utilisateur{users.length !== 1 ? 's' : ''} total
                </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
} 