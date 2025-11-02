import React from 'react';

export default function ScraperPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 900, width: '100%', background: '#fff', borderRadius: 20, boxShadow: '0 8px 32px #0002', padding: 40, margin: 'auto', textAlign: 'center', fontSize: 22, color: '#4FC3F7', fontWeight: 700 }}>
        {/* Message alternatif à la place du composant Scraper supprimé */}
        Le service de scraping est disponible via les scripts Python et l'intégration backend. Consultez la documentation ou contactez l'administrateur pour plus d'informations.
      </div>
    </div>
  );
} 