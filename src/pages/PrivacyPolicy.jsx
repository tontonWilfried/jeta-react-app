import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';

const PrivacyPolicy = () => {
  const navigate = useNavigate();
  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };
  return (
    <div className="min-h-screen bg-[#f6fafd] py-8 px-4 relative">
      {/* Bouton retour cohérent, en dehors du bloc principal */}
      <button
        onClick={handleBack}
        className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/80 hover:bg-[#e3f3fa] shadow text-[#4FC3F7] font-semibold text-base z-30 border border-[#e3f3fa]"
        style={{backdropFilter: 'blur(2px)'}}
      >
        <FiArrowLeft className="w-5 h-5" /> Retour
      </button>
      <div className="max-w-2xl mx-auto p-6 bg-white rounded shadow mt-8 mb-8">
        <h1 className="text-3xl font-bold mb-4 text-main">Politique de Confidentialité</h1>
        <p className="mb-4">Nous nous engageons à protéger vos données personnelles conformément à la législation camerounaise (Loi n° 2010/012 sur la cybersécurité et la cybercriminalité) et au RGPD.</p>
        <h2 className="text-xl font-semibold mt-6 mb-2">1. Données collectées</h2>
        <ul className="list-disc ml-6 mb-4">
          <li>Informations de compte (nom, email, mot de passe sécurisé)</li>
          <li>Données de navigation et d’utilisation de l’application</li>
          <li>Historique d’achats, de paniers, de discussions et de commandes</li>
        </ul>
        <h2 className="text-xl font-semibold mt-6 mb-2">2. Utilisation des données</h2>
        <ul className="list-disc ml-6 mb-4">
          <li>Gestion de votre compte et de vos commandes</li>
          <li>Amélioration de l’expérience utilisateur</li>
          <li>Envoi de notifications et d’informations importantes</li>
        </ul>
        <h2 className="text-xl font-semibold mt-6 mb-2">3. Sécurité</h2>
        <p className="mb-4">Vos données sont stockées de façon sécurisée sur les serveurs de Google Firebase. Nous appliquons les meilleures pratiques de sécurité et d’accès restreint. Vous êtes responsable de la confidentialité de votre mot de passe.</p>
        <h2 className="text-xl font-semibold mt-6 mb-2">4. Consentement</h2>
        <p className="mb-4">Votre consentement est requis pour la collecte et le traitement de vos données. Vous pouvez retirer ce consentement à tout moment en supprimant votre compte.</p>
        <h2 className="text-xl font-semibold mt-6 mb-2">5. Droit d’accès, de rectification et de suppression</h2>
        <p className="mb-4">Vous pouvez demander l’accès, la modification ou la suppression de vos données personnelles à tout moment via la page profil ou en nous contactant.</p>
        <h2 className="text-xl font-semibold mt-6 mb-2">6. Contact</h2>
        <p>Pour toute question, contactez-nous à <a href="mailto:support@jeta.cm" className="text-accent-green underline">support@jeta.cm</a>.</p>
      </div>
    </div>
  );
};

export default PrivacyPolicy; 