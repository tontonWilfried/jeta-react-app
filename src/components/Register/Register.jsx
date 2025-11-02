import './Register.css';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-toastify';
import { Link, useNavigate } from 'react-router-dom';
import { auth, firestore } from '../../firebaseConfig';
import {
  createUserWithEmailAndPassword,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  sendEmailVerification,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { FaSpinner } from 'react-icons/fa';
import 'react-toastify/dist/ReactToastify.css';

const RECAPTCHA_SITE_KEY = '6LfGX1orAAAAAJ-1LB9KIkDVa0hPo1NwP2ZvAueK';

const CITIES = [
  'Yaoundé', 'Douala', 'Bafoussam', 'Garoua', 'Maroua', 'Bamenda', 'Ngaoundéré', 'Kumba',
  'Ebolowa', 'Kribi', 'Bertoua', 'Limbé', 'Nkongsamba', 'Edéa', 'Foumban', 'Dschang'
];

const isValidCameroonPhoneNumber = (number) => {
  const regex = /^6[0-9]{8}$/;
  return regex.test(number);
};

const Register = () => {
  const navigate = useNavigate();
  const [authMethod, setAuthMethod] = useState('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [verificationCodeSent, setVerificationCodeSent] = useState(false);
  const [confirmationResultState, setConfirmationResultState] = useState(null);
  const [name, setName] = useState('');
  const [quartier, setQuartier] = useState('');
  const [ville, setVille] = useState('');
  const [telephone, setTelephone] = useState('');
  const [consent, setConsent] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [telephoneError, setTelephoneError] = useState('');

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
    if (recaptchaVerifierRef.current) {
      console.log('[RegisterComponent] Clearing existing reCAPTCHA before re-initialization.');
      clearRecaptcha();
    }
    
    console.log('[RegisterComponent] Initializing reCAPTCHA...');
    setRecaptchaLoading(true);
    setRecaptchaError('');
    setRecaptchaRendered(false);
    
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
          recaptchaVerifierRef.current = verifier;
        })
        .catch((renderError) => {
          console.error('[RegisterComponent] Error rendering reCAPTCHA:', renderError);
          setRecaptchaError('Erreur lors du rendu du reCAPTCHA. Assurez-vous que le conteneur est visible et que la clé de site est correcte.');
          clearRecaptcha();
        });
    } catch (initError) {
      console.error('[RegisterComponent] Error creating RecaptchaVerifier instance:', initError);
      setRecaptchaError(`Impossible d'initialiser le reCAPTCHA: ${initError.message}`);
      setRecaptchaLoading(false);
    }
  }, [auth, clearRecaptcha]);

  useEffect(() => {
    let timerId;
    if (authMethod === 'phone') {
      if (recaptchaContainerRef.current) {
        if (!recaptchaVerifierRef.current && !recaptchaLoading) {
          console.log('[RegisterComponent] Phone auth selected, initializing reCAPTCHA.');
          initializeRecaptcha();
        }
      } else {
        timerId = setTimeout(() => {
          if (authMethod === 'phone' && recaptchaContainerRef.current && !recaptchaVerifierRef.current && !recaptchaLoading) {
            console.log('[RegisterComponent] Phone auth selected (after delay), initializing reCAPTCHA.');
            initializeRecaptcha();
          }
        }, 100);
      }
    } else {
      clearRecaptcha();
    }
    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [authMethod, initializeRecaptcha, clearRecaptcha, recaptchaLoading]);

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
    setPhoneNumber('');
    setCode('');
    setVerificationCodeSent(false);
    setConfirmationResultState(null);
    setPhoneError('');
    setTelephoneError('');
  };

  const handlePhoneNumberChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 9);
    setPhoneNumber(value);
    if (value && !isValidCameroonPhoneNumber(value)) {
      setPhoneError('Le numéro doit commencer par 6 et contenir exactement 9 chiffres (ex: 677598632).');
    } else {
      setPhoneError('');
    }
  };

  const handleTelephoneChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 9);
    setTelephone(value);
    if (value && !isValidCameroonPhoneNumber(value)) {
      setTelephoneError('Le numéro doit commencer par 6 et contenir exactement 9 chiffres (ex: 677598632).');
    } else {
      setTelephoneError('');
    }
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
        setTimeout(() => {
          navigate('/login');
        }, 1500);
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

  const handleSendSms = async () => {
    if (!recaptchaRendered || !recaptchaVerifierRef.current) {
      toast.error('Veuillez compléter le reCAPTCHA avant d\'envoyer le SMS.');
      if (!recaptchaVerifierRef.current && recaptchaContainerRef.current && authMethod === 'phone') {
        initializeRecaptcha();
      }
      return;
    }
    setIsSubmitting(true);
    const fullPhoneNumber = `+237${phoneNumber}`;
    console.log(`[RegisterComponent] Attempting to send SMS to: ${fullPhoneNumber} using verifier:`, recaptchaVerifierRef.current);
    try {
      const confirmation = await signInWithPhoneNumber(auth, fullPhoneNumber, recaptchaVerifierRef.current);
      setConfirmationResultState(confirmation);
      setVerificationCodeSent(true);
      toast.success('SMS envoyé avec succès ! Veuillez entrer le code.');
      console.log('[RegisterComponent] SMS sent, confirmation result set.');
    } catch (error) {
      console.error('[RegisterComponent] Error sending SMS:', error);
      toast.error(error.message || "Erreur lors de l'envoi du SMS.");
      clearRecaptcha();
      if (authMethod === 'phone' && recaptchaContainerRef.current) {
        setTimeout(() => initializeRecaptcha(), 100);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!confirmationResultState) {
      toast.error('Aucun processus de vérification en cours.');
      return;
    }
    if (!code || code.length !== 6) {
      toast.error('Veuillez entrer un code à 6 chiffres.');
      return;
    }
    setIsSubmitting(true);
    console.log(`[RegisterComponent] Attempting to verify code: ${code}`);
    try {
      const result = await confirmationResultState.confirm(code);
      const user = result.user;
      if (user) {
        const userDocRef = doc(firestore, 'users', user.uid);
        await setDoc(userDocRef, {
          uid: user.uid,
          phoneNumber: `+237${phoneNumber}`,
          displayName: name,
          quartier: quartier,
          ville: ville,
          role: 'client',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        console.log('[RegisterComponent] Phone registration successful. User:', result.user);
        toast.success('Inscription par téléphone réussie !');
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      }
    } catch (error) {
      console.error('[RegisterComponent] Error verifying code:', error);
      if (error.code === 'auth/invalid-verification-code') {
        toast.error('Code de vérification invalide.');
      } else if (error.code === 'auth/code-expired') {
        toast.error('Le code a expiré. Veuillez demander un nouveau code.');
        setVerificationCodeSent(false);
        clearRecaptcha();
      } else {
        toast.error(error.message || "Erreur lors de la vérification du code.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (authMethod === 'phone' && !isValidCameroonPhoneNumber(phoneNumber)) {
      toast.error('Veuillez entrer un numéro de téléphone camerounais valide (9 chiffres, commençant par 6).');
      return;
    }
    if (authMethod === 'email' && !isValidCameroonPhoneNumber(telephone)) {
      toast.error('Veuillez entrer un numéro de téléphone camerounais valide (9 chiffres, commençant par 6).');
      return;
    }

    if (authMethod === 'email') {
      await handleRegisterWithEmail();
    } else if (authMethod === 'phone') {
      if (!verificationCodeSent) {
        await handleSendSms();
      } else {
        await handleVerifyCode();
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-page-bg p-4">
      <div className="bg-orange-50 p-6 sm:p-8 rounded-2xl shadow-xl w-full max-w-md text-center border border-orange-200/75 font-poppins">
        <div className="mb-6">
          <svg width="80" height="96" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" className="mx-auto">
            <text x="50" y="80" fontFamily="Poppins, sans-serif" fontSize="60" fontWeight="bold" fill="#4FC3F7" textAnchor="middle">
              J
            </text>
            <path d="M40 90 Q50 100 60 90" stroke="#4FC3F7" strokeWidth="2" fill="none" />
          </svg>
        </div>
        <h2 className="text-2xl sm:text-3xl text-primary font-bold mb-6 register-title-step">Créer un compte</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
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
                    onChange={handleTelephoneChange}
                    placeholder="Numéro (ex: 677598632)"
                    className={`mt-1 block w-full rounded-lg border ${telephoneError ? 'border-red-500' : 'border-gray-300'} shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 p-3 text-base transition-colors duration-300 pl-[70px]`}
                    pattern="6[0-9]{8}"
                    title="Doit commencer par 6 et avoir 9 chiffres (ex: 677598632)"
                    maxLength={9}
                    inputMode="numeric"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                {telephoneError && (
                  <p className="text-sm text-red-600 mt-1">{telephoneError}</p>
                )}
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
          {authMethod === 'phone' && !verificationCodeSent && (
            <>
              <div className="mb-4 text-left">
                <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 text-left">
                  Téléphone
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pr-2 border-r border-gray-300">+237</span>
                  <input
                    id="phoneNumber"
                    type="tel"
                    value={phoneNumber}
                    onChange={handlePhoneNumberChange}
                    placeholder="Numéro (ex: 677598632)"
                    className={`mt-1 block w-full rounded-lg border ${phoneError || (recaptchaError && !recaptchaLoading) ? 'border-red-500' : 'border-gray-300'} shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 p-3 text-base transition-colors duration-300 pl-[70px]`}
                    pattern="6[0-9]{8}"
                    title="Doit commencer par 6 et avoir 9 chiffres (ex: 677598632)"
                    maxLength={9}
                    inputMode="numeric"
                    required
                    disabled={isSubmitting}
                  />
                </div>
                {phoneError && (
                  <p className="text-sm text-red-600 mt-1">{phoneError}</p>
                )}
              </div>
              <div className="mb-4 text-left">
                <label htmlFor="password-phone" className="block text-sm font-medium text-gray-700 text-left">
                  Mot de passe
                </label>
                <input
                  id="password-phone"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mot de passe"
                  className="mt-1 block w-full rounded-lg border border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50 p-3 text-base transition-colors duration-300"
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <div ref={recaptchaContainerRef} id="recaptcha-container-react" className="min-h-[78px] flex justify-center items-center mt-4">
                </div>
                {recaptchaLoading && !recaptchaRendered && (
                  <p className="text-sm text-gray-600">Chargement du reCAPTCHA...</p>
                )}
                {recaptchaError && !recaptchaLoading && (
                  <p className="text-sm text-red-600">{recaptchaError}</p>
                )}
              </div>
            </>
          )}
          {!verificationCodeSent && (
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
          {!verificationCodeSent && (
            <button
              type="submit"
              disabled={isSubmitting || (authMethod === 'phone' && (!recaptchaRendered || recaptchaLoading)) || !consent || phoneError || telephoneError}
              className={`w-full px-4 py-3 rounded-lg font-semibold shadow transition-all duration-200 ease-in-out register-submit-button-step ${
                (isSubmitting || (authMethod === 'phone' && (!recaptchaRendered || recaptchaLoading)) || !consent || phoneError || telephoneError)
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-primary text-white hover:bg-primary-dark hover:scale-[1.02] flex items-center justify-center'
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <FaSpinner className="animate-spin mr-2 text-white" /> Chargement...
                </span>
              ) : (authMethod === 'phone' ? 'Envoyer le code SMS' : "S'inscrire")}
            </button>
          )}
          <div className="flex items-center mb-4">
            <input
              type="checkbox"
              id="consent"
              checked={consent}
              onChange={e => setConsent(e.target.checked)}
              required
              className="mr-2"
            />
            <label htmlFor="consent" className="text-sm">
              J'accepte la <a href="/politique-confidentialite" target="_blank" rel="noopener noreferrer" className="text-accent-green underline">politique de confidentialité</a> de Jeta.
            </label>
          </div>
        </form>
        {verificationCodeSent && authMethod === 'phone' && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-gray-700">Un code de vérification a été envoyé au +237 {phoneNumber}.</p>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0,6))}
              placeholder="Code à 6 chiffres"
              className="w-full p-3 rounded-lg border border-gray-300 text-center tracking-wider focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors duration-300"
              maxLength={6}
              inputMode="numeric"
              disabled={isSubmitting}
            />
            <button
              onClick={handleVerifyCode}
              disabled={isSubmitting || code.length !== 6}
              className={`w-full px-4 py-3 rounded-lg font-semibold shadow transition-all duration-200 ease-in-out ${
                (isSubmitting || code.length !== 6) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-primary text-white hover:bg-primary-dark hover:scale-[1.02] flex items-center justify-center'
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <FaSpinner className="animate-spin mr-2 text-white" /> Vérification...
                </span>
              ) : 'Vérifier le code'}
            </button>
            <button
              onClick={() => {
                setVerificationCodeSent(false);
                setCode('');
                setRecaptchaError('');
                clearRecaptcha();
                if (authMethod === 'phone' && recaptchaContainerRef.current) {
                  setTimeout(() => initializeRecaptcha(), 100);
                }
              }}
              className="text-sm text-primary hover:underline mt-2 transition-transform hover:scale-[1.02] inline-block"
              disabled={isSubmitting}
            >
              Renvoyer le code
            </button>
          </div>
        )}
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