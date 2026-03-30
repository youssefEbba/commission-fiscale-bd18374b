

# Restreindre les types de document dans la réponse au rejet

## Problème
Quand l'entreprise clique "Upload doc" sur un rejet temporaire, le dialogue actuel affiche un simple `<input type="file">` sans sélecteur de type de document. Les types de documents demandés dans le rejet (`documentsDemandes`) ne sont pas utilisés pour filtrer ou guider l'upload.

## Solution
Modifier le dialogue "Répondre au rejet temporaire" (lignes 696-718) pour :

1. **Stocker la décision complète** au lieu de juste l'ID — passer de `respondDecisionId: number` à `respondDecision: DecisionCorrectionDto | null`
2. **Ajouter un sélecteur de type de document** restreint aux types listés dans `decision.documentsDemandes`
3. **Différencier les deux boutons** : "Répondre" ouvre le dialogue en mode texte seul, "Upload doc" ouvre le dialogue avec le sélecteur de document pré-affiché

## Fichier modifié
**`src/pages/UtilisationDetail.tsx`** :
- Remplacer `respondDecisionId` par `respondDecision` (objet complet)
- Dans le dialogue, si `respondDecision.documentsDemandes` existe et n'est pas vide, afficher un `<Select>` filtré sur ces types uniquement (au lieu du champ fichier libre)
- Le label "Joindre un document" devient "Document demandé" avec le type pré-sélectionné si un seul type est demandé
- Adapter `handleRespondRejet` pour envoyer le type de document sélectionné

