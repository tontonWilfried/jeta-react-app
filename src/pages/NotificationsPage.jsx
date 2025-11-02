// src/pages/NotificationsPage.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { firestore } from '../firebaseConfig';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy, updateDoc, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { useDiscussionSelection } from '../contexts/DiscussionSelectionContext';
import { FiArrowLeft } from 'react-icons/fi';

const NotificationsPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openUser, setOpenUser] = useState(null); // Pour gérer l'accordéon
  const { setSelectedDiscussionUid } = useDiscussionSelection();
  const [userRole, setUserRole] = useState(null);
  const [supportNotifs, setSupportNotifs] = useState([]); // Pour les notifs support admin

  // DEBUG : log currentUser à chaque rendu
  console.log('[DEBUG][NotificationsPage] Render | currentUser:', currentUser);
  console.log('[DEBUG][NotificationsPage] notifications:', notifications);
  console.log('[DEBUG][NotificationsPage] userRole:', userRole);

  useEffect(() => {
    console.log('[DEBUG][NotificationsPage] useEffect triggered | currentUser:', currentUser);
    if (!currentUser) {
      setNotifications([]);
      setSupportNotifs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribes = [];

    // Fonction simplifiée pour écouter les messages non lus
    const listenToUnreadMessages = async () => {
      try {
        // Récupérer tous les chats où l'utilisateur est concerné
        const chatsRef = collection(firestore, 'clientSellerChats');
        const chatsSnap = await getDocs(chatsRef);
        const userChats = chatsSnap.docs.filter(doc => doc.id.includes(currentUser.uid));
        
        console.log('[DEBUG][NotificationsPage] Found user chats:', userChats.map(doc => doc.id));
        
        // Si aucun chat n'est trouvé, chercher dans tous les chats possibles
        let allChats = userChats;
        if (userChats.length === 0) {
          console.log('[DEBUG][NotificationsPage] Aucun chat trouvé, recherche dans tous les chats...');
          allChats = chatsSnap.docs;
        }
        
        // Pour chaque chat, écouter les messages non lus
        const chatUnsubscribes = [];
        const chatNotifications = [];
        
        for (const chatDoc of allChats) {
          const chatId = chatDoc.id;
          const msgsRef = collection(firestore, 'clientSellerChats', chatId, 'messages');
          const q = query(msgsRef, where('read', '==', false));
          
          const unsub = onSnapshot(q, async (msgsSnap) => {
            const unreadMessages = msgsSnap.docs.filter(doc => {
              const msg = doc.data();
              return msg.senderUid !== currentUser.uid; // Seulement les messages reçus
            });
            
            console.log(`[DEBUG][NotificationsPage] Chat ${chatId}: ${unreadMessages.length} messages non lus`);
            
            if (unreadMessages.length > 0) {
              // Créer des notifications pour chaque message non lu
              for (const msgDoc of unreadMessages) {
                const msg = msgDoc.data();
                
                // Récupérer le nom de l'expéditeur
                let senderName = 'Utilisateur';
                try {
                  const userDoc = await getDoc(doc(firestore, 'users', msg.senderUid));
                  if (userDoc.exists()) {
                    senderName = userDoc.data().displayName || userDoc.data().name || userDoc.data().email || 'Utilisateur';
                  }
                } catch (error) {
                  console.error('Erreur lors de la récupération du nom:', error);
                }
                
                const notification = {
                  id: msgDoc.id,
                  type: 'message',
                  title: `${senderName} vous a écrit`,
                  message: msg.text,
                  timestamp: msg.createdAt,
                  chatId: chatId,
                  senderUid: msg.senderUid,
                  senderName: senderName
                };
                
                chatNotifications.push(notification);
              }
              
              // Mettre à jour les notifications
              setNotifications(prev => {
                const filtered = prev.filter(n => n.chatId !== chatId);
                return [...filtered, ...chatNotifications];
              });
            }
          });
          
          chatUnsubscribes.push(unsub);
        }
        
        // Nettoyage
        return () => {
          chatUnsubscribes.forEach(unsub => unsub());
        };
      } catch (error) {
        console.error('[ERROR][NotificationsPage] Erreur lors de l\'écoute des messages:', error);
        setLoading(false);
      }
    };

    listenToUnreadMessages();

    // Nettoyage
    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [currentUser]);

  // Récupérer le rôle utilisateur depuis Firestore
  useEffect(() => {
    const fetchUserRole = async () => {
      if (!currentUser) return;
      try {
        const userDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role);
        }
      } catch {}
    };
    fetchUserRole();
  }, [currentUser]);

  // Fonction pour marquer les messages comme lus et naviguer vers la discussion
  const handleOpenDiscussion = async (notif) => {
    try {
      const chatId = notif.chatId;
      const msgsRef = collection(firestore, 'clientSellerChats', chatId, 'messages');
      const q = query(msgsRef, where('read', '==', false), where('senderUid', '==', notif.senderUid));
      const msgsSnap = await getDocs(q);
      const updatePromises = msgsSnap.docs.map(msgDoc => updateDoc(msgDoc.ref, { read: true }));
      await Promise.all(updatePromises);

      // Rediriger explicitement selon le rôle utilisateur
      if (userRole === 'seller') {
        setSelectedDiscussionUid(notif.senderUid); // vendeur : clientUid
        navigate('/seller-discussions');
      } else {
        setSelectedDiscussionUid(notif.senderUid); // client : sellerUid
        navigate('/customer-discussions');
      }
    } catch (error) {
      console.error('Erreur lors de l\'ouverture de la discussion:', error);
      if (userRole === 'seller') {
        setSelectedDiscussionUid(notif.senderUid);
        navigate('/seller-discussions');
      } else {
        setSelectedDiscussionUid(notif.senderUid);
        navigate('/customer-discussions');
      }
    }
  };

  // Fonction pour ouvrir la discussion support admin
  const handleOpenSupportDiscussion = (notif) => {
    // Stocke l'ID dans le localStorage ou dans un state global/context si besoin
    localStorage.setItem('adminSelectedSupportChat', notif.userId);
    navigate('/admin-support');
  };

  // Regrouper les notifications par utilisateur (senderUid)
  const grouped = {};
  notifications.forEach(notif => {
    if (!grouped[notif.senderUid]) grouped[notif.senderUid] = [];
    grouped[notif.senderUid].push(notif);
  });

  // Affichage explicite si currentUser est null
  if (!currentUser) {
    return (
      <div className="bg-page-bg text-main min-h-screen flex items-center justify-center">
        <div className="bg-white shadow-xl rounded-lg p-8 text-center">
          <h1 className="text-2xl font-bold mb-4 text-primary">Chargement de l'authentification...</h1>
          <p className="text-lg text-gray-400">Merci de patienter...</p>
        </div>
      </div>
    );
  }

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
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-xl rounded-lg p-6 md:p-10">
          <h1 className="text-3xl md:text-4xl font-bold text-primary mb-6">
            Mes Notifications
          </h1>
          {loading ? (
            <p className="text-lg text-gray-400">Chargement...</p>
          ) : Object.keys(grouped).length === 0 ? (
            <p className="text-lg text-gray-500">Vous n'avez aucune nouvelle notification.</p>
          ) : (
            <ul className="divide-y divide-blue-50">
              {Object.entries(grouped).map(([senderUid, notifs]) => {
                const firstNotif = notifs[0];
                return (
                  <li key={senderUid} className="py-4">
                    <div className="flex items-center gap-4 cursor-pointer" onClick={() => setOpenUser(openUser === senderUid ? null : senderUid)}>
                      <div className="flex-1">
                        <div className="font-bold text-[#4FC3F7]">{firstNotif.senderName}</div>
                        <div className="text-sm text-gray-700 truncate max-w-xs">
                          {notifs.length === 1 ? firstNotif.text : `${notifs.length} nouveaux messages`}
                        </div>
                        {firstNotif.createdAt && (
                          <div className="text-xs text-gray-400 mt-1">
                            {firstNotif.createdAt.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                          </div>
                        )}
                      </div>
                      <span className="inline-block bg-[#4FC3F7] text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold shadow">
                        {notifs.length}
                      </span>
                      <button
                        onClick={e => { e.stopPropagation(); handleOpenDiscussion(firstNotif); }}
                        className="bg-[#4FC3F7] text-white px-4 py-2 rounded-full font-bold shadow hover:bg-[#0288D1] transition text-sm"
                      >
                        Ouvrir
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setOpenUser(openUser === senderUid ? null : senderUid); }}
                        className="ml-2 text-[#4FC3F7] text-lg font-bold focus:outline-none"
                        aria-label="Afficher les messages"
                      >
                        {openUser === senderUid ? '▲' : '▼'}
                      </button>
                    </div>
                    {/* Liste déroulante des messages non lus */}
                    {openUser === senderUid && (
                      <ul className="mt-2 ml-6 space-y-1">
                        {notifs.map(notif => (
                          <li key={notif.id} className="bg-blue-50 rounded px-3 py-2 text-sm text-gray-700 flex items-center gap-2">
                            <span className="truncate flex-1">{notif.text}</span>
                            {notif.createdAt && (
                              <span className="text-xs text-gray-400">{notif.createdAt.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {/* --- SUPPORT ADMIN NOTIFS --- */}
          {supportNotifs.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-bold text-[#A259F7] mb-2">Support (messages non lus)</h2>
              <ul className="divide-y divide-blue-50">
                {supportNotifs.map(notif => (
                  <li key={notif.userId} className="py-3">
                    <div className="flex items-center gap-4 cursor-pointer" onClick={() => setOpenUser(openUser === notif.userId ? null : notif.userId)}>
                      <span className="font-bold text-[#00C853]">{notif.userName || notif.userId || 'Utilisateur inconnu'}</span>
                      <span className="inline-block bg-[#00C853] text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold shadow">{notif.count}</span>
                      <span className="text-sm text-gray-700 truncate flex-1">{notif.count === 1 ? notif.lastMsg.text : `${notif.count} nouveaux messages`}</span>
                      {notif.lastMsg?.createdAt && (
                        <span className="text-xs text-gray-400 ml-2">{notif.lastMsg.createdAt.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); handleOpenSupportDiscussion(notif); }}
                        className="bg-[#A259F7] text-white px-4 py-2 rounded-full font-bold shadow hover:bg-[#7c3aed] transition text-sm ml-2"
                      >Ouvrir</button>
                      <button
                        onClick={e => { e.stopPropagation(); setOpenUser(openUser === notif.userId ? null : notif.userId); }}
                        className="ml-2 text-[#4FC3F7] text-lg font-bold focus:outline-none"
                        aria-label="Afficher les messages"
                      >
                        {openUser === notif.userId ? '▲' : '▼'}
                      </button>
                    </div>
                    {/* Liste déroulante des messages non lus */}
                    {openUser === notif.userId && (
                      <ul className="mt-2 ml-8">
                        {notif.messages.map(msg => (
                          <li key={msg.id} className="text-gray-700 text-sm mb-1 flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full bg-[#00C853] mr-2"></span>
                            <span>{msg.text}</span>
                            {msg.createdAt && <span className="text-xs text-gray-400 ml-2">{msg.createdAt.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default NotificationsPage;
