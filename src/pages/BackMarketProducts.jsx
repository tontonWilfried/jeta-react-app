import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useSellerCart } from '../contexts/SellerCartContext';
import { useAuth } from '../contexts/AuthContext';
import { FiShoppingBag, FiRefreshCw, FiFilter, FiSearch, FiArrowLeft } from 'react-icons/fi';
import { FaShoppingCart, FaTags } from 'react-icons/fa';

export default function BackMarketProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('Smartphones');
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
  const { addToSellerCart } = useSellerCart();
  const { currentUser } = useAuth();
  const isSeller = currentUser && (currentUser.role === 'seller' || currentUser.isSeller);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('http://localhost:3001/api/backmarket-products')
      .then(res => res.json())
      .then(data => {
        setProducts(data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Erreur lors du chargement des produits BackMarket:', error);
        setLoading(false);
      });
  }, []);

  // Extraire toutes les catégories uniques
  const categories = Array.from(new Set(products.map(p => p.category))).sort();

  // Sous-catégories pour la catégorie sélectionnée
  const subcategories = Array.from(
    new Set(products.filter(p => p.category === selectedCategory).map(p => p.subcategory))
  ).sort();

  // Filtrer les produits selon la catégorie et la sous-catégorie sélectionnées
  let filteredProducts = products.filter(
    p =>
      p.category === selectedCategory &&
      (selectedSubcat === 'Toutes' || p.subcategory === selectedSubcat)
  );

  // Trier selon le choix de l'utilisateur
  if (priceSort === 'asc') {
    filteredProducts.sort((a, b) => a.price - b.price);
  } else if (priceSort === 'desc') {
    filteredProducts.sort((a, b) => b.price - a.price);
  }

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);
  const startIndex = (page - 1) * PRODUCTS_PER_PAGE;
  const endIndex = startIndex + PRODUCTS_PER_PAGE;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  const handleRefresh = async () => {
    if (refreshDisabled) return;
    setRefreshing(true);
    setRefreshDisabled(true);
    setProgress(0);
    setNotif('Démarrage du scraping BackMarket...');

    try {
      const response = await fetch('http://localhost:3001/api/scrape-backmarket', {
        method: 'POST',
      });

      if (response.ok) {
        const eventSource = new EventSource('http://localhost:3001/api/scrape-backmarket/progress');
        eventSourceRef.current = eventSource;

        eventSource.onmessage = (event) => {
          const data = JSON.parse(event.data);
          setProgress(data.progress);
          setNotif(data.message);

          if (data.progress === 100) {
            eventSource.close();
            setRefreshing(false);
            setNotif('Scraping terminé ! Rechargement des produits...');
            
            // Recharger les produits
            setTimeout(() => {
              fetch('http://localhost:3001/api/backmarket-products')
                .then(res => res.json())
                .then(data => {
                  setProducts(data);
                  setNotif(null);
                  setProgress(null);
                });
            }, 2000);
          }
        };

        eventSource.onerror = () => {
          eventSource.close();
          setRefreshing(false);
          setNotif('Erreur lors du scraping');
          setProgress(null);
        };
      } else {
        setRefreshing(false);
        setNotif('Erreur lors du démarrage du scraping');
        setProgress(null);
      }
    } catch (error) {
      setRefreshing(false);
      setNotif('Erreur de connexion au serveur');
      setProgress(null);
    }

    setTimeout(() => setRefreshDisabled(false), 30000); // 30 secondes de cooldown
  };

  const handleAddToCart = (product) => {
    if (isSeller) {
      addToSellerCart({
        ...product,
        resalePrice: Math.round(product.price * 1.3), // Prix de revente suggéré
        checked: false,
        quantity: 1
      });
    } else {
      addToCart(product);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6fafd] py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/seller/scrapping')}
              className="flex items-center gap-2 text-[#4FC3F7] hover:text-[#4FC3F7]/80 transition-colors"
            >
              <FiArrowLeft className="w-5 h-5" />
              <span>Retour</span>
            </button>
            <div className="flex items-center gap-3">
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/2/2e/Back_Market_logo.png"
                alt="BackMarket"
                className="w-12 h-12 object-contain"
              />
              <div>
                <h1 className="text-2xl font-bold text-[#4FC3F7]">Produits BackMarket</h1>
                <p className="text-gray-600">Reconditionné : smartphones, high-tech, électroménager</p>
              </div>
            </div>
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={refreshDisabled || refreshing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
              refreshDisabled || refreshing
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-[#222] text-white hover:bg-[#222]/90'
            }`}
          >
            <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Scraping...' : 'Actualiser'}
          </button>
        </div>

        {/* Progress bar */}
        {refreshing && progress !== null && (
          <div className="mb-6 bg-white rounded-lg p-4 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">{notif}</span>
              <span className="text-sm font-medium text-[#4FC3F7]">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-[#4FC3F7] h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Filtres */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FiFilter className="inline w-4 h-4 mr-1" />
                Catégorie
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setSelectedSubcat('Toutes');
                  setPage(1);
                }}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4FC3F7] focus:border-transparent"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FiFilter className="inline w-4 h-4 mr-1" />
                Sous-catégorie
              </label>
              <select
                value={selectedSubcat}
                onChange={(e) => {
                  setSelectedSubcat(e.target.value);
                  setPage(1);
                }}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4FC3F7] focus:border-transparent"
              >
                <option value="Toutes">Toutes</option>
                {subcategories.map(subcat => (
                  <option key={subcat} value={subcat}>{subcat}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FiFilter className="inline w-4 h-4 mr-1" />
                Trier par prix
              </label>
              <select
                value={priceSort}
                onChange={(e) => {
                  setPriceSort(e.target.value);
                  setPage(1);
                }}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4FC3F7] focus:border-transparent"
              >
                <option value="default">Par défaut</option>
                <option value="asc">Prix croissant</option>
                <option value="desc">Prix décroissant</option>
              </select>
            </div>
          </div>
        </div>

        {/* Résultats */}
        <div className="mb-6">
          <p className="text-gray-600">
            {filteredProducts.length} produit(s) trouvé(s)
            {selectedCategory !== 'Toutes' && ` dans ${selectedCategory}`}
            {selectedSubcat !== 'Toutes' && ` > ${selectedSubcat}`}
          </p>
        </div>

        {/* Grille de produits */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4FC3F7]"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {paginatedProducts.map((product, index) => (
              <div key={index} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                <div className="aspect-w-3 aspect-h-2 bg-gray-100">
                  <img
                    src={product.imageUrl || 'https://via.placeholder.com/300x200?text=BackMarket'}
                    alt={product.name}
                    className="w-full h-48 object-contain p-4"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{product.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">{product.category}</p>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-lg font-bold text-[#00C853]">{product.price} FCFA</span>
                    <span className="text-xs text-gray-500">BackMarket</span>
                  </div>
                  <button
                    onClick={() => handleAddToCart(product)}
                    className="w-full bg-[#4FC3F7] text-white py-2 px-4 rounded-lg hover:bg-[#4FC3F7]/90 transition-colors flex items-center justify-center gap-2"
                  >
                    <FaShoppingCart className="w-4 h-4" />
                    {isSeller ? 'Ajouter au panier vendeur' : 'Ajouter au panier'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-8">
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Précédent
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`px-3 py-2 rounded-lg border ${
                    page === pageNum
                      ? 'bg-[#4FC3F7] text-white border-[#4FC3F7]'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              ))}
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 