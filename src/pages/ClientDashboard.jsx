import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import BecomeSellerForm from '../components/Profile/BecomeSellerForm';
import { FiSmile, FiShoppingBag, FiBookOpen, FiGift, FiMessageCircle, FiTrendingUp, FiCheckCircle, FiClock, FiUserPlus } from 'react-icons/fi';

export default function ClientDashboard() {
  const { currentUser, userData } = useAuth();
  const [showSellerForm, setShowSellerForm] = useState(false);

  // Simuler des commandes et notifications (à remplacer par des vraies données si dispo)
  const commandes = [];
  const notifications = [
    { id: 1, message: "Bienvenue sur JETA ! Profitez de nos services." },
  ];

  // Statut demande vendeur
  const sellerStatus = userData?.role === 'pending_seller' ? 'pending' : userData?.role === 'seller' ? 'approved' : 'none';
  const displayName = userData?.displayName || userData?.name || currentUser?.displayName || currentUser?.name || currentUser?.email || 'Client';

  return (
    <div className="p-4 sm:p-8 bg-page-bg min-h-screen font-poppins">
      <div className="max-w-5xl mx-auto">
        {/* Header contextuel animé */}
        <div className="flex flex-col items-center justify-center mb-10 animate-fadeInUp pt-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-dark drop-shadow-lg flex items-center gap-3 mb-2" style={{paddingBottom: '0.3em', marginBottom: '0.5em'}}>
            <span className="animate-bounce"><FiSmile className="inline-block text-primary-dark" size={44} /></span>
            Bienvenue, {displayName} !
          </h1>
          <p className="text-lg sm:text-xl text-text-secondary font-medium text-center max-w-2xl">
            Retrouvez ici tous vos services, commandes et avantages JETA.
          </p>
        </div>

        {/* Accès rapide sous forme de cards modernisées, 4 en haut, 2 en bas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Link to="/brocante-live" className="bg-gradient-to-br from-[#e3f3fa] to-[#f6fafd] rounded-2xl shadow-lg p-6 flex flex-col items-center hover:scale-105 transition-transform border border-[#b3e0f7] group">
            <FiShoppingBag className="text-[#4FC3F7] group-hover:scale-110 transition-transform duration-200 mb-3" size={38} />
            <span className="font-bold text-lg mb-1 text-[#4FC3F7]">Brocante en ligne</span>
            <span className="text-gray-500 text-sm text-center">Achetez et vendez en direct</span>
          </Link>
          <Link to="/customer-discussions" className="bg-gradient-to-br from-[#e3f0ff] to-[#f6fafd] rounded-2xl shadow-lg p-6 flex flex-col items-center hover:scale-105 transition-transform border border-[#b3cfff] group">
            <FiMessageCircle className="text-[#4FC3F7] group-hover:scale-110 transition-transform duration-200 mb-3" size={38} />
            <span className="font-bold text-lg mb-1 text-[#4FC3F7]">Discussions</span>
            <span className="text-gray-500 text-sm text-center">Discutez avec vos vendeurs</span>
          </Link>
          <Link to="/loyalty-program" className="bg-gradient-to-br from-[#e3f0ff] to-[#f6fafd] rounded-2xl shadow-lg p-6 flex flex-col items-center hover:scale-105 transition-transform border border-[#b3cfff] group">
            <FiGift className="text-[#4FC3F7] group-hover:scale-110 transition-transform duration-200 mb-3" size={38} />
            <span className="font-bold text-lg mb-1 text-[#4FC3F7]">Programme fidélité</span>
            <span className="text-gray-500 text-sm text-center">Cumulez des points et gagnez des récompenses</span>
          </Link>
          <Link to="/chat-support" className="bg-gradient-to-br from-[#e3f0ff] to-[#f6fafd] rounded-2xl shadow-lg p-6 flex flex-col items-center hover:scale-105 transition-transform border border-[#b3cfff] group">
            <FiMessageCircle className="text-[#4FC3F7] group-hover:scale-110 transition-transform duration-200 mb-3" size={38} />
            <span className="font-bold text-lg mb-1 text-[#4FC3F7]">Support</span>
            <span className="text-gray-500 text-sm text-center">Contactez notre équipe pour toute question</span>
          </Link>
        </div>
        {/* Carte Devenir vendeur harmonisée centrée */}
        <div className="flex justify-center mb-10">
          <div
            className="bg-gradient-to-br from-[#f3e3fa] to-[#fafdff] rounded-2xl shadow-lg p-6 flex flex-col items-center hover:scale-105 transition-transform border border-[#e0b3f7] group cursor-pointer relative"
            onClick={() => sellerStatus === 'none' && setShowSellerForm(v => !v)}
            style={{ minHeight: '180px' }}
          >
            <FiUserPlus className="text-[#A259F7] group-hover:scale-110 transition-transform duration-200 mb-3" size={38} />
            <span className="font-bold text-lg mb-1 text-[#A259F7]">Devenir vendeur</span>
            <span className="text-gray-500 text-sm text-center mb-2">Rejoignez la communauté des vendeurs JETA et proposez vos articles en quelques clics !</span>
            {sellerStatus === 'pending' && (
              <span className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-yellow-100 text-yellow-800 text-xs font-semibold px-3 py-1 rounded-full shadow animate-pulse flex items-center gap-1">
                ⏳ En attente
              </span>
            )}
            {sellerStatus === 'approved' && (
              <span className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full shadow animate-bounce flex items-center gap-1">
                ✅ Vendeur
              </span>
            )}
            {showSellerForm && sellerStatus === 'none' && (
              <div className="mt-4 w-full relative" onClick={e => e.stopPropagation()}>
                <BecomeSellerForm />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 