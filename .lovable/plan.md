## Problèmes constatés

1. **Menu actif illisible** — Dans `src/components/dashboard/DashboardLayout.tsx` (ligne 122-127), la classe active applique `bg-sidebar-accent text-sidebar-primary`. Or `--sidebar-primary` est défini comme le jaune/doré (la même couleur que `--sidebar-accent`), donc le texte et l'icône deviennent invisibles sur le fond jaune (cas visible sur la capture : "Tableau de bord" sélectionné = barre jaune vide).

2. **Aperçu de lien partagé** — `index.html` (lignes 15 et 19) référence l'image OpenGraph par défaut de Lovable (`https://lovable.dev/opengraph-image-p98pqg.png`), ce qui fait apparaître le logo Lovable sur WhatsApp/réseaux sociaux.

## Modifications proposées

### 1. `src/components/dashboard/DashboardLayout.tsx`
- Remplacer dans `linkClass` la classe active `bg-sidebar-accent text-sidebar-primary` par `bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm` afin que l'item sélectionné affiche un fond doré net avec un texte vert foncé lisible (en respectant les tokens du design system, sans couleur en dur).

### 2. `index.html`
- Supprimer les deux balises pointant vers `lovable.dev/opengraph-image-...` (`og:image` et `twitter:image`).
- Retirer `twitter:site = @Lovable`.
- Laisser le titre et la description (déjà personnalisés Commission Fiscale).

Résultat : l'aperçu WhatsApp affichera uniquement le titre/description « Commission Fiscale — Gestion des Crédits d'Impôt » sans visuel Lovable. (Si vous souhaitez un visuel propre plus tard, on pourra générer une image OG aux couleurs vert/or.)

## Hors scope
Aucun changement de logique métier, ni de tokens CSS, ni d'autres pages.
