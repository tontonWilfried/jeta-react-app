// Type pour les fonctions d'écoute
type SyncListener = () => void;

const listeners: Set<SyncListener> = new Set();

/**
 * Permet de s'abonner aux demandes de synchronisation.
 * @param listener La fonction à appeler lorsqu'une synchronisation est demandée.
 * @returns Une fonction pour se désabonner.
 */
export const subscribeToSyncRequests = (listener: SyncListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Déclenche une demande de synchronisation à tous les auditeurs abonnés.
 */
export const requestSync = (): void => {
  console.log('Sync requested via syncTriggerService');
  listeners.forEach(listener => listener());
};