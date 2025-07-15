import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../../firebaseConfig'; // Ajustez le chemin si nécessaire
import { signOut } from 'firebase/auth';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { firestore } from '../../firebaseConfig';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
// Importez vos icônes, par exemple de react-icons
import {
  FaSignInAlt,
  FaUserPlus,
  FaTachometerAlt,
  FaUserCircle,
  FaShoppingCart,
  FaBell,
  FaSearch,
  FaSignOutAlt, // Nouvelle icône pour déconnexion
  // FaGlobe // Pour le sélecteur de langue si vous l'ajoutez
} from 'react-icons/fa';
import { FiLogIn, FiUser, FiShoppingCart as FiShoppingCartIcon, FiBell as FiBellIcon, FiLogOut, FiHome } from 'react-icons/fi';

const Header = ({ isConnected, userName, notificationCount }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { cartItemCount } = useCart();
  const [searchTerm, setSearchTerm] = useState('');
  const [userRole, setUserRole] = useState(null);
  // const [language, setLanguage] = useState('fr'); // Pour le sélecteur de langue
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [allNamesAndCats, setAllNamesAndCats] = useState([]);

  // Charger tous les noms et catégories produits pour l'autocomplétion
  useEffect(() => {
    const fetchAllNamesAndCats = async () => {
      try {
        const productsRef = collection(firestore, 'products');
        const snapshot = await getDocs(productsRef);
        const setVals = new Set();
        snapshot.docs.forEach(doc => {
          const d = doc.data();
          if (d.name) setVals.add(d.name);
          if (d.category) setVals.add(d.category);
        });
        setAllNamesAndCats(Array.from(setVals));
      } catch {}
    };
    fetchAllNamesAndCats();
  }, []);

  // Suggestions dynamiques
  useEffect(() => {
    if (searchTerm.trim().length === 0) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const input = searchTerm.trim().toLowerCase();
    const filtered = allNamesAndCats.filter(item => item.toLowerCase().includes(input));
    setSuggestions(filtered.slice(0, 8));
    setShowSuggestions(filtered.length > 0);
    setActiveSuggestion(-1);
  }, [searchTerm, allNamesAndCats]);

  // Navigation clavier
  const handleInputKeyDown = (e) => {
    if (!showSuggestions) return;
    if (e.key === 'ArrowDown') {
      setActiveSuggestion(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      setActiveSuggestion(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      if (activeSuggestion >= 0 && suggestions[activeSuggestion]) {
        setSearchTerm(suggestions[activeSuggestion]);
        setShowSuggestions(false);
        navigate(`/search?q=${encodeURIComponent(suggestions[activeSuggestion])}`);
      } else {
        navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
      }
    }
  };

  // Clic suggestion
  const handleSuggestionClick = (sugg) => {
    setSearchTerm(sugg);
    setShowSuggestions(false);
    navigate(`/search?q=${encodeURIComponent(sugg)}`);
  };

  useEffect(() => {
    const fetchRole = async () => {
      if (!currentUser) return;
      try {
        const userDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role);
        }
      } catch {}
    };
    fetchRole();
  }, [currentUser]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/login'); // Rediriger vers la page de connexion après déconnexion
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-page-bg border-b border-primary/40 shadow-sm animate-fadeInHeader">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-8">
        <div className="flex items-center h-20 justify-start">
          {/* Logo */}
          <Link to={isConnected ? "/dashboard" : "/"} className="flex items-center mr-4 select-none">
            <svg width="40" height="48" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" className="h-10 w-auto">
              <text x="50" y="80" fontFamily="Poppins, sans-serif" fontSize="80" fontWeight="bold" fill="#4FC3F7" textAnchor="middle">J</text>
              <path d="M40 90 Q50 100 60 90" stroke="#4FC3F7" strokeWidth="3" fill="none" />
            </svg>
          </Link>

          {/* Barre de recherche (affichée seulement pour vendeur ou client) */}
          {(userRole === 'seller' || userRole === 'client') && (
            <form onSubmit={handleSearch} className="flex-1 max-w-lg mx-4 hidden md:flex" autoComplete="off">
              <div className="flex w-full bg-page-bg rounded-full shadow-sm border border-subtle-border focus-within:ring-2 focus-within:ring-primary/30 relative">
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(suggestions.length > 0)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Rechercher des articles, catégories..."
                  className="flex-1 px-5 py-2 bg-transparent text-main placeholder:text-[#FFB300] text-base font-bold rounded-l-full focus:outline-none"
                  style={{ fontWeight: 700 }}
                  autoComplete="off"
                />
                <button type="submit" className="px-5 py-2 rounded-r-full text-[#4FC3F7] hover:bg-primary/10 transition">
                  <FaSearch className="w-5 h-5" />
                </button>
                {/* Suggestions d'autocomplétion */}
                {showSuggestions && suggestions.length > 0 && (
                  <ul style={{
                    position: 'absolute',
                    top: 44,
                    left: 0,
                    right: 0,
                    background: '#fff',
                    border: '1.5px solid #bbdefb',
                    borderTop: 'none',
                    borderRadius: '0 0 18px 18px',
                    boxShadow: '0 4px 16px #1976d211',
                    zIndex: 20,
                    listStyle: 'none',
                    margin: 0,
                    padding: 0,
                    maxHeight: 260,
                    overflowY: 'auto',
                  }}>
                    {suggestions.map((sugg, idx) => (
                      <li
                        key={sugg}
                        onMouseDown={() => handleSuggestionClick(sugg)}
                        style={{
                          padding: '12px 20px',
                          background: idx === activeSuggestion ? '#e3f2fd' : '#fff',
                          color: '#1976d2',
                          fontWeight: 600,
                          fontFamily: 'Montserrat, sans-serif',
                          fontSize: 16,
                          cursor: 'pointer',
                          borderBottom: idx === suggestions.length - 1 ? 'none' : '1px solid #e3eafc',
                        }}
                        onMouseEnter={() => setActiveSuggestion(idx)}
                      >
                        {sugg}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </form>
          )}

          {/* Menu navigation */}
          <nav className="flex items-center gap-2 sm:gap-4 ml-auto">
            {isConnected ? (
              <>
                <Link to="/dashboard" className="flex items-center gap-1 text-primary font-semibold px-3 py-2 rounded-lg hover:bg-primary/10 transition text-base">
                  <FiHome className="w-5 h-5" />
                  <span className="hidden sm:inline">Tableau de bord</span>
                </Link>
                <Link to="/profile" className="flex items-center gap-1 text-primary font-semibold px-3 py-2 rounded-lg hover:bg-primary/10 transition text-base">
                  <FiUser className="w-5 h-5" />
                  <span className="hidden sm:inline">Profil</span>
                </Link>
                <Link to="/cart" className="relative flex items-center gap-1 text-primary font-semibold px-3 py-2 rounded-lg hover:bg-primary/10 transition text-base">
                  <FiShoppingCartIcon className="w-5 h-5" />
                  <span className="hidden sm:inline">Panier</span>
                  {cartItemCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-accent-red text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold shadow">{cartItemCount}</span>
                  )}
                </Link>
                {/* Notifications (affichée seulement si vendeur ou client) */}
                {(userRole === 'seller' || userRole === 'client') && (
                  <Link to="/notifications-page" className="relative flex items-center gap-1 text-primary font-semibold px-3 py-2 rounded-lg hover:bg-primary/10 transition text-base">
                    <FiBellIcon className="w-5 h-5" />
                    <span className="hidden sm:inline">Notifs</span>
                    {notificationCount > 0 && (
                      <span className="absolute -top-2 -right-2 bg-accent-red text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold shadow">{notificationCount}</span>
                    )}
                  </Link>
                )}
                <button
                  onClick={handleSignOut}
                  className="ml-1 p-2 rounded-full bg-white border border-primary text-primary hover:bg-primary/10 transition shadow-sm"
                  title="Déconnexion"
                >
                  <FiLogOut className="w-5 h-5" />
                </button>
              </>
            ) : (
              <Link to="/register" className="flex items-center gap-2 bg-white text-primary border border-primary px-4 py-2 rounded-full font-semibold shadow-sm hover:bg-primary/10 transition text-base">
                <FiLogIn className="w-5 h-5" />
                <span>Connexion/Inscription</span>
              </Link>
            )}
          </nav>
        </div>
        {/* Barre de recherche mobile */}
        {(userRole === 'seller' || userRole === 'client') && (
          <form onSubmit={handleSearch} className="flex md:hidden mt-2">
            <div className="flex w-full bg-page-bg rounded-full shadow-sm border border-subtle-border focus-within:ring-2 focus-within:ring-primary/30">
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher..."
                className="flex-1 px-4 py-2 bg-transparent text-main placeholder:text-secondary text-base font-medium rounded-l-full focus:outline-none"
              />
              <button type="submit" className="px-4 py-2 rounded-r-full text-primary hover:bg-primary/10 transition">
                <FaSearch className="w-5 h-5" />
              </button>
            </div>
          </form>
        )}
      </div>
      <style>{`
        @keyframes fadeInHeader {
          from { opacity: 0; transform: translateY(-16px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </header>
  );
};

export default Header;
