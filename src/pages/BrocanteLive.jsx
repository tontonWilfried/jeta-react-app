import React, { useState, useEffect, useCallback } from 'react';
import { firestore, auth } from '../firebaseConfig';
import { collection, query, where, orderBy, limit, startAfter, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { FaSearch, FaFilter, FaSort, FaSpinner, FaShoppingCart, FaHeart, FaMapMarkerAlt, FaTag, FaDollarSign, FaTimesCircle } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { FiTrendingUp } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';

const BrocanteLive = () => {
  const { currentUser } = useAuth();
  const { addToCart } = useCart();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [addingToCart, setAddingToCart] = useState({});
  const [addingToFavorites, setAddingToFavorites] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [userFavorites, setUserFavorites] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedCity, setSelectedCity] = useState('');
  const [cityOptions, setCityOptions] = useState([]);

  // Filters and Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [productCondition, setProductCondition] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  const PRODUCTS_PER_PAGE = 20;

  const productCategories = [
    { value: '', label: 'Toutes les catégories' },
    { value: 'vetements', label: 'Vêtements' },
    { value: 'electronique', label: 'Électronique' },
    { value: 'maison', label: 'Maison & Jardin' },
    { value: 'livres', label: 'Livres & Média' },
    { value: 'jouets', label: 'Jouets & Jeux' },
    { value: 'vehicules', label: 'Véhicules & Pièces' },
    { value: 'art', label: 'Art & Collection' },
    { value: 'aliments', label: 'Nutrition' },
    { value: 'cosmetiques', label: 'Cosmetique' },
    { value: 'accessoires', label: 'Accessoire & Bijoux' },
    { value: 'autres', label: 'Autres' },
  ];

  const productConditions = [
    { value: '', label: 'Tous les états' },
    { value: 'neuf', label: 'Neuf' },
    { value: 'occasion', label: 'Occasion' },
  ];

  // Liste fixe des villes principales du Cameroun
  const CITIES = [
    'Yaoundé', 'Douala', 'Bafoussam', 'Garoua', 'Maroua', 'Bamenda', 'Ngaoundéré', 'Kumba',
    'Ebolowa', 'Kribi', 'Bertoua', 'Limbé', 'Nkongsamba', 'Edéa', 'Foumban', 'Dschang'
  ];

  // Supprime le useEffect qui chargeait cityOptions dynamiquement
  // Remplace cityOptions par CITIES dans le select ville

  const fetchProducts = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');

    let baseQuery = collection(firestore, 'products');
    let queryConstraints = [where('isVisible', '==', true)];
    let activeRangeFilterField = null;

    // 1. Apply equality filters first
    if (selectedCategory) {
      queryConstraints.push(where('category', '==', selectedCategory));
    }
    if (productCondition) {
      queryConstraints.push(where('type', '==', productCondition));
    }

    // 2. Determine the single range filter
    if (searchTerm && (minPrice || maxPrice)) {
      let alreadyWarnedNameAndPrice = false;
      if (searchTerm && (minPrice || maxPrice) && !alreadyWarnedNameAndPrice) {
        toast.warn("La recherche par nom et le filtrage par prix ne peuvent pas être combinés. Le filtre par prix sera ignoré.");
        alreadyWarnedNameAndPrice = true;
      }
    } else if (minPrice || maxPrice) {
      if (minPrice) {
        queryConstraints.push(where('price', '>=', parseFloat(minPrice)));
      }
      if (maxPrice) {
        queryConstraints.push(where('price', '<=', parseFloat(maxPrice)));
      }
      activeRangeFilterField = 'price';
    }

    // 3. Apply sorting
    let orderByConstraints = [];
    if (activeRangeFilterField) {
      // Toujours d'abord le champ du filtre range
      orderByConstraints.push(orderBy(activeRangeFilterField, sortOrder));
      // Si on trie par autre chose, on ajoute ce tri (sauf si c'est déjà le champ du filtre range)
      if (sortBy !== activeRangeFilterField) {
        orderByConstraints.push(orderBy(sortBy, sortOrder));
      }
      // Si ni le filtre range ni le tri n'est 'createdAt', on ajoute 'createdAt' pour stabilité
      if (activeRangeFilterField !== 'createdAt' && sortBy !== 'createdAt') {
        orderByConstraints.push(orderBy('createdAt', 'desc'));
      }
    } else {
      // Pas de filtre range, on trie normalement
      orderByConstraints.push(orderBy(sortBy, sortOrder));
      if (sortBy !== 'createdAt') {
        orderByConstraints.push(orderBy('createdAt', 'desc'));
      }
    }

    // Pagination: skip (page-1)*PRODUCTS_PER_PAGE docs
    let productsQuery = query(baseQuery, ...queryConstraints, ...orderByConstraints);
    let docsToSkip = (page - 1) * PRODUCTS_PER_PAGE;
    let lastVisible = null;
    let allDocs = [];
    let alreadyNotifiedNoResult = false;
    try {
      // Get all docs up to the current page (inefficient for large collections, but works for now)
      const querySnapshot = await getDocs(productsQuery);
      allDocs = querySnapshot.docs;
      setTotalProducts(allDocs.length);
      // Filtrer pour masquer les produits du vendeur connecté
      let filteredDocs = allDocs;
      if (searchTerm) {
        const search = searchTerm.trim().toLowerCase();
        filteredDocs = allDocs.filter(doc => {
          const name = (doc.data().name || '').toLowerCase();
          return name.includes(search);
        });
      }
      // Masquer les produits du vendeur connecté
      if (currentUser && currentUser.uid) {
        filteredDocs = filteredDocs.filter(doc => doc.data().sellerUid !== currentUser.uid);
      }
      
      // Filtrage par ville du vendeur (si sélectionnée)
      if (selectedCity) {
        // Récupérer les vendeurs de cette ville
        const usersRef = collection(firestore, 'users');
        const usersQuery = query(usersRef, where('ville', '==', selectedCity));
        const usersSnap = await getDocs(usersQuery);
        const sellerUidsInCity = new Set();
        usersSnap.docs.forEach(userDoc => {
          sellerUidsInCity.add(userDoc.id);
        });
        
        // Filtrer les produits selon les vendeurs de cette ville
        filteredDocs = filteredDocs.filter(doc => {
          const prod = doc.data();
          return sellerUidsInCity.has(prod.sellerUid);
        });
      }
      
      const pageDocs = filteredDocs.slice(docsToSkip, docsToSkip + PRODUCTS_PER_PAGE);
      const newProducts = pageDocs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(newProducts);
      setHasMore((docsToSkip + PRODUCTS_PER_PAGE) < filteredDocs.length);
      setTotalProducts(filteredDocs.length);
      // Afficher le toast 'Aucun produit...' seulement si ce n'est pas déjà affiché pour cette recherche
      if (newProducts.length === 0 && !alreadyNotifiedNoResult) {
        alreadyNotifiedNoResult = true;
        // Afficher le message dans la page, pas en toast
        // toast.info("Aucun produit ne correspond à vos critères de recherche.");
      } else if (newProducts.length > 0) {
        alreadyNotifiedNoResult = false;
      }
      if (!setHasMore && page > 1) {
        toast.info("Tous les produits sont déjà affichés.");
      }
    } catch (err) {
      console.error("Erreur lors de la récupération des produits:", err);
      setError("Impossible de charger les produits. Veuillez réessayer.");
      toast.error("Impossible de charger les produits. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedCategory, productCondition, minPrice, maxPrice, sortBy, sortOrder, currentUser, selectedCity]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, productCondition, minPrice, maxPrice, sortBy, sortOrder, searchTerm]);

  useEffect(() => {
    fetchProducts(currentPage);
  }, [currentPage, fetchProducts]);

  // Charger les favoris de l'utilisateur
  useEffect(() => {
    if (currentUser) {
      loadUserFavorites();
    }
  }, [currentUser]);

  const loadUserFavorites = async () => {
    try {
      const favoritesRef = doc(firestore, 'favorites', currentUser.uid);
      const favoritesDoc = await getDoc(favoritesRef);
      if (favoritesDoc.exists()) {
        const favoritesData = favoritesDoc.data();
        const favoritesList = favoritesData.items || [];
        setUserFavorites(favoritesList.map(item => item.productId));
      } else {
        setUserFavorites([]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des favoris:', error);
    }
  };

  const isProductFavorite = (productId) => {
    return userFavorites.includes(productId);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('');
    setMinPrice('');
    setMaxPrice('');
    setProductCondition('');
    setSortBy('createdAt');
    setSortOrder('desc');
    setSelectedCity(''); // Clear city filter
  };

  // Function to add product to cart
  const handleAddToCart = async (product) => {
    if (!currentUser) {
      toast.error('Veuillez vous connecter pour ajouter des articles au panier');
      return;
    }

    if (product.stock < 1) {
      toast.error('Ce produit n\'est plus en stock');
      return;
    }

    setAddingToCart(prev => ({ ...prev, [product.id]: true }));

    try {
      await addToCart(product.id, 1);
    } catch (error) {
      console.error('Erreur lors de l\'ajout au panier:', error);
    } finally {
      setAddingToCart(prev => ({ ...prev, [product.id]: false }));
    }
  };

  // Function to add to favorites
  const addToFavorites = async (product) => {
    if (!currentUser) {
      toast.error('Veuillez vous connecter pour ajouter aux favoris');
      return;
    }

    setAddingToFavorites(prev => ({ ...prev, [product.id]: true }));

    try {
      const favoritesRef = doc(firestore, 'favorites', currentUser.uid);
      const favoritesDoc = await getDoc(favoritesRef);

      let favorites = [];
      if (favoritesDoc.exists()) {
        favorites = favoritesDoc.data().items || [];
      }

      const isAlreadyFavorite = favorites.some(item => item.productId === product.id);
      
      if (isAlreadyFavorite) {
        toast.info('Ce produit est déjà dans vos favoris');
        return;
      }

      favorites.push({
        productId: product.id,
        addedAt: Date.now()
      });

      if (favoritesDoc.exists()) {
        await updateDoc(favoritesRef, {
          items: favorites,
          updatedAt: serverTimestamp()
        });
      } else {
        await setDoc(favoritesRef, {
          userId: currentUser.uid,
          items: favorites,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      toast.success('Produit ajouté aux favoris !');
      loadUserFavorites(); // Re-fetch favorites to update the state
    } catch (error) {
      console.error('Erreur lors de l\'ajout aux favoris:', error);
      toast.error('Erreur lors de l\'ajout aux favoris');
    } finally {
      setAddingToFavorites(prev => ({ ...prev, [product.id]: false }));
    }
  };

  // Function to render product cards
  const renderProductCard = (product) => (
    <div key={product.id} className="bg-[#f6fafd] rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 flex flex-col border-2 border-white">
      <div className="w-full aspect-[3/2] overflow-hidden rounded-t-lg bg-white relative flex items-center justify-center">
        <img
          src={product.imageUrl || 'https://via.placeholder.com/150'}
          alt={product.name}
          className="w-full h-full object-contain"
        />
        {/* Stock indicator */}
        {product.stock < 5 && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
            Stock limité
          </div>
        )}
        {/* Favoris button */}
        <button
          onClick={() => addToFavorites(product)}
          disabled={addingToFavorites[product.id]}
          className={`absolute top-2 right-2 p-2 rounded-full transition-all duration-200 ${
            isProductFavorite(product.id)
              ? 'bg-red-500 text-white shadow-lg'
              : 'bg-white/80 text-gray-600 hover:bg-white hover:text-red-500'
          } ${addingToFavorites[product.id] ? 'opacity-50' : ''}`}
        >
          {addingToFavorites[product.id] ? (
            <FaSpinner className="w-4 h-4 animate-spin" />
          ) : (
            <FaHeart className="w-4 h-4" />
          )}
        </button>
      </div>
      <div className="p-4 flex flex-col flex-grow text-left">
        <h3 className="text-base font-bold text-[#4FC3F7] mb-1 truncate capitalize leading-tight tracking-wide">{product.name}</h3>
        <p className="text-xs text-gray-500 mb-1 line-clamp-2 min-h-[20px]">{product.description}</p>
        <div className="text-xs text-gray-700 mb-1">
          {product.type && (
            <span>Type : {product.type === 'neuf' ? 'Neuf' : 'Occasion'}</span>
          )}
          {product.type && typeof product.stock === 'number' && <span> | </span>}
          {typeof product.stock === 'number' && (
            <span>Stock : {product.stock}</span>
          )}
        </div>
        <div className="text-sm font-semibold mb-2">
          Prix : <span className="text-[#00C853] font-bold">{product.price} FCFA</span>
        </div>
        <div className="flex justify-center items-center gap-3 mt-4">
          <button 
            onClick={() => handleAddToCart(product)}
            disabled={addingToCart[product.id] || product.stock < 1}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors text-sm font-semibold ${
              addingToCart[product.id] || product.stock < 1
                ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                : 'bg-[#4FC3F7] hover:bg-[#0288D1] text-white'
            }`}
          >
            {addingToCart[product.id] ? (
              <FaSpinner className="w-4 h-4 animate-spin" />
            ) : (
              <FaShoppingCart className="w-4 h-4" />
            )}
            {product.stock < 1 ? 'Rupture' : 'Ajouter'}
          </button>
          <button
            className="px-4 py-2 rounded-md bg-gray-100 text-[#4FC3F7] font-semibold hover:bg-blue-50 transition-colors text-sm"
            onClick={() => setSelectedProduct(product)}
          >
            Détails
          </button>
        </div>
      </div>
    </div>
  );

  // Pagination controls
  const totalPages = Math.ceil(products.length === PRODUCTS_PER_PAGE && hasMore ? (currentPage + 1) * PRODUCTS_PER_PAGE : (currentPage * PRODUCTS_PER_PAGE));
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Ajoute une fonction utilitaire pour compter les filtres actifs
  const getActiveFiltersCount = () => {
    let count = 0;
    if (selectedCategory) count++;
    if (productCondition) count++;
    if (selectedCity) count++;
    if (minPrice) count++;
    if (maxPrice) count++;
    if (sortBy !== 'createdAt' || sortOrder !== 'desc') count++;
    return count;
  };

  const navigate = useNavigate();

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
      {/* Filtres slim et soft */}
      <div className="flex flex-wrap gap-3 mb-6 items-center justify-center mt-16">
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Rechercher..."
          className="px-3 py-2 rounded-full border border-[#b3e5fc] bg-white text-base focus:outline-none focus:ring-2 focus:ring-[#4FC3F7] shadow-sm placeholder:text-[#90caf9] transition-all"
          style={{fontWeight: 500, minWidth: 0, boxShadow: '0 1px 6px #4FC3F711', maxWidth: 220}}
        />
        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          className="px-3 py-2 rounded-full border border-[#b3e5fc] bg-white text-base text-[#0288D1] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#4FC3F7] transition-all"
          style={{fontWeight: 500, minWidth: 0, boxShadow: '0 1px 6px #4FC3F711'}}
        >
          {productCategories.filter((cat, idx, arr) => arr.findIndex(c => c.value === cat.value) === idx).map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
        <input
          type="number"
          value={minPrice}
          onChange={e => setMinPrice(e.target.value)}
          placeholder="Prix min"
          className="px-3 py-2 rounded-full border border-[#b3e5fc] bg-white text-base focus:outline-none focus:ring-2 focus:ring-[#4FC3F7] shadow-sm placeholder:text-[#90caf9] transition-all"
          style={{fontWeight: 500, minWidth: 0, boxShadow: '0 1px 6px #4FC3F711', width: 160}}
        />
        <input
          type="number"
          value={maxPrice}
          onChange={e => setMaxPrice(e.target.value)}
          placeholder="Prix max"
          className="px-3 py-2 rounded-full border border-[#b3e5fc] bg-white text-base focus:outline-none focus:ring-2 focus:ring-[#4FC3F7] shadow-sm placeholder:text-[#90caf9] transition-all"
          style={{fontWeight: 500, minWidth: 0, boxShadow: '0 1px 6px #4FC3F711', width: 160}}
        />
        <select
          value={productCondition}
          onChange={e => setProductCondition(e.target.value)}
          className="px-3 py-2 rounded-full border border-[#b3e5fc] bg-white text-base text-[#0288D1] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#4FC3F7] transition-all"
          style={{fontWeight: 500, minWidth: 0, boxShadow: '0 1px 6px #4FC3F711'}}
        >
          {productConditions.filter((cond, idx, arr) => arr.findIndex(c => c.value === cond.value) === idx).map(cond => (
            <option key={cond.value} value={cond.value}>{cond.label}</option>
          ))}
        </select>
        {/* Filtre de tri par prix */}
        <select
          value={sortBy === 'price' ? sortOrder : ''}
          onChange={e => {
            if (e.target.value === 'asc') {
              setSortBy('price');
              setSortOrder('asc');
            } else if (e.target.value === 'desc') {
              setSortBy('price');
              setSortOrder('desc');
            } else {
              setSortBy('createdAt');
              setSortOrder('desc');
            }
          }}
          className="px-3 py-2 rounded-full border border-[#b3e5fc] bg-white text-base text-[#0288D1] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#4FC3F7] transition-all"
          style={{fontWeight: 500, minWidth: 0, boxShadow: '0 1px 6px #4FC3F711'}}
        >
          <option value="">Trier par prix</option>
          <option value="asc">Du moins cher au plus cher</option>
          <option value="desc">Du plus cher au moins cher</option>
        </select>
        <select
          value={selectedCity}
          onChange={e => setSelectedCity(e.target.value)}
          className="px-3 py-2 rounded-full border border-[#b3e5fc] bg-white text-base text-[#0288D1] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#4FC3F7] transition-all"
          style={{fontWeight: 500, minWidth: 0, boxShadow: '0 1px 6px #4FC3F711'}}
        >
          <option value="">Toutes les villes</option>
          {CITIES.map(city => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleClearFilters}
          className="bg-[#e3f3fa] text-[#4FC3F7] px-6 py-2 rounded-full font-semibold shadow hover:bg-[#b6e6fa] transition-colors duration-200"
        >
          Effacer
        </button>
      </div>
      {/* SUPPRESSION DU FILTRE MODERNE (carte sticky) */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* SUPPRESSION DU FILTRE MODERNE (carte sticky) */}
        {/* Product Listing Section */}
          <section>
            {error && <p className="text-red-600 text-center mb-4">{error}</p>}
            
            {loading && products.length === 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {[...Array(PRODUCTS_PER_PAGE)].map((_, index) => (
                  <div key={index} className="bg-white rounded-lg shadow-md flex flex-col animate-pulse">
                    <div className="w-full aspect-square bg-gray-200 rounded-t-lg"></div>
                    <div className="p-4 flex flex-col flex-grow">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
                      <div className="h-5 bg-gray-200 rounded w-1/3 mt-auto"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3 mt-2"></div>
                      <div className="h-10 bg-gray-200 rounded w-full mt-3"></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && products.length === 0 && !error && (
              <div className="text-center text-gray-500 text-lg my-8">Aucun produit ne correspond à vos critères de recherche.</div>
            )}

            {products.length > 0 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {products.map(renderProductCard)}
                </div>
                {/* Pagination */}
                <div className="flex justify-center mt-8 gap-2">
                  {Array.from({ length: Math.ceil(totalProducts / PRODUCTS_PER_PAGE) }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => handlePageChange(i + 1)}
                      className={`px-4 py-2 rounded-lg font-semibold shadow transition-colors duration-200 ${currentPage === i + 1 ? 'bg-[#4FC3F7] text-white' : 'bg-gray-100 text-[#4FC3F7] hover:bg-blue-50'}`}
                    >
                      Page {i + 1}
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        </main>
      {/* Modale détail produit */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full relative animate-fadeIn">
            <button onClick={() => setSelectedProduct(null)} className="absolute top-2 right-2 text-gray-500 hover:text-primary text-2xl">&times;</button>
            <div className="flex flex-col items-center">
              <img src={selectedProduct.imageUrl || 'https://via.placeholder.com/180'} alt={selectedProduct.name} className="w-40 h-32 object-contain rounded mb-4 bg-[#f6fafd]" />
              <h2 className="text-2xl font-bold text-[#4FC3F7] mb-2 text-center">{selectedProduct.name}</h2>
              <div className="text-gray-500 text-sm mb-2 text-center">{selectedProduct.category}</div>
              <div className="text-gray-700 text-base mb-2 text-center">{selectedProduct.description}</div>
              <div className="flex flex-wrap gap-3 justify-center mb-2">
                {selectedProduct.type && <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">{selectedProduct.type === 'neuf' ? 'Neuf' : 'Occasion'}</span>}
                {typeof selectedProduct.stock === 'number' && <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-semibold">Stock : {selectedProduct.stock}</span>}
              </div>
              <div className="text-[#00C853] font-bold text-xl mb-4">{selectedProduct.price ? selectedProduct.price.toLocaleString() : 0} FCFA</div>
              <button
                onClick={() => { handleAddToCart(selectedProduct); setSelectedProduct(null); }}
                className="w-full bg-[#4FC3F7] text-white font-bold py-3 rounded-xl hover:bg-[#0288D1] transition text-base shadow-md mb-2"
                disabled={addingToCart[selectedProduct.id] || selectedProduct.stock < 1}
              >
                {selectedProduct.stock < 1 ? 'Rupture de stock' : 'Ajouter au panier'}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
      .custom-select {
        background-image: url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 8L10 12L14 8' stroke='%234FC3F7' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 0.75rem center;
        background-size: 1.5em 1.5em;
        padding-right: 2.5rem !important;
        cursor: pointer;
      }
      .custom-select:focus {
        border-color: #4FC3F7;
        box-shadow: 0 0 0 2px #4FC3F733;
      }
      .custom-select:hover {
        background-color: #f3f6fa;
      }
      `}</style>
    </div>
  );
};

export default BrocanteLive;