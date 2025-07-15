import React, { useEffect, useState, useRef } from 'react';
import { onSnapshot, query, where, collection, orderBy, doc, getDoc, getDocs } from 'firebase/firestore';
import { firestore } from '../firebaseConfig';
import { useAuth } from './AuthContext';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { useDiscussionSelection } from './DiscussionSelectionContext';

export default function GlobalChatListener() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState(null);
  const lastNotifiedMsgIds = useRef({}); // { chatId: lastMsgId }
  const { setSelectedDiscussionUid } = useDiscussionSelection();
  const connectionTimestamp = useRef(Date.now());

  // Reset connection timestamp and lastNotifiedMsgIds on user change
  useEffect(() => {
    connectionTimestamp.current = Date.now();
    lastNotifiedMsgIds.current = {};
  }, [currentUser]);

  // Fonction pour extraire le sellerUid depuis l'ID du chat
  const extractSellerUid = (chatId) => {
    // Format: clientUid_sellerUid
    const parts = chatId.split('_');
    if (parts.length >= 2) {
      // Le sellerUid est toujours la partie après le premier underscore
      return parts.slice(1).join('_');
    }
    return null;
  };

  // Fonction pour naviguer vers la discussion
  const navigateToDiscussion = (chatId) => {
    if (!userRole) return; // Sécurité : attendre que le rôle soit chargé
    const parts = chatId.split('_');
    const clientUid = parts[0];
    const sellerUid = parts[1];
    if (currentUser) {
      if (userRole === 'seller') {
        setSelectedDiscussionUid(clientUid);
        navigate('/seller-discussions');
      } else if (userRole === 'client' || userRole === 'customer') {
        setSelectedDiscussionUid(sellerUid);
        navigate('/customer-discussions');
      } else {
        // Rôle inconnu : ne rien faire
        return;
      }
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    let unsubscribes = [];
    let isMounted = true;

    async function listenAllChats() {
      const clientChatsSnap = await getDocs(query(collection(firestore, 'clientSellerChats')));
      const chatIds = [];
      clientChatsSnap.forEach(docSnap => {
        const chatId = docSnap.id;
        if (chatId.includes(currentUser.uid)) {
          chatIds.push(chatId);
        }
      });
      for (const chatId of chatIds) {
        const q = query(collection(firestore, 'clientSellerChats', chatId, 'messages'), orderBy('createdAt', 'asc'));
        const unsub = onSnapshot(q, async (snap) => {
          const newMessages = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          if (newMessages.length === 0) return;
          const lastMsg = newMessages[newMessages.length - 1];
          // Afficher le toast uniquement si :
          // - le message n'est pas de l'utilisateur courant
          // - ce message n'a pas déjà déclenché un toast
          // - le message n'est pas déjà lu
          // - le message a été créé APRÈS la connexion de l'utilisateur
          if (
            lastMsg.senderUid !== currentUser.uid &&
            lastNotifiedMsgIds.current[chatId] !== lastMsg.id &&
            !lastMsg.read &&
            lastMsg.createdAt &&
            lastMsg.createdAt.toDate &&
            lastMsg.createdAt.toDate().getTime() > connectionTimestamp.current
          ) {
            let senderName = 'Utilisateur';
            try {
              const userDoc = await getDoc(doc(firestore, 'users', lastMsg.senderUid));
              if (userDoc.exists()) {
                senderName = userDoc.data().displayName || userDoc.data().name || userDoc.data().email || 'Utilisateur';
              }
            } catch {}
            // toast.info(`${senderName} vous a envoyé un message`, {
            //   icon: '💬',
            //   toastId: `msg-${chatId}-${lastMsg.id}`,
            //   onClick: () => navigateToDiscussion(chatId)
            // });
            lastNotifiedMsgIds.current[chatId] = lastMsg.id;
          }
        });
        unsubscribes.push(unsub);
      }
    }
    listenAllChats();
    return () => {
      isMounted = false;
      unsubscribes.forEach(unsub => unsub());
    };
  }, [currentUser]);

  // Récupération du rôle de l'utilisateur depuis Firestore
  useEffect(() => {
    const fetchUserRole = async () => {
      if (!currentUser) return;
      
      try {
        const userDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserRole(userData.role);
        }
      } catch (error) {
        console.error('Erreur lors de la récupération du rôle:', error);
      }
    };
    
    fetchUserRole();
  }, [currentUser]);

  return null;
}
