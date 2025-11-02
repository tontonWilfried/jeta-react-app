import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSync, FaShoppingCart, FaStore, FaTags } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { FiShoppingBag, FiRefreshCw, FiArrowLeft } from 'react-icons/fi';
import axios from 'axios';
import { useSellerCart } from '../contexts/SellerCartContext';
import { toast } from 'react-toastify';

const SITES = [
  {
    key: 'action',
    name: 'Action',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Action_logo.png',
    description: 'Produits alimentaires, snacks, boissons, friandises, etc.',
    icon: (
      <div className="flex items-center justify-center">
        <FaSync className="animate-spin" style={{ color: '#4FC3F7', fontSize: 36 }} />
      </div>
    ),
    bg: 'bg-[#003399]',
    to: '/seller/scrapping/action',
  },
  {
    key: 'carrefour',
    name: 'Carrefour',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Carrefour_logo.svg/1200px-Carrefour_logo.svg.png',
    description: 'Produits alimentaires, hygiène, électroménager, etc.',
    icon: (
      <div className="flex items-center justify-center" style={{ background: '#003399', borderRadius: '1.5rem', padding: '0.5rem' }}>
        <div style={{ background: '#fff', borderRadius: '50%', border: '4px solid #E30613', width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FaSync className="animate-spin" style={{ color: '#003399', fontSize: 36 }} />
        </div>
      </div>
    ),
    bg: 'bg-[#003399]',
    to: '/seller/scrapping/carrefour',
  },
  {
    key: 'lidl',
    name: 'Lidl',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Lidl_logo.svg/1200px-Lidl_logo.svg.png',
    description: 'Produits alimentaires, boissons, produits frais, etc.',
    icon: (
      <div className="flex items-center justify-center" style={{ background: '#0050AA', borderRadius: '1.5rem', padding: '0.5rem' }}>
        <div style={{ background: '#FFD600', borderRadius: '50%', border: '4px solid #E3001B', width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FaSync className="animate-spin" style={{ color: '#0050AA', fontSize: 36 }} />
        </div>
      </div>
    ),
    bg: 'bg-[#0050AA]',
    to: '/seller/scrapping/lidl',
  },
];

export default function ScrappingSites() {
  const navigate = useNavigate();
  const { currentUser, userData } = useAuth();
  const displayName = userData?.displayName || userData?.name || currentUser?.displayName || currentUser?.name || currentUser?.email || 'Vendeur';

  // Recherche globale produits scrappés
  const [searchTerm, setSearchTerm] = useState('');
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const PRODUCTS_PER_PAGE = 20;

  // Nouveau : filtre par site
  const [siteFilter, setSiteFilter] = useState('all');
  // Remplacer le filtre par site par un filtre de tri
  const [sortOrder, setSortOrder] = useState('default');

  // Ajout des états pour l'auto-complétion
  const [autoComplete, setAutoComplete] = useState([]);
  const [showAutoComplete, setShowAutoComplete] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      axios.get('/api/action-products').then(res => (res.data || []).map(p => ({ ...p, site: 'action' }))).catch(() => []),
      axios.get('/api/carrefour-products').then(res => (res.data || []).map(p => ({ ...p, site: 'carrefour' }))).catch(() => []),
      axios.get('/api/lidl-products').then(res => ((res.data && res.data.products) || []).map(p => ({ ...p, site: 'lidl' }))).catch(() => []),
    ]).then(([action, carrefour, lidl]) => {
      setAllProducts([...action, ...carrefour, ...lidl]);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setAutoComplete([]);
      setShowAutoComplete(false);
      return;
    }
    const suggestions = allProducts
      .filter(p => p.name && p.name.toLowerCase().includes(searchTerm.trim().toLowerCase()))
      .map(p => p.name)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .slice(0, 8);
    setAutoComplete(suggestions);
    setShowAutoComplete(suggestions.length > 0);
  }, [searchTerm, allProducts]);

  const { addToSellerCart, cart } = useSellerCart();

  // Filtrage
  const filtered = allProducts.filter(p =>
    !searchTerm.trim() || (p.name && p.name.toLowerCase().includes(searchTerm.trim().toLowerCase()))
  );

  // Appliquer le tri sur la liste filtrée
  let sorted = [...filtered];
  if (sortOrder === 'asc') {
    sorted.sort((a, b) => (a.price || a.promo_price || 0) - (b.price || b.promo_price || 0));
  } else if (sortOrder === 'desc') {
    sorted.sort((a, b) => (b.price || b.promo_price || 0) - (a.price || a.promo_price || 0));
  }
  const totalPages = Math.ceil(sorted.length / PRODUCTS_PER_PAGE);
  const paginated = sorted.slice((page - 1) * PRODUCTS_PER_PAGE, page * PRODUCTS_PER_PAGE);

  // Affichage
  return (
    <div className="min-h-screen bg-[#f6fafd] py-10 px-4 relative">
      {/* Bouton retour */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/80 hover:bg-[#e3f3fa] shadow text-[#4FC3F7] font-semibold text-base z-30 border border-[#e3f3fa]"
        style={{backdropFilter: 'blur(2px)'}}
      >
        <FiArrowLeft className="w-5 h-5" /> Retour
      </button>
      {/* Panier flottant */}
      <button
        onClick={() => navigate('/seller-cart')}
        className="fixed bottom-6 right-6 z-40 bg-[#4FC3F7] hover:bg-[#0288D1] text-white rounded-full shadow-lg flex items-center justify-center w-16 h-16 border-4 border-white transition-all"
        style={{boxShadow: '0 4px 24px #4FC3F733'}}
      >
        <FaShoppingCart className="w-8 h-8" />
        {cart.length > 0 && (
          <span className="absolute -top-2 -right-2 bg-[#E91E63] text-white text-xs font-bold rounded-full px-2 py-0.5 border-2 border-white">{cart.length}</span>
        )}
      </button>
      {/* Header et recherche */}
      <div className="flex flex-col items-center justify-center mb-10 animate-fadeInUp pt-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-dark drop-shadow-lg flex items-center gap-3 mb-2" style={{paddingBottom: '0.3em', marginBottom: '0.5em'}}>
          <span className="animate-bounce"><FiRefreshCw className="inline-block text-primary-dark" size={44} /></span>
          Scrapping produits
        </h1>
        <p className="text-lg sm:text-xl text-text-secondary font-medium text-center max-w-2xl">
          Recherche dans tous les produits scrappés (Action, Carrefour, Lidl)
        </p>
      </div>
      {/* Barre de recherche slim et soft + filtre de tri */}
      <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-8">
        <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
          <input
            type="text"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
            onFocus={() => setShowAutoComplete(autoComplete.length > 0)}
            onBlur={() => setTimeout(() => setShowAutoComplete(false), 150)}
            placeholder="Rechercher un produit..."
            className="px-3 py-2 rounded-full border border-[#b3e5fc] w-full text-base focus:outline-none focus:ring-2 focus:ring-[#4FC3F7] bg-white shadow-sm transition-all placeholder:text-[#90caf9]"
            style={{fontWeight: 500, minWidth: 0, boxShadow: '0 1px 6px #4FC3F711'}}
          />
          {showAutoComplete && (
            <div style={{
              position: 'absolute',
              top: 44,
              left: 0,
              right: 0,
              background: '#fff',
              border: '1px solid #b3e5fc',
              borderTop: 'none',
              borderRadius: '0 0 12px 12px',
              boxShadow: '0 4px 16px #4FC3F711',
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
                    color: '#4FC3F7',
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
        <select
          value={sortOrder}
          onChange={e => setSortOrder(e.target.value)}
          className="px-3 py-2 rounded-full border border-[#b3e5fc] bg-white text-base text-[#0288D1] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#4FC3F7] transition-all"
          style={{fontWeight: 500, minWidth: 0, boxShadow: '0 1px 6px #4FC3F711'}}
        >
          <option value="default">Tri par défaut</option>
          <option value="asc">Prix : du moins cher au plus cher</option>
          <option value="desc">Prix : du plus cher au moins cher</option>
        </select>
      </div>
      {/* Liste des sites à scrapper (filtrée) */}
      {searchTerm.trim() === '' ? (
        <>
          <h1 className="text-3xl font-bold text-[#4FC3F7] mb-10 text-center">Sélectionnez un site de votre choix </h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {SITES.filter(site => siteFilter === 'all' || site.key === siteFilter).map(site => (
              <div
                key={site.key}
                onClick={() => navigate(site.to)}
                className={`cursor-pointer ${site.bg} rounded-2xl border-2 border-white shadow-md hover:shadow-xl transition-shadow duration-200 flex flex-col items-center justify-center aspect-square p-8 group`}
              >
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[#e3f3fa] mb-4 group-hover:bg-[#4FC3F7] transition-colors">
                  {site.icon}
                </div>
                {site.logo && (
                  <img src={site.logo} alt={site.name} className="w-24 h-10 object-contain mb-3" onError={e => { e.target.style.display = 'none'; }} />
                )}
                <h2 className="text-xl font-bold text-[#4FC3F7] mb-2">{site.name}</h2>
                <div className="text-gray-500 text-sm text-center">{site.description}</div>
              </div>
            ))}
          </div>
        </>
      ) : loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent"></div>
        </div>
      ) : (
        <>
          {paginated.length === 0 ? (
            <div className="text-center text-gray-500 text-lg">Aucun produit trouvé.</div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 max-w-7xl mx-auto mb-8">
                {paginated.map(prod => (
                  <div key={prod.id + '-' + prod.site} className="bg-white rounded-2xl shadow-lg p-5 border border-slate-200 flex flex-col">
                    <img src={prod.image_url || prod.imageUrl || 'https://via.placeholder.com/300x200?text=Produit'} alt={prod.name} className="w-full h-40 object-contain rounded-lg mb-3 bg-white" />
                    <h3 className="font-bold text-lg text-[#4FC3F7] mb-1 truncate">{prod.name}</h3>
                    <div className="text-gray-500 text-sm mb-2 line-clamp-2">{prod.description}</div>
                    <div className="text-sm mb-2">Catégorie : <span className="font-semibold">{prod.category}</span></div>
                    <div className="text-sm mb-2">Sous-catégorie : <span className="font-semibold">{prod.subcategory}</span></div>
                    <div className="text-sm mb-2">Site : <span className="font-semibold capitalize">{prod.site}</span></div>
                    <div className="text-base font-bold mb-2 text-[#00C853]">{prod.price || prod.promo_price} € / {prod.price_fcfa ? Math.round(prod.price_fcfa) : prod.promo_price ? Math.round(prod.promo_price * 655.957) : ''} FCFA</div>
                    <a href={prod.product_url} target="_blank" rel="noopener noreferrer" className="text-[#4FC3F7] font-semibold text-sm mb-2 hover:underline">Voir sur {prod.site.charAt(0).toUpperCase() + prod.site.slice(1)}</a>
                    <button
                      onClick={() => {
                        const price = prod.price || prod.promo_price || 0;
                        addToSellerCart({
                          ...prod,
                          price,
                          price_fcfa: Math.round(price * 655.957),
                          site: prod.site,
                          resalePrice: Math.round(price * 1.3),
                          checked: false,
                          quantity: 1
                        });
                        toast.success('Ajouté au panier vendeur !', {
                          autoClose: 1800,
                          hideProgressBar: true,
                          style: { background: '#e3fcec', color: '#137333', fontWeight: 600, fontSize: 15 }
                        });
                      }}
                      disabled={!!cart.find(p => p.id === prod.id && p.site === prod.site)}
                      className={`mt-2 px-4 py-2 rounded-lg font-semibold transition-all w-full ${cart.find(p => p.id === prod.id && p.site === prod.site) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-[#4FC3F7] text-white hover:bg-[#0288D1]'}`}
                    >
                      {cart.find(p => p.id === prod.id && p.site === prod.site) ? 'Déjà dans le panier' : 'Ajouter au panier vendeur'}
                    </button>
                  </div>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="flex justify-center mt-8 gap-2">
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setPage(i + 1)}
                      className={`px-4 py-2 rounded-lg font-semibold shadow transition-colors duration-200 ${page === i + 1 ? 'bg-[#4FC3F7] text-white' : 'bg-gray-100 text-[#4FC3F7] hover:bg-blue-50'}`}
                    >
                      Page {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
} 