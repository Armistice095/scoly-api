import type { Notification } from '@prisma/client';

/** Objet `Notification` de l'API. Jamais `etablissementId` ni `utilisateurId`. */
export function versNotification(n: Notification) {
  return {
    id: n.id,
    type: n.type,
    categorie: n.categorie,
    titre: n.titre,
    message: n.message,
    lue: n.lueLe !== null,
    lueLe: n.lueLe ? n.lueLe.toISOString() : null,
    documentId: n.documentId,
    membreId: n.membreId,
    createdAt: n.createdAt.toISOString(),
  };
}
