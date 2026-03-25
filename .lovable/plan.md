

## Intégration des nouveaux endpoints de rejet et upload

### Contexte
Le backend a remplacé les anciens endpoints par deux nouveaux :
- **POST /api/correction/reject** (JSON) — motif obligatoire
- **POST /api/correction/upload-document** (multipart) — upload avec versionnage, optionnellement lié à un rejet

### Modifications

**Fichier : `src/lib/api.ts`**

1. Mettre à jour `demandeCorrectionApi` :
   - Remplacer `postDecision()` par une nouvelle méthode `reject()` qui appelle `POST /api/correction/reject` avec `{ correctionId, motif, scope, details }`
   - Remplacer `uploadDocument()` par `uploadCorrectionDocument()` qui appelle `POST /api/correction/upload-document` en multipart avec les champs `file`, `correctionId`, `name`, et optionnellement `isRejet=1` + `motif`
   - Conserver `postDecision()` pour le VISA (si l'ancien endpoint VISA reste valide), ou adapter selon le backend

2. Ajouter la validation côté front : si motif est vide, bloquer l'envoi avec un message d'erreur

**Fichier : `src/pages/Demandes.tsx`**

3. Modifier `handleTempReject()` :
   - Appeler la nouvelle méthode `reject()` au lieu de `postDecision(id, "REJET_TEMP", ...)`
   - Passer `correctionId` (string), `motif` (obligatoire), `scope` (type de document concerné)

4. Modifier la logique d'upload de document manquant :
   - Appeler `uploadCorrectionDocument()` avec `isRejet=1` et `motif` quand l'upload est lié à un rejet temporaire
   - Pour les uploads normaux (non liés à un rejet), appeler sans `isRejet`

5. Ajouter une validation visible dans le dialogue de rejet : le bouton "Confirmer" reste désactivé si le motif est vide, avec un message "Le motif est obligatoire"

**Fichiers impactés secondairement** : `src/pages/CorrectionDouaniere.tsx`, `src/pages/DemandesMiseEnPlace.tsx`, `src/pages/Utilisations.tsx` — mêmes adaptations pour les appels `postDecision("REJET_TEMP", ...)` et upload

### Point d'attention
- Confirmer si le VISA utilise toujours l'ancien endpoint `POST /api/demandes-correction/{id}/decisions` ou s'il y a un nouvel endpoint aussi
- Le `correctionId` attendu par les nouveaux endpoints est un **string** (pas un number)

