import React, { useState, useEffect, useCallback } from 'react';
import { firestore, auth } from '../firebaseConfig';
import { collection, query, where, orderBy, limit, startAfter, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { FaSearch, FaFilter, FaSort, FaSpinner, FaShoppingCart, FaHeart, FaMapMarkerAlt, FaTag, FaDollarSign, FaTimesCircle } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { FiTrendingUp } from 'react-icons/fi';

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
      toast.warn("La recherche par nom et le filtrage par prix ne peuvent pas être combinés. Le filtre par prix sera ignoré.");
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
      if (newProducts.length === 0) {
        toast.info("Aucun produit ne correspond à vos critères de recherche.");
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

  return (
    <div className="min-h-screen bg-white text-text-main p-4">
      <div className="flex flex-col items-center justify-center mb-10 animate-fadeInUp pt-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-dark drop-shadow-lg flex items-center gap-3 mb-2" style={{paddingBottom: '0.3em', marginBottom: '0.5em'}}>
          <span className="animate-bounce"><FiTrendingUp className="inline-block text-primary-dark" size={44} /></span>
          Brocante Live
        </h1>
        <p className="text-lg sm:text-xl text-text-secondary font-medium text-center max-w-2xl">
          Découvrez les meilleures trouvailles de la communauté en temps réel !
        </p>
      </div>
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Search and Filter Section */}
        <section className="mb-8 p-6 bg-[#f6fafd] rounded-2xl shadow-xl border border-[#e3f1fa] sticky top-0 z-20">
          <form onSubmit={handleSearchSubmit} className="flex flex-col gap-4">
            {/* Groupe principal : Recherche + Filtres principaux */}
            <fieldset className="border-0 p-0 m-0">
              <legend className="sr-only">Recherche et filtres principaux</legend>
              <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-4">
                {/* Barre de recherche */}
                <div className="flex-1 relative">
                  <label htmlFor="search" className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                    <FaSearch className="text-primary" /> Recherche
                  </label>
                  <input
                    id="search"
                    type="text"
                    placeholder="Rechercher un produit, une marque, une catégorie..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-gray-300 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary transition-colors duration-300 pr-10 text-sm shadow-sm"
                    aria-label="Recherche de produits"
                  />
                  <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-primary hover:text-primary-dark" aria-label="Lancer la recherche">
                    <FaSearch />
                  </button>
                </div>
                <button type="submit" className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-lg font-bold shadow hover:bg-primary-dark transition-colors duration-200 text-base min-w-[120px] justify-center">
                  <FaFilter /> Rechercher
                </button>
              </div>
              {/* Filtres principaux */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                <div>
                  <label htmlFor="category" className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-2">
                    <FaTag className="text-primary" /> Catégorie
                    {selectedCategory && <span className="ml-2 bg-primary text-white rounded-full px-2 py-0.5 text-xs font-semibold">1</span>}
                  </label>
                  <select
                    id="category"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className={`w-full px-3 py-2.5 rounded-lg border-2 border-white bg-white text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4FC3F7] focus:border-[#4FC3F7] transition duration-200 appearance-none custom-select shadow-sm ${selectedCategory ? 'ring-2 ring-primary' : ''}`}
                    aria-label="Filtrer par catégorie"
                  >
                    {productCategories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="condition" className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-2">
                    <FaDollarSign className="text-primary" /> État
                    {productCondition && <span className="ml-2 bg-primary text-white rounded-full px-2 py-0.5 text-xs font-semibold">1</span>}
                  </label>
                  <select
                    id="condition"
                    value={productCondition}
                    onChange={(e) => setProductCondition(e.target.value)}
                    className={`w-full px-3 py-2.5 rounded-lg border-2 border-white bg-white text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4FC3F7] focus:border-[#4FC3F7] transition duration-200 appearance-none custom-select shadow-sm ${productCondition ? 'ring-2 ring-primary' : ''}`}
                    aria-label="Filtrer par état"
                  >
                    {productConditions.map(cond => (
                      <option key={cond.value} value={cond.value}>{cond.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="city" className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-2">
                    <FaMapMarkerAlt className="text-primary" /> Ville
                    {selectedCity && <span className="ml-2 bg-primary text-white rounded-full px-2 py-0.5 text-xs font-semibold">1</span>}
                  </label>
                  <select
                    id="city"
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className={`w-full px-3 py-2.5 rounded-lg border-2 border-white bg-white text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4FC3F7] focus:border-[#4FC3F7] transition duration-200 appearance-none custom-select shadow-sm ${selectedCity ? 'ring-2 ring-primary' : ''}`}
                    aria-label="Filtrer par ville"
                  >
                    <option value="">Toutes les villes</option>
                    {CITIES.map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
              </div>
            </fieldset>

            {/* Séparateur visuel */}
            <div className="my-4 border-t border-[#e3f1fa]" aria-hidden="true"></div>

            {/* Groupe secondaire : Prix + Tri */}
            <fieldset className="border-0 p-0 m-0">
              <legend className="sr-only">Filtres secondaires</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
                {/* Groupe prix */}
                <div className="flex flex-col gap-1">
                  <span className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                    <FaDollarSign className="text-primary" /> Prix
                    {(minPrice || maxPrice) && <span className="ml-2 bg-primary text-white rounded-full px-2 py-0.5 text-xs font-semibold">{[minPrice,maxPrice].filter(Boolean).length}</span>}
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      id="minPrice"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      placeholder="Prix minimum"
                      className="w-1/2 px-3 py-2.5 rounded-lg border-2 border-white bg-white text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4FC3F7] focus:border-[#4FC3F7] transition duration-200 shadow-sm text-sm"
                      aria-label="Prix minimum"
                    />
                    <input
                      type="number"
                      id="maxPrice"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      placeholder="Prix maximum"
                      className="w-1/2 px-3 py-2.5 rounded-lg border-2 border-white bg-white text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4FC3F7] focus:border-[#4FC3F7] transition duration-200 shadow-sm text-sm"
                      aria-label="Prix maximum"
                    />
                  </div>
                </div>
                {/* Tri */}
                <div className="flex flex-col gap-1">
                  <span className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                    <FaSort className="text-primary" /> Tri
                    {(sortBy !== 'createdAt' || sortOrder !== 'desc') && <span className="ml-2 bg-primary text-white rounded-full px-2 py-0.5 text-xs font-semibold">1</span>}
                  </span>
                  <div className="flex gap-2">
                    <select
                      id="sortBy"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className={`w-1/2 px-3 py-2.5 rounded-lg border-2 border-white bg-white text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4FC3F7] focus:border-[#4FC3F7] transition duration-200 appearance-none custom-select shadow-sm text-sm ${sortBy !== 'createdAt' ? 'ring-2 ring-primary' : ''}`}
                      aria-label="Trier par"
                    >
                      <option value="createdAt">Date d'ajout</option>
                      <option value="price">Prix</option>
                    </select>
                    <select
                      id="sortOrder"
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value)}
                      className={`w-1/2 px-3 py-2.5 rounded-lg border-2 border-white bg-white text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4FC3F7] focus:border-[#4FC3F7] transition duration-200 appearance-none custom-select shadow-sm text-sm ${sortOrder !== 'desc' ? 'ring-2 ring-primary' : ''}`}
                      aria-label="Ordre de tri"
                    >
                      <option value="desc">Décroissant</option>
                      <option value="asc">Croissant</option>
                    </select>
                  </div>
                </div>
                {/* Effacer les filtres */}
                <div className="flex flex-col gap-1 items-end justify-end">
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2.5 rounded-lg font-bold shadow hover:bg-red-200 transition-colors duration-200 w-full sm:w-auto text-sm"
                    aria-label="Effacer tous les filtres"
                  >
                    <FaTimesCircle className="text-red-500" /> Effacer les filtres
                    {getActiveFiltersCount() > 0 && (
                      <span className="ml-2 bg-red-500 text-white rounded-full px-2 py-0.5 text-xs font-semibold">{getActiveFiltersCount()}</span>
                    )}
                  </button>
                </div>
              </div>
            </fieldset>
          </form>
          {/* Feedback utilisateur : nombre de résultats */}
          <div className="mt-6 flex items-center gap-3 text-gray-700 text-base font-semibold">
            {loading ? (
              <FaSpinner className="animate-spin text-primary mr-2" />
            ) : (
              <span>{totalProducts} résultat{totalProducts > 1 ? 's' : ''} trouvé{totalProducts > 1 ? 's' : ''}</span>
            )}
            {getActiveFiltersCount() > 0 && (
              <span className="ml-2 bg-primary text-white rounded-full px-3 py-1 text-xs font-semibold">{getActiveFiltersCount()} filtre{getActiveFiltersCount() > 1 ? 's' : ''} actif{getActiveFiltersCount() > 1 ? 's' : ''}</span>
            )}
          </div>
        </section>

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

            {!loading && products.length === 0 && (
              <p className="text-gray-500 text-center text-lg">Aucun produit disponible pour le moment ou ne correspond à votre recherche.</p>
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