// src/pages/NotificationsPage.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { firestore } from '../firebaseConfig';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy, updateDoc, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { useDiscussionSelection } from '../contexts/DiscussionSelectionContext';

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
  console.log('[DEBUG][NotificationsPage] supportNotifs:', supportNotifs);
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

    // Écouter tous les chats où l'utilisateur est concerné
    const chatsRef = collection(firestore, 'clientSellerChats');
    const unsubChats = onSnapshot(chatsRef, (chatsSnap) => {
      const chatIds = chatsSnap.docs.map(doc => doc.id).filter(chatId => chatId.includes(currentUser.uid));
      
      if (chatIds.length === 0) {
        setNotifications([]);
        setLoading(false); // <-- déjà présent
        return;
      }

      unsubscribes.forEach(unsub => unsub());
      unsubscribes.length = 0;

      let chatsProcessed = 0;
      if (chatIds.length === 0) {
        setLoading(false);
      }
      chatIds.forEach(chatId => {
        const msgsRef = collection(firestore, 'clientSellerChats', chatId, 'messages');
        const q = query(msgsRef, where('read', '==', false), orderBy('createdAt', 'desc'));
        const unsubMsgs = onSnapshot(q, async (msgsSnap) => {
          const unreadMessages = msgsSnap.docs.filter(doc => doc.data().senderUid !== currentUser.uid);
          if (unreadMessages.length === 0) {
            setNotifications(prev => {
              const updated = prev.map(n =>
                n.chatId === chatId ? { ...n, hasUnread: false, unreadCount: 0 } : n
              );
              return updated.sort((a, b) =>
                (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0)
              );
            });
            chatsProcessed++;
            if (chatsProcessed === chatIds.length) setLoading(false);
            return;
          }

          // Récupérer les infos des messages non lus
          const notifs = await Promise.all(unreadMessages.map(async (docSnap) => {
            const msg = docSnap.data();
            let senderName = 'Utilisateur';
            try {
              const userDoc = await getDoc(doc(firestore, 'users', msg.senderUid));
              if (userDoc.exists()) {
                senderName = userDoc.data().displayName || userDoc.data().name || userDoc.data().email || 'Utilisateur';
              }
            } catch (error) {
              console.error('Erreur récupération utilisateur:', error);
            }
            const parts = chatId.split('_');
            const otherUid = parts.find(uid => uid !== currentUser.uid);
            return {
              id: docSnap.id,
              chatId,
              text: msg.text,
              senderName,
              senderUid: msg.senderUid,
              createdAt: msg.createdAt?.toDate ? msg.createdAt.toDate() : null,
              otherUid,
            };
          }));

          setNotifications(prev => {
            const filtered = prev.filter(n => n.chatId !== chatId);
            return [...filtered, ...notifs].sort((a, b) => 
              (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0)
            );
          });
          chatsProcessed++;
          if (chatsProcessed === chatIds.length) setLoading(false);
        });
        unsubscribes.push(unsubMsgs);
      });
      // Si aucun chat, loading doit passer à false
      if (chatIds.length === 0) setLoading(false);
    });

    // --- SUPPORT ADMIN : écoute temps réel sur tous les fils support_chats ---
    let supportUnsubs = [];
    const listenSupportNotifs = async () => {
      // Vérifier si admin
      const userDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
      console.log('[DEBUG][NotificationsPage] Checking user role for support notifications. User exists:', userDoc.exists(), 'Role:', userDoc.exists() ? userDoc.data().role : 'N/A');
      if (!userDoc.exists() || userDoc.data().role !== 'admin') {
        console.log('[DEBUG][NotificationsPage] User is not admin, skipping support notifications');
        return;
      }
      console.log('[DEBUG][NotificationsPage] User is admin, setting up support notifications listeners');
      // Charger tous les fils support
      const chatsSnap = await getDocs(collection(firestore, 'support_chats'));
      const userIds = chatsSnap.docs.map(doc => doc.id);
      console.log('[DEBUG][NotificationsPage] userIds support_chats:', userIds);
      if (userIds.length === 0) {
        setSupportNotifs([]);
        setLoading(false); // <-- AJOUT : loading false si aucun support
        return;
      }
      // Pour chaque fil, écouter les messages non lus
      userIds.forEach(userId => {
        const msgsRef = collection(firestore, 'support_chats', userId, 'messages');
        const q = query(msgsRef, where('sender', '!=', 'support'), where('read', '==', false), orderBy('createdAt', 'desc'));
        try {
          const unsub = onSnapshot(q, async (msgsSnap) => {
            console.log('[DEBUG][NotificationsPage] supportNotifs snapshot for userId:', userId, '| docs:', msgsSnap.docs.length, '| empty:', msgsSnap.empty);
            if (!msgsSnap.empty) {
              msgsSnap.docs.forEach(docSnap => {
                const msg = docSnap.data();
                console.log('[DEBUG][NotificationsPage] Message:', { id: docSnap.id, ...msg });
              });
            } else {
              console.log('[DEBUG][NotificationsPage] Aucun message non lu trouvé pour userId:', userId);
            }
            if (msgsSnap.empty) {
              setSupportNotifs(prev => prev.filter(n => n.userId !== userId));
              return;
            }
            // Récupérer infos utilisateur
            let userName = 'Utilisateur';
            try {
              const userDoc = await getDoc(doc(firestore, 'users', userId));
              if (userDoc.exists()) {
                userName = userDoc.data().displayName || userDoc.data().name || userDoc.data().email || 'Utilisateur';
              }
            } catch {}
            // Regrouper tous les messages non lus
            const messages = msgsSnap.docs.map(docSnap => {
              const msg = docSnap.data();
              return {
                id: docSnap.id,
                text: msg.text,
                createdAt: msg.createdAt?.toDate ? msg.createdAt.toDate() : null,
              };
            });
            // Trier les messages du plus récent au plus ancien
            messages.sort((a, b) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0));
            // Mettre à jour la notif pour cet userId
            setSupportNotifs(prev => {
              const filtered = prev.filter(n => n.userId !== userId);
              return [
                ...filtered,
                {
                  userId,
                  userName,
                  count: messages.length,
                  lastMsg: messages[0],
                  messages,
                },
              ].sort((a, b) => (b.lastMsg?.createdAt?.getTime?.() || 0) - (a.lastMsg?.createdAt?.getTime?.() || 0));
            });
          });
          supportUnsubs.push(unsub);
        } catch (err) {
          console.error('[DEBUG][NotificationsPage] Firestore onSnapshot error for userId:', userId, err);
        }
      });
      // Ajout d'un fallback debug après 2s
      setTimeout(() => {
        if (supportNotifs.length === 0) {
          console.log('[DEBUG][NotificationsPage] Fallback: Aucun supportNotifs détecté après 2s. currentUser:', currentUser.uid, '| role:', userDoc.data().role, '| supportNotifs.length:', supportNotifs.length);
        }
      }, 2000);
    };
    listenSupportNotifs();

    unsubscribes.push(unsubChats);
    return () => {
      unsubscribes.forEach(unsub => unsub());
      supportUnsubs.forEach(unsub => unsub());
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
    <div className="bg-page-bg text-main min-h-screen">
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
