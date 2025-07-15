import { firestore } from '../firebaseConfig';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

export interface CartItem {
  productId: string;
  productName: string;
  imageUrl: string;
  price: number;
  quantity: number;
  sellerUid: string;
  sellerName: string;
  addedAt: number;
}

export interface Cart {
  userId: string;
  items: CartItem[];
  createdAt: number;
  updatedAt: number;
}

class CartService {
  // Récupérer le panier d'un utilisateur
  async getCart(userId: string): Promise<CartItem[]> {
    try {
      const cartRef = doc(firestore, 'carts', userId);
      const cartDoc = await getDoc(cartRef);
      
      if (cartDoc.exists()) {
        return cartDoc.data().items || [];
      }
      return [];
    } catch (error) {
      console.error('Erreur lors de la récupération du panier:', error);
      throw error;
    }
  }

  // Ajouter un produit au panier
  async addToCart(userId: string, productId: string, quantity: number = 1): Promise<void> {
    try {
      const cartRef = doc(firestore, 'carts', userId);
      const cartDoc = await getDoc(cartRef);

      let cartItems: CartItem[] = [];
      if (cartDoc.exists()) {
        cartItems = cartDoc.data().items || [];
      }

      // Vérifier si le produit est déjà dans le panier
      const existingItemIndex = cartItems.findIndex(item => item.productId === productId);
      
      // Si c'est un produit Carrefour (commence par 'carrefour_'), on ne peut pas le récupérer depuis Firestore
      if (productId.startsWith('carrefour_')) {
        // Pour les produits Carrefour, on ne peut pas les ajouter au panier normal
        // car ils ne sont pas dans Firestore. On peut soit:
        // 1. Les stocker localement
        // 2. Créer une entrée temporaire
        // 3. Rediriger vers le panier vendeur
        throw new Error('Les produits Carrefour ne peuvent être ajoutés qu\'au panier vendeur');
      }
      
      // Récupérer les infos du produit depuis Firestore
      const productRef = doc(firestore, 'products', productId);
      const productDoc = await getDoc(productRef);
      if (!productDoc.exists()) {
        throw new Error('Produit non trouvé');
      }
      const productData = productDoc.data();

      // Récupérer le nom du vendeur depuis la collection users
      let sellerName = '';
      if (productData.sellerUid) {
        const sellerRef = doc(firestore, 'users', productData.sellerUid);
        const sellerDoc = await getDoc(sellerRef);
        if (sellerDoc.exists()) {
          const sellerData = sellerDoc.data();
          sellerName = sellerData.displayName || sellerData.name || sellerData.email || productData.sellerUid;
        } else {
          sellerName = productData.sellerUid;
        }
      }

      if (existingItemIndex >= 0) {
        // Mettre à jour la quantité
        cartItems[existingItemIndex].quantity += quantity;
      } else {
        // Ajouter un nouvel article avec toutes les infos nécessaires
        cartItems.push({
          productId,
          productName: productData.name || '',
          imageUrl: productData.imageUrl || '',
          price: productData.price || 0,
          quantity,
          sellerUid: productData.sellerUid || '',
          sellerName: sellerName,
          addedAt: Date.now()
        });
      }

      // Mettre à jour le panier dans Firebase
      if (cartDoc.exists()) {
        await updateDoc(cartRef, {
          items: cartItems,
          updatedAt: serverTimestamp()
        });
      } else {
        await setDoc(cartRef, {
          userId,
          items: cartItems,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout au panier:', error);
      throw error;
    }
  }

  // Mettre à jour la quantité d'un article
  async updateQuantity(userId: string, productId: string, quantity: number): Promise<void> {
    try {
      const cartRef = doc(firestore, 'carts', userId);
      const cartDoc = await getDoc(cartRef);

      if (!cartDoc.exists()) {
        throw new Error('Panier non trouvé');
      }

      let cartItems: CartItem[] = cartDoc.data().items || [];
      const itemIndex = cartItems.findIndex(item => item.productId === productId);

      if (itemIndex >= 0) {
        if (quantity <= 0) {
          // Supprimer l'article si la quantité est 0 ou négative
          cartItems.splice(itemIndex, 1);
        } else {
          // Mettre à jour la quantité
          cartItems[itemIndex].quantity = quantity;
        }

        await updateDoc(cartRef, {
          items: cartItems,
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la quantité:', error);
      throw error;
    }
  }

  // Supprimer un article du panier
  async removeFromCart(userId: string, productId: string): Promise<void> {
    try {
      const cartRef = doc(firestore, 'carts', userId);
      const cartDoc = await getDoc(cartRef);

      if (!cartDoc.exists()) {
        return;
      }

      let cartItems: CartItem[] = cartDoc.data().items || [];
      cartItems = cartItems.filter(item => item.productId !== productId);

      await updateDoc(cartRef, {
        items: cartItems,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Erreur lors de la suppression du panier:', error);
      throw error;
    }
  }

  // Vider le panier
  async clearCart(userId: string): Promise<void> {
    try {
      const cartRef = doc(firestore, 'carts', userId);
      await updateDoc(cartRef, {
        items: [],
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Erreur lors du vidage du panier:', error);
      throw error;
    }
  }

  // Obtenir le nombre total d'articles dans le panier
  async getCartItemCount(userId: string): Promise<number> {
    try {
      const cartItems = await this.getCart(userId);
      return cartItems.reduce((total, item) => total + item.quantity, 0);
    } catch (error) {
      console.error('Erreur lors du calcul du nombre d\'articles:', error);
      return 0;
    }
  }
}

export const cartService = new CartService(); 