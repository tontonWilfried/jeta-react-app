import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useSellerCart } from '../contexts/SellerCartContext';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import { FaShoppingCart } from 'react-icons/fa';
import { FiArrowLeft } from 'react-icons/fi';

// Import Google Fonts dynamiquement
const fontLink = document.createElement('link');
fontLink.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap';
fontLink.rel = 'stylesheet';
document.head.appendChild(fontLink);

function canRefreshToday(subcat) {
  const key = `refresh_${subcat}`;
  const last = localStorage.getItem(key);
  const today = new Date().toISOString().slice(0, 10);
  return last !== today;
}

function setRefreshToday(subcat) {
  const key = `refresh_${subcat}`;
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(key, today);
}

// Ajoute la fonction utilitaire pour savoir si un produit est récent
function isRecent(dateString) {
  if (!dateString) return false;
  const now = new Date();
  const scraped = new Date(dateString);
  const diffTime = now - scraped;
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays < 7;
}

export default function CarrefourProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('Jeux et Jouets');
  const [refreshDisabled, setRefreshDisabled] = useState(false);
  const [priceSort, setPriceSort] = useState('default');
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [notif, setNotif] = useState(null);
  const [progress, setProgress] = useState(null);
  const eventSourceRef = useRef(null);
  const PRODUCTS_PER_PAGE = 20;
  const { addToCart } = useCart();
  const { addToSellerCart } = useSellerCart();
  const { currentUser } = useAuth();
  const isSeller = currentUser && (currentUser.role === 'seller' || currentUser.isSeller);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const [autoComplete, setAutoComplete] = useState([]);
  const [showAutoComplete, setShowAutoComplete] = useState(false);

  useEffect(() => {
    fetch('http://localhost:3001/api/carrefour-products')
      .then(res => res.json())
      .then(data => {
        setProducts(data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Erreur lors du chargement des produits Carrefour:', error);
        setLoading(false);
      });
  }, []);

  // Extraire toutes les catégories uniques
  const categories = Array.from(new Set(products.map(p => p.category))).sort();

  // Carrefour n'a pas de sous-catégories, donc on n'en affiche pas
  const subcategories = [];

  // Recherche sur tous les produits (toutes catégories)
  let filteredProducts = products.filter(
    p =>
      (searchTerm.trim() === '' || (p.name && p.name.toLowerCase().includes(searchTerm.trim().toLowerCase()))) &&
      (selectedCategory === '' || p.category === selectedCategory)
  );

  // Trier selon le choix de l'utilisateur
  if (priceSort === 'asc') {
    filteredProducts = filteredProducts.slice().sort((a, b) => (a.promo_price || 0) - (b.promo_price || 0));
  } else if (priceSort === 'desc') {
    filteredProducts = filteredProducts.slice().sort((a, b) => (b.promo_price || 0) - (a.promo_price || 0));
  }

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice((page - 1) * PRODUCTS_PER_PAGE, page * PRODUCTS_PER_PAGE);

  // Regrouper les produits paginés par catégorie (Carrefour n'a pas de sous-catégories)
  const grouped = {};
  paginatedProducts.forEach(prod => {
    const cat = prod.category || 'Sans catégorie';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(prod);
  });

  useEffect(() => {
    setRefreshDisabled(false); // Toujours permettre l'actualisation pour Carrefour
    setPage(1); // Réinitialiser la page si filtre change
    setNotif(null); // Efface la notification quand on change de catégorie
  }, [selectedCategory, priceSort, searchTerm]); // Ajout de searchTerm

  // Efface la notification après 5 secondes
  useEffect(() => {
    if (notif) {
      const timer = setTimeout(() => setNotif(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notif]);

  // Nouvelle fonction pour actualiser SANS scraping (juste reload depuis la base)
  async function handleSimpleRefresh() {
    setRefreshing(true);
    setNotif(null);
    try {
      const prodRes = await fetch('http://localhost:3001/api/carrefour-products');
      const prodData = await prodRes.json();
      setProducts(prodData);
      setNotif({ type: 'success', message: 'Catalogue rechargé depuis la base.' });
    } catch (e) {
      setNotif({ type: 'error', message: 'Erreur lors du rechargement.' });
    }
    setRefreshing(false);
  }

  // Fonction utilitaire pour convertir le nom affiché en clé backend
  function getCategoryKey(cat) {
    switch (cat) {
      case 'Jeux et Jouets': return 'toys';
      case 'Boissons & Alimentation': return 'food';
      case 'Cuisine': return 'cuisine';
      case 'Entretien Maison': return 'entretien';
      case 'Maison et Décoration': return 'maison';
      case 'Papeterie et Bureau': return 'papeterie';
      case 'Jouets, Sports et Loisirs': return 'loisirs';
      case 'Informatique et Bureau': return 'informatique';
      case 'Image et Son': return 'image_son';
      case 'Smartphones et Objets Connectés': return 'smartphones';
      case 'Bagagerie et Maroquinerie': return 'bagagerie';
      case 'Bébé': return 'bebe';
      default: return '';
    }
  }

  const handleAddToCart = (product) => {
    // Pour les produits Carrefour, toujours utiliser le panier vendeur
      addToSellerCart({
        ...product,
      resalePrice: Math.round((product.promo_price || 0) * 1.3),
        checked: false,
        quantity: 1
      });
    toast.success('Ajouté au panier vendeur !', { 
      autoClose: 1800, 
      hideProgressBar: true, 
      style: { background: '#e3fcec', color: '#137333', fontWeight: 600, fontSize: 15 } 
    });
  };

  // Auto-complétion dynamique
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setAutoComplete([]);
      setShowAutoComplete(false);
      return;
    }
    const suggestions = products
      .filter(p => p.name && p.name.toLowerCase().includes(searchTerm.trim().toLowerCase()))
      .map(p => p.name)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .slice(0, 8);
    setAutoComplete(suggestions);
    setShowAutoComplete(suggestions.length > 0);
  }, [searchTerm, products]);

  if (loading) return <div style={{ fontFamily: 'Montserrat, sans-serif', textAlign: 'center', color: '#003399' }}>Chargement...</div>;

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
      {/* Titre centré */}
      <h1 style={{ 
        fontFamily: 'Montserrat, sans-serif', 
        fontWeight: 700, 
        fontSize: 32, 
        color: '#003399', 
        marginBottom: 24, 
        textAlign: 'center'
      }}>
        Produits Carrefour
      </h1>
      <p style={{ 
        color: '#003399', 
        fontWeight: 500, 
        margin: '0 0 24px 0', 
        textAlign: 'center' 
      }}>
        Produits en promotion
      </p>
      {/* Barre de recherche */}
      <div style={{ maxWidth: 400, margin: '0 auto 24px auto', position: 'relative' }}>
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          onFocus={() => setShowAutoComplete(autoComplete.length > 0)}
          onBlur={() => setTimeout(() => setShowAutoComplete(false), 150)}
          placeholder="Rechercher un produit..."
          style={{
            width: '100%',
            padding: '10px 16px',
            borderRadius: 8,
            border: '1px solid #b3cfff',
            fontSize: 16,
            outline: 'none',
            boxShadow: '0 1px 2px rgba(0, 51, 153, 0.04)',
            marginBottom: 0,
            background: '#fff',
            color: '#222',
            fontFamily: 'Montserrat, sans-serif',
          }}
        />
        {showAutoComplete && (
          <div style={{
            position: 'absolute',
            top: 44,
            left: 0,
            right: 0,
            background: '#fff',
            border: '1px solid #b3cfff',
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            boxShadow: '0 4px 16px #00339911',
            zIndex: 10,
            maxHeight: 220,
            overflowY: 'auto',
          }}>
            {autoComplete.map((suggestion, idx) => (
              <div
                key={idx}
                onMouseDown={() => {
                  setSearchTerm(suggestion);
                  setShowAutoComplete(false);
                }}
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  fontSize: 15,
                  color: '#003399',
                  background: idx % 2 === 0 ? '#f8fafc' : '#e3eafc',
                  borderBottom: '1px solid #e3eafc',
                  fontWeight: 500,
                }}
              >
                {suggestion}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Conteneur des filtres */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 16,
        margin: '24px 0 32px 0',
        justifyContent: 'center',
        flexWrap: 'wrap',
      }}>
        {/* Filtre catégorie */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 220 }}>
          <label style={{ fontWeight: 600, fontSize: 15, color: '#333', marginBottom: 8, textAlign: 'center' }}>
            Filtrer par catégorie :
          </label>
          <div style={{
            position: 'relative',
            background: 'linear-gradient(135deg, #f3f6fa 60%, #eaf1fb 100%)',
            borderRadius: 20,
            boxShadow: '0 6px 24px #00339911, 0 1.5px 6px #00339922',
            padding: 2,
          }}>
            <select
              value={selectedCategory}
              onChange={e => {
                setSelectedCategory(e.target.value);
              }}
              style={{
                padding: '10px 32px 10px 16px',
                borderRadius: 20,
                border: 'none',
                fontSize: 16,
                fontWeight: 700,
                background: 'transparent',
                color: '#003399',
                outline: 'none',
                fontFamily: 'Montserrat, sans-serif',
                boxShadow: 'none',
                appearance: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                cursor: 'pointer',
                width: 220,
                transition: 'box-shadow 0.2s, background 0.2s',
                letterSpacing: 0.5,
                textAlign: 'left',
              }}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <svg
              style={{
                position: 'absolute',
                right: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                width: 16,
                height: 16,
                fill: '#003399',
                opacity: 0.7,
              }}
              viewBox="0 0 24 24"
            >
              <path d="M7 10l5 5 5-5z" />
            </svg>
          </div>
        </div>

        {/* Filtre tri prix */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 180 }}>
          <label style={{ fontWeight: 600, fontSize: 15, color: '#333', marginBottom: 8, textAlign: 'center' }}>
            Trier par prix
          </label>
          <div style={{
            position: 'relative',
            background: 'linear-gradient(135deg, #f3f6fa 60%, #eaf1fb 100%)',
            borderRadius: 20,
            boxShadow: '0 6px 24px #00339911, 0 1.5px 6px #00339922',
            padding: 2,
          }}>
            <select
              value={priceSort}
              onChange={e => setPriceSort(e.target.value)}
              style={{
                padding: '10px 32px 10px 16px',
                borderRadius: 20,
                border: 'none',
                fontSize: 16,
                fontWeight: 700,
                background: 'transparent',
                color: '#003399',
                outline: 'none',
                fontFamily: 'Montserrat, sans-serif',
                boxShadow: 'none',
                appearance: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                cursor: 'pointer',
                width: 180,
                transition: 'box-shadow 0.2s, background 0.2s',
                letterSpacing: 0.5,
                textAlign: 'left',
              }}
            >
              <option value="default">Par défaut</option>
              <option value="asc">Prix croissant</option>
              <option value="desc">Prix décroissant</option>
            </select>
            <svg
              style={{
                position: 'absolute',
                right: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                width: 16,
                height: 16,
                fill: '#003399',
                opacity: 0.7,
              }}
              viewBox="0 0 24 24"
            >
              <path d="M7 10l5 5 5-5z" />
            </svg>
          </div>
        </div>
        {/* Bouton Actualiser */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 160 }}>
          <label style={{ fontWeight: 600, fontSize: 15, color: '#333', marginBottom: 8, textAlign: 'center' }}>
             
          </label>
          <button
            onClick={handleSimpleRefresh}
            disabled={refreshing || !selectedCategory || getCategoryKey(selectedCategory) === ''}
            style={{
              padding: '10px 28px',
              borderRadius: 20,
              border: 'none',
              fontSize: 16,
              fontWeight: 700,
              background: refreshing ? '#b0bec5' : '#003399',
              color: '#fff',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              boxShadow: '0 6px 24px #00339911, 0 1.5px 6px #00339922',
              transition: 'background 0.2s',
              fontFamily: 'Montserrat, sans-serif',
              width: 160,
              marginTop: 2,
              marginBottom: 0,
              letterSpacing: 0.5,
            }}
          >
            {refreshing ? 'Actualisation...' : 'Actualiser'}
          </button>
              </div>
              <button
          onClick={() => navigate('/seller-cart')}
                style={{
            padding: '10px 28px',
            borderRadius: 20,
            border: 'none',
            fontSize: 16,
            fontWeight: 700,
                  background: '#003399',
                  color: '#fff',
                  cursor: 'pointer',
            boxShadow: '0 6px 24px #00339911, 0 1.5px 6px #00339922',
                  transition: 'background 0.2s',
                  fontFamily: 'Montserrat, sans-serif',
            marginLeft: 8,
            marginBottom: 0,
            letterSpacing: 0.5,
                }}
              >
          Mon panier
              </button>
            </div>
      {/* Notification et barre de progression */}
      {(notif || progress !== null) && (
        <div style={{
          margin: '16px auto 0 auto',
          maxWidth: 420,
          background: notif && notif.type === 'success' ? '#e3fcec' : notif && notif.type === 'error' ? '#ffeaea' : '#e3eafc',
          color: notif && notif.type === 'success' ? '#137333' : notif && notif.type === 'error' ? '#b71c1c' : '#003399',
          border: `1.5px solid ${notif && notif.type === 'success' ? '#b2f2d6' : notif && notif.type === 'error' ? '#ffbdbd' : '#bbdefb'}`,
          borderRadius: 16,
          padding: '14px 24px',
          fontWeight: 600,
          fontSize: 16,
          textAlign: 'center',
          boxShadow: '0 2px 8px #00339911',
        }}>
          {progress !== null && (
            <>
              <div style={{ marginBottom: 8 }}>Actualisation en cours...</div>
              <div style={{
                height: 12,
                borderRadius: 8,
                background: '#e3eafc',
                overflow: 'hidden',
                boxShadow: '0 1.5px 6px #00339922',
              }}>
                <div style={{
                  width: `${progress}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #003399 60%, #42a5f5 100%)',
                  transition: 'width 0.3s ease-in-out',
                  borderRadius: 8,
                }} />
              </div>
              <div style={{
                textAlign: 'center',
                fontWeight: 600,
                fontSize: 13,
                color: '#003399',
                marginTop: 4,
                letterSpacing: 0.5,
                fontFamily: 'Montserrat, sans-serif',
              }}>{progress}%</div>
            </>
          )}
          {notif && <div style={{ marginTop: progress !== null ? 8 : 0 }}>{notif.message}</div>}
        </div>
      )}
      {/* Liste des produits paginés */}
      {Object.keys(grouped).map(subcat => (
        <div key={subcat} style={{ marginBottom: 40 }}>
          <h2 style={{ 
            color: '#003399', 
            marginBottom: 16, 
            fontFamily: 'Montserrat, sans-serif', 
            fontWeight: 600 
          }}>
            {subcat}
          </h2>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: 24 
          }}>
            {grouped[subcat].map(product => (
              <div key={product.id} style={{ 
                border: '1px solid #eee', 
                borderRadius: 12, 
                padding: 16, 
                background: '#fff', 
                fontFamily: 'Montserrat, sans-serif', 
                boxShadow: '0 2px 8px #00339911',
                position: 'relative', // Pour le badge Nouveau
              }}>
                {/* Badge Nouveau */}
                {isRecent(product.first_scraped_at) && (
                  <div style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    background: '#ffe066',
                    color: '#222',
                    fontWeight: 700,
                    fontSize: 13,
                    padding: '2px 10px',
                    borderRadius: 8,
                    zIndex: 2,
                    boxShadow: '0 1px 4px #0001',
                    letterSpacing: 1,
                    border: '1.5px solid #ffd700',
                  }}>
                    Nouveau
                  </div>
                )}
                                 <img 
                   src={product.image_url || 'https://via.placeholder.com/300x200?text=Carrefour'} 
                   alt={product.name} 
                   style={{ 
                     width: '100%', 
                     height: 140, 
                     objectFit: 'contain', 
                     marginBottom: 8, 
                     background: '#fff', 
                     borderRadius: 8 
                   }} 
                 />
                <h3 style={{ fontSize: 18, margin: '8px 0 4px 0', fontWeight: 700, color: '#003399' }}>
                  {product.name}
                </h3>
                <div style={{ color: '#888', fontSize: 14, marginBottom: 4 }}>
                  {product.description}
                </div>
                                 <div style={{ fontSize: 15, marginBottom: 4 }}>
                   <b>Prix :</b> {product.promo_price ? product.promo_price + ' €' : '—'} /{' '}
                   <span style={{ color: '#00C853', fontWeight: 600 }}>
                     {product.promo_price ? Math.round(product.promo_price * 655.957) : '—'} FCFA
                   </span>
                 </div>
                 {product.old_price && (
                   <div style={{ color: '#888', fontSize: 14, marginBottom: 4, textDecoration: 'line-through' }}>
                     Ancien prix : {product.old_price} €
                   </div>
                 )}
                 {product.reduction_percent && (
                   <div style={{ color: '#00C853', fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                     Réduction : -{product.reduction_percent}%
                   </div>
                 )}
                <a 
                  href={product.product_url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ color: '#003399', fontWeight: 600, fontSize: 15, marginBottom: 2, display: 'inline-block' }}
                >
                  Voir sur Carrefour
                </a>
                                 <span
                   onClick={() => { 
                     const price = product.promo_price || product.price || 0;
                     addToSellerCart({
                       id: product.id,
                       name: product.name,
                       description: product.description,
                       price,
                       price_fcfa: Math.round(price * 655.957),
                       image_url: product.image_url,
                       product_url: product.product_url,
                       category: product.category,
                       subcategory: product.subcategory || 'Sans catégorie',
                       site: 'carrefour'
                     }); 
                     toast.success('Ajouté au panier vendeur !', { 
                       autoClose: 1800, 
                       hideProgressBar: true, 
                       style: { background: '#e3fcec', color: '#137333', fontWeight: 600, fontSize: 15 } 
                     });
                   }}
                   style={{
                     color: '#003399',
                     fontWeight: 500,
                     fontSize: 15,
                     marginLeft: 0,
                     marginTop: 2,
                     display: 'inline-block',
                     cursor: 'pointer',
                     textDecoration: 'none',
                     transition: 'color 0.2s',
                   }}
                   tabIndex={0}
                   role="button"
                   onKeyPress={e => { 
                     if (e.key === 'Enter') {
                       const price = product.promo_price || product.price || 0;
                       addToSellerCart({
                         id: product.id,
                         name: product.name,
                         description: product.description,
                         price,
                         price_fcfa: Math.round(price * 655.957),
                         image_url: product.image_url,
                         product_url: product.product_url,
                         category: product.category,
                         subcategory: product.subcategory || 'Sans catégorie',
                         site: 'carrefour'
                       }); 
                       toast.success('Ajouté au panier vendeur !', { 
                         autoClose: 1800, 
                         hideProgressBar: true, 
                         style: { background: '#e3fcec', color: '#137333', fontWeight: 600, fontSize: 15 } 
                       });
                     }
                   }}
                 >
                   Ajouter au panier vendeur
                 </span>
          </div>
        ))}
      </div>
        </div>
      ))}
      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 32 }}>
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            style={{
              padding: '8px 18px',
              borderRadius: 14,
              border: 'none',
              background: page === 1 ? '#e0e0e0' : '#003399',
              color: page === 1 ? '#888' : '#fff',
              fontWeight: 600,
              fontSize: 15,
              fontFamily: 'Montserrat, sans-serif',
              boxShadow: page === 1 ? 'none' : '0 2px 8px #00339911',
              cursor: page === 1 ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            Précédent
          </button>
          <span style={{ fontWeight: 600, fontSize: 16, color: '#003399' }}>
            Page {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
            style={{
              padding: '8px 18px',
              borderRadius: 14,
              border: 'none',
              background: page === totalPages ? '#e0e0e0' : '#003399',
              color: page === totalPages ? '#888' : '#fff',
              fontWeight: 600,
              fontSize: 15,
              fontFamily: 'Montserrat, sans-serif',
              boxShadow: page === totalPages ? 'none' : '0 2px 8px #00339911',
              cursor: page === totalPages ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
} 