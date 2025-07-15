import React, { useEffect, useState, useRef } from 'react';
import { collection, getDocs, updateDoc, doc, onSnapshot, query, orderBy, addDoc, serverTimestamp, where } from 'firebase/firestore';
import { firestore } from '../firebaseConfig';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    clients: 0,
    sellers: 0,
    pending: 0,
    total: 0
  });
  const [pendingSellers, setPendingSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [adminMessage, setAdminMessage] = useState('');
  const messagesEndRef = useRef(null);
  const [unreadSupportCount, setUnreadSupportCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [scraping, setScraping] = useState('');
  const [scrapeMessage, setScrapeMessage] = useState('');
  const [scrapeLogs, setScrapeLogs] = useState('');
  const scrapeLogsRef = useRef(null);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      const usersSnap = await getDocs(collection(firestore, 'users'));
      let clients = 0, sellers = 0, pending = 0;
      const pendingList = [];
      const allUsers = [];
      usersSnap.forEach(docu => {
        const data = docu.data();
        allUsers.push({ id: docu.id, ...data });
        if (data.role === 'admin') return;
        if (data.role === 'seller') sellers++;
        else if (data.role === 'pending_seller') {
          pending++;
          pendingList.push({ id: docu.id, ...data });
        }
        else clients++;
      });
      setStats({ clients, sellers, pending, total: usersSnap.size });
      setPendingSellers(pendingList);
      setUsers(allUsers);
      setLoading(false);
    };
    fetchStats();
  }, []);

  useEffect(() => {
    const fetchChats = async () => {
      const chatsSnap = await getDocs(collection(firestore, 'support_chats'));
      const chatList = [];
      for (const chatDoc of chatsSnap.docs) {
        const userId = chatDoc.id;
        const messagesSnap = await getDocs(query(collection(firestore, 'support_chats', userId, 'messages'), orderBy('createdAt', 'asc')));
        const messages = messagesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        chatList.push({ userId, messages });
      }
      setChats(chatList);
    };
    fetchChats();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedChat, chats]);

  const handleSendAdminMessage = async (e) => {
    e.preventDefault();
    if (!adminMessage.trim() || !selectedChat) return;
    await addDoc(collection(firestore, 'support_chats', selectedChat, 'messages'), {
      text: adminMessage.trim(),
      sender: 'support',
      createdAt: serverTimestamp(),
    });
    setAdminMessage('');
    const messagesSnap = await getDocs(query(collection(firestore, 'support_chats', selectedChat, 'messages'), orderBy('createdAt', 'asc')));
    const messages = messagesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setChats(chats => chats.map(c => c.userId === selectedChat ? { ...c, messages } : c));
  };

  const handleValidate = async (uid) => {
    await updateDoc(doc(firestore, 'users', uid), { role: 'seller' });
    setPendingSellers(pendingSellers.filter(u => u.id !== uid));
    setStats(s => ({ ...s, sellers: s.sellers + 1, pending: s.pending - 1 }));
  };

  const handleRefuse = async (uid) => {
    await updateDoc(doc(firestore, 'users', uid), { role: 'client' });
    setPendingSellers(pendingSellers.filter(u => u.id !== uid));
    setStats(s => ({ ...s, clients: s.clients + 1, pending: s.pending - 1 }));
  };

  const handleRoleChange = async (uid, newRole) => {
    await updateDoc(doc(firestore, 'users', uid), { role: newRole });
    setUsers(users => users.map(u => u.id === uid ? { ...u, role: newRole } : u));
  };

  const handleDelete = async (uid) => {
    await updateDoc(doc(firestore, 'users', uid), { deleted: true });
    setUsers(users => users.filter(u => u.id !== uid));
  };

  const getUserDisplay = (chat) => {
    const user = users.find(u => u.id === chat.userId);
    if (user) return user.displayName || user.name || user.email;
    if (chat.messages && chat.messages.length > 0) {
      const lastMsg = chat.messages[chat.messages.length - 1];
      if (lastMsg.userName) return lastMsg.userName;
    }
    return 'Discussion';
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = selectedRole === 'all' || user.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  useEffect(() => {
    const unsubList = [];
    let isMounted = true;
    const listenAllSupportUnread = async () => {
      const chatsSnap = await getDocs(collection(firestore, 'support_chats'));
      const userIds = chatsSnap.docs.map(doc => doc.id);
      let total = 0;
      if (userIds.length === 0) {
        if (isMounted) setUnreadSupportCount(0);
        return;
      }
      userIds.forEach(userId => {
        const msgsRef = collection(firestore, 'support_chats', userId, 'messages');
        const q = query(msgsRef, where('sender', '!=', 'support'), where('read', '==', false));
        const unsub = onSnapshot(q, (snap) => {
          if (!isMounted) return;
          let count = snap.docs.length;
          setUnreadSupportCount(prev => {
            let newTotal = 0;
            userIds.forEach(uid => {
              const ref = collection(firestore, 'support_chats', uid, 'messages');
              const q2 = query(ref, where('sender', '!=', 'support'), where('read', '==', false));
              getDocs(q2).then(snap2 => {
                newTotal += snap2.docs.length;
                if (uid === userIds[userIds.length - 1]) {
                  setUnreadSupportCount(newTotal);
                }
              });
            });
            return prev;
          });
        });
        unsubList.push(unsub);
      });
    };
    listenAllSupportUnread();
    return () => { isMounted = false; unsubList.forEach(u => u()); };
  }, []);

  // Fonctions de scrapping
  const handleScrape = async (site) => {
    setScraping(site);
    setScrapeMessage(`Scraping ${site} en cours...`);
    setScrapeLogs('');
    if (site === 'action') {
      // Logs temps réel via SSE
      const es = new window.EventSource('http://localhost:3001/api/refresh-action-progress?category=all');
      let logs = '';
      es.addEventListener('log', e => {
        logs += e.data + '\n';
        setScrapeLogs(logs);
        if (scrapeLogsRef.current) {
          scrapeLogsRef.current.scrollTop = scrapeLogsRef.current.scrollHeight;
        }
      });
      es.addEventListener('error', e => {
        setScrapeMessage('Erreur scraping Action (voir logs ci-dessous)');
        es.close();
        setScraping('');
      });
      es.addEventListener('done', e => {
        setScrapeMessage('Scraping Action terminé !');
        es.close();
        setScraping('');
      });
      return;
    }
    if (site === 'carrefour') {
      // Logs temps réel via SSE pour Carrefour
      const es = new window.EventSource('http://localhost:3001/api/refresh-carrefour-progress?category=all');
      let logs = '';
      es.addEventListener('log', e => {
        logs += e.data + '\n';
        setScrapeLogs(logs);
        if (scrapeLogsRef.current) {
          scrapeLogsRef.current.scrollTop = scrapeLogsRef.current.scrollHeight;
        }
      });
      es.addEventListener('error', e => {
        setScrapeMessage('Erreur scraping Carrefour (voir logs ci-dessous)');
        es.close();
        setScraping('');
      });
      es.addEventListener('done', e => {
        setScrapeMessage('Scraping Carrefour terminé !');
        es.close();
        setScraping('');
      });
      return;
    }
    if (site === 'lidl') {
      // Logs temps réel via SSE pour Lidl
      const es = new window.EventSource('http://localhost:3001/api/refresh-lidl-progress?category=all');
      let logs = '';
      es.addEventListener('log', e => {
        logs += e.data + '\n';
        setScrapeLogs(logs);
        if (scrapeLogsRef.current) {
          scrapeLogsRef.current.scrollTop = scrapeLogsRef.current.scrollHeight;
        }
      });
      es.addEventListener('error', e => {
        setScrapeMessage('Erreur scraping Lidl (voir logs ci-dessous)');
        es.close();
        setScraping('');
      });
      es.addEventListener('done', e => {
        setScrapeMessage('Scraping Lidl terminé !');
        es.close();
        setScraping('');
      });
      return;
    }
    let url = '';
    let data = {};
    if (site === 'lidl') {
      toast.error('Scraping Lidl non disponible (pas d’API backend)', { autoClose: 2500 });
      setScraping('');
      setScrapeMessage('');
      return;
    }
    if (site === 'carrefour') {
      url = 'http://localhost:3001/api/refresh-carrefour';
      data = { category: 'toys' };
    }
    try {
      const resp = await axios.post(url, data);
      setScrapeMessage(`Scraping ${site} terminé avec succès !`);
      setScrapeLogs(resp.data.output || '');
      toast.success(`Scrapping ${site} lancé !`, { autoClose: 2000 });
    } catch (e) {
      setScrapeMessage(`Erreur scraping ${site} : ${e.response?.data?.error || e.message}`);
      setScrapeLogs(e.response?.data?.error || '');
      toast.error(`Erreur scrapping ${site}`, { autoClose: 2000 });
    }
    setScraping('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-2">
              Tableau de bord Administrateur
            </h1>
            <p className="text-slate-600">Gérez votre plateforme en toute simplicité</p>
          </div>
          <div className="mt-4 sm:mt-0 flex gap-3">
            <Link 
              to="/admin-support" 
              className="relative inline-flex items-center px-6 py-3 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
          Support client
              {unreadSupportCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center">
                  {unreadSupportCount}
                </span>
              )}
        </Link>
      </div>
        </div>

        {/* Boutons de scrapping admin */}
        <div className="flex gap-4 mb-8 justify-center">
          <button onClick={() => handleScrape('lidl')} disabled={scraping==='lidl'} className="px-6 py-3 rounded-xl font-bold bg-[#1d7bbd] text-white shadow-lg hover:bg-[#4FC3F7] transition disabled:opacity-60">
            {scraping==='lidl' ? 'Scrapping Lidl...' : 'Scrapper Lidl'}
          </button>
          <button onClick={() => handleScrape('action')} disabled={scraping==='action'} className="px-6 py-3 rounded-xl font-bold bg-[#003399] text-white shadow-lg hover:bg-[#4FC3F7] transition disabled:opacity-60">
            {scraping==='action' ? 'Scrapping Action...' : 'Scrapper Action'}
          </button>
          <button onClick={() => handleScrape('carrefour')} disabled={scraping==='carrefour'} className="px-6 py-3 rounded-xl font-bold bg-[#009688] text-white shadow-lg hover:bg-[#4FC3F7] transition disabled:opacity-60">
            {scraping==='carrefour' ? 'Scrapping Carrefour...' : 'Scrapper Carrefour'}
          </button>
        </div>
        {scrapeMessage && (
          <div className="text-center my-4">
            <div className="flex items-center justify-center gap-2">
              {scraping && <span className="animate-spin h-5 w-5 border-2 border-blue-400 border-t-transparent rounded-full"></span>}
              <span className="font-semibold text-blue-700">{scrapeMessage}</span>
            </div>
            <pre ref={scrapeLogsRef} className="bg-slate-100 text-xs text-left p-3 mt-2 rounded-lg max-h-64 overflow-auto whitespace-pre-line" style={{fontFamily:'Fira Mono, monospace'}}>{scrapeLogs}</pre>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent"></div>
          </div>
        ) : (
          <>
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-sm font-medium">Nombre de clients</p>
                    <p className="text-3xl font-bold text-emerald-600">{stats.clients}</p>
                  </div>
                  <div className="p-3 bg-emerald-100 rounded-full">
                    <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-sm font-medium">Nombre de vendeurs</p>
                    <p className="text-3xl font-bold text-blue-600">{stats.sellers}</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-full">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                </div>
            </div>

              <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-sm font-medium">Tâches en attente</p>
                    <p className="text-3xl font-bold text-amber-600">{stats.pending}</p>
            </div>
                  <div className="p-3 bg-amber-100 rounded-full">
                    <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
            </div>
            </div>
          </div>

              <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-sm font-medium">Nombre total d'utilisateurs</p>
                    <p className="text-3xl font-bold text-slate-700">{stats.total}</p>
                  </div>
                  <div className="p-3 bg-slate-100 rounded-full">
                    <svg className="w-8 h-8 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Pending Sellers Section */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200 mb-8">
              <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center">
                <svg className="w-6 h-6 mr-3 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Nombre de tâches en attente
              </h2>
              
          {pendingSellers.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-slate-600 text-lg">Aucun vendeur en attente</p>
                  <p className="text-slate-400 text-sm mt-2">Toutes les tâches ont été traitées</p>
                </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pendingSellers.map(seller => (
                    <div key={seller.id} className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl shadow-md p-6 border-2 border-amber-200 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-amber-300 bg-white shadow-md">
                      {seller.sellerPhotoUrl ? (
                        <a href={seller.sellerPhotoUrl} target="_blank" rel="noopener noreferrer">
                              <img src={seller.sellerPhotoUrl} alt="Photo vendeur" className="object-cover w-full h-full hover:scale-105 transition-transform duration-300" />
                        </a>
                      ) : (
                            <div className="w-full h-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                      )}
                    </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-lg text-slate-800">{seller.displayName || 'Nom non fourni'}</h3>
                          <p className="text-slate-600 text-sm">{seller.email}</p>
                    </div>
                  </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-white rounded-lg p-3 shadow-sm">
                          <p className="text-xs text-slate-500 mb-1">Ville</p>
                          <p className="font-semibold text-slate-800">{seller.ville || 'Non spécifiée'}</p>
                    </div>
                        <div className="bg-white rounded-lg p-3 shadow-sm">
                          <p className="text-xs text-slate-500 mb-1">Quartier</p>
                          <p className="font-semibold text-slate-800">{seller.quartier || 'Non spécifié'}</p>
                    </div>
                  </div>
                      
                      <div className="mb-4">
                        <p className="text-xs text-slate-500 mb-2">Pièce d'identité</p>
                    {seller.identityDocumentUrl ? (
                          <a href={seller.identityDocumentUrl} target="_blank" rel="noopener noreferrer" className="block">
                            <img 
                              src={seller.identityDocumentUrl} 
                              alt="Pièce d'identité" 
                              className="w-full max-h-32 object-cover rounded-lg border-2 border-white shadow-sm hover:shadow-md transition-shadow duration-300" 
                            />
                      </a>
                    ) : (
                          <div className="w-full h-20 bg-slate-100 rounded-lg flex items-center justify-center">
                            <span className="text-slate-400 text-sm">Document non fourni</span>
                          </div>
                    )}
                  </div>
                      
                      <div className="flex gap-2">
                        <button 
                          className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:from-emerald-600 hover:to-green-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                          onClick={() => handleValidate(seller.id)}
                        >
                          Valider
                        </button>
                        <button 
                          className="flex-1 bg-gradient-to-r from-red-500 to-rose-600 text-white px-4 py-2 rounded-lg font-semibold hover:from-red-600 hover:to-rose-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                          onClick={() => handleRefuse(seller.id)}
                        >
                          Refuser
                        </button>
                  </div>
                </div>
              ))}
            </div>
          )}
            </div>

            {/* User Management Section */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800 mb-4 sm:mb-0 flex items-center">
                  <svg className="w-6 h-6 mr-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                  Gestion des utilisateurs
                </h2>
                
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <input
                    type="text"
                    placeholder="Rechercher un utilisateur..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">Tous les rôles</option>
                    <option value="client">Clients</option>
                    <option value="seller">Vendeurs</option>
                    <option value="pending_seller">En attente</option>
                    <option value="admin">Admins</option>
                  </select>
                </div>
              </div>
              
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Utilisateur</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Rôle</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date d'inscription</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {filteredUsers.map(user => (
                      <tr key={user.id} className={`hover:bg-slate-50 transition-colors duration-200 ${user.role === 'admin' ? 'bg-blue-50' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                              {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-slate-900">{user.displayName || 'Nom non fourni'}</div>
                              <div className="text-sm text-slate-500">{user.email}</div>
                            </div>
                          </div>
                      </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={user.role}
                            onChange={e => handleRoleChange(user.id, e.target.value)}
                            className={`px-4 py-2 rounded-full border-2 font-semibold text-sm shadow-md focus:outline-none focus:ring-2 transition-all duration-200 cursor-pointer
                              ${user.role === 'seller' ? 'bg-gradient-to-r from-blue-100 to-blue-200 border-blue-400 text-blue-700 hover:from-blue-200 hover:to-blue-300' : ''}
                              ${user.role === 'client' ? 'bg-gradient-to-r from-emerald-100 to-emerald-200 border-emerald-400 text-emerald-700 hover:from-emerald-200 hover:to-emerald-300' : ''}
                              ${user.role === 'pending_seller' ? 'bg-gradient-to-r from-amber-100 to-amber-200 border-amber-400 text-amber-700 hover:from-amber-200 hover:to-amber-300' : ''}
                              ${user.role === 'admin' ? 'bg-gradient-to-r from-purple-100 to-purple-200 border-purple-400 text-purple-700 hover:from-purple-200 hover:to-purple-300' : ''}
                            `}
                          >
                          <option value="client">Client</option>
                          <option value="seller">Vendeur</option>
                          <option value="pending_seller">En attente</option>
                          <option value="admin">Admin</option>
                        </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {user.createdAt && user.createdAt.toDate
                            ? format(user.createdAt.toDate(), 'dd/MM/yyyy')
                            : user.createdAt && !isNaN(new Date(user.createdAt))
                              ? format(new Date(user.createdAt), 'dd/MM/yyyy')
                              : 'Date inconnue'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button 
                            className="bg-gradient-to-r from-red-500 to-rose-600 text-white px-4 py-2 rounded-lg font-semibold hover:from-red-600 hover:to-rose-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                            onClick={() => handleDelete(user.id)} 
                            disabled={user.role === 'admin'}
                          >
                            Supprimer
                          </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          </>
              )}
            </div>
    </div>
  );
} 