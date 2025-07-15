import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { firestore } from '../../firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export default function MobileMoneySettings() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    orangeEnabled: false,
    orangeName: '',
    orangeNumber: '',
    mtnEnabled: false,
    mtnName: '',
    mtnNumber: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      setLoading(true);
      try {
        const userRef = doc(firestore, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          setForm({
            orangeEnabled: !!data.orangeNumber,
            orangeName: data.orangeName || '',
            orangeNumber: data.orangeNumber || '',
            mtnEnabled: !!data.mtnNumber,
            mtnName: data.mtnName || '',
            mtnNumber: data.mtnNumber || '',
          });
        }
      } catch (e) {
        setError("Erreur lors du chargement des infos.");
      }
      setLoading(false);
    };
    fetchData();
  }, [currentUser]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setSuccess(false);
    setError('');
  };

  const handleToggle = (operator) => {
    if (operator === 'orange') {
      setForm(f => ({ ...f, orangeEnabled: !f.orangeEnabled, orangeName: !f.orangeEnabled ? f.orangeName : '', orangeNumber: !f.orangeEnabled ? f.orangeNumber : '' }));
    } else if (operator === 'mtn') {
      setForm(f => ({ ...f, mtnEnabled: !f.mtnEnabled, mtnName: !f.mtnEnabled ? f.mtnName : '', mtnNumber: !f.mtnEnabled ? f.mtnNumber : '' }));
    }
    setSuccess(false);
    setError('');
  };

  const handleDelete = (operator) => {
    if (operator === 'orange') {
      setForm(f => ({ ...f, orangeName: '', orangeNumber: '', orangeEnabled: false }));
    } else if (operator === 'mtn') {
      setForm(f => ({ ...f, mtnName: '', mtnNumber: '', mtnEnabled: false }));
    }
    setSuccess(false);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    setError('');
    try {
      const userRef = doc(firestore, 'users', currentUser.uid);
      await updateDoc(userRef, {
        orangeName: form.orangeEnabled ? form.orangeName : '',
        orangeNumber: form.orangeEnabled ? form.orangeNumber : '',
        mtnName: form.mtnEnabled ? form.mtnName : '',
        mtnNumber: form.mtnEnabled ? form.mtnNumber : '',
      });
      setSuccess(true);
    } catch (e) {
      setError("Erreur lors de l'enregistrement.");
    }
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 max-w-md mx-auto mt-8">
      <h2 className="text-xl font-bold text-primary mb-4">Informations de paiement Mobile Money</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <input
            type="checkbox"
            id="orangeEnabled"
            checked={form.orangeEnabled}
            onChange={() => handleToggle('orange')}
            className="accent-[#FF9800] w-5 h-5"
          />
          <label htmlFor="orangeEnabled" className="font-semibold" style={{ color: '#FF9800' }}>Ajouter un numéro Orange Money</label>
        </div>
        {form.orangeEnabled && (
          <div className="border-b pb-4 mb-4">
            <label className="block font-semibold mb-1 text-primary">Nom affiché (Orange Money)</label>
            <input
              type="text"
              name="orangeName"
              value={form.orangeName}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Nom du titulaire Orange Money"
            />
            <label className="block font-semibold mb-1 text-primary mt-3">Numéro Orange Money</label>
            <input
              type="tel"
              name="orangeNumber"
              value={form.orangeNumber}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Ex: 6XXXXXXXX"
            />
            <button
              type="button"
              onClick={() => handleDelete('orange')}
              className="mt-3 text-xs text-red-500 hover:underline"
            >
              Supprimer ce numéro Orange Money
            </button>
          </div>
        )}
        <div className="flex items-center gap-3 mb-2">
          <input
            type="checkbox"
            id="mtnEnabled"
            checked={form.mtnEnabled}
            onChange={() => handleToggle('mtn')}
            className="accent-[#FFEB3B] w-5 h-5"
          />
          <label htmlFor="mtnEnabled" className="font-semibold" style={{ color: '#FFEB3B' }}>Ajouter un numéro MTN Mobile Money</label>
        </div>
        {form.mtnEnabled && (
          <div>
            <label className="block font-semibold mb-1 text-primary">Nom affiché (MTN Mobile Money)</label>
            <input
              type="text"
              name="mtnName"
              value={form.mtnName}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Nom du titulaire MTN Mobile Money"
            />
            <label className="block font-semibold mb-1 text-primary mt-3">Numéro MTN Mobile Money</label>
            <input
              type="tel"
              name="mtnNumber"
              value={form.mtnNumber}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Ex: 6XXXXXXXX"
            />
            <button
              type="button"
              onClick={() => handleDelete('mtn')}
              className="mt-3 text-xs text-red-500 hover:underline"
            >
              Supprimer ce numéro MTN Mobile Money
            </button>
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 rounded bg-primary text-white font-bold hover:bg-primary-dark transition"
        >
          {loading ? 'Enregistrement...' : 'Enregistrer'}
        </button>
        {success && <div className="text-green-600 font-semibold mt-2">Infos enregistrées !</div>}
        {error && <div className="text-red-600 font-semibold mt-2">{error}</div>}
      </form>
    </div>
  );
} 