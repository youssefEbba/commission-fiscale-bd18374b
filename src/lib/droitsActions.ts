/**
 * Boutons d'action : ils s'affichent selon le droit que le serveur exige pour l'action, jamais selon
 * le rôle seul. Un rôle qui n'a pas ce droit (l'administrateur, notamment, qui n'a que des droits de
 * correction « à la place de ») ne doit pas voir un bouton qui aboutirait à un refus.
 * Chaque liste reprend le @PreAuthorize de la route appelée.
 */
type A = (p: string) => boolean;
const unDe = (...droits: string[]) => (a: A) => droits.some((d) => a(d));

export const DROITS = {
  /** POST/PUT/DELETE /demandes-correction, /soumettre. */
  deposerCorrection: unDe("correction.submit"),
  /** Réponse à un rejet temporaire, nouvelle version d'une pièce d'une demande de correction. */
  completerCorrection: unDe("correction.offer.upload", "correction.complement.add"),
  /** POST/PUT/DELETE /certificats-credit (mise en place), /soumettre. */
  deposerMiseEnPlace: unDe("mise_en_place.submit"),
  /** POST /certificats-credit/{id}/documents. */
  deposerPieceCredit: unDe("mise_en_place.document.upload", "mise_en_place.dgd.queue.view",
    "mise_en_place.president.signature.upload", "mise_en_place.president.document.generate"),
  /** POST /utilisations-credit/{id}/documents. */
  deposerPieceUtilisation: unDe("utilisation.douane.document.upload", "utilisation.interieur.document.upload"),
  /** POST /utilisations-credit/decisions/{id}/rejet-temp/reponses. */
  repondreRejetUtilisation: unDe("utilisation.douane.document.upload", "utilisation.interieur.document.upload",
    "utilisation.entreprise.rejet.repondre"),
} as const;
