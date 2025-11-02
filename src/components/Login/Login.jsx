// Login.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify'; // Importez toast
import { auth } from '../../firebaseConfig'; // Ajustez le chemin
import {
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  sendPasswordResetEmail
} from 'firebase/auth';
import 'react-toastify/dist/ReactToastify.css'; // Importez les styles de react-toastify
import { FaSpinner } from 'react-icons/fa';

const RECAPTCHA_SITE_KEY = '6LfGX1orAAAAAJ-1LB9KIkDVa0hPo1NwP2ZvAueK'; // Même clé que pour l'inscription

const Login = () => {
  const navigate = useNavigate();
  const [authMethod, setAuthMethod] = useState('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [verificationCodeSent, setVerificationCodeSent] = useState(false);
  const [confirmationResultState, setConfirmationResultState] = useState(null);

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
      } catch (e) { /* ignore */ }
      recaptchaVerifierRef.current = null;
    }
    if (recaptchaContainerRef.current) {
        recaptchaContainerRef.current.innerHTML = '';
    }
    setRecaptchaRendered(false);
    setRecaptchaLoading(false);
  }, []);

  const initializeRecaptcha = useCallback(() => {
    if (!recaptchaContainerRef.current) return;
    if (recaptchaVerifierRef.current) clearRecaptcha();
    
    setRecaptchaLoading(true);
    recaptchaContainerRef.current.innerHTML = '';

    try {
      const verifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
        'size': 'normal',
        'callback': () => { setRecaptchaRendered(true); setRecaptchaLoading(false); setRecaptchaError(''); },
        'expired-callback': () => { clearRecaptcha(); setTimeout(() => initializeRecaptcha(), 100); },
        'error-callback': (error) => { toast.error(`Erreur reCAPTCHA: ${error.message}`); clearRecaptcha(); }
      });
      verifier.render().then(widgetId => {
        recaptchaVerifierRef.current = verifier;
      }).catch(err => {
        toast.error('Erreur rendu reCAPTCHA.');
        clearRecaptcha();
      });
    } catch (initError) {
      toast.error(`Init reCAPTCHA: ${initError.message}`);
      setRecaptchaLoading(false);
    }
  }, [auth, clearRecaptcha]);

  useEffect(() => {
    if (authMethod === 'phone') {
      if (recaptchaContainerRef.current && !recaptchaVerifierRef.current && !recaptchaLoading) {
        initializeRecaptcha();
      }
    } else {
      clearRecaptcha();
    }
  }, [authMethod, initializeRecaptcha, clearRecaptcha, recaptchaLoading]);

  useEffect(() => () => clearRecaptcha(), [clearRecaptcha]);


  const handleAuthMethodChange = (method) => {
    setAuthMethod(method);
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);

    if (authMethod === 'email') {
      try {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success('Connexion réussie !');
        navigate('/dashboard');
      } catch (error) {
        console.error("[LoginComponent] Error during email login:", error);
        let errorMessage = "Une erreur est survenue lors de la connexion.";
        switch (error.code) {
          case 'auth/user-not-found':
            errorMessage = "Aucun utilisateur trouvé avec cette adresse email.";
            break;
          case 'auth/wrong-password':
            errorMessage = "Mot de passe incorrect.";
            break;
          case 'auth/invalid-email':
            errorMessage = "L'adresse email fournie n'est pas valide.";
            break;
          case 'auth/user-disabled':
            errorMessage = "Votre compte a été désactivé. Veuillez contacter le support.";
            break;
          default:
            errorMessage = error.message || "Erreur de connexion par email.";
            break;
        }
        toast.error(errorMessage);
      }
    } else if (authMethod === 'phone') {
      if (!verificationCodeSent) {
        if (!recaptchaRendered || !recaptchaVerifierRef.current) {
          toast.error('Veuillez compléter le reCAPTCHA.');
          setIsSubmitting(false);
          return;
        }
        try {
          const fullPhoneNumber = `+237${phoneNumber}`;
          const confirmation = await signInWithPhoneNumber(auth, fullPhoneNumber, recaptchaVerifierRef.current);
          setConfirmationResultState(confirmation);
          setVerificationCodeSent(true);
          toast.success('SMS envoyé. Entrez le code.');
        } catch (error) {
          toast.error(error.message || "Erreur envoi SMS.");
          clearRecaptcha();
          setTimeout(() => initializeRecaptcha(), 100);
        }
      } else {
        if (!confirmationResultState || !code) {
            toast.error('Veuillez entrer le code de vérification.');
            setIsSubmitting(false);
            return;
        }
        try {
            await confirmationResultState.confirm(code);
            toast.success('Connexion par téléphone réussie !');
            navigate('/dashboard');
        } catch (error) {
            toast.error(error.message || "Erreur vérification code.");
        }
      }
    }
    setIsSubmitting(false);
  };

  const handlePasswordReset = async () => {
    console.log('[LoginComponent] handlePasswordReset triggered.');

    if (!email) {
      toast.error("Veuillez entrer votre adresse email pour réinitialiser le mot de passe.");
      return;
    }
    console.log(`[LoginComponent] Attempting password reset for email: ${email}`);
    setIsSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email);
      console.log('[LoginComponent] sendPasswordResetEmail call successful (Firebase accepted the request).');
      toast.success("Email de réinitialisation envoyé ! Veuillez vérifier votre boîte de réception (et vos spams).");
    } catch (error) {
      console.error("[LoginComponent] Error sending password reset email:", error);
      if (error.code === 'auth/user-not-found') {
        toast.error("Aucun utilisateur trouvé avec cette adresse email.");
      } else if (error.code === 'auth/invalid-email') {
        toast.error("L'adresse email fournie n'est pas valide.");
      }
      else {
        toast.error(error.message || "Erreur lors de l'envoi de l'email de réinitialisation.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-page-bg p-4">
      <div className="bg-orange-50 p-6 sm:p-8 rounded-2xl shadow-xl w-full max-w-md text-center border border-orange-200/75">
        <div className="mb-6">
          <svg width="80" height="96" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" className="mx-auto">
            <text x="50" y="80" fontFamily="Poppins, sans-serif" fontSize="60" fontWeight="bold" fill="#4FC3F7" textAnchor="middle">J</text>
            <path d="M40 90 Q50 100 60 90" stroke="#4FC3F7" strokeWidth="2" fill="none" />
          </svg>
        </div>
        <h2 className="text-2xl sm:text-3xl text-primary font-bold mb-6 login-title-step">Connexion</h2>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="flex justify-center space-x-4 sm:space-x-6 mb-6 login-auth-method-step">
            <label className="inline-flex items-center cursor-pointer">
              <input type="radio" name="authMethod" value="email" checked={authMethod === 'email'} onChange={() => handleAuthMethodChange('email')} className="sr-only peer"/>
              <span className="w-4 h-4 border border-gray-300 rounded-full flex items-center justify-center mr-2 peer-checked:border-primary"><span className={`w-2 h-2 bg-primary rounded-full ${authMethod !== 'email' ? 'opacity-0' : 'opacity-100'}`}></span></span>
              <span className="text-gray-700 peer-checked:text-primary">Email</span>
            </label>
            {/*
            <label className="inline-flex items-center cursor-pointer">
              <input type="radio" name="authMethod" value="phone" checked={authMethod === 'phone'} onChange={() => handleAuthMethodChange('phone')} className="sr-only peer"/>
              <span className="w-4 h-4 border border-gray-300 rounded-full flex items-center justify-center mr-2 peer-checked:border-primary"><span className={`w-2 h-2 bg-primary rounded-full ${authMethod !== 'phone' ? 'opacity-0' : 'opacity-100'}`}></span></span>
              <span className="text-gray-700 peer-checked:text-primary">Téléphone</span>
            </label>
            */}
          </div>

          {authMethod === 'email' && (
            <>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Adresse Email" className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors duration-300 login-email-input-step" required disabled={isSubmitting} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors duration-300 login-password-input-step" required disabled={isSubmitting} />
            </>
          )}

          {authMethod === 'phone' && !verificationCodeSent && (
            <>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pr-2 border-r border-gray-300">+237</span>
                <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0,9))} placeholder="Numéro (ex: 690536261)" className={`w-full p-3 pl-[70px] rounded-lg border ${recaptchaError ? 'border-red-500' : 'border-gray-300'} focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors duration-300`} required disabled={isSubmitting} />
              </div>
              <div className="space-y-2">
                <div ref={recaptchaContainerRef} id="recaptcha-container-login" className="min-h-[78px] flex justify-center items-center mt-4"></div>
                {recaptchaLoading && <p className="text-sm text-gray-600">Chargement du reCAPTCHA...</p>} {/* Garder ce message pour le reCAPTCHA */}
              </div>
            </>
          )}
          
          {!verificationCodeSent && (
            <button type="submit" disabled={isSubmitting || (authMethod === 'phone' && (!recaptchaRendered || recaptchaLoading))}
              className={`w-full px-4 py-3 rounded-lg font-semibold transition-all duration-200 ease-in-out ${
                (isSubmitting || (authMethod === 'phone' && (!recaptchaRendered || recaptchaLoading)))
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-primary text-white hover:bg-primary-dark hover:scale-[1.02] login-submit-button-step flex items-center justify-center' // Ajout de flex pour centrer le spinner
              }`}>
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <FaSpinner className="animate-spin mr-2 text-white" /> Chargement... {/* Couleur du spinner en blanc */}
                </span>
              ) : (authMethod === 'phone' ? 'Envoyer le code SMS' : 'Se connecter')}
            </button>
          )}
        </form>

        {verificationCodeSent && authMethod === 'phone' && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-gray-700">Un code de vérification a été envoyé au +237 {phoneNumber}.</p>
            <input type="text" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0,6))} placeholder="Code à 6 chiffres" className="w-full p-3 rounded-lg border border-gray-300 text-center tracking-wider focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors duration-300" maxLength={6} inputMode="numeric" disabled={isSubmitting}/>
            <button onClick={handleLogin} disabled={isSubmitting || code.length !== 6} className={`w-full px-4 py-3 rounded-lg font-semibold transition-all duration-200 ease-in-out ${(isSubmitting || code.length !== 6) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-primary text-white hover:bg-primary-dark hover:scale-[1.02]'}`}>
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <FaSpinner className="animate-spin mr-2 text-white" /> Vérification... {/* Couleur du spinner en blanc */}
                </span>
              ) : 'Vérifier et Se connecter'}
            </button>
             <button onClick={() => { setVerificationCodeSent(false); setCode(''); clearRecaptcha(); if (authMethod === 'phone') setTimeout(() => initializeRecaptcha(), 100);}} className="text-sm text-primary hover:underline mt-2" disabled={isSubmitting}>Renvoyer le code</button>
          </div>
        )}

        {authMethod === 'email' && (
          <button
            type="button"
            onClick={handlePasswordReset}
            className="text-sm text-primary hover:underline mt-4 disabled:opacity-50"
            disabled={isSubmitting}
          >
            Mot de passe oublié ?
          </button>
        )}

        <p className="mt-8 text-sm text-gray-600">
          Pas encore de compte ?{' '}
          <Link to="/register" className="font-medium text-primary hover:underline login-register-link-step">
            S'inscrire
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
