## Objectif

Masquer temporairement les modules dont le back-end n'est pas encore développé, sans supprimer le code (juste le commenter pour pouvoir le réactiver facilement plus tard).

Note : aucune référence à "Groupement" n'a été trouvée dans le code (ni page, ni route, ni entrée de menu). Il n'y a donc rien à commenter pour cette partie.

## Modifications à effectuer

### 1. Sous-traitance

- `src/components/dashboard/DashboardLayout.tsx` (ligne 62) : commenter l'entrée de menu `sous_traitance`.
- `src/App.tsx` :
  - ligne 35 : commenter l'import `import SousTraitance from "./pages/SousTraitance";`
  - lignes 135-137 environ : commenter la `<Route path="/dashboard/sous-traitance" .../>`.

### 2. Modifications / Avenants

La page `Modifications` est entièrement dédiée aux avenants — la « partie avenant des modifications » correspond donc à toute la page. Je la masque entièrement.

- `src/components/dashboard/DashboardLayout.tsx` (ligne 60) : commenter l'entrée de menu `modifications`.
- `src/App.tsx` :
  - ligne 40 : commenter l'import `import Modifications from "./pages/Modifications";`
  - lignes 145-147 environ : commenter la `<Route path="/dashboard/modifications" .../>`.

### 3. Ce qui n'est PAS touché

- Les fichiers `src/pages/SousTraitance.tsx` et `src/pages/Modifications.tsx` restent intacts.
- Les traductions (`fr/ar/sous_traitance.json`, `fr/ar/modifications.json`, clés `nav`) restent intactes.
- Les références à `avenantApi` dans `src/lib/api.ts` et `tStatutAvenant` dans `src/i18n/enums.ts` restent intactes (non visibles côté UI).

Ainsi, pour réactiver les modules après livraison du back-end, il suffira de décommenter 6 lignes au total (2 entrées de menu + 2 imports + 2 routes).

## Détails techniques

Style de commentaire utilisé :
- JSX/TSX dans routes et menu : `{/* ... */}`
- Imports TypeScript : `//`

Chaque bloc commenté sera précédé d'une courte note `// TODO: réactiver quand le back-end ...` pour faciliter la recherche ultérieure.
