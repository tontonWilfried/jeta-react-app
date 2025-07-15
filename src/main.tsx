// main.tsx
import React from 'react' // Importation de React
import ReactDOM from 'react-dom/client' // Importation pour le rendu dans le DOM
import { BrowserRouter } from 'react-router-dom'; // Importation de BrowserRouter
import App from './App.tsx' // Votre composant App principal
import { AuthProvider } from './contexts/AuthContext.tsx'; // Importer AuthProvider
import { CartProvider } from './contexts/CartContext.tsx';
import { SellerCartProvider } from './contexts/SellerCartContext';
import './index.css' // Importation de vos styles globaux (où Tailwind est initialisé)

// Crée la racine de l'application React et la monte dans l'élément HTML avec l'ID 'root'
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <SellerCartProvider>
            <App />
          </SellerCartProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
