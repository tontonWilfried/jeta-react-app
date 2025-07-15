// Register.jsx
import './Register.css';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-toastify'; // Importez toast
import { Link, useNavigate } from 'react-router-dom';
import { auth, firestore } from '../../firebaseConfig'; // Ajustez le chemin si firebaseConfig.ts est ailleurs
import {
  createUserWithEmailAndPassword,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  signOut, // Gardez signOut si vous l'utilisez ailleurs dans ce fichier (ex: après inscription)
  sendEmailVerification, // <-- AJOUTEZ CETTE LIGNE
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'; // Importer serverTimestamp

// Importez FaSpinner
import { FaSpinner } from 'react-icons/fa';
import 'react-toastify/dist/ReactToastify.css'; // Importez les styles de react-toastify

// Clé de site reCAPTCHA v2 (visible)
// Remplacez par votre clé de site réelle si différente
const RECAPTCHA_SITE_KEY = '6LfGX1orAAAAAJ-1LB9KIkDVa0hPo1NwP2ZvAueK'; 

// Liste fixe des villes principales du Cameroun
const CITIES = [
  'Yaoundé', 'Douala', 'Bafoussam', 'Garoua', 'Maroua', 'Bamenda', 'Ngaoundéré', 'Kumba',
  'Ebolowa', 'Kribi', 'Bertoua', 'Limbé', 'Nkongsamba', 'Edéa', 'Foumban', 'Dschang'
];

const Register = () => {
  const navigate = useNavigate();
  const [authMethod, setAuthMethod] = useState('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [quartier, setQuartier] = useState('');
  const [ville, setVille] = useState('');
  const [telephone, setTelephone] = useState('');

  const [recaptchaLoading, setRecaptchaLoading] = useState(false);
  const [recaptchaRendered, setRecaptchaRendered] = useState(false);
  const [recaptchaError, setRecaptchaError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const recaptchaContainerRef = useRef(null);
  const recaptchaVerifierRef = useRef(null);

  const clearRecaptcha = useCallback(() => {
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
        console.log('[RegisterComponent] reCAPTCHA cleared.');
      } catch (e) {
        console.warn("[RegisterComponent] Error clearing reCAPTCHA instance:", e);
      }
      recaptchaVerifierRef.current = null;
    }
    // Vider aussi le conteneur au cas où des éléments reCAPTCHA y resteraient
    if (recaptchaContainerRef.current) {
        recaptchaContainerRef.current.innerHTML = '';
    }
    setRecaptchaRendered(false);
    setRecaptchaLoading(false);
    setRecaptchaError('');
  }, []);

  const initializeRecaptcha = useCallback(() => {
    if (!recaptchaContainerRef.current) {
      console.error('[RegisterComponent] recaptchaContainerRef.current is null. Cannot initialize reCAPTCHA.');
      toast.error('Conteneur reCAPTCHA non trouvé. Veuillez rafraîchir.');
      setRecaptchaLoading(false);
      return;
    }
    // Si un verifier existe déjà et est rendu, ne rien faire, sauf si on force une réinitialisation.
    // Pour l'instant, on va le nettoyer et le recréer pour s'assurer qu'il est frais.
    if (recaptchaVerifierRef.current) {
        console.log('[RegisterComponent] Clearing existing reCAPTCHA before re-initialization.');
        clearRecaptcha(); // Utilise la fonction de nettoyage complète
    }
    
    console.log('[RegisterComponent] Initializing reCAPTCHA...');
    setRecaptchaLoading(true);
    setRecaptchaError('');
    setRecaptchaRendered(false);
    
    // Assurez-vous que le conteneur est vide
    recaptchaContainerRef.current.innerHTML = '';

    try {
      const verifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
        'size': 'normal',
        'callback': (response) => {
          console.log('[RegisterComponent] reCAPTCHA solved:', response);
          setRecaptchaRendered(true);
          setRecaptchaLoading(false);
          setRecaptchaError('');
        },
        'expired-callback': () => {
          console.log('[RegisterComponent] reCAPTCHA expired');
          setRecaptchaError('Le reCAPTCHA a expiré. Veuillez réessayer.');
          clearRecaptcha(); 
          // On pourrait vouloir réinitialiser automatiquement ici après un court délai
          setTimeout(() => initializeRecaptcha(), 100);
        },
        'error-callback': (error) => {
          console.error('[RegisterComponent] reCAPTCHA error-callback:', error);
          setRecaptchaError(`Erreur reCAPTCHA: ${error.message || 'Veuillez réessayer.'}`);
          clearRecaptcha();
        }
      });
      
      verifier.render()
        .then((widgetId) => {
          console.log('[RegisterComponent] reCAPTCHA rendered with widgetId:', widgetId);
          recaptchaVerifierRef.current = verifier; // Stocker l'instance APRÈS le rendu réussi
          // Le callback s'occupera de setRecaptchaRendered et setRecaptchaLoading
        })
        .catch((renderError) => {
          console.error('[RegisterComponent] Error rendering reCAPTCHA:', renderError);
          setRecaptchaError('Erreur lors du rendu du reCAPTCHA. Assurez-vous que le conteneur est visible et que la clé de site est correcte.');
          clearRecaptcha();
        });
    } catch (initError) {
      console.error('[RegisterComponent] Error creating RecaptchaVerifier instance:', initError);
      setRecaptchaError(`Impossible d'initialiser le reCAPTCHA: ${initError.message}`);
      setRecaptchaLoading(false); // S'assurer que loading est false en cas d'erreur de création
    }
  }, [auth, clearRecaptcha]); // `clearRecaptcha` est maintenant une dépendance stable

  useEffect(() => {
    let timerId;
    // Supprimer toutes les références à 'phone', 'signInWithPhoneNumber', 'recaptcha', 'authMethod === "phone"', etc.
    // Laisser uniquement l'inscription email/mot de passe.
    if (authMethod === 'email') {
      // S'assurer que le conteneur est disponible dans le DOM
      if (recaptchaContainerRef.current) {
        if (!recaptchaVerifierRef.current && !recaptchaLoading) {
          console.log('[RegisterComponent] Email auth selected, initializing reCAPTCHA.');
          initializeRecaptcha();
        }
      } else {
        // Si le conteneur n'est pas encore là, attendre un peu
        timerId = setTimeout(() => {
          if (authMethod === 'email' && recaptchaContainerRef.current && !recaptchaVerifierRef.current && !recaptchaLoading) {
            console.log('[RegisterComponent] Email auth selected (after delay), initializing reCAPTCHA.');
            initializeRecaptcha();
          }
        }, 100);
      }
    } else {
      // Si on n'est pas en mode téléphone, nettoyer le reCAPTCHA
      clearRecaptcha();
    }
    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [authMethod, initializeRecaptcha, clearRecaptcha, recaptchaLoading]); // recaptchaLoading ajouté pour éviter réinitialisations multiples

   // Nettoyage au démontage du composant
   useEffect(() => {
    return () => {
      console.log('[RegisterComponent] Component unmounting, clearing reCAPTCHA.');
      clearRecaptcha();
    };
  }, [clearRecaptcha]);


  const handleAuthMethodChange = (method) => {
    setAuthMethod(method);
    setEmail('');
    setPassword('');
    setTelephone('');
    // Le reCAPTCHA sera (ré)initialisé ou nettoyé par l'autre useEffect basé sur authMethod
  };

  const handleRegisterWithEmail = async () => {
    setIsSubmitting(true);
    console.log(`[RegisterComponent] Attempting email registration with email: ${email}`);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      if (user) {
        await updateProfile(user, { displayName: name });
        await sendEmailVerification(user);

        // Créer un document pour cet utilisateur dans Firestore
        const userDocRef = doc(firestore, 'users', user.uid);
        await setDoc(userDocRef, {
          uid: user.uid,
          email: email,
          displayName: name,
          quartier: quartier,
          ville: ville,
          telephone: telephone,
          role: 'client',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        console.log('[RegisterComponent] Email registration successful. User:', userCredential.user);
        toast.success('Inscription réussie ! Un email de vérification vous a été envoyé. Veuillez vérifier votre boîte de réception (et vos spams).');
        // Redirect to login page after successful registration
        setTimeout(() => {
          navigate('/login');
        }, 1500); // Wait 1.5s to show success message
        // await signOut(auth); // Optionnel
      }
    } catch (error) {
      console.error('[RegisterComponent] Email authentication error:', error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error('Cette adresse email est déjà utilisée.');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('Adresse email invalide.');
      } else if (error.code === 'auth/weak-password') {
        toast.error('Le mot de passe est trop faible (minimum 6 caractères).');
      } else {
        toast.error(error.message || "Une erreur est survenue lors de l'inscription.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (authMethod === 'email') {
      await handleRegisterWithEmail();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-page-bg p-4">
      <div className="bg-orange-50 p-6 sm:p-8 rounded-2xl shadow-xl w-full max-w-md text-center border border-orange-200/75 font-poppins">
        {/* Remplacement de l'image par le SVG */}
        <div className="mb-6">
          <svg width="80" height="96" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" className="mx-auto">
            {/* Le fond de la carte bg-orange-50 devrait suffire, donc la rect SVG est commentée ou peut être supprimée */}
            {/* <rect width="100" height="120" fill="#FFF7ED" rx="20" ry="20" /> */}
            <text x="50" y="80" fontFamily="Poppins, sans-serif" fontSize="60" fontWeight="bold" fill="#4FC3F7" textAnchor="middle">
              J
            </text>
            {/* Vous pouvez ajuster la couleur du stroke pour qu'elle corresponde à votre theme.colors.primary.DEFAULT si besoin */}
            <path d="M40 90 Q50 100 60 90" stroke="#4FC3F7" strokeWidth="2" fill="none" />
          </svg>
        </div>
        {/* Fin du remplacement du logo */}
        <h2 className="text-2xl sm:text-3xl text-primary font-bold mb-6 register-title-step">Créer un compte</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Choix de la méthode d'authentification - maintenant tout en haut */}
          <div className="flex justify-center space-x-4 sm:space-x-6 mb-6 register-auth-method-step">
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="radio"
                name="authMethod"
                value="email"
                checked={authMethod === 'email'}
                onChange={() => handleAuthMethodChange('email')}
                className="sr-only peer"
              />
              <span className="w-4 h-4 border border-gray-300 rounded-full flex items-center justify-center mr-2 peer-checked:border-primary">
                <span className={`w-2 h-2 bg-primary rounded-full ${authMethod !== 'email' ? 'opacity-0' : 'opacity-100'}`}></span>
              </span>
              <span className="text-gray-700 peer-checked:text-primary">Email</span>
            </label>
          </div>
          {/* Champ Nom - Toujours en premier */}
          <div className="mb-4 text-left">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 text-left">
              Nom
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 p-3 text-base transition-colors duration-300"
              placeholder="Votre nom complet"
              autoComplete="name"
              disabled={isSubmitting}
            />
          </div>
          {/* Email ou Téléphone + Mot de passe, avec styles harmonisés */}
          {authMethod === 'email' && (
            <>
              <div className="mb-4 text-left">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 text-left">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Adresse Email"
                  className="mt-1 block w-full rounded-lg border border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 p-3 text-base transition-colors duration-300"
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="mb-4 text-left">
                <label htmlFor="telephone" className="block text-sm font-medium text-gray-700 text-left">
                  Téléphone
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pr-2 border-r border-gray-300">+237</span>
                  <input
                    id="telephone"
                    type="tel"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value.replace(/\D/g, '').slice(0,9))}
                    placeholder="Numéro (ex: 690536261)"
                    className="mt-1 block w-full rounded-lg border border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 p-3 text-base transition-colors duration-300 pl-[70px]"
                    pattern="[6][0-9]{8}"
                    title="Doit commencer par 6 et avoir 9 chiffres"
                    maxLength={9}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              <div className="mb-4 text-left">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 text-left">
                  Mot de passe
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mot de passe"
                  className="mt-1 block w-full rounded-lg border border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 p-3 text-base transition-colors duration-300"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </>
          )}

          {/* Champs communs pour les deux méthodes */}
          {!authMethod === 'email' && (
            <>
              <div className="mb-4 text-left">
                <label htmlFor="quartier" className="block text-sm font-medium text-gray-700 text-left">
                  Quartier
                </label>
                <input
                  id="quartier"
                  type="text"
                  value={quartier}
                  onChange={(e) => setQuartier(e.target.value)}
                  placeholder="Votre quartier"
                  className="mt-1 block w-full rounded-lg border border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 p-3 text-base transition-colors duration-300"
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="mb-4 text-left">
                <label htmlFor="ville" className="block text-sm font-medium text-gray-700 text-left">
                  Ville
                </label>
                <select
                  id="ville"
                  value={ville}
                  onChange={(e) => setVille(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 p-3 text-base transition-colors duration-300 bg-white text-gray-800 font-semibold"
                  required
                  disabled={isSubmitting}
                >
                  <option value="">Choisir une ville</option>
                  {CITIES.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <button
              type="submit"
              disabled={isSubmitting || (authMethod === 'email' && (!recaptchaRendered || recaptchaLoading))}
              className={`w-full px-4 py-3 rounded-lg font-semibold shadow transition-all duration-200 ease-in-out register-submit-button-step ${
                (isSubmitting || (authMethod === 'email' && (!recaptchaRendered || recaptchaLoading)))
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-primary text-white hover:bg-primary-dark hover:scale-[1.02] flex items-center justify-center' // Ajout de flex pour centrer le spinner
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <FaSpinner className="animate-spin mr-2 text-white" /> Chargement... {/* Couleur du spinner en blanc */}
                </span>
              ) : (authMethod === 'email' ? "S'inscrire" : "S'inscrire")}
            </button>
        </form>

        <p className="mt-8 text-sm text-gray-600">
          Déjà un compte ?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
