// Script pour créer le document de chat manquant
// Exécutez ce script dans la console du navigateur sur la page de votre app

const { firestore } = require('./src/firebaseConfig');
const { doc, setDoc, serverTimestamp } = require('firebase/firestore');

async function fixMissingChat() {
  try {
    // Créer le document de chat manquant
    const chatId = 'HUtwGQQq9he4O6wQqfBW5xK0Tus1_JtsqPuTIpYMRXvivOfhjk2gnTJD2';
    const chatDocRef = doc(firestore, 'clientSellerChats', chatId);
    
    await setDoc(chatDocRef, {
      createdAt: serverTimestamp(),
      lastMessage: 'eoo',
      lastMessageTime: serverTimestamp(),
      clientUid: 'HUtwGQQq9he4O6wQqfBW5xK0Tus1',
      sellerUid: 'JtsqPuTIpYMRXvivOfhjk2gnTJD2',
    }, { merge: true });
    
    console.log('✅ Document de chat créé avec succès !');
    console.log('Chat ID:', chatId);
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

// Exécuter le script
fixMissingChat(); 