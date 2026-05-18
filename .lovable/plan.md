## Objectif
Trier la liste des utilisations dans `/dashboard/utilisations` par date de création décroissante (la plus récente en premier).

## Fichier concerné
- `src/pages/Utilisations.tsx`

## Modification prévue
- Après le `.filter()` qui produit `filtered` (ligne ~537), ajouter un `.sort()` qui compare `dateCreation` en ordre décroissant.
- Les éléments sans `dateCreation` seront placés en fin de liste.

## Pas de changement d'architecture
- Aucun appel API supplémentaire : le tri est client-side sur la liste déjà chargée.
- Aucun impact sur la pagination ou les filtres existants (recherche, statut, onglets).
