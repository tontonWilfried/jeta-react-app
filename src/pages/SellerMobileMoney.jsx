import React, { useState } from 'react';
import MobileMoneySettings from '../components/Profile/MobileMoneySettings';
import { useAuth } from '../contexts/AuthContext';
import { firestore } from '../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import { FiCreditCard } from 'react-icons/fi';

export default function SellerMobileMoney() {
  const { currentUser } = useAuth();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!currentUser) return;
    setLoading(true);
    setError('');
    setSuccess(false);
    try {
      const userRef = doc(firestore, 'users', currentUser.uid);
      await updateDoc(userRef, {
        mobileMoneyName: '',
        mobileMoneyNumber: '',
        mobileMoneyOperator: '',
      });
      setSuccess(true);
    } catch (e) {
      setError("Erreur lors de la suppression.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-page-bg flex flex-col items-center justify-center py-10 px-2">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-lg p-8 flex flex-col items-center">
        <div className="flex items-center gap-3 mb-4">
          <FiCreditCard className="text-primary" size={32} />
          <h1 className="text-2xl sm:text-3xl font-extrabold text-primary">Mon paiement Mobile Money</h1>
        </div>
        <p className="text-gray-600 text-center mb-6 max-w-md">
          Configure ici tes informations de paiement Mobile Money. Ces informations seront affichées à tes clients lors du paiement de leurs commandes.
        </p>
        <MobileMoneySettings />
        <button
          onClick={handleDelete}
          disabled={loading}
          className="w-full mt-8 py-2 px-4 rounded-lg bg-red-500 text-white font-bold hover:bg-red-600 transition shadow"
        >
          {loading ? 'Suppression...' : 'Supprimer mes infos Mobile Money'}
        </button>
        {success && <div className="text-green-600 font-semibold mt-4">Infos supprimées !</div>}
        {error && <div className="text-red-600 font-semibold mt-4">{error}</div>}
      </div>
    </div>
  );
} 