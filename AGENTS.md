# AGENTS.md — décisions techniques du projet

- Lignes de tableau cliquables : utiliser `ClickableTableRow` (`src/components/ui/clickable-table-row.tsx`) avec un vrai `<Link>` sur la colonne de référence — le composant ignore les clics venant des boutons/liens/menus de la ligne, donc les actions existantes n'ont pas besoin de `stopPropagation` ajouté à la main.
- Boutons « Retour » des fiches : utiliser le hook `useSmartBack(fallback)` (`src/hooks/useSmartBack.ts`) — revient à la page précédente si l'historique vient de l'application, sinon retombe sur la liste ; ne plus écrire `navigate(-1)` ou `navigate("/liste")` en dur dans les fiches.
- Alertes d'échéance des conventions : calcul centralisé dans `src/lib/conventionEcheance.ts` (seuils 90 j / 30 j, constantes nommées) — ajuster les seuils là, pas dans les pages.
- Permissions métier : passer par `hasPermission(...)` du `AuthContext` (JWT d'abord, repli `ROLE_PERMISSIONS`) — ne pas reproduire de règle métier par rôle dans les pages.
