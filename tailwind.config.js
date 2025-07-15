// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ... vos couleurs personnalisées ...
        primary: {
          DEFAULT: '#4FC3F7', // Un bleu ciel
          dark: '#29B6F6',
          light: '#81D4FA',
        },
        secondary: {
          DEFAULT: '#FFB74D', // Un orange doux
          dark: '#FFA726',
          light: '#FFCC80',
        },
        accent: {
          green: '#8BC34A', // Un vert accent
          red: '#E57373',   // Un rouge accent
        },
        'page-bg': '#F5F5F5', // Gris très clair pour le fond des pages
        'subtle-border': '#E0E0E0', // Gris clair pour les bordures et séparateurs
        'text-main': '#424242', // Gris foncé pour le texte principal
        'text-secondary': '#757575', // Gris moyen pour le texte secondaire
      },
      fontFamily: {
        // Ajoutez votre police ici. 'sans' est la pile de polices par défaut de Tailwind.
        // En la plaçant en premier, elle sera utilisée par défaut.
        sans: ['Poppins', 'sans-serif'],
        // Vous pouvez aussi ajouter d'autres polices si besoin
        // serif: ['Georgia', 'serif'],
        // mono: ['Menlo', 'monospace'],
      },
      keyframes: {
        // ... vos keyframes existants ...
         fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
         letterBounce: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' }, // Ajustez la hauteur du rebond si nécessaire
        },
         typewriter: {
          to: { left: '100%' },
        },
         blink: {
          '0%, 100%': { borderColor: 'transparent' },
          '50%': { borderColor: 'orange' }, // Ajustez la couleur du curseur si nécessaire
        },
      },
      animation: {
        // ... vos animations existantes ...
        fadeInUp: 'fadeInUp 0.5s ease-out forwards', // Animation pour les éléments qui apparaissent
        letterBounce: 'letterBounce 0.5s ease-in-out', // Animation pour les lettres du logo
        typewriter: 'typewriter 4s steps(44) 1s forwards', // Ajustez la durée et les étapes
        blink: 'blink .75s step-end infinite', // Ajustez la durée et le timing
      },
    },
  },
  plugins: [
     require('@tailwindcss/line-clamp'), // Assurez-vous que ce plugin est toujours là si vous utilisez line-clamp
     // ... autres plugins ...
  ],
}
