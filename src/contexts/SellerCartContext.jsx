import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

const SellerCartContext = createContext();

export function useSellerCart() {
  const ctx = useContext(SellerCartContext);
  if (!ctx) throw new Error('useSellerCart must be used within a SellerCartProvider');
  return ctx;
}

function getStorageKey(uid) {
  return uid ? `seller_cart_${uid}` : 'seller_cart_guest';
}

export function SellerCartProvider({ children }) {
  const { currentUser } = useAuth();
  const [cart, setCart] = useState([]);
  const uid = currentUser?.uid;
  const storageKey = getStorageKey(uid);

  // Charger depuis localStorage au démarrage ou quand l'utilisateur change
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setCart(parsed);
        else setCart([]);
      } else {
        setCart([]);
      }
    } catch (e) {
      setCart([]);
    }
  }, [storageKey]);

  // Sauver dans localStorage à chaque changement
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(cart));
  }, [cart, storageKey]);

  // Ajouter un produit (pas de doublon, incrémente la quantité sinon)
  function addToSellerCart(product) {
    setCart(prev => {
      const idx = prev.findIndex(p => p.id === product.id);
      if (idx >= 0) {
        // Déjà présent, incrémente la quantité
        const updated = [...prev];
        updated[idx].quantity = (updated[idx].quantity || 1) + 1;
        return updated;
      }
      // Nouveau produit : l'ajouter au début pour qu'il apparaisse en haut
      return [{ ...product, quantity: 1, checked: false, resalePrice: '' }, ...prev];
    });
  }

  // Retirer un produit
  function removeFromSellerCart(productId) {
    setCart(prev => prev.filter(p => p.id !== productId));
  }

  // Mettre à jour la quantité
  function updateQuantity(productId, quantity) {
    setCart(prev => prev.map(p => p.id === productId ? { ...p, quantity } : p));
  }

  // Marquer comme acheté
  function toggleChecked(productId) {
    setCart(prev => prev.map(p => p.id === productId ? { ...p, checked: !p.checked } : p));
  }

  // Mettre à jour le prix de revente
  function setResalePrice(productId, price) {
    setCart(prev => prev.map(p => p.id === productId ? { ...p, resalePrice: price } : p));
  }

  // Vider le panier
  function clearSellerCart() {
    setCart([]);
  }

  // Calculs
  const total = cart.reduce((sum, p) => sum + (p.price || 0) * (p.quantity || 1), 0);
  const totalResale = cart.reduce((sum, p) => sum + (parseFloat(p.resalePrice) || 0) * (p.quantity || 1), 0);
  const benefit = totalResale - total;

  return (
    <SellerCartContext.Provider value={{
      cart,
      addToSellerCart,
      removeFromSellerCart,
      updateQuantity,
      toggleChecked,
      setResalePrice,
      clearSellerCart,
      total,
      totalResale,
      benefit
    }}>
      {children}
    </SellerCartContext.Provider>
  );
} 