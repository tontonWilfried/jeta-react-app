// src/firebaseConfig.ts (Exemple)
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// import { getAnalytics } from "firebase/analytics"; // Si vous l'utilisez

// Votre configuration Firebase copiée depuis votre projet Angular
const firebaseConfig = {
    apiKey: "AIzaSyAk-QBgctpjqAJ_ZuNuGQlCIjLvZdbszuY",
    authDomain: "jeta-9c4dc.firebaseapp.com",
    projectId: "jeta-9c4dc",
    storageBucket: "jeta-9c4dc.firebasestorage.app",
    messagingSenderId: "403028000027",
    appId: "1:403028000027:web:2a733e83d2693ca76767be",
    recaptcha: { // Ajoutez cette section
        siteKey: '6LfGX1orAAAAAJ-1LB9KIkDVa0hPo1NwP2ZvAueK' // Votre clé de site reCAPTCHA v2 de production
      }// Optionnel, pour Analytics
};

// Initialiser Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);
// const analytics = getAnalytics(app); // Si vous l'utilisez

export { app, auth, firestore /*, analytics */ };
