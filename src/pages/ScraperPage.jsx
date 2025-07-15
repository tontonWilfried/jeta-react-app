import React from 'react';
import Scraper from '../components/Scraper';

export default function ScraperPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 900, width: '100%', background: '#fff', borderRadius: 20, boxShadow: '0 8px 32px #0002', padding: 40, margin: 'auto' }}>
        <Scraper />
      </div>
    </div>
  );
} 