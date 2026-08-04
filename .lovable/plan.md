# Signatures stockées côté backend (au lieu d'un PNG figé dans le front)

Oui, c'est possible et c'est la bonne approche. Aujourd'hui la signature du Président est un fichier statique (`src/assets/signature-president.png`) importé directement dans les deux générateurs PDF (certificat de crédit et lettre d'adoption). Conséquence : une seule signature possible, changement = redéploiement du front, aucune traçabilité.

## Ce qui serait fait côté front (après livraison du backend)

1. Nouveau module `src/lib/signatures.ts` : récupération de la signature active d'un rôle/utilisateur, conversion en dataURL base64 (jsPDF a besoin d'une image encodée, pas d'une URL protégée), avec cache mémoire.
2. `certificatSignaturePdf.ts` et `adoptionLetterPdf.ts` : la signature devient un paramètre du contexte ; repli sur l'asset local si l'API ne répond pas (503 MinIO, signature absente), pour ne jamais bloquer la génération.
3. Section « Ma signature » dans `MonProfil.tsx` : chaque acteur (PRESIDENT, DGD, DGI, DGTCP, DGB) voit sa signature actuelle, peut en uploader une nouvelle ou la remplacer.
4. Dans `Utilisateurs.tsx` (ADMIN_SI) : action « Signature » sur chaque ligne utilisateur — aperçu, upload, remplacement, désactivation de la signature de n'importe quel acteur. L'administrateur gère donc les signatures de tous les rôles depuis son front.
5. Extension au besoin aux documents d'utilisation de crédit.


## Prompt à transmettre à l'équipe backend

> Nous avons besoin de gérer les images de signature (PNG à fond transparent) côté serveur, afin que les documents générés (certificat de crédit d'impôts, lettre d'adoption, et à terme documents d'utilisation) portent la signature réelle du signataire courant, sans redéploiement du front.
>
> **Modèle `signature`**
> - `id`
> - `utilisateur_id` (FK users, nullable)
> - `role` (enum rôle applicatif : PRESIDENT, DGD, DGI, DGTCP, DGB, ADMIN_SI…) — permet une signature « institutionnelle » par fonction quand `utilisateur_id` est nul
> - `nom_affiche` (libellé imprimé sous la signature, ex. « Le Président de la Commission Fiscale »)
> - `objet_minio` / `chemin_stockage`, `content_type` (image/png uniquement), `taille`, `largeur_px`, `hauteur_px`, `checksum_sha256`
> - `active` (booléen), `version` (int incrémental), `date_creation`, `cree_par`, `date_desactivation`
> - Contrainte : au plus **une** signature active par couple (role, utilisateur_id).
>
> **Endpoints REST** (mêmes conventions d'erreur que l'existant : erreur structurée à code stable, 503 si MinIO indisponible)
> - `GET /api/signatures` — liste (filtres `role`, `utilisateurId`, `activeOnly`). ADMIN_SI, ou l'utilisateur pour ses propres signatures.
> - `GET /api/signatures/active?role=PRESIDENT[&utilisateurId=]` — DTO de la signature active (404 si aucune).
> - `GET /api/signatures/{id}/content` — flux binaire PNG (`Content-Type: image/png`, `Cache-Control: private`), authentifié par le JWT habituel.
> - `GET /api/signatures/{id}/base64` — `{ "dataUrl": "data:image/png;base64,..." }`. **Important** : le front génère les PDF dans le navigateur avec jsPDF, qui ne sait pas suivre une URL protégée ; ce endpoint évite un fetch binaire + conversion manuelle et tout souci CORS.
> - `POST /api/signatures` — multipart : `file` (PNG obligatoire), `role`, `utilisateurId` (optionnel), `nomAffiche`, `activer` (booléen). Fail-fast : aucun effet en base si l'upload objet échoue (rollback), cohérent avec la règle MinIO fail-fast déjà en place.
> - `PUT /api/signatures/{id}` — mise à jour des métadonnées (`nomAffiche`, `active`).
> - `POST /api/signatures/{id}/remplacer` — multipart `file` : crée une nouvelle version et désactive l'ancienne (historique conservé, pas de suppression physique) — même pattern que les documents GED.
> - `DELETE /api/signatures/{id}` — désactivation logique uniquement.
>
> **Validation**
> - PNG uniquement, taille max 1 Mo, dimensions max 2000x1000 px, contrôle du magic number (ne pas se fier au `Content-Type` client).
> - Refuser tout fichier non-image ; stocker le checksum.
>
> **Sécurité / audit**
> - Écriture (POST/PUT/DELETE/remplacer) : ADMIN_SI, ou l'utilisateur pour sa propre signature.
> - Lecture du contenu : tout utilisateur authentifié autorisé à générer le document concerné.
> - Journaliser chaque création/remplacement/désactivation dans l'audit, avec `motif` quand l'action passe par le canal de correction administrateur.
>
> **DTO attendu**
> ```json
> {
>   "id": 12,
>   "role": "PRESIDENT",
>   "utilisateurId": 4,
>   "nomAffiche": "Le Président de la Commission Fiscale",
>   "active": true,
>   "version": 3,
>   "contentType": "image/png",
>   "largeurPx": 900,
>   "hauteurPx": 400,
>   "dateCreation": "2026-08-04T00:00:00Z",
>   "creePar": "admin.si"
> }
> ```

## Détails techniques front

- Le repli sur `src/assets/signature-president.png` reste en place tant que le backend n'est pas déployé : aucune régression sur les PDF existants.
- Le ratio largeur/hauteur renvoyé par l'API sert à dimensionner l'image sans déformation (aujourd'hui 48x22 mm et 46x22 mm en dur).
- Cache par `id` + `version` pour éviter un appel réseau à chaque génération.
