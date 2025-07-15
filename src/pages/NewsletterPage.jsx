// src/pages/NewsletterPage.jsx
import React, { useState } from 'react';

const NewsletterPage = () => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Logique d'abonnement (simulée pour l'instant)
    console.log('Email pour la newsletter:', email);
    setSubscribed(true);
    setEmail('');
  };

  return (
    <div className="bg-page-bg text-main min-h-screen">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-xl rounded-lg p-6 md:p-10">
          <h1 className="text-3xl md:text-4xl font-bold text-primary mb-6">
            Newsletter JETA
          </h1>
          {subscribed ? (
            <p className="text-lg text-accent-green font-semibold">Merci ! Vous êtes maintenant abonné(e) à notre newsletter.</p>
          ) : (
            <>
              <p className="text-lg text-main mb-4">
                Inscrivez-vous pour recevoir nos dernières actualités, promotions et conseils pour vos brocantes.
              </p>
              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div>
                  <label htmlFor="newsletter-email" className="sr-only">
                    Adresse Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    id="newsletter-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors duration-300"
                    placeholder="Votre adresse email"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-lg font-semibold transition-colors duration-300"
                >
                  S'inscrire à la Newsletter
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default NewsletterPage;
