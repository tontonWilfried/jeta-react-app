import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { cartService, type CartItem } from '../services/cartService';
import { toast } from 'react-toastify';

interface CartContextType {
  cartItems: CartItem[];
  cartItemCount: number;
  loading: boolean;
  addToCart: (productId: string, quantity?: number) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const { currentUser } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartItemCount, setCartItemCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Charger le panier quand l'utilisateur change
  useEffect(() => {
    if (currentUser) {
      loadCart();
    } else {
      setCartItems([]);
      setCartItemCount(0);
    }
  }, [currentUser]);

  const loadCart = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    try {
      const items = await cartService.getCart(currentUser.uid);
      setCartItems(items);
      setCartItemCount(items.reduce((total, item) => total + item.quantity, 0));
    } catch (error) {
      console.error('Erreur lors du chargement du panier:', error);
      toast.error('Impossible de charger votre panier');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (productId: string, quantity: number = 1) => {
    if (!currentUser) {
      toast.error('Veuillez vous connecter pour ajouter des articles au panier');
      return;
    }

    try {
      await cartService.addToCart(currentUser.uid, productId, quantity);
      await loadCart(); // Recharger le panier
      toast.success('Produit ajouté au panier !');
    } catch (error) {
      console.error('Erreur lors de l\'ajout au panier:', error);
      toast.error('Erreur lors de l\'ajout au panier');
    }
  };

  const updateQuantity = async (productId: string, quantity: number) => {
    if (!currentUser) return;

    try {
      await cartService.updateQuantity(currentUser.uid, productId, quantity);
      await loadCart(); // Recharger le panier
      toast.success('Quantité mise à jour');
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la quantité:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const removeFromCart = async (productId: string) => {
    if (!currentUser) return;

    try {
      await cartService.removeFromCart(currentUser.uid, productId);
      await loadCart(); // Recharger le panier
      toast.success('Article supprimé du panier');
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const clearCart = async () => {
    if (!currentUser) return;

    try {
      await cartService.clearCart(currentUser.uid);
      setCartItems([]);
      setCartItemCount(0);
      toast.success('Panier vidé');
    } catch (error) {
      console.error('Erreur lors du vidage du panier:', error);
      toast.error('Erreur lors du vidage du panier');
    }
  };

  const refreshCart = async () => {
    await loadCart();
  };

  const value = {
    cartItems,
    cartItemCount,
    loading,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    refreshCart
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}; 