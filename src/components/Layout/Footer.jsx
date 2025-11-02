import React from 'react';
import { Link } from 'react-router-dom';
import { FaWhatsapp, FaFacebook, FaEnvelope } from 'react-icons/fa';
// import { FaWhatsapp, FaFacebook, FaEnvelope, FaMapMarkerAlt } from 'react-icons/fa';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    // Utilisation des couleurs de tailwind.config.js et d'un gris standard pour le fond
    <footer className="bg-gray-100 text-primary border-t border-subtle-border py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
          <div>
            <h3 className="font-semibold text-lg mb-2">Liens Utiles</h3>
            <ul className="space-y-1">
              <li><Link to="/about" className="hover:underline">À propos de JETA</Link></li>
              <li><Link to="/contact" className="hover:underline">Nous Contacter</Link></li>
              <li><Link to="/terms" className="hover:underline">Conditions d’utilisation</Link></li>
              <li><Link to="/faq" className="hover:underline">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-2">Nous Rejoindre</h3>
            <p className="mb-2">
              {/* <FaMapMarkerAlt className="inline mr-1" /> */}
              Brocante connectée au Cameroun
              {/* Optionnel: lien Google Maps */}
              {/* <a href="URL_GOOGLE_MAPS" target="_blank" rel="noopener noreferrer" className="hover:underline ml-1">(Voir la carte)</a> */}
            </p>
            <div className="flex justify-center space-x-4">
              <a href="" target="_blank" rel="noopener noreferrer" className="hover:text-primary">
                {/* <FaWhatsapp size={24} /> */}
                <FaWhatsapp size={24} />
              </a>
              <a href="" target="_blank" rel="noopener noreferrer" className="hover:text-primary">
                {/* <FaFacebook size={24} /> */}
                <FaFacebook size={24} />
              </a>
              <a href="" className="hover:text-primary">
                {/* <FaEnvelope size={24} /> Ou une icône SMS */}
                <FaEnvelope size={24} />
              </a>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-2">Support & Fidélité</h3>
            <ul className="space-y-1">
              <li><Link to="/promotions" className="hover:underline">Offres Flash</Link></li>
              {/* <li><Link to="/loyalty" className="hover:underline">Points Fidélité</Link></li> */}
              <li><Link to="/support" className="hover:underline">Contacter le Support</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-subtle-border pt-6">
          <p className="text-sm">&copy; {currentYear} JETA - Tous droits réservés.</p>
          <div className="text-center text-xs text-gray-500 mt-2">
            © {new Date().getFullYear()} Jeta. Tous droits réservés. |
            <a href="/politique-confidentialite" className="text-accent-green underline ml-1">Politique de confidentialité</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;