import React from 'react';

const CustomJoyrideTooltip = ({
  continuous,
  index,
  step,
  backProps,
  closeProps,
  primaryProps,
  skipProps,
  tooltipProps,
  isLastStep,
  size, // Nombre total d'étapes
}) => {
  return (
    <div 
      {...tooltipProps} 
      className="bg-orange-50 p-6 rounded-md shadow-2xl border-3 border-primary text-text-main joyride-tooltip"
      style={{
        ...tooltipProps.style,
        zIndex: 10001, // S'assurer que le tooltip est au-dessus de tout
        position: 'fixed', // Position fixe pour éviter les problèmes de scroll
        minWidth: '400px', // Plus large
        maxWidth: '500px', // Encore plus large
        width: 'auto',
      }}
    >
      {step.title && <h4 className="text-xl font-bold text-primary mb-3">{step.title}</h4>}
      <div className="text-base mb-5 leading-relaxed">{step.content}</div>
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="text-sm text-gray-600 font-medium">
          {/* Traduction du texte de progression */}
          {continuous && (
            <span className="bg-primary/10 px-3 py-2 rounded-full">
              Étape {index + 1} sur {size}
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {index > 0 && (
            <button 
              {...backProps} 
              className="text-base text-primary hover:bg-primary hover:text-white px-4 py-2 rounded border border-primary transition-all duration-200 font-medium"
            >
              ← Précédent
            </button>
          )}
          {continuous && !isLastStep && (
            <button 
              {...primaryProps} 
              className="text-base bg-primary text-white px-5 py-2 rounded hover:bg-primary-dark shadow-md transition-all duration-200 font-medium"
            >
              Suivant →
            </button>
          )}
          {isLastStep && (
             <button 
               {...primaryProps} 
               className="text-base bg-accent-green text-text-main px-5 py-2 rounded hover:bg-opacity-80 shadow-md transition-all duration-200 font-semibold"
             >
              ✓ Terminer
            </button>
          )}
          {!continuous && ( // Si ce n'est pas un tour continu, on pourrait avoir un bouton "Fermer"
            <button {...closeProps} className="text-sm text-gray-500 hover:text-gray-700 hover:underline">
              Fermer
            </button>
          )}
          {step.showSkipButton && !isLastStep && (
             <button 
               {...skipProps} 
               className="text-base text-gray-500 hover:text-gray-700 hover:underline px-3 py-2"
             >
              Passer
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomJoyrideTooltip;