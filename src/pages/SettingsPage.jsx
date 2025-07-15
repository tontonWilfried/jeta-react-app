// src/pages/SettingsPage.jsx
import React from 'react';

const SettingsPage = () => {
  return (
    <div className="bg-page-bg text-main min-h-screen">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-xl rounded-lg p-6 md:p-10">
          <h1 className="text-3xl md:text-4xl font-bold text-primary mb-6">
            Paramètres & Personnalisation
          </h1>
          <p className="text-lg text-main">
            Gérez ici vos préférences d'affichage, la langue de l'application, et d'autres paramètres.
          </p>
          <div className="mt-6 space-y-4">
            <div>
              <label htmlFor="language-select" className="block text-sm font-medium text-gray-700">
                Langue de l'application
              </label>
              <select
                id="language-select"
                name="language"
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
                defaultValue="fr" // Valeur par défaut
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>
            {/* Autres paramètres ici */}
          </div>
        </div>
      </main>
    </div>
  );
};

export default SettingsPage;
