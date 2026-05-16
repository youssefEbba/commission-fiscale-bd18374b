## Intégration de la langue arabe (FR ↔ AR avec RTL)

Le projet n'a actuellement aucune librairie i18n. Voici le plan pour ajouter l'arabe avec support **RTL** (right-to-left) complet.

### 1. Installer la stack i18n

- `i18next` + `react-i18next` (gestion des traductions, hooks `useTranslation`)
- `i18next-browser-languagedetector` (détection auto navigateur + persistance localStorage)

### 2. Structure des fichiers de traduction

```text
src/i18n/
  index.ts              -> init i18next, détection langue, chargement ressources
  locales/
    fr/common.json      -> toutes les chaînes FR (clés en français normalisé)
    fr/dashboard.json
    fr/conventions.json
    fr/marches.json
    fr/demandes.json
    ...
    ar/common.json      -> traductions arabes
    ar/dashboard.json
    ...
```

Découpage par **namespace** (par domaine métier) pour éviter un seul fichier monolithique.

### 3. Support RTL (critique pour l'arabe)

- Ajouter un `LanguageContext` (ou réutiliser AuthContext) qui :
  - met `document.documentElement.lang = 'ar' | 'fr'`
  - met `document.documentElement.dir = 'rtl' | 'ltr'`
- Tailwind : activer les variantes logiques. Deux options :
  - **Option A (recommandée)** : remplacer progressivement `ml-*`/`mr-*`/`pl-*`/`pr-*`/`left-*`/`right-*`/`text-left`/`text-right` par les équivalents logiques `ms-*`/`me-*`/`ps-*`/`pe-*`/`start-*`/`end-*`/`text-start`/`text-end`. Tailwind v3 les supporte nativement.
  - **Option B (rapide)** : installer `tailwindcss-rtl` pour auto-flip, mais moins propre à long terme.
- Vérifier les composants à risque : `Sidebar`, `DashboardLayout`, `DropdownMenu`, `Sheet` (drawer côté), tables, icônes directionnelles (`ChevronLeft/Right`, flèches pagination).

### 4. Sélecteur de langue

- Bouton globe (icône `Languages` de lucide) dans :
  - `Navbar` (landing) à côté de "Se connecter"
  - `DashboardLayout` (header, près de `NotificationBell`)
- Dropdown avec **Français** / **العربية**. Persistance via localStorage (clé `i18nextLng`).

### 5. Migration progressive des chaînes

Plutôt que tout migrer d'un coup (le projet a ~40 pages), procéder par vagues :

1. **Vague 1** : `Navbar`, `Footer`, `Login`, `Register`, `Index` (landing publique).
2. **Vague 2** : `DashboardLayout`, sidebar, menus, `Dashboard`.
3. **Vague 3** : listes principales (`Conventions`, `Marches`, `Demandes`, `Certificats`, `Utilisations`).
4. **Vague 4** : pages de détail et workflows (Mise en place, Transferts, Modifications, etc.).
5. **Vague 5** : composants partagés (`DocumentGED`, `CreateDemandeWizard`, dialogs).

Pattern :
```tsx
const { t } = useTranslation('conventions');
<h1>{t('title')}</h1>
```

### 6. Cas particuliers à traiter

- **Dates** : utiliser `date-fns` avec `locale: ar` (ou `fr`) pour le formatage. Calendrier hégirien optionnel — par défaut on garde le grégorien avec libellés en arabe.
- **Nombres et devises** : `formatCurrency` doit utiliser `Intl.NumberFormat(lang === 'ar' ? 'ar-MR' : 'fr-MR', ...)`. Garder "MRU" comme code devise.
- **Statuts métier** (ex : `VALIDE`, `EN_COURS`) : mapper via `t(`statuts.${statut}`)`.
- **Toasts** (`showApiError`, `showSuccess`) : les titres passés en argument doivent être des clés traduites au site d'appel.
- **PDF** (`liquidationPdf.ts`) : jsPDF ne supporte pas l'arabe nativement. Si l'utilisateur veut des PDF en arabe, il faudra embarquer une police arabe (ex: Amiri) et gérer le shaping RTL — à traiter dans un lot dédié plus tard.
- **Messages d'erreur backend** : restent en français (côté API). Soit on les laisse, soit on mappe les codes `ApiRequestError.code` vers des clés i18n côté frontend.

### 7. Détails techniques

- Init i18next dans `src/main.tsx` avant le render React.
- `fallbackLng: 'fr'`, `defaultNS: 'common'`.
- Charger les namespaces statiquement (import JSON) — pas besoin de lazy load vu la taille.
- Ajouter `lang="fr"` initial dans `index.html` (déjà OK), mais le `dir` sera piloté côté JS.
- Tests : aucun à modifier (`example.test.ts` n'utilise rien de i18n).

### Ce que je livrerai à la phase d'implémentation

Si tu approuves, je ferai :
1. L'installation + setup i18next + contexte langue + sélecteur (étape 1-4).
2. La **Vague 1** de migration (landing + auth) pour valider le pattern.
3. Les vagues suivantes seront faites à la demande, page par page, pour éviter une PR géante.

Veux-tu qu'on parte sur ce plan ? Préférence pour Tailwind logiques (option A propre) ou `tailwindcss-rtl` (option B rapide) ?