import React from 'react';
import { Link } from 'react-router-dom';
import './Home.css'; // Pour l'effet machine à écrire
// CustomJoyrideTooltip est maintenant utilisé globalement dans App.tsx

const Home = ({ startOnboardingTour }) => {
  // La logique du tutoriel est maintenant gérée par App.tsx
  // startOnboardingTour est une prop venant de App.tsx

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-page-bg text-text-main p-4">
        <div className="flex flex-col items-center">
          {/* Logo SVG */}
          <div className="mb-6">
            <svg width="100" height="120" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" className="mx-auto">
              {/* <rect width="100" height="120" fill="#FFF7ED" rx="20" ry="20" /> */} {/* Fond de la carte déjà géré par bg-orange-50 */}
              <text x="50" y="80" fontFamily="Poppins, sans-serif" fontSize="60" fontWeight="bold" fill="#4FC3F7" textAnchor="middle">
                J
              </text>
              <path d="M40 90 Q50 100 60 90" stroke="#4FC3F7" strokeWidth="2" fill="none" />
            </svg>
          </div>

          {/* Carte principale */}
          <div className="bg-orange-50 p-6 rounded-2xl shadow-xl w-full max-w-md text-center border border-orange-200/75">
            {/* Titre JETA */}
            <h1 className="text-3xl sm:text-4xl text-primary font-bold mb-3 jeta-title-step">
              <span className="inline-block animate-letterBounce" style={{ animationDelay: '0s', animationIterationCount: 2 }}>J</span>
              <span className="inline-block animate-letterBounce" style={{ animationDelay: '0.1s', animationIterationCount: 2 }}>E</span>
              <span className="inline-block animate-letterBounce" style={{ animationDelay: '0.2s', animationIterationCount: 2 }}>T</span>
              <span className="inline-block animate-letterBounce" style={{ animationDelay: '0.3s', animationIterationCount: 2 }}>A</span>
            </h1>
            
            {/* Slogan avec effet machine à écrire */}
            <p className="text-md text-text-main/80 mb-6 font-mono typewriter jeta-slogan-step">
              Le Gestionnaire D'achats.
            </p>
        
            {/* Boutons d'action */}
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 w-full">
              <Link 
                to="/login" // Pointer vers la page de connexion
                className="flex-1 bg-primary hover:bg-primary-dark text-white px-4 py-3 rounded-lg font-semibold shadow-md transform hover:scale-105 transition-all duration-200 flex items-center justify-center start-button-step"
              >
                COMMENCER
              </Link>
              <button 
                onClick={startOnboardingTour}
                className="flex-1 bg-primary hover:bg-primary-dark text-white px-4 py-3 rounded-lg font-semibold shadow-md transform hover:scale-105 transition-all duration-200 flex items-center justify-center"
              >
                Lancer le Tutoriel
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;