import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SellerDashboard from './pages/SellerDashboard';
import ScraperPage from './pages/ScraperPage';
import SellerCart from './pages/SellerCart';
import SellerMobileMoney from './pages/SellerMobileMoney';
import SearchResults from './pages/SearchResults';
import SellerStats from './pages/SellerStats';
// ... autres imports ...

function App() {
  return (
    <Router>
      <Routes>
        {/* ... autres routes ... */}
        <Route path="/search" element={<SearchResults />} />
        <Route path="/vendeur" element={<SellerDashboard />} />
        <Route path="/scraper" element={<ScraperPage />} />
        <Route path="/seller-cart" element={<SellerCart />} />
        <Route path="/seller-mobile-money" element={<SellerMobileMoney />} />
        <Route path="/seller-stats" element={<SellerStats />} />
      </Routes>
    </Router>
  );
}

export default App; 