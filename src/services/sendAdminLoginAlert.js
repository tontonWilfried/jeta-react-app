import emailjs from 'emailjs-com';

// Fonction pour récupérer la localisation IP
async function getLocationByIP() {
  try {
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();
    
    if (data.error) {
      return 'Localisation non disponible';
    }
    
    return `${data.city || 'Ville inconnue'}, ${data.region || 'Région inconnue'}, ${data.country_name || 'Pays inconnu'} (IP: ${data.ip || 'Inconnue'})`;
  } catch (error) {
    console.error('Erreur géolocalisation IP:', error);
    return 'Localisation non disponible';
  }
}

export async function sendAdminLoginAlert({ email, device, date }) {
  // Récupérer automatiquement la localisation IP
  const location = await getLocationByIP();
  
  return emailjs.send(
    'service_8826dku',    // Remplace par ton vrai service ID EmailJS
    'template_zz9i9gc',   // Remplace par ton vrai template ID EmailJS
    {
      to_email: email,
      device: device,
      date: date,
      location: location,
    },
    'XuragNzi6cI4-NqRF'     // Remplace par ta clé publique EmailJS
  );
}