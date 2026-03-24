

## Intégration du REJET_TEMP avec documentsDemandes et verrouillage des uploads

### Résumé
Le backend supporte maintenant le rejet temporaire avec une liste de documents demandés (`documentsDemandes`), et le verrouillage des uploads (remplacement interdit sauf si le type est dans la liste des documents demandés). Le frontend doit être mis à jour pour :
1. Permettre de sélectionner les documents à demander lors d'un REJET_TEMP
2. Afficher les documents demandés dans les décisions
3. Gérer le verrouillage côté UI (indiquer quels documents peuvent être remplacés)

### Modifications

#### 1. Mettre à jour `DecisionCorrectionDto` et `postDecision` (`src/lib/api.ts`)
- Ajouter `documentsDemandes?: string[]` à `DecisionCorrectionDto`
- Modifier `postDecision` pour accepter et envoyer `documentsDemandes` quand `decision === "REJET_TEMP"`

#### 2. Enrichir le Dialog de rejet temporaire (`src/pages/CorrectionDouaniere.tsx`)
- Ajouter une liste de checkboxes avec les types de documents (basée sur `DOCUMENT_TYPES_REQUIS` + types supplémentaires comme `PV_OUVERTURE`, `DAO_DQE`, etc.)
- Les checkboxes sont obligatoires quand c'est un REJET_TEMP (au moins 1 document doit être coché)
- Envoyer `documentsDemandes` dans l'appel `postDecision`
- Le bouton "Confirmer" est désactivé si aucun document n'est sélectionné

#### 3. Enrichir le Dialog de rejet temporaire (`src/pages/Demandes.tsx`)
- Même logique : si `rejectDecisionFinale === false`, afficher les checkboxes de documents demandés
- Envoyer `documentsDemandes` dans l'appel

#### 4. Afficher les documents demandés dans les décisions
- Dans les deux pages (Demandes.tsx et CorrectionDouaniere.tsx), là où les décisions sont affichées, montrer les `documentsDemandes` sous forme de badges quand `decision === "REJET_TEMP"`

#### 5. Indicateur visuel de verrouillage des uploads
- Dans la section d'upload de documents (côté AC), quand le statut est `INCOMPLETE` :
  - Afficher un badge/icône sur les documents qui sont dans `documentsDemandes` (modifiables)
  - Griser ou désactiver le bouton d'upload pour les documents qui ne sont PAS dans `documentsDemandes` et qui existent déjà
  - Le backend rejette de toute façon, mais l'UI doit guider l'utilisateur

### Fichiers à modifier
- `src/lib/api.ts` — `DecisionCorrectionDto` + `postDecision`
- `src/pages/CorrectionDouaniere.tsx` — Dialog rejet + affichage décisions
- `src/pages/Demandes.tsx` — Dialog rejet + affichage décisions + verrouillage uploads

### Details techniques
- Utilisation de `Checkbox` de shadcn/ui pour la sélection des documents
- La liste complète des types de documents doit inclure les 7 pièces du P1 : `LETTRE_SAISINE`, `PV_OUVERTURE`, `ATTESTATION_FISCALE`, `OFFRE_FINANCIERE`, `TABLEAU_MODELE`, `DAO_DQE`, `LISTE_ITEMS_EXCEL`

