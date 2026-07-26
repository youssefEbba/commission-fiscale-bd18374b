## Problème

Sur le détail d'une demande de correction (`/dashboard/demandes/:id`, `src/pages/DemandeDetail.tsx`), l'UI ignore encore les contraintes de visa dynamiques :

- La liste des organismes (onglets « Statut par organisme ») est codée en dur : `["DGD", "DGTCP", "DGI", "DGB"]` — le DGD apparaît même sur une demande 100 % crédit intérieur (et inversement le DGI sur une demande 100 % extérieur).
- Le blocage d'action est codé en dur sur le visa DGD : `blocked = !isCurrentDGD && !isPres && !dgdVisa` — donc un DGI voit « En attente du visa DGD » alors que le DGD n'est pas dans le circuit.
- L'onglet actif par défaut est `"DGD"`, même quand le DGD est exclu, d'où l'affichage « DGD – Douanes / En attente de décision ».

Le helper `src/lib/visas.ts` (`requiredVisasCorrection`, `isRoleExcluded`) existe déjà et est utilisé pour la carte « Crédits demandés » et la décision finale — il suffit de l'appliquer aux trois points ci-dessus.

## Changements prévus (frontend uniquement)

**`src/pages/DemandeDetail.tsx`**

1. Remplacer `DECISION_ROLES_LIST` statique par la liste dérivée de `requiredVisasCorrection(selected)` (sans `PRESIDENT`). Les onglets n'affichent donc que les organismes réellement requis.
2. Initialiser / corriger l'onglet actif : si `activeOrg` n'appartient pas à la liste requise, basculer automatiquement sur le rôle de l'utilisateur s'il est requis, sinon sur le premier de la liste (via un `useEffect` ou une valeur effective calculée, comme déjà fait dans `CorrectionDouaniere.tsx`).
3. Rendre le blocage conditionnel : ne bloquer sur le visa DGD que si `requiredVisasCorrection(...)` contient `DGD`. Sinon, aucun message d'attente et les boutons visa/rejet restent disponibles.
4. Si l'utilisateur connecté a un rôle exclu du circuit (`isRoleExcluded`), masquer la zone d'actions visa/rejet et afficher un encart neutre « Votre visa n'est pas requis pour cette demande » (consultation seule).

**Vérification de cohérence** (lecture, correction seulement si nécessaire) sur `src/pages/CorrectionDouaniere.tsx` : l'onglet par défaut `activeOrg = "DGD"` et le message `blocked_by_dgd` y sont déjà conditionnés par `dgdRequired`/`visibleDecisionRoles` ; je m'assure que l'onglet initial retombe bien sur un organisme requis et que les documents spécifiques DGD (offre fiscale corrigée) ne sont pas exigés quand le DGD est hors circuit.

**i18n** : ajout d'une clé pour l'encart « visa non requis » dans `src/i18n/locales/fr/demandes.json` et `ar/demandes.json` (et équivalent `correction_douaniere.json` si utilisé là aussi).

## Hors périmètre

Aucune modification de la logique métier back-end ni des règles de `visas.ts` — uniquement l'affichage et les gardes UI.
