// src/pages/BrocanteMap.jsx
import React from 'react';

const BrocanteMap = () => {
  return (
    <div className="bg-page-bg text-main min-h-screen">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-xl rounded-lg p-6 md:p-10">
          <h1 className="text-3xl md:text-4xl font-bold text-primary mb-6">
            Carte des Brocantes
          </h1>
          <p className="text-lg text-main">
            Visualisez les stands et brocantes à proximité sur une carte interactive.
          </p>
          <p className="mt-4 text-main">(Intégration de Google Maps ou autre service de cartographie à implémenter).</p>
          {/* Carte interactive ici */}
          <div className="mt-6 h-96 bg-gray-200 flex items-center justify-center text-gray-500">
            Espace réservé pour la carte
          </div>
        </div>
      </main>
    </div>
  );
};

export default BrocanteMap;
