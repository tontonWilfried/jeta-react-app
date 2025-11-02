import React, { useState } from 'react';
import { useSellerCart } from '../contexts/SellerCartContext';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { FiShoppingBag } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';

export default function SellerCart() {
  const { cart, removeFromSellerCart, updateQuantity, toggleChecked, setResalePrice, total, totalResale, clearSellerCart } = useSellerCart();
  const { currentUser, userData } = useAuth();
  const displayName = userData?.displayName || userData?.name || currentUser?.displayName || currentUser?.name || currentUser?.email || 'Vendeur';
  const navigate = useNavigate();

  // Filtre : tous, achetés, non achetés
  const [filter, setFilter] = useState('all');
  let filteredCart = cart;
  if (filter === 'checked') filteredCart = cart.filter(p => !!p.checked);
  if (filter === 'not_checked') filteredCart = cart.filter(p => !p.checked);

  // Calculs en FCFA sur le panier filtré
  const totalFcfaRaw = filteredCart.reduce((sum, p) => sum + ((p.price || 0) * (p.quantity || 1) * 655.957), 0);
  const totalFcfa = Math.ceil(totalFcfaRaw);
  const totalResaleFcfaRaw = filteredCart.reduce((sum, p) => sum + (parseFloat(p.resalePrice) || 0) * (p.quantity || 1), 0);
  const totalResaleFcfa = Math.round(totalResaleFcfaRaw / 100) * 100;
  const benefit = totalResaleFcfa - totalFcfa;
  const displayBenefit = benefit > 0 ? benefit : 0;

  // Affichage du bénéfice potentiel avec couleur et signe selon le cas
  let benefitColor = '#888';
  let benefitSign = '';
  if (benefit > 0) benefitColor = '#137333';
  else if (benefit < 0) { benefitColor = '#b71c1c'; benefitSign = '-'; }

  // Pagination pour panier vendeur
  const ITEMS_PER_PAGE = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(filteredCart.length / ITEMS_PER_PAGE);
  const paginatedCart = filteredCart.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

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
      <div className="flex flex-col items-center justify-center mb-10 animate-fadeInUp pt-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-dark drop-shadow-lg flex items-center gap-3 mb-2" style={{paddingBottom: '0.3em', marginBottom: '0.5em'}}>
          <span className="animate-bounce"><FiShoppingBag className="inline-block text-primary-dark" size={44} /></span>
          Mon panier vendeur
        </h1>
        <p className="text-lg sm:text-xl text-text-secondary font-medium text-center max-w-2xl">
          Prépare tes achats et calcule ton bénéfice potentiel sur cette page.
        </p>
      </div>
      <div style={{
        padding: '24px 16px', // Réduit pour mieux occuper l'espace, comme ActionProducts
        fontFamily: 'Montserrat, sans-serif',
        background: '#f8fafc',
        minHeight: '100vh',
      }}>
        {/* Titre centré */}
        <h1 style={{ 
          fontWeight: 700, 
          fontSize: 32, 
          color: '#1976d2', 
          marginBottom: 24, 
          textAlign: 'center' 
        }}>
          Mon panier vendeur
        </h1>

        {/* Affichage des totaux et bouton en haut */}
        {cart.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 28,
              marginBottom: 32,
              flexWrap: 'wrap',
              width: '100%',
              maxWidth: 900,
              margin: '0 auto 32px auto',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 18,
              fontWeight: 500,
              color: '#222',
              background: 'none',
              border: 'none',
              padding: 0,
              minWidth: 200,
              flex: '1 1 200px',
            }}>
              <span style={{ color: '#444' }}>Total à dépenser :</span>
              <span style={{ fontWeight: 700, color: '#1976d2' }}>{totalFcfa.toLocaleString()}</span>
              <span style={{ fontWeight: 500, color: '#444' }}>FCFA</span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 18,
              fontWeight: 500,
              color: '#222',
              background: 'none',
              border: 'none',
              padding: 0,
              minWidth: 200,
              flex: '1 1 200px',
            }}>
              <span style={{ color: '#444' }}>Bénéfice potentiel :</span>
              <span style={{ fontWeight: 700, color: benefitColor }}>{benefitSign}{Math.abs(benefit).toLocaleString()}</span>
              <span style={{ fontWeight: 500, color: '#444' }}>FCFA</span>
            </div>
            <button
              onClick={() => {
                clearSellerCart();
                toast.info('Panier vidé', {
                  autoClose: 1800,
                  hideProgressBar: true,
                  style: { background: '#e3fcec', color: '#137333', fontWeight: 600, fontSize: 15 },
                });
              }}
              style={{
                padding: '10px 28px',
                borderRadius: 20,
                border: 'none',
                fontSize: 18,
                fontWeight: 700,
                background: '#1976d2',
                color: '#fff',
                cursor: 'pointer',
                boxShadow: 'none',
                fontFamily: 'Montserrat, sans-serif',
                minWidth: 160,
                flex: '1 1 160px',
                letterSpacing: 0.5,
                marginTop: 0,
                transition: 'background 0.2s',
              }}
            >
              Vider le panier
            </button>
          </div>
        )}

        {/* Filtre achetés / non achetés */}
        {cart.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginBottom: 18 }}>
            <button
              onClick={() => setFilter('all')}
              style={{
                padding: '7px 18px',
                borderRadius: 16,
                border: filter === 'all' ? '2px solid #1976d2' : '1.5px solid #e3eafc',
                background: filter === 'all' ? '#eaf1fb' : '#fff',
                color: filter === 'all' ? '#1976d2' : '#444',
                fontWeight: 600,
                fontSize: 15,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Tous
            </button>
            <button
              onClick={() => setFilter('checked')}
              style={{
                padding: '7px 18px',
                borderRadius: 16,
                border: filter === 'checked' ? '2px solid #137333' : '1.5px solid #e3eafc',
                background: filter === 'checked' ? '#e3fcec' : '#fff',
                color: filter === 'checked' ? '#137333' : '#444',
                fontWeight: 600,
                fontSize: 15,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Achetés
            </button>
            <button
              onClick={() => setFilter('not_checked')}
              style={{
                padding: '7px 18px',
                borderRadius: 16,
                border: filter === 'not_checked' ? '2px solid #b71c1c' : '1.5px solid #e3eafc',
                background: filter === 'not_checked' ? '#fdeaea' : '#fff',
                color: filter === 'not_checked' ? '#b71c1c' : '#444',
                fontWeight: 600,
                fontSize: 15,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Non achetés
            </button>
          </div>
        )}

        {/* Message panier vide */}
        {cart.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#888', fontSize: 20, margin: '60px 0' }}>
            Votre panier est vide.
          </div>
        ) : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 24,
              marginBottom: 28,
            }}>
              {paginatedCart.map(item => (
                <div key={item.id} style={{
                  background: '#fff',
                  border: '1px solid #eee', // Identique à ActionProducts
                  borderRadius: 12, // Identique à ActionProducts
                  boxShadow: '0 2px 8px #1976d211', // Identique à ActionProducts
                  padding: 16, // Identique à ActionProducts
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  <img 
                    src={item.image_url} 
                    alt={item.name} 
                    style={{ 
                      width: '100%', 
                      height: 140, // Identique à ActionProducts
                      objectFit: 'contain', // Identique à ActionProducts
                      marginBottom: 8, // Identique à ActionProducts
                      background: '#fff', // Fond blanc
                      borderRadius: 8 // Identique à ActionProducts
                    }} 
                  />
                  <h3 style={{ 
                    fontSize: 18, // Identique à ActionProducts
                    margin: '8px 0 4px 0', // Identique à ActionProducts
                    fontWeight: 700 // Identique à ActionProducts
                  }}>
                    {item.name}
                  </h3>
                  <div style={{ 
                    color: '#888', 
                    fontSize: 14, // Identique à ActionProducts
                    marginBottom: 4 // Identique à ActionProducts
                  }}>
                    {item.description}
                  </div>
                  <div style={{ 
                    fontSize: 15, // Identique à ActionProducts
                    marginBottom: 4 // Identique à ActionProducts
                  }}>
                    <b>Prix :</b> {item.price} € /{' '}
                    <span style={{ color: '#388e3c', fontWeight: 600 }}>
                      {item.price_fcfa} FCFA
                    </span>
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: 6, 
                    marginTop: 8 
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ fontSize: 14, color: '#1976d2', fontWeight: 600 }}>
                        Qté :
                      </label>
                      <input 
                        type="number" 
                        min={1} 
                        value={item.quantity} 
                        onChange={e => updateQuantity(item.id, Math.max(1, parseInt(e.target.value) || 1))} 
                        style={{ 
                          width: 50, 
                          borderRadius: 7, 
                          border: '1.2px solid #1976d2', 
                          padding: '3px 6px', 
                          fontWeight: 600, 
                          fontSize: 14, 
                          textAlign: 'center' 
                        }} 
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ fontSize: 14, color: '#1976d2', fontWeight: 600 }}>
                        Prix revente :
                      </label>
                      <input 
                        type="number" 
                        min={0} 
                        value={item.resalePrice} 
                        onChange={e => setResalePrice(item.id, e.target.value)} 
                        style={{ 
                          width: 70, 
                          borderRadius: 7, 
                          border: '1.2px solid #1976d2', 
                          padding: '3px 6px', 
                          fontWeight: 600, 
                          fontSize: 14, 
                          textAlign: 'center' 
                        }} 
                        placeholder="FCFA" 
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ fontSize: 14, color: '#1976d2', fontWeight: 600 }}>
                        Acheté :
                      </label>
                      <input 
                        type="checkbox" 
                        checked={!!item.checked} 
                        onChange={() => { 
                          toggleChecked(item.id); 
                          toast.info('Statut mis à jour', { 
                            autoClose: 1800, 
                            hideProgressBar: true, 
                            style: { background: '#e3fcec', color: '#137333', fontWeight: 600, fontSize: 15 } 
                          }); 
                        }} 
                        style={{ width: 18, height: 18 }} 
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 8 }}>
                    <a 
                      href={item.product_url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      style={{ 
                        color: '#1976d2', 
                        fontWeight: 600, 
                        fontSize: 15, 
                        textDecoration: 'none',
                        transition: 'text-decoration 0.2s',
                      }}
                      onMouseOver={e => e.currentTarget.style.textDecoration = 'underline'}
                      onMouseOut={e => e.currentTarget.style.textDecoration = 'none'}
                    >
                      Voir sur {item.site ? item.site.charAt(0).toUpperCase() + item.site.slice(1) : 'le site'}
                    </a>
                    <span
                      onClick={() => { 
                        removeFromSellerCart(item.id); 
                        toast.info('Produit retiré du panier', { 
                          autoClose: 1800, 
                          hideProgressBar: true, 
                          style: { background: '#e3fcec', color: '#137333', fontWeight: 600, fontSize: 15 } 
                        }); 
                      }}
                      style={{
                        color: '#b71c1c',
                        fontWeight: 600,
                        fontSize: 15,
                        cursor: 'pointer',
                        textDecoration: 'none',
                        transition: 'text-decoration 0.2s',
                      }}
                      tabIndex={0}
                      role="button"
                      onMouseOver={e => e.currentTarget.style.textDecoration = 'underline'}
                      onMouseOut={e => e.currentTarget.style.textDecoration = 'none'}
                    >
                      Retirer
                    </span>
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
      </div>
    </div>
  );
}