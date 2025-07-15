// Script pour créer des messages de test avec les vrais UIDs des utilisateurs
const admin = require('firebase-admin');
const path = require('path');

// Initialiser Firebase Admin
if (!admin.apps.length) {
  try {
    const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('❌ Erreur: Impossible de charger serviceAccountKey.json');
    process.exit(1);
  }
}

const db = admin.firestore();

async function createTestMessages() {
  try {
    console.log('🔄 Récupération des utilisateurs existants...');
    
    // Récupérer tous les utilisateurs
    const usersSnap = await db.collection('users').get();
    const users = [];
    usersSnap.forEach(doc => {
      users.push({ id: doc.id, ...doc.data() });
    });
    
    console.log(`📊 ${users.length} utilisateurs trouvés`);
    
    if (users.length < 2) {
      console.log('❌ Il faut au moins 2 utilisateurs pour créer des messages de test');
      return;
    }
    
    // Prendre les 2 premiers utilisateurs
    const user1 = users[0];
    const user2 = users[1];
    
    console.log(`👤 Utilisateur 1: ${user1.displayName || user1.email} (${user1.id})`);
    console.log(`👤 Utilisateur 2: ${user2.displayName || user2.email} (${user2.id})`);
    
    // Créer un chat entre ces deux utilisateurs
    const chatId = `${user1.id}_${user2.id}`;
    
    console.log(`💬 Création du chat: ${chatId}`);
    
    // Créer le document de chat
    await db.collection('clientSellerChats').doc(chatId).set({
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      info: 'Chat de test créé automatiquement',
    }, { merge: true });
    
    // Ajouter plusieurs messages de test
    const messages = [
      {
        text: 'Bonjour ! Comment allez-vous ?',
        senderUid: user1.id,
        senderType: 'client',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
      },
      {
        text: 'Très bien merci ! Et vous ?',
        senderUid: user2.id,
        senderType: 'seller',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
      },
      {
        text: 'Parfait ! Avez-vous des questions sur nos produits ?',
        senderUid: user1.id,
        senderType: 'client',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
      },
      {
        text: 'Oui, je voudrais savoir si vous avez des promotions en cours.',
        senderUid: user2.id,
        senderType: 'seller',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
      }
    ];
    
    // Ajouter les messages
    for (const message of messages) {
      await db.collection('clientSellerChats').doc(chatId)
        .collection('messages').add(message);
    }
    
    console.log('✅ Messages de test créés avec succès !');
    console.log(`📝 Chat ID: ${chatId}`);
    console.log(`💬 ${messages.length} messages ajoutés`);
    console.log('🔍 Vérifiez dans la console Firebase > Firestore > clientSellerChats');
    
    // Créer aussi un chat dans l'autre sens (user2_user1)
    const chatId2 = `${user2.id}_${user1.id}`;
    console.log(`💬 Création du chat inverse: ${chatId2}`);
    
    await db.collection('clientSellerChats').doc(chatId2).set({
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      info: 'Chat de test inverse créé automatiquement',
    }, { merge: true });
    
    const message2 = {
      text: 'Salut ! Je suis intéressé par vos services.',
      senderUid: user2.id,
      senderType: 'client',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      read: false,
    };
    
    await db.collection('clientSellerChats').doc(chatId2)
      .collection('messages').add(message2);
    
    console.log('✅ Chat inverse créé avec succès !');
    console.log(`📝 Chat ID 2: ${chatId2}`);
    
  } catch (err) {
    console.error('❌ Erreur lors de la création des messages :', err);
  }
}

createTestMessages(); 