import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { firestore } from '../firebaseConfig';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { FaSearch } from 'react-icons/fa';
import { useCart } from '../contexts/CartContext';

// Import Google Fonts dynamiquement
const fontLink = document.createElement('link');
fontLink.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap';
fontLink.rel = 'stylesheet';
document.head.appendChild(fontLink);

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function SearchResults() {
  const q = useQuery().get('q') || '';
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [searchInput, setSearchInput] = useState(q);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const allNamesAndCats = React.useMemo(() => {
    const set = new Set();
    results.forEach(prod => {
      if (prod.name) set.add(prod.name);
      if (prod.category) set.add(prod.category);
    });
    return Array.from(set);
  }, [results]);

  // Suggestions dynamiques
  useEffect(() => {
    if (searchInput.trim().length === 0) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const input = searchInput.trim().toLowerCase();
    const filtered = allNamesAndCats.filter(item => item.toLowerCase().includes(input));
    setSuggestions(filtered.slice(0, 8));
    setShowSuggestions(filtered.length > 0);
    setActiveSuggestion(-1);
  }, [searchInput, allNamesAndCats]);

  // Navigation clavier
  const handleInputKeyDown = (e) => {
    if (!showSuggestions) return;
    if (e.key === 'ArrowDown') {
      setActiveSuggestion(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      setActiveSuggestion(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      if (activeSuggestion >= 0 && suggestions[activeSuggestion]) {
        setSearchInput(suggestions[activeSuggestion]);
        setShowSuggestions(false);
        navigate(`/search?q=${encodeURIComponent(suggestions[activeSuggestion])}`);
      } else {
        navigate(`/search?q=${encodeURIComponent(searchInput)}`);
      }
    }
  };

  // Soumission du champ
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (activeSuggestion >= 0 && suggestions[activeSuggestion]) {
      navigate(`/search?q=${encodeURIComponent(suggestions[activeSuggestion])}`);
    } else {
      navigate(`/search?q=${encodeURIComponent(searchInput)}`);
    }
  };

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      setError('');
      try {
        const productsRef = collection(firestore, 'products');
        const snapshot = await getDocs(productsRef);
        const search = q.trim().toLowerCase();
        const filtered = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(prod =>
            (prod.name && prod.name.toLowerCase().includes(search)) ||
            (prod.category && prod.category.toLowerCase().includes(search))
          );
        setResults(filtered);
      } catch (err) {
        setError("Erreur lors de la recherche. Veuillez réessayer.");
      } finally {
        setLoading(false);
      }
    };
    if (q) fetchResults();
    else {
      setResults([]);
      setLoading(false);
    }
  }, [q]);

  // Regrouper les résultats par sous-catégorie (comme dans ActionProducts)
  const grouped = {};
  results.forEach(prod => {
    const subcat = prod.subcategory || 'Autres'; // Fallback si pas de sous-catégorie
    if (!grouped[subcat]) grouped[subcat] = [];
    grouped[subcat].push(prod);
  });
  // Ne pas afficher la section "Autres" si c'est la seule
  const subcatsToShow = Object.keys(grouped).filter(subcat => subcat !== 'Autres' || Object.keys(grouped).length === 1);

  if (loading) {
    return (
      <div style={{ fontFamily: 'Montserrat, sans-serif', textAlign: 'center', fontSize: 16, color: '#1976d2' }}>
        Chargement...
      </div>
    );
  }

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
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8 
      }}>
        <FaSearch style={{ color: '#1976d2' }} />
        Résultats de recherche pour « {q} »
      </h1>

      {/* Champ de recherche avec autocomplétion (préparation) */}
      {/* (SUPPRIMÉ : plus de champ de recherche ici) */}

      {/* Affichage des erreurs */}
      {error && (
        <div style={{
          margin: '16px auto 0 auto',
          maxWidth: 420,
          background: '#ffeaea',
          color: '#b71c1c',
          border: '1.5px solid #ffbdbd',
          borderRadius: 16,
          padding: '14px 24px',
          fontWeight: 600,
          fontSize: 16,
          textAlign: 'center',
          boxShadow: '0 2px 8px #1976d211',
        }}>
          {error}
        </div>
      )}

      {/* Message si aucun résultat */}
      {!error && results.length === 0 && (
        <div style={{
          margin: '16px auto 0 auto',
          maxWidth: 420,
          background: '#e3eafc',
          color: '#1976d2',
          border: '1.5px solid #bbdefb',
          borderRadius: 16,
          padding: '14px 24px',
          fontWeight: 600,
          fontSize: 16,
          textAlign: 'center',
          boxShadow: '0 2px 8px #1976d211',
        }}>
          Aucun résultat pour « {q} »
        </div>
      )}

      {/* Liste des produits regroupés par sous-catégorie */}
      {subcatsToShow.map(subcat => (
        <div key={subcat} style={{ marginBottom: 40 }}>
          {!(subcat === 'Autres' && subcatsToShow.length === 1) && (
            <h2 style={{ 
              color: '#1a237e', 
              marginBottom: 16, 
              fontFamily: 'Montserrat, sans-serif', 
              fontWeight: 600,
              fontSize: 24 
            }}>
              {subcat}
            </h2>
          )}
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
                boxShadow: '0 2px 8px #1976d211' 
              }}>
                <div style={{ 
                  width: '100%', 
                  height: 140, 
                  background: '#fff', // fond blanc pur
                  borderRadius: 8, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  marginBottom: 8, 
                  overflow: 'hidden',
                }}>
                  <img 
                    src={product.imageUrl || 'https://via.placeholder.com/120'} 
                    alt={product.name} 
                    style={{ 
                      maxWidth: '100%', 
                      maxHeight: 120, 
                      objectFit: 'contain', 
                      display: 'block',
                    }} 
                  />
                </div>
                <h3 style={{ fontSize: 18, margin: '8px 0 4px 0', fontWeight: 700, color: '#1976d2' }}>
                  {product.name}
                </h3>
                <div style={{ color: '#888', fontSize: 14, marginBottom: 4 }}>
                  {product.category}
                </div>
                <div style={{ fontSize: 15, marginBottom: 4 }}>
                  <b>Stock :</b> <span style={{ fontWeight: 600 }}>{product.stock || 'N/A'}</span>
                </div>
                <div style={{ fontSize: 15, marginBottom: 4 }}>
                  <b>Prix :</b> <span style={{ color: '#388e3c', fontWeight: 600 }}>
                    {product.price ? product.price.toLocaleString() : 0} FCFA
                  </span>
                </div>
                <button
                  onClick={() => addToCart(product.id, 1)}
                  style={{
                    padding: '10px 28px',
                    borderRadius: 20,
                    border: 'none',
                    fontSize: 16,
                    fontWeight: 700,
                    background: '#4FC3F7',
                    color: '#fff',
                    cursor: 'pointer',
                    boxShadow: '0 6px 24px #1976d211, 0 1.5px 6px #1976d222',
                    transition: 'background 0.2s',
                    fontFamily: 'Montserrat, sans-serif',
                    width: '100%',
                    marginTop: 8,
                    letterSpacing: 0.5,
                  }}
                >
                  Ajouter au panier
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}