import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const ConsentBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('jeta_data_consent');
    if (!consent) setVisible(true);
  }, []);

  const handleAccept = () => {
    localStorage.setItem('jeta_data_consent', 'accepted');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#f5f5f5', color: '#222', padding: '16px', boxShadow: '0 -2px 8px rgba(0,0,0,0.07)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px' }}>
      <span>
        En poursuivant votre navigation, vous acceptez la collecte et le stockage de vos données conformément à notre <Link to="/politique-confidentialite" style={{ color: '#4FC3F7', textDecoration: 'underline' }}>politique de confidentialité</Link>.
      </span>
      <button onClick={handleAccept} style={{ background: '#4FC3F7', color: 'white', border: 'none', borderRadius: '4px', padding: '8px 16px', fontWeight: 'bold', cursor: 'pointer' }}>J'accepte</button>
    </div>
  );
};

export default ConsentBanner; 