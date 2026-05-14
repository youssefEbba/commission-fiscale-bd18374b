## Objectif
Alléger l'affichage des listes **Conventions** et **Attributions / Marchés** en ne gardant que les champs clés, et rediriger vers une page de détail complète via un bouton **Voir**.

## Problème actuel
- Les tables affichent 8-9 colonnes (ID, référence, intitulé, date, montant, statut, type, représentant, actions). C'est dense et peu lisible sur mobile/tablette.
- Aucune page de détail dédiée n'existe pour ces deux entités ; les informations complètes sont montrées dans des dialogs modales (détail, documents, édit, etc.) ce qui limite la lisibilité.

## Solution proposée

### 1. Alléger les listes
**Conventions** — colonnes conservées :
- Référence
- Intitulé (tronqué)
- Bailleur
- Montant (MRU)
- Statut
- Actions (Voir + menu actions)

**Attributions / Marchés** — colonnes conservées :
- N° Attribution / Marché
- Intitulé (tronqué)
- Montant HT
- Statut
- Type
- Actions (Voir + menu actions)

Les tables restent scrollables horizontalement (`overflow-x-auto`) si nécessaire, mais avec beaucoup moins de colonnes.

### 2. Créer les pages de détail
- `src/pages/ConventionDetail.tsx` — affiche toutes les informations de la convention (référence, projectReference, intitulé, bailleur, dates, montants, devise, taux, statut, autorité contractante, dates de validation, motif rejet) + documents GED + actions contextuelles (valider/rejeter/annuler selon rôle et statut).
- `src/pages/MarcheDetail.tsx` — affiche toutes les informations du marché (numéro, intitulé, montant, convention liée, statut, type, délégués, dates) + documents GED + actions contextuelles.

### 3. Routage
Ajouter dans `App.tsx` :
- `/dashboard/conventions/:id` → `<ConventionDetail />`
- `/dashboard/marches/:id` → `<MarcheDetail />`

### 4. Navigation
Dans chaque ligne des listes, ajouter un bouton **Voir** (icône `Eye`) qui fait un `navigate()` vers la page de détail. Les actions secondaires (Modifier, Affecter, GED, Annuler) restent dans le menu `MoreHorizontal`.

## Fichiers impactés
- `src/pages/Conventions.tsx` — réduire colonnes, ajouter lien Voir
- `src/pages/Marches.tsx` — réduire colonnes, ajouter lien Voir
- `src/App.tsx` — ajouter routes détail
- **Nouveau** `src/pages/ConventionDetail.tsx`
- **Nouveau** `src/pages/MarcheDetail.tsx`

## Estimation
~2-3 fichiers à modifier + 2 pages à créer. Travail modéré mais bien cadré.