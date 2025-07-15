// src/pages/HelpInfoPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';

const HelpInfoPage = () => {
  return (
    <div className="bg-page-bg text-main min-h-screen">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-xl rounded-lg p-6 md:p-10">
          <h1 className="text-3xl md:text-4xl font-bold text-primary mb-6">
            Aide & Informations
          </h1>
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-main mb-2">FAQ (Foire Aux Questions)</h2>
              <p className="text-main">Trouvez les réponses aux questions les plus fréquemment posées.</p>
              {/* <Link to="/faq-details" className="text-accent-green hover:underline">Consulter la FAQ</Link> */}
              <p className="mt-2 text-gray-500">(Contenu de la FAQ à ajouter)</p>
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-main mb-2">Politique de Confidentialité</h2>
              <p className="text-main">Découvrez comment nous protégeons vos données personnelles.</p>
              {/* <Link to="/privacy-policy" className="text-accent-green hover:underline">Lire notre politique</Link> */}
              <p className="mt-2 text-gray-500">(Contenu de la politique à ajouter)</p>
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-main mb-2">Conditions d'Utilisation</h2>
              <p className="text-main">Consultez les termes et conditions d'utilisation de JETA.</p>
              {/* <Link to="/terms-of-service" className="text-accent-green hover:underline">Lire les conditions</Link> */}
              <p className="mt-2 text-gray-500">(Contenu des conditions à ajouter)</p>
            </div>
             <div>
              <h2 className="text-2xl font-semibold text-main mb-2">À Propos de JETA</h2>
              <p className="text-main">Apprenez-en plus sur notre mission et notre équipe.</p>
              {/* <Link to="/about-us" className="text-accent-green hover:underline">Découvrir JETA</Link> */}
              <p className="mt-2 text-gray-500">(Contenu "À Propos" à ajouter)</p>
            </div>
             <div>
              <h2 className="text-2xl font-semibold text-main mb-2">Nous Contacter</h2>
              <p className="text-main">Besoin d'aide ? Contactez notre support.</p>
              {/* <Link to="/contact-support" className="text-accent-green hover:underline">Contacter le support</Link> */}
              <p className="mt-2 text-gray-500">(Informations de contact à ajouter)</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HelpInfoPage;
