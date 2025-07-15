// Script Node.js pour initialiser la collection clientSellerChats dans Firestore
// Placez votre fichier serviceAccountKey.json à la racine du projet

const admin = require('firebase-admin');
const path = require('path');

// Chemin vers le fichier de credentials
const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));

// Initialiser Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// UIDs fictifs pour test
const clientUid = 'testClientUid123';
const sellerUid = 'testSellerUid456';
const chatId = `${clientUid}_${sellerUid}`;

async function initClientSellerChats() {
  try {
    // Créer le document de chat (vide ou avec un champ info)
    await db.collection('clientSellerChats').doc(chatId).set({
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      info: 'Chat de test créé par script',
    }, { merge: true });

    // Ajouter un message de test
    await db.collection('clientSellerChats').doc(chatId)
      .collection('messages').add({
        text: 'Ceci est un message de test',
        senderUid: sellerUid,
        senderType: 'seller',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
      });

    console.log('✅ Collection clientSellerChats et message de test créés avec succès !');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur lors de la création :', err);
    process.exit(1);
  }
}

initClientSellerChats(); 