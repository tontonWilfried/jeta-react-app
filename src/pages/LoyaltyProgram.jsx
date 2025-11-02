// src/pages/LoyaltyProgram.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../firebaseConfig';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';

const BARREME = 1000; // 1 point par 1000 FCFA
const REDUCTION = 5; // 5% pour 100 points (exemple)

const LoyaltyProgram = () => {
  const { currentUser } = useAuth();
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false); // Pour afficher tout l'historique ou non
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPoints = async () => {
      if (!currentUser) return;
      setLoading(true);
      const userRef = doc(firestore, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setLoyaltyPoints(userSnap.data().loyaltyPoints || 0);
        setHistory(userSnap.data().loyaltyHistory || []);
      }
      setLoading(false);
    };
    fetchPoints();
  }, [currentUser]);

  // Déterminer l'historique à afficher
  const historyToShow = showAll ? history.slice().reverse() : history.slice(-2).reverse();
  const hasMore = history.length > 2;

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
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-xl rounded-lg p-6 md:p-10 max-w-2xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-extrabold text-[#4FC3F7] mb-6 text-center">
            Mon Programme Fidélité
          </h1>
          {loading ? (
            <div className="text-center text-gray-400 py-8">Chargement...</div>
          ) : (
            <>
              <div className="flex flex-col items-center mb-6">
                <div className="text-5xl font-extrabold text-accent-green mb-2">{loyaltyPoints}</div>
                <div className="text-lg font-semibold text-gray-600">points fidélité</div>
              </div>
              <div className="bg-[#e3f3fa] rounded-xl p-4 mb-6 text-center">
                <div className="font-bold text-[#4FC3F7] mb-1">Comment ça marche ?</div>
                <div className="text-gray-700 text-sm">
                  • 1 point pour chaque <span className="font-bold">{BARREME} FCFA</span> dépensés sur JETA.<br/>
                  • <span className="font-bold">100 points</span> = <span className="text-accent-green font-bold">{REDUCTION}% de réduction</span> sur votre prochaine commande.<br/>
                  • Plus vous commandez, plus vous gagnez de points et d'avantages !
                </div>
              </div>
              <div className="mb-4">
                <div className="font-bold text-[#4FC3F7] mb-2">Historique de vos points</div>
                {history.length === 0 ? (
                  <div className="text-gray-400 text-center py-8">Aucun mouvement de points pour l'instant.</div>
                ) : (
                  <div className="space-y-3">
                    {historyToShow.map((item, idx) => (
                      <div key={idx} className="bg-[#f6fafd] rounded-lg p-4 border border-white shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex-1">
                            <div className="font-semibold text-[#4FC3F7] text-sm">
                              {item.productName || item.description || 'Commande payée'}
                            </div>
                            {item.amount && (
                              <div className="text-xs text-gray-500 mt-1">
                                Montant : {item.amount.toLocaleString()} FCFA
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-lg font-bold ${item.points > 0 ? 'text-[#00C853]' : 'text-red-500'}`}>
                              {item.points > 0 ? '+' : ''}{item.points} pts
                            </span>
                            <span className="text-xs text-gray-400">
                              {item.date ? new Date(item.date).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              }) : ''}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            item.type === 'gain' 
                              ? 'bg-green-100 text-green-700 border border-green-200' 
                              : 'bg-red-100 text-red-700 border border-red-200'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                            {item.type === 'gain' ? 'Commande validée' : 'Points utilisés'}
                          </div>
                          {item.amount && (
                            <div className="text-xs text-gray-500">
                              • {Math.floor(item.amount / 1000)} point{Math.floor(item.amount / 1000) > 1 ? 's' : ''} pour {item.amount.toLocaleString()} FCFA
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {hasMore && (
                      <div className="flex justify-center mt-2">
                        <button
                          className="px-4 py-2 rounded-lg bg-[#e3f3fa] text-[#4FC3F7] font-semibold hover:bg-[#b3e0f7] transition text-sm shadow"
                          onClick={() => setShowAll(v => !v)}
                        >
                          {showAll ? 'Voir moins' : `Voir plus (${history.length - 2} de plus)`}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default LoyaltyProgram;
