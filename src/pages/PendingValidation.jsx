import React from 'react';

export default function PendingValidation() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-page-bg">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4 text-primary">Votre demande est en cours de validation</h1>
        <p className="mb-4">Merci d'avoir soumis votre demande pour devenir vendeur sur JETA.<br />
        Notre équipe va examiner vos informations et vous recevrez un email dès que votre compte sera validé.</p>
        <p className="text-accent-green font-semibold">⏳ Veuillez patienter, nous vous contacterons très bientôt !</p>
      </div>
    </div>
  );
} 