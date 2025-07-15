import { openDB, type IDBPDatabase, type DBSchema } from 'idb';

// Définir le schéma de votre base de données
interface JetaDBSchema extends DBSchema {
  purchases: {
    key: number; // Type de la clé primaire
    value: Purchase; // Type de l'objet stocké
    // Vous pouvez ajouter des index ici si nécessaire
    // indexes: { 'firestoreId': string };
  };
  // Vous pourriez ajouter d'autres stores ici, par exemple 'cache'
  // cache: {
  //   key: string;
  //   value: any;
  // };
}

// Interface pour un achat
export interface Purchase {
  id?: number; // Auto-incrémenté par IndexedDB, donc optionnel à la création
  item: string;
  price: number;
  firestoreId?: string; // ID du document Firestore
}

const DB_NAME = 'JetaDatabase';
const DB_VERSION = 1;
const PURCHASE_STORE_NAME = 'purchases';

let dbPromise: Promise<IDBPDatabase<JetaDBSchema>> | null = null;

const getDb = (): Promise<IDBPDatabase<JetaDBSchema>> => {
  if (!dbPromise) {
    dbPromise = openDB<JetaDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion) {
        console.log(`Upgrading IndexedDB from version ${oldVersion} to ${newVersion}`);
        if (!db.objectStoreNames.contains(PURCHASE_STORE_NAME)) {
          db.createObjectStore(PURCHASE_STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true,
          });
          console.log(`Object store "${PURCHASE_STORE_NAME}" created.`);
        }
        // Exemple pour ajouter un index si vous en avez besoin plus tard
        // const purchaseStore = transaction.objectStore(PURCHASE_STORE_NAME);
        // if (!purchaseStore.indexNames.contains('firestoreId')) {
        //   purchaseStore.createIndex('firestoreId', 'firestoreId');
        // }
      },
    });
  }
  return dbPromise;
};

export const initializeDatabase = async (): Promise<void> => {
  try {
    await getDb();
    console.log('IndexedDB initialized successfully by service');
  } catch (error) {
    console.error('Database initialization error by service:', error);
    dbPromise = null; // Permet une nouvelle tentative d'initialisation
    throw error;
  }
};

export const addPurchase = async (data: { item: string; price: number }): Promise<number> => {
  const db = await getDb();
  const id = await db.add(PURCHASE_STORE_NAME, data as Omit<Purchase, 'id'>); // id est auto-généré
  console.log(`Achat ajouté via service : ${data.item}, ${data.price}, ID: ${id}`);
  return id;
};

export const getAllPurchases = async (): Promise<Purchase[]> => {
  const db = await getDb();
  return db.getAll(PURCHASE_STORE_NAME);
};

export const updatePurchaseFirestoreId = async (id: number, firestoreId: string): Promise<void> => {
  const db = await getDb();
  const purchase = await db.get(PURCHASE_STORE_NAME, id);
  if (purchase) {
    const updatedPurchase = { ...purchase, firestoreId };
    await db.put(PURCHASE_STORE_NAME, updatedPurchase);
    console.log(`IndexedDB: Purchase ${id} updated with Firestore ID: ${firestoreId}`);
  } else {
    console.warn(`IndexedDB: Purchase with id ${id} not found for local update.`);
  }
};