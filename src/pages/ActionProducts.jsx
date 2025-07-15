import React, { useEffect, useState, useRef } from 'react';
import { useCart } from '../contexts/CartContext';
import { toast } from 'react-toastify';
import { useSellerCart } from '../contexts/SellerCartContext';
import { useAuth } from '../contexts/AuthContext';
import { useState as useReactState } from 'react';
import { useNavigate } from 'react-router-dom';

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

function isToday(dateString) {
  if (!dateString) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateString.slice(0, 10) === today;
}

function isRecent(dateString) {
  if (!dateString) return false;
  const now = new Date();
  const scraped = new Date(dateString);
  const diffTime = now - scraped;
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays < 7;
}

export default function ActionProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('Boissons & Alimentation');
  const [selectedSubcat, setSelectedSubcat] = useState('Toutes');
  const [refreshDisabled, setRefreshDisabled] = useState(false);
  const [priceSort, setPriceSort] = useState('default');
  const [page, setPage] = useState(1);
  const PRODUCTS_PER_PAGE = 20;
  const [refreshing, setRefreshing] = useState(false);
  const [notif, setNotif] = useState(null);
  const [progress, setProgress] = useState(null);
  const eventSourceRef = useRef(null);
  const { addToCart } = useCart();
  const { addToSellerCart, cart: sellerCart, removeFromSellerCart, updateQuantity, toggleChecked, setResalePrice, total, totalResale, benefit, clearSellerCart } = useSellerCart();
  const { currentUser } = useAuth();
  const isSeller = currentUser && (currentUser.role === 'seller' || currentUser.isSeller);
  const [showSellerCart, setShowSellerCart] = useReactState(false);
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [autoComplete, setAutoComplete] = useState([]);
  const [showAutoComplete, setShowAutoComplete] = useState(false);

  useEffect(() => {
    fetch('http://localhost:3001/api/action-products')
      .then(res => res.json())
      .then(data => {
        setProducts(data);
        setLoading(false);
      });
  }, []);

  // Extraire toutes les catégories uniques + Nouveautés si besoin
  const baseCategories = Array.from(new Set(products.map(p => p.category))).sort();
  const hasNouveautes = products.some(p => p.is_new === 1 || p.is_new === true);
  const categories = hasNouveautes ? ['Nouveautés', ...baseCategories] : baseCategories;

  // Sous-catégories pour la catégorie sélectionnée
  const subcategories = Array.from(
    new Set(products.filter(p => p.category === selectedCategory).map(p => p.subcategory))
  ).sort();

  // Filtrer les produits selon la catégorie, la sous-catégorie et la recherche
  let filteredProducts = products.filter(
    p =>
      ((selectedCategory === 'Nouveautés' && (p.is_new === 1 || p.is_new === true)) ||
       (selectedCategory !== 'Nouveautés' && (selectedCategory === '' || p.category === selectedCategory))) &&
      (selectedSubcat === 'Toutes' || p.subcategory === selectedSubcat) &&
      (searchTerm.trim() === '' || (p.name && p.name.toLowerCase().includes(searchTerm.trim().toLowerCase())))
  );

  // Trier selon le choix de l'utilisateur
  if (priceSort === 'asc') {
    filteredProducts = filteredProducts.slice().sort((a, b) => a.price - b.price);
  } else if (priceSort === 'desc') {
    filteredProducts = filteredProducts.slice().sort((a, b) => b.price - a.price);
  }

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice((page - 1) * PRODUCTS_PER_PAGE, page * PRODUCTS_PER_PAGE);

  // Regrouper les produits paginés par sous-catégorie
  const grouped = {};
  paginatedProducts.forEach(prod => {
    if (!grouped[prod.subcategory]) grouped[prod.subcategory] = [];
    grouped[prod.subcategory].push(prod);
  });

  // Supprimer la section Nouveautés en haut de page (elle est maintenant une catégorie)

  useEffect(() => {
    if (selectedSubcat !== 'Toutes') {
      setRefreshDisabled(!canRefreshToday(selectedSubcat));
    } else {
      setRefreshDisabled(true);
    }
    setPage(1); // Réinitialiser la page si filtre change
    setNotif(null); // Efface la notification quand on change de catégorie
  }, [selectedSubcat, selectedCategory, priceSort]);

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
      const prodRes = await fetch('http://localhost:3001/api/action-products');
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
      case 'Boissons & Alimentation': return 'food';
      case 'Décorations': return 'decorations';
      case 'Cuisine': return 'cuisine';
      case 'Articles Ménagers': return 'menagers';
      case 'Papeterie et Bureau': return 'papeterie';
      case 'Hobby': return 'hobby';
      default: return '';
    }
  }

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

  if (loading) return <div style={{ fontFamily: 'Montserrat, sans-serif', textAlign: 'center' }}>Chargement...</div>;

  return (
    <div style={{ 
      padding: 24, 
      fontFamily: 'Montserrat, sans-serif', 
      background: '#f8fafc', 
      minHeight: '100vh' 
    }}>
      {/* Titre centré */}
      <h1 style={{ 
        fontFamily: 'Montserrat, sans-serif', 
        fontWeight: 700, 
        fontSize: 32, 
        color: '#1976d2', 
        marginBottom: 24, 
      }}>Catalogue Action</h1>
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
            boxShadow: '0 1px 2px rgba(25, 118, 210, 0.04)',
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
            boxShadow: '0 4px 16px #1976d211',
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
                  color: '#1976d2',
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
            boxShadow: '0 6px 24px #1976d211, 0 1.5px 6px #1976d222',
            padding: 2,
          }}>
            <select
              value={selectedCategory}
              onChange={e => {
                setSelectedCategory(e.target.value);
                setSelectedSubcat('Toutes');
              }}
              style={{
                padding: '10px 32px 10px 16px',
                borderRadius: 20,
                border: 'none',
                fontSize: 16,
                fontWeight: 700,
                background: 'transparent',
                color: '#1976d2',
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
                fill: '#1976d2',
                opacity: 0.7,
              }}
              viewBox="0 0 24 24"
            >
              <path d="M7 10l5 5 5-5z" />
            </svg>
          </div>
        </div>
        {/* Filtre sous-catégorie */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 220 }}>
          <label style={{ fontWeight: 600, fontSize: 15, color: '#333', marginBottom: 8, textAlign: 'center' }}>
            Filtrer par sous-catégorie :
          </label>
          <div style={{
            position: 'relative',
            background: 'linear-gradient(135deg, #f3f6fa 60%, #eaf1fb 100%)',
            borderRadius: 20,
            boxShadow: '0 6px 24px #1976d211, 0 1.5px 6px #1976d222',
            padding: 2,
          }}>
            <select
              value={selectedSubcat}
              onChange={e => setSelectedSubcat(e.target.value)}
              style={{
                padding: '10px 32px 10px 16px',
                borderRadius: 20,
                border: 'none',
                fontSize: 16,
                fontWeight: 700,
                background: 'transparent',
                color: '#1976d2',
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
              onFocus={e => e.target.parentNode.style.boxShadow = '0 0 0 4px #1976d244, 0 6px 24px #1976d211'}
              onBlur={e => e.target.parentNode.style.boxShadow = '0 6px 24px #1976d211, 0 1.5px 6px #1976d222'}
            >
              <option value="Toutes">Toutes</option>
              {subcategories.map(subcat => (
                <option key={subcat} value={subcat}>{subcat}</option>
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
                fill: '#1976d2',
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
            boxShadow: '0 6px 24px #1976d211, 0 1.5px 6px #1976d222',
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
                color: '#1976d2',
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
                fill: '#1976d2',
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
              background: refreshing ? '#b0bec5' : '#1976d2',
              color: '#fff',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              boxShadow: '0 6px 24px #1976d211, 0 1.5px 6px #1976d222',
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
            background: '#1976d2',
            color: '#fff',
            cursor: 'pointer',
            boxShadow: '0 6px 24px #1976d211, 0 1.5px 6px #1976d222',
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
          color: notif && notif.type === 'success' ? '#137333' : notif && notif.type === 'error' ? '#b71c1c' : '#1976d2',
          border: `1.5px solid ${notif && notif.type === 'success' ? '#b2f2d6' : notif && notif.type === 'error' ? '#ffbdbd' : '#bbdefb'}`,
          borderRadius: 16,
          padding: '14px 24px',
          fontWeight: 600,
          fontSize: 16,
          textAlign: 'center',
          boxShadow: '0 2px 8px #1976d211',
        }}>
          {progress !== null && (
            <>
              <div style={{ marginBottom: 8 }}>Actualisation en cours...</div>
              <div style={{
                height: 12,
                borderRadius: 8,
                background: '#e3eafc',
                overflow: 'hidden',
                boxShadow: '0 1.5px 6px #1976d222',
              }}>
                <div style={{
                  width: `${progress}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #1976d2 60%, #42a5f5 100%)',
                  transition: 'width 0.3s ease-in-out',
                  borderRadius: 8,
                }} />
              </div>
              <div style={{
                textAlign: 'center',
                fontWeight: 600,
                fontSize: 13,
                color: '#1976d2',
                marginTop: 4,
                letterSpacing: 0.5,
                fontFamily: 'Montserrat, sans-serif',
              }}>{progress}%</div>
            </>
          )}
          {notif && <div style={{ marginTop: progress !== null ? 8 : 0 }}>{notif.message}</div>}
        </div>
      )}

      {/* Section Nouveautés */}
      {/* Supprimer la section Nouveautés en haut de page (elle est maintenant une catégorie) */}

      {/* Liste des produits paginés */}
      {Object.keys(grouped).map(subcat => (
        <div key={subcat} style={{ marginBottom: 40 }}>
          <h2 style={{ 
            color: '#1a237e', 
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
            {grouped[subcat].map(prod => (
              <div key={prod.id} style={{ 
                border: '1px solid #eee', 
                borderRadius: 12, 
                padding: 16, 
                background: '#fff', 
                fontFamily: 'Montserrat, sans-serif', 
                boxShadow: '0 2px 8px #1976d211', 
                position: 'relative', // AJOUT ICI
              }}>
                <img 
                  src={prod.image_url} 
                  alt={prod.name} 
                  style={{ 
                    width: '100%', 
                    height: 140, 
                    objectFit: 'contain', 
                    marginBottom: 8, 
                    background: '#f5f5f5', 
                    borderRadius: 8 
                  }} 
                />
                {isRecent(prod.first_scraped_at) && (
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
                <h3 style={{ fontSize: 18, margin: '8px 0 4px 0', fontWeight: 700 }}>
                  {prod.name}
                </h3>
                <div style={{ color: '#888', fontSize: 14, marginBottom: 4 }}>
                  {prod.description}
                </div>
                <div style={{ fontSize: 15, marginBottom: 4 }}>
                  <b>Prix :</b> {prod.price} € /{' '}
                  <span style={{ color: '#388e3c', fontWeight: 600 }}>
                    {prod.price_fcfa} FCFA
                  </span>
                </div>
                <a 
                  href={prod.product_url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ color: '#1976d2', fontWeight: 600, fontSize: 15, marginBottom: 2, display: 'inline-block' }}
                >
                  Voir sur Action
                </a>
                <span
                  onClick={() => { addToSellerCart({
                    id: prod.id,
                    name: prod.name,
                    description: prod.description,
                    price: prod.price,
                    price_fcfa: prod.price_fcfa,
                    image_url: prod.image_url,
                    product_url: prod.product_url,
                    category: prod.category,
                    subcategory: prod.subcategory,
                    site: 'action'
                  }); toast.success('Ajouté au panier !', { autoClose: 1800, hideProgressBar: true, style: { background: '#e3fcec', color: '#137333', fontWeight: 600, fontSize: 15 } }); }}
                  style={{
                    color: '#1976d2',
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
                  onKeyPress={e => { if (e.key === 'Enter') addToSellerCart({ id: prod.id, name: prod.name, description: prod.description, price: prod.price, price_fcfa: prod.price_fcfa, image_url: prod.image_url, product_url: prod.product_url, category: prod.category, subcategory: prod.subcategory }); }}
                >
                  Ajouter au panier
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
              background: page === 1 ? '#e0e0e0' : '#1976d2',
              color: page === 1 ? '#888' : '#fff',
              fontWeight: 600,
              fontSize: 15,
              fontFamily: 'Montserrat, sans-serif',
              boxShadow: page === 1 ? 'none' : '0 2px 8px #1976d211',
              cursor: page === 1 ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            Précédent
          </button>
          <span style={{ fontWeight: 600, fontSize: 16, color: '#1976d2' }}>
            Page {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
            style={{
              padding: '8px 18px',
              borderRadius: 14,
              border: 'none',
              background: page === totalPages ? '#e0e0e0' : '#1976d2',
              color: page === totalPages ? '#888' : '#fff',
              fontWeight: 600,
              fontSize: 15,
              fontFamily: 'Montserrat, sans-serif',
              boxShadow: page === totalPages ? 'none' : '0 2px 8px #1976d211',
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