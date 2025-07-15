import React, { useState, useEffect, useRef } from 'react';
import { firestore, auth } from '../firebaseConfig';
import { collection, addDoc, updateDoc, serverTimestamp, query, where, getDocs, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import Modal from 'react-modal';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import { FaEdit, FaTrashAlt, FaEye, FaEyeSlash, FaPlus, FaChartBar, FaShoppingBag } from 'react-icons/fa';
import 'react-image-crop/dist/ReactCrop.css';
import { FiEdit, FiTrash2, FiEye, FiShoppingBag, FiBox } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

Modal.setAppElement('#root');

const ManageBrocante = () => {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState(1);
  const [productType, setProductType] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deletingProductId, setDeletingProductId] = useState(null);
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const imgRef = useRef(null);
  const previewCanvasRef = useRef(null);

  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sellerProducts, setSellerProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] = useState(false);
  const [productToDeleteId, setProductToDeleteId] = useState(null);
  const [lowStockWarningDetails, setLowStockWarningDetails] = useState({ show: false, products: [] });
  const [showFullImage, setShowFullImage] = useState(false);

  // États pour les filtres
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [selectedType, setSelectedType] = useState('');

  // Filtrage JS des produits
  const filteredProducts = sellerProducts.filter(product => {
    let match = true;
    if (searchTerm && product.name) {
      match = match && product.name.toLowerCase().includes(searchTerm.trim().toLowerCase());
    }
    if (selectedCategory) {
      match = match && product.category === selectedCategory;
    }
    if (selectedType) {
      match = match && product.type === selectedType;
    }
    if (minPrice) {
      match = match && product.price >= parseFloat(minPrice);
    }
    if (maxPrice) {
      match = match && product.price <= parseFloat(maxPrice);
    }
    return match;
  });

  // Pagination pour produits
  const PRODUCTS_PER_PAGE = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * PRODUCTS_PER_PAGE, currentPage * PRODUCTS_PER_PAGE);

  const CLOUDINARY_CLOUD_NAME = 'dosydbnt4';
  const CLOUDINARY_UPLOAD_PRESET = 'jeta_produits';

  const productCategories = [
    { value: '', label: 'Choisir une catégorie...', disabled: true },
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
  const productTypes = [{ value: '', label: 'Choisir un type...', disabled: true }, { value: 'neuf', label: 'Neuf' }, { value: 'occasion', label: 'Occasion' }];

  const LOW_STOCK_THRESHOLD = 15;

  const updateLowStockWarning = (productsList) => {
    const lowStockItems = productsList.filter(p => typeof p.stock === 'number' && p.stock < LOW_STOCK_THRESHOLD);
    if (lowStockItems.length > 0) {
      setLowStockWarningDetails({
        show: true,
        products: lowStockItems.map(p => p.name).slice(0, 3)
      });
    } else {
      setLowStockWarningDetails({ show: false, products: [] });
    }
  };
  const fetchSellerProducts = async () => {
    if (!currentUser) {
      console.log('[ManageBrocante] fetchSellerProducts: currentUser non disponible. Annulation.');
      return;
    }
    console.log('[ManageBrocante] fetchSellerProducts: Tentative de récupération des produits pour sellerUid:', currentUser.uid);
    setIsLoadingProducts(true);
    try {
      const productsRef = collection(firestore, 'products');
      const q = query(productsRef, where('sellerUid', '==', currentUser.uid), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const products = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        isVisible: doc.data().isVisible !== undefined ? doc.data().isVisible : true
      }));
      console.log('[ManageBrocante] fetchSellerProducts: Produits récupérés:', products);
      setSellerProducts(products);
      updateLowStockWarning(products);
    } catch (err) {
      console.error("Erreur lors de la récupération des produits du vendeur:", err);
      setError(`Impossible de charger vos produits. Erreur: ${err.message}`);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  useEffect(() => {
    console.log('[ManageBrocante] useEffect: currentUser a changé:', currentUser);
    if (currentUser) {
      fetchSellerProducts();
    }
  }, [currentUser]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCrop(undefined);
      setImagePreview('');
      setImageFile(null);
      const reader = new FileReader();
      reader.addEventListener('load', () => setImgSrc(reader.result?.toString() || ''));
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const IMAGE_CONTAINER_RATIO = 3 / 2;

  function onImageLoad(e) {
    imgRef.current = e.currentTarget;
    const { width, height } = e.currentTarget;
    const containerRatio = IMAGE_CONTAINER_RATIO;
    let cropWidth, cropHeight, cropX, cropY;
    if (width / height > containerRatio) {
      cropHeight = height;
      cropWidth = height * containerRatio;
      cropX = (width - cropWidth) / 2;
      cropY = 0;
    } else {
      cropWidth = width;
      cropHeight = width / containerRatio;
      cropX = 0;
      cropY = (height - cropHeight) / 2;
    }
    const percentCrop = {
          unit: '%',
      x: (cropX / width) * 100,
      y: (cropY / height) * 100,
      width: (cropWidth / width) * 100,
      height: (cropHeight / height) * 100,
      aspect: containerRatio,
    };
    setCrop(percentCrop);
    setCompletedCrop(percentCrop);
  }

  useEffect(() => {
    if (
      completedCrop?.width &&
      completedCrop?.height &&
      imgRef.current &&
      previewCanvasRef.current
    ) {
      const image = imgRef.current;
      const canvas = previewCanvasRef.current;
      const crop = completedCrop;

      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      const pixelRatio = window.devicePixelRatio || 1;

      canvas.width = Math.floor(crop.width * scaleX * pixelRatio);
      canvas.height = Math.floor(crop.height * scaleY * pixelRatio);

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No 2d context');

      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      ctx.imageSmoothingQuality = 'high';

      ctx.drawImage(
        image,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        crop.width * scaleX,
        crop.height * scaleY
      );

      setImagePreview(canvas.toDataURL('image/jpeg'));
      canvas.toBlob((blob) => {
        if (blob) {
          setImageFile(new File([blob], "cropped_image.jpg", { type: "image/jpeg" }));
        }
      }, 'image/jpeg', 0.90);
    }
  }, [completedCrop]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!productName.trim() || !description.trim() || !price || !category || (!editingProduct && !imageFile) || !currentUser || !stock || (showProductType && !productType)) {
      setError("Veuillez remplir tous les champs obligatoires. L'image est requise pour un nouveau produit.");
      return;
    }
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
      setError('Configuration Cloudinary manquante.');
      return;
    }

    setIsUploading(true);
    setError('');
    setSuccess('');

    let imageUrlToSave = editingProduct ? editingProduct.imageUrl : '';

    try {
      if (!showFullImage && imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
          method: 'POST',
          body: formData,
        });
        const cloudinaryData = await response.json();
        if (cloudinaryData.secure_url) {
          imageUrlToSave = cloudinaryData.secure_url;
        } else {
          setError(cloudinaryData.error?.message || 'Erreur lors de l\'upload de la nouvelle image sur Cloudinary.');
          setIsUploading(false);
          return;
        }
      } else if (showFullImage && imgSrc && (!editingProduct || imgSrc !== editingProduct.imageUrl)) {
        const formData = new FormData();
        const res = await fetch(imgSrc);
        const blob = await res.blob();
        formData.append('file', blob, 'full_image.jpg');
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
          method: 'POST',
          body: formData,
        });
        const cloudinaryData = await response.json();
        if (cloudinaryData.secure_url) {
          imageUrlToSave = cloudinaryData.secure_url;
        } else {
          setError(cloudinaryData.error?.message || 'Erreur lors de l\'upload de l\'image complète sur Cloudinary.');
          setIsUploading(false);
          return;
        }
      }

      const productData = {
        name: productName,
        description: description,
        price: parseFloat(price),
        imageUrl: imageUrlToSave,
        category: category,
        stock: parseInt(stock, 10),
        ...(showProductType ? { type: productType } : {}),
        sellerUid: currentUser.uid,
        brocanteId: editingProduct ? editingProduct.brocanteId : 'ID_DE_LA_BROCANTE_PAR_DEFAUT',
        updatedAt: serverTimestamp(),
      };

      if (editingProduct) {
        await updateDoc(doc(firestore, 'products', editingProduct.id), productData);
        setSuccess('Produit modifié avec succès !');
      } else {
        productData.createdAt = serverTimestamp();
        productData.isVisible = true;
        await addDoc(collection(firestore, 'products'), productData);
        setSuccess('Produit ajouté avec succès !');
      }

      resetFormAndCloseModal();
      fetchSellerProducts();
    } catch (err) {
      console.error("Erreur lors de la soumission du produit:", err);
      setError(`Une erreur est survenue. ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const resetFormAndCloseModal = () => {
    setProductName('');
    setDescription('');
    setPrice('');
    setImageFile(null);
    setCategory('');
    setStock(1);
    setProductType('');
    setImagePreview('');
    setImgSrc('');
    setCrop(undefined);
    setEditingProduct(null);
    setIsModalOpen(false);
    setShowFullImage(false);
  };

  const handleOpenEditModal = (product) => {
    setEditingProduct(product);
    setProductName(product.name);
    setDescription(product.description);
    setPrice(product.price.toString());
    setCategory(product.category);
    setStock(product.stock);
    setProductType(product.type);
    setImagePreview(product.imageUrl);
    setImgSrc(product.imageUrl);
    setIsModalOpen(true);
    setError('');
    setSuccess('');
  };

  const openAddModal = () => {
    resetFormAndCloseModal();
    setIsModalOpen(true);
  };

  const openConfirmDeleteModal = (productId) => {
    setProductToDeleteId(productId);
    setIsConfirmDeleteModalOpen(true);
  };

  const closeConfirmDeleteModal = () => {
    setProductToDeleteId(null);
    setIsConfirmDeleteModalOpen(false);
  };

  const confirmDeleteProduct = async () => {
    if (!productToDeleteId) return;
    setDeletingProductId(productToDeleteId);
    setError('');
    setSuccess('');

    try {
      await deleteDoc(doc(firestore, 'products', productToDeleteId));
      setSuccess('Produit supprimé avec succès !');
      const updatedProducts = sellerProducts.filter(product => product.id !== productToDeleteId);
      setSellerProducts(updatedProducts);
      updateLowStockWarning(updatedProducts);
    } catch (err) {
      console.error("Erreur lors de la suppression du produit:", err);
      setError(`Impossible de supprimer le produit. Erreur: ${err.message}`);
    } finally {
      setDeletingProductId(null);
      closeConfirmDeleteModal();
    }
  };

  const toggleProductVisibility = async (productId, currentVisibility) => {
    setError('');
    setSuccess('');
    try {
      const productRef = doc(firestore, 'products', productId);
      await updateDoc(productRef, { isVisible: !currentVisibility });
      setSuccess('Visibilité du produit mise à jour !');
      setSellerProducts(prevProducts =>
        prevProducts.map(product =>
          product.id === productId ? { ...product, isVisible: !currentVisibility } : product
        )
      );
    } catch (err) {
      console.error("Erreur lors du basculement de la visibilité:", err);
      setError(`Impossible de changer la visibilité. Erreur: ${err.message}`);
    }
  };

  const showProductType = category !== 'aliments';

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 2500);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const displayName = userData?.displayName || userData?.name || currentUser?.displayName || currentUser?.name || currentUser?.email || 'Vendeur';

  return (
    <div className="bg-gray-100 text-gray-800 min-h-screen">
      <div className="flex flex-col items-center justify-center mb-10 animate-fadeInUp pt-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-dark drop-shadow-lg flex items-center gap-3 mb-2" style={{paddingBottom: '0.3em', marginBottom: '0.5em'}}>
          <span className="animate-bounce"><FiBox className="inline-block text-primary-dark" size={44} /></span>
          Gestion de mes produits
        </h1>
        <p className="text-lg sm:text-xl text-text-secondary font-medium text-center max-w-2xl">
          Ajoute, modifie ou supprime tes produits en toute simplicité.
        </p>
      </div>
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <section className="mb-10">
          {/* NOUVELLE SECTION ACTIONS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {/* Ajouter un produit */}
            <button
              onClick={openAddModal}
              className="flex flex-col items-center justify-center bg-[#f6fafd] rounded-2xl shadow-md hover:shadow-xl transition-shadow duration-300 border-2 border-white p-8 group focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label="Ajouter un produit"
            >
              <FaPlus className="text-[#4FC3F7] mb-3 text-3xl group-hover:scale-110 transition-transform" />
              <span className="text-lg font-bold text-[#4FC3F7] mb-1">Ajouter un produit</span>
              <span className="text-gray-500 text-sm">Publier un nouvel article à vendre</span>
            </button>
          </div>
        </section>

          <Modal
            isOpen={isModalOpen}
            onRequestClose={resetFormAndCloseModal}
            style={{
              content: {
                top: '50%',
                left: '50%',
                right: 'auto',
                bottom: 'auto',
                marginRight: '-50%',
                transform: 'translate(-50%, -50%)',
                width: '90%',
                maxWidth: '450px',
                padding: '15px',
                borderRadius: '0.75rem',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 15px 20px -5px rgba(0, 0, 0, 0.1), 0 8px 8px -5px rgba(0, 0, 0, 0.04)',
                zIndex: 1001,
              },
              overlay: { backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 },
            }}
            ariaHideApp={true}
          >
          <h2 className="text-xl font-semibold text-[#4FC3F7] mb-3 text-left">{editingProduct ? 'Modifier le produit' : 'Ajouter un produit'}</h2>
            {error && <p className="text-red-600 bg-red-100 p-2 rounded-xl mb-3">{error}</p>}
          {success && <p className="text-[#00C853] bg-green-100 p-2 rounded-xl mb-3">{success}</p>}
          <form onSubmit={handleSubmit} className="space-y-4 bg-white/90 rounded-xl shadow-lg p-4">
              <div>
              <label htmlFor="productName" className="block text-sm font-semibold text-[#4FC3F7] mb-1">Nom du produit</label>
                <input
                  type="text"
                  id="productName"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  required
                className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4FC3F7] transition duration-200"
                />
              </div>
              <div>
              <label htmlFor="description" className="block text-sm font-semibold text-[#4FC3F7] mb-1">Description</label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows="3"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4FC3F7] transition duration-200"
                />
              </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label htmlFor="price" className="block text-sm font-semibold text-[#4FC3F7] mb-1">Prix (FCFA)</label>
                <input
                  type="number"
                  id="price"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                  min="0"
                  step="any"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4FC3F7] transition duration-200"
                />
              </div>
              <div className="flex-1">
                <label htmlFor="stock" className="block text-sm font-semibold text-[#4FC3F7] mb-1">Quantité en stock</label>
                <input
                  type="number"
                  id="stock"
                  value={stock}
                  onChange={(e) => setStock(parseInt(e.target.value, 10) || 0)}
                  required
                  min="0"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4FC3F7] transition duration-200"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label htmlFor="category" className="block text-sm font-semibold text-[#4FC3F7] mb-1">Catégorie</label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                  className="w-full px-4 py-2 rounded-xl border border-gray-300 bg-gray-50 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4FC3F7] transition duration-200 appearance-none"
                >
                  {productCategories.map(cat => (
                    <option key={cat.value} value={cat.value} disabled={cat.disabled}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              {showProductType && (
                <div className="flex-1">
                  <label htmlFor="productType" className="block text-sm font-semibold text-[#4FC3F7] mb-1">Type de produit</label>
                <select
                  id="productType"
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  required
                    className="w-full px-4 py-2 rounded-xl border border-gray-300 bg-gray-50 text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4FC3F7] transition duration-200 appearance-none"
                >
                  {productTypes.map(type => (
                    <option key={type.value} value={type.value} disabled={type.disabled}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              )}
              </div>
              <div>
              <label htmlFor="imageFile" className="block text-sm font-semibold text-[#4FC3F7] mb-1">
                  Image du produit {editingProduct && "(Optionnel si inchangée)"}
                </label>
                <input
                  type="file"
                  id="imageFile"
                  accept="image/*"
                  onChange={handleImageChange}
                  required={!editingProduct}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 file:rounded-lg file:border-0 file:bg-[#4FC3F7] file:text-white file:px-3 file:py-1 file:hover:bg-[#0288D1] transition duration-200"
              />
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border ${!showFullImage ? 'bg-[#4FC3F7] text-white border-[#4FC3F7]' : 'bg-white text-[#4FC3F7] border-[#4FC3F7]'}`}
                  onClick={() => setShowFullImage(false)}
                >
                  Recadrer
                </button>
                <button
                  type="button"
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border ${showFullImage ? 'bg-[#4FC3F7] text-white border-[#4FC3F7]' : 'bg-white text-[#4FC3F7] border-[#4FC3F7]'}`}
                  onClick={() => setShowFullImage(true)}
                >
                  Afficher l'image entière
                </button>
              </div>
              {!showFullImage && imgSrc && (
                <div className="mt-3 border border-dashed border-gray-300 p-2 rounded-lg">
                    <ReactCrop
                      crop={crop}
                      onChange={(_, percentCrop) => setCrop(percentCrop)}
                      onComplete={(c) => setCompletedCrop(c)}
                    aspect={IMAGE_CONTAINER_RATIO}
                      minWidth={100}
                      minHeight={100}
                    >
                      <img
                        ref={imgRef}
                        alt="Recadrage"
                        src={imgSrc}
                        onLoad={onImageLoad}
                        style={{ maxHeight: '40vh', objectFit: 'contain' }}
                        crossOrigin="anonymous"
                      />
                    </ReactCrop>
                    <p className="text-xs text-gray-500 mt-1 text-center">Ajustez le cadre pour recadrer l'image.</p>
                  </div>
                )}
              {showFullImage && imgSrc && (
                <div className="mt-3 border border-dashed border-gray-300 p-2 rounded-lg flex justify-center items-center" style={{ aspectRatio: '3 / 2', background: '#f3f6fa', minHeight: '120px' }}>
                  <img
                    src={imgSrc}
                    alt="Aperçu complet"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '240px',
                      objectFit: 'contain',
                      borderRadius: '12px',
                    }}
                  />
                </div>
              )}
              {imagePreview && !showFullImage && (
                  <div className="mt-3 text-center">
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      {imageFile ? "Nouvel aperçu recadré :" : (editingProduct ? "Image actuelle :" : "Aperçu recadré :")}
                    </p>
                  <div style={{
                    width: '100%',
                    maxWidth: '240px',
                    aspectRatio: '3 / 2',
                    margin: '0 auto',
                    background: '#f3f6fa',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1.5px solid #eaf6fb',
                  }}>
                    <img
                      src={imagePreview}
                      alt="Aperçu"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        borderRadius: '12px',
                      }}
                    />
                  </div>
                  </div>
                )}
                <canvas ref={previewCanvasRef} style={{ display: 'none' }} />
              </div>
            <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={resetFormAndCloseModal}
                className="px-4 py-2 rounded-lg font-medium text-gray-800 bg-gray-200 hover:bg-gray-300 transition-all duration-200"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                className={`px-4 py-2 rounded-lg font-medium text-white ${isUploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#4FC3F7] hover:bg-[#0288D1]'} shadow hover:shadow-md transition-all duration-200`}
                >
                  {isUploading ? (editingProduct ? 'Modification...' : 'Ajout en cours...') : (editingProduct ? 'Enregistrer les modifications' : 'Ajouter')}
                </button>
              </div>
            </form>
          </Modal>

          <Modal
            isOpen={isConfirmDeleteModalOpen}
            onRequestClose={closeConfirmDeleteModal}
            style={{
              content: {
                top: '50%',
                left: '50%',
                right: 'auto',
                bottom: 'auto',
                marginRight: '-50%',
                transform: 'translate(-50%, -50%)',
                width: '90%',
                maxWidth: '400px',
                padding: '20px',
                borderRadius: '0.75rem',
                boxShadow: '0 15px 20px -5px rgba(0, 0, 0, 0.1), 0 8px 8px -5px rgba(0, 0, 0, 0.04)',
                zIndex: 1002,
              },
              overlay: { backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1001 },
            }}
            ariaHideApp={true}
          >
          <h2 className="text-xl font-semibold text-[#4FC3F7] mb-4 text-center">Confirmer la suppression</h2>
          <p className="text-gray-800 mb-6 text-center">
              Êtes-vous sûr de vouloir supprimer ce produit ? Cette action est irréversible.
            </p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={closeConfirmDeleteModal}
              className="px-6 py-2 rounded-md font-medium text-gray-800 bg-gray-200 hover:bg-gray-300 transition-all duration-200"
              >
                Annuler
              </button>
              <button
                onClick={confirmDeleteProduct}
                disabled={deletingProductId === productToDeleteId}
              className={`px-6 py-2 rounded-md font-medium text-white ${deletingProductId === productToDeleteId ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'} shadow hover:shadow-md transition-all duration-200`}
              >
                {deletingProductId === productToDeleteId ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </Modal>

        <hr className="my-8 border-t border-gray-300" />

          <section>
            {lowStockWarningDetails.show && (
            <div className="mb-6 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 rounded-md shadow-sm flex items-center justify-center">
                    <svg className="fill-current h-6 w-6 text-yellow-600 mr-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zM9 5v6h2V5H9zm0 8v2h2v-2H9z"/>
                    </svg>
                  <div>
                    <p className="font-bold">Attention : Stock bas !</p>
                    <p className="text-sm">
                      {lowStockWarningDetails.products.length > 0 &&
                        `Certains produits ont un stock inférieur à ${LOW_STOCK_THRESHOLD} unités (ex: ${lowStockWarningDetails.products.join(', ')}${lowStockWarningDetails.products.length < sellerProducts.filter(p => typeof p.stock === 'number' && p.stock < LOW_STOCK_THRESHOLD).length ? ' et autres...' : ''}). `
                      }
                       Pensez à réapprovisionner.
                    </p>
                </div>
              </div>
            )}
          <h2 className="text-xl md:text-2xl font-semibold text-[#4FC3F7] mb-4 text-left">Mes produits en vente</h2>
          {/* Filtres produits */}
          <section className="mb-6 p-4 bg-[#f6fafd] rounded-2xl shadow-md border border-[#f3f6fa]">
            <form className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="flex-grow">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Rechercher par nom..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:border-[#4FC3F7] focus:ring-1 focus:ring-[#4FC3F7] transition-colors duration-300 pr-10"
                  />
                </div>
              </div>
              <button type="button" onClick={() => { setSearchTerm(''); setSelectedCategory(''); setMinPrice(''); setMaxPrice(''); setSelectedType(''); }} className="bg-[#e3f3fa] text-[#4FC3F7] px-6 py-3 rounded-lg font-semibold shadow hover:bg-[#b6e6fa] transition-colors duration-200">Effacer les filtres</button>
            </form>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-2">
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                <select
                  id="category"
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border-2 border-white bg-white text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4FC3F7] focus:border-[#4FC3F7] transition duration-200 appearance-none"
                >
                  <option value="">Toutes les catégories</option>
                  {productCategories.filter(cat => !cat.disabled).map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  id="type"
                  value={selectedType}
                  onChange={e => setSelectedType(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border-2 border-white bg-white text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4FC3F7] focus:border-[#4FC3F7] transition duration-200 appearance-none"
                >
                  <option value="">Tous les types</option>
                  {productTypes.filter(type => !type.disabled).map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="minPrice" className="block text-sm font-medium text-gray-700 mb-1">Prix Min</label>
                  <input
                    type="number"
                    id="minPrice"
                    value={minPrice}
                    onChange={e => setMinPrice(e.target.value)}
                    placeholder="Min"
                    className="w-full px-4 py-3 rounded-2xl border-2 border-white bg-white text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4FC3F7] focus:border-[#4FC3F7] transition duration-200"
                  />
                </div>
                <div>
                  <label htmlFor="maxPrice" className="block text-sm font-medium text-gray-700 mb-1">Prix Max</label>
                  <input
                    type="number"
                    id="maxPrice"
                    value={maxPrice}
                    onChange={e => setMaxPrice(e.target.value)}
                    placeholder="Max"
                    className="w-full px-4 py-3 rounded-2xl border-2 border-white bg-white text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4FC3F7] focus:border-[#4FC3F7] transition duration-200"
                  />
                </div>
              </div>
            </div>
          </section>
            {isLoadingProducts && <p className="text-gray-500 text-left">Chargement de vos produits...</p>}
            {!isLoadingProducts && filteredProducts.length === 0 && (
              <p className="text-gray-500 text-left">Aucun produit correspondant aux filtres.</p>
            )}
            {!isLoadingProducts && filteredProducts.length > 0 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {paginatedProducts.map((product) => (
                    <div
                      key={product.id}
                      className={`bg-[#f6fafd] rounded-lg shadow-sm p-2 flex flex-col ${!product.isVisible ? 'opacity-60 grayscale' : ''}`}
                    >
                    <div className="w-full aspect-[3/2] overflow-hidden rounded-t-lg bg-white flex items-center justify-center">
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                        className="w-full h-full object-contain p-2"
                        />
                      </div>
                    <div className="flex flex-col flex-grow px-2 pt-2 pb-2 text-left">
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
                    </div>
                    <div className="px-2 pb-2 pt-2 flex justify-center items-center gap-4 border-t border-gray-100 bg-gray-50 rounded-b-lg mt-auto">
                        <button
                          onClick={() => toggleProductVisibility(product.id, product.isVisible)}
                        className={`p-2 rounded-full ${product.isVisible ? 'text-[#4FC3F7] hover:bg-blue-100' : 'text-gray-400 hover:bg-gray-100'} transition-colors duration-200`}
                          title={product.isVisible ? "Cacher le produit" : "Rendre le produit visible"}
                        >
                        <FiEye className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(product)}
                        className="p-2 rounded-full text-[#4FC3F7] hover:bg-blue-100 transition-colors duration-200"
                          title="Modifier le produit"
                        >
                        <FiEdit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => openConfirmDeleteModal(product.id)}
                          disabled={deletingProductId === product.id}
                          className={`p-2 rounded-full ${deletingProductId === product.id ? 'text-gray-400' : 'text-red-600 hover:bg-red-100'} transition-colors duration-200`}
                          title="Supprimer le produit"
                        >
                          {deletingProductId === product.id
                          ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div>
                          : <FiTrash2 className="h-5 w-5" />
                          }
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex justify-center mt-8 gap-2">
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i + 1)}
                        className={`px-4 py-2 rounded-lg font-semibold shadow transition-colors duration-200 ${currentPage === i + 1 ? 'bg-[#4FC3F7] text-white' : 'bg-gray-100 text-[#4FC3F7] hover:bg-blue-50'}`}
                      >
                        Page {i + 1}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
      </main>
      <style>{`
        .glass-card-dashboard {
          background: rgba(255,255,255,0.85);
          border-radius: 1.25rem;
          box-shadow: 0 4px 32px 0 rgba(79,195,247,0.10), 0 1.5px 8px 0 #e0cfae33;
          border: 1.5px solid #eaf6fb;
          padding: 2.2rem 1.2rem 1.6rem 1.2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          min-height: 120px;
          transition: box-shadow 0.2s, transform 0.2s;
        }
        .glass-card-dashboard:hover {
          box-shadow: 0 8px 40px 0 rgba(79,195,247,0.18), 0 2px 12px 0 #e0cfae33;
          transform: translateY(-4px) scale(1.03);
        }
        .quick-btn-compact {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          background: #fff;
          color: #03A9F4;
          border-radius: 9999px;
          padding: 0.5rem 1.2rem;
          font-weight: 600;
          font-size: 1rem;
          box-shadow: 0 1.5px 6px #4FC3F711;
          border: 1.5px solid #b3e0f7;
          min-width: unset;
          text-decoration: none;
          transition: background 0.18s, color 0.18s, box-shadow 0.18s, transform 0.18s;
          margin-top: 0.2rem;
        }
        .quick-btn-compact:hover {
          background: #4FC3F7;
          color: #fff;
          box-shadow: 0 4px 18px #4FC3F733;
          transform: translateY(-1.5px) scale(1.03);
        }
      `}</style>
    </div>
  );
};

export default ManageBrocante;