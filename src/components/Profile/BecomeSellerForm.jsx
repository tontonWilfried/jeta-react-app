import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { firestore } from '../../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { FiUploadCloud, FiDollarSign } from 'react-icons/fi';

const CONTRACT_URL = '/contrat-vendeur.html'; // Ouvre la page HTML du contrat vendeur

// Cloudinary config (à adapter si besoin)
const CLOUDINARY_CLOUD_NAME = 'dosydbnt4';
const CLOUDINARY_UPLOAD_PRESET = 'jeta_produits';

// Liste fixe des villes principales du Cameroun
const CITIES = [
  'Yaoundé', 'Douala', 'Bafoussam', 'Garoua', 'Maroua', 'Bamenda', 'Ngaoundéré', 'Kumba',
  'Ebolowa', 'Kribi', 'Bertoua', 'Limbé', 'Nkongsamba', 'Edéa', 'Foumban', 'Dschang'
];

const BecomeSellerForm = () => {
  const { currentUser } = useAuth();
  const [identityFile, setIdentityFile] = useState(null);
  const [sellerPhotoFile, setSellerPhotoFile] = useState(null);
  const [ville, setVille] = useState('');
  const [quartier, setQuartier] = useState('');
  const [contractAccepted, setContractAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleIdentityFileChange = (e) => {
    setIdentityFile(e.target.files[0]);
  };
  const handleSellerPhotoFileChange = (e) => {
    setSellerPhotoFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identityFile) {
      toast.error('Merci de fournir une photo de votre pièce d\'identité.');
      return;
    }
    if (!sellerPhotoFile) {
      toast.error('Merci de fournir une photo de vous-même.');
      return;
    }
    if (!ville.trim()) {
      toast.error('Merci de renseigner votre ville.');
      return;
    }
    if (!quartier.trim()) {
      toast.error('Merci de renseigner votre quartier.');
      return;
    }
    if (!contractAccepted) {
      toast.error('Vous devez accepter le contrat pour devenir vendeur.');
      return;
    }
    setLoading(true);
    setSuccess('');
    try {
      // Upload pièce d'identité sur Cloudinary
      const formDataId = new FormData();
      formDataId.append('file', identityFile);
      formDataId.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const responseId = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formDataId,
      });
      const cloudinaryDataId = await responseId.json();
      if (!cloudinaryDataId.secure_url) {
        throw new Error(cloudinaryDataId.error?.message || 'Erreur lors de l\'upload de la pièce d\'identité.');
      }
      const identityDocumentUrl = cloudinaryDataId.secure_url;

      // Upload photo vendeur sur Cloudinary
      const formDataPhoto = new FormData();
      formDataPhoto.append('file', sellerPhotoFile);
      formDataPhoto.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const responsePhoto = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formDataPhoto,
      });
      const cloudinaryDataPhoto = await responsePhoto.json();
      if (!cloudinaryDataPhoto.secure_url) {
        throw new Error(cloudinaryDataPhoto.error?.message || 'Erreur lors de l\'upload de la photo du vendeur.');
      }
      const sellerPhotoUrl = cloudinaryDataPhoto.secure_url;

      // Mise à jour du document utilisateur
      const userRef = doc(firestore, 'users', currentUser.uid);
      await updateDoc(userRef, {
        role: 'pending_seller',
        identityDocumentUrl,
        sellerPhotoUrl,
        ville,
        quartier,
        contractAccepted: true,
        sellerRequestAt: new Date().toISOString(),
      });
      setSuccess('Votre demande a bien été envoyée. Un administrateur va la valider sous peu.');
    } catch (error) {
      console.error('Erreur lors de la demande vendeur:', error);
      toast.error('Erreur lors de la demande : ' + (error.message || 'Réessayez.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-lg mx-auto bg-gradient-to-br from-[#f3e3fa] to-[#fafdff] border border-[#e0b3f7] p-7 rounded-2xl shadow-xl space-y-6 animate-fadeInUp">
      <h2 className="text-2xl font-extrabold text-[#A259F7] mb-2 text-center flex items-center justify-center gap-2">
        <span className="inline-block animate-bounce"><FiDollarSign size={32} /></span> Devenir vendeur
      </h2>
      {success && <div className="bg-green-100 text-green-700 p-3 rounded-xl text-center font-semibold shadow">{success}</div>}
      <div>
        <label className="block font-medium mb-1 text-[#A259F7]">Photo de la pièce d'identité</label>
        <div className="relative flex items-center gap-3">
          <label className="flex items-center gap-2 bg-[#A259F7]/90 hover:bg-[#A259F7] text-white font-semibold px-4 py-2 rounded-xl shadow cursor-pointer transition border border-[#e0b3f7]">
            <FiUploadCloud size={20} />
            {identityFile ? 'Modifier le fichier' : 'Choisir un fichier'}
            <input type="file" accept="image/*,application/pdf" onChange={handleIdentityFileChange} required className="absolute left-0 top-0 w-full h-full opacity-0 cursor-pointer" tabIndex={-1} />
          </label>
          {identityFile && <span className="text-sm text-[#A259F7] truncate max-w-[180px]">{identityFile.name}</span>}
        </div>
      </div>
      <div>
        <label className="block font-medium mb-1 text-[#A259F7]">Photo du vendeur</label>
        <div className="relative flex items-center gap-3">
          <label className="flex items-center gap-2 bg-[#A259F7]/90 hover:bg-[#A259F7] text-white font-semibold px-4 py-2 rounded-xl shadow cursor-pointer transition border border-[#e0b3f7]">
            <FiUploadCloud size={20} />
            {sellerPhotoFile ? 'Modifier le fichier' : 'Choisir un fichier'}
            <input type="file" accept="image/*" onChange={handleSellerPhotoFileChange} required className="absolute left-0 top-0 w-full h-full opacity-0 cursor-pointer" tabIndex={-1} />
          </label>
          {sellerPhotoFile && <span className="text-sm text-[#A259F7] truncate max-w-[180px]">{sellerPhotoFile.name}</span>}
        </div>
      </div>
      <div>
        <label className="block font-medium mb-1 text-[#A259F7]">Ville</label>
        <select
          value={ville}
          onChange={e => setVille(e.target.value)}
          required
          className="w-full border border-[#e0b3f7] rounded-xl px-3 py-2 text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-[#A259F7] placeholder:text-[#A259F7]/40 transition font-semibold"
        >
          <option value="">Choisir une ville</option>
          {CITIES.map(city => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block font-medium mb-1 text-[#A259F7]">Quartier</label>
        <input type="text" value={quartier} onChange={e => setQuartier(e.target.value)} required className="w-full border border-[#e0b3f7] rounded-xl px-3 py-2 text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-[#A259F7] placeholder:text-[#A259F7]/40 transition" placeholder="Quartier" />
      </div>
      <div className="flex items-center space-x-3">
        <input type="checkbox" id="contract" checked={contractAccepted} onChange={e => setContractAccepted(e.target.checked)} required className="accent-[#A259F7] w-5 h-5 rounded focus:ring-2 focus:ring-[#A259F7]" />
        <label htmlFor="contract" className="text-sm text-[#A259F7]">J'ai lu et j'accepte le <a href={CONTRACT_URL} target="_blank" rel="noopener noreferrer" className="underline text-[#A259F7] font-semibold hover:text-[#7c3aed] transition">contrat vendeur</a></label>
      </div>
      <button type="submit" disabled={loading} className="bg-[#A259F7] text-white px-8 py-3 rounded-2xl font-bold shadow-lg hover:bg-[#7c3aed] transition disabled:opacity-50 w-full text-lg tracking-wide">
        {loading ? 'Envoi...' : 'Envoyer la demande'}
      </button>
    </form>
  );
};

export default BecomeSellerForm; 