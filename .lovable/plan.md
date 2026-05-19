# Internationalisation FR (par défaut) + AR (RTL)

Mise en place i18next sur toute l'application (~38 pages), avec bascule à chaud, RTL natif arabe, et migration progressive de toutes les chaînes en dur.

## 1. Fondations (Phase 1 — livrée en une passe)

**Installation**
- Ajouter : `i18next`, `react-i18next`, `i18next-browser-languagedetector`, `@fontsource/noto-sans-arabic`.

**Arborescence créée**
```
src/i18n/
  index.ts              # init i18next, namespaces, detector, missingKey
  i18next.d.ts          # typage des namespaces et resources
  bootstrap.tsx         # <I18nBootstrap/> : sync html[lang|dir], persistance
  enums.ts              # helpers tStatutCertificat, tRole, tTypeDocument, etc.
  format.ts             # formatDate, formatAmount (MRU), numberingSystem
  LanguageSwitcher.tsx  # DropdownMenu shadcn (Globe icon)
locales/{fr,ar}/
  common.json nav.json auth.json conventions.json marches.json
  demandes.json certificats.json utilisations.json transferts.json
  cloture.json modifications.json ged.json users.json roles.json
  audit.json referentiel.json errors.json enums.json
```

**Config i18next**
- `fallbackLng: "fr"`, `defaultNS: "common"`, `returnEmptyString: false`.
- Detector order : `localStorage` (clé `app.lang`) → `navigator` → `fr`.
- Dev : `saveMissing: true` + `missingKeyHandler` qui `console.warn`.
- Pluriels via `Intl.PluralRules` natif (i18next ≥ v23).

**Bootstrap RTL**
- `<I18nBootstrap/>` monté au-dessus de `<BrowserRouter>` dans `App.tsx`.
- Effet sur changement de langue : `document.documentElement.lang = lng`, `dir = lng === "ar" ? "rtl" : "ltr"`, persiste `localStorage["app.lang"]`.
- `index.css` : `html[lang="ar"] body { font-family: "Noto Sans Arabic", "Plus Jakarta Sans", sans-serif; }`.

**Tailwind RTL**
- Tailwind v3 supporte nativement les variants `rtl:` / `ltr:` via le plugin officiel (à activer dans `tailwind.config.ts`).
- Convention adoptée : préférer les utilitaires logiques (`ms-/me-`, `ps-/pe-`, `start-/end-`, `text-start/end`). Refactor uniquement les composants chrome critiques (DashboardLayout, sidebar, header, drawers, dropdowns d'action). Le reste est migré au fil de l'eau lors du passage page par page.
- Icônes directionnelles (chevrons, flèches retour) : classe `rtl:rotate-180` ou inversion conditionnelle.

**Sélecteur de langue**
- `LanguageSwitcher` (DropdownMenu shadcn, icône `Globe`) ajouté dans le header de `DashboardLayout`. Options : « Français » / « العربية ». Change la langue à chaud, persiste, déclenche le RTL via le bootstrap.

**Helpers**
- `format.ts` : `formatDate(d, opts?)`, `formatAmount(n, { currency = "MRU", numberingSystem = "latn" })`.
- `enums.ts` : table de mapping centralisée par enum métier → clé `enums.<enum>.<VALEUR>`. Helpers typés : `tStatutCertificat`, `tStatutTransfert`, `tStatutUtilisation`, `tRole`, `tTypeDocument`, `tTypeUtilisation`, `tDecisionType`, `tTvaStockSource`. Fallback vers la valeur brute si clé manquante.
- `feedback.ts` : enrichi pour traduire d'abord `errors.<code>` puis fallback sur `error.message` brut du backend.

**Outillage**
- Script `scripts/i18n-check.mjs` (~50 lignes) qui compare les jeux de clés fr/ar par namespace et liste manquantes/orphelines. Ajout `"i18n:check": "node scripts/i18n-check.mjs"` dans `package.json`.
- `i18next.d.ts` déclare les namespaces pour autocomplétion `t()`.

**Documentation**
- `docs/I18N.md` : ajouter une langue, ajouter une clé, conventions, enums, RTL, helpers, script de vérification.

## 2. Migration du chrome (Phase 2 — même livraison)

Composants généralisés migrés vers `t(...)` :
- `DashboardLayout` (titre, menus, breadcrumb, footer)
- Sidebar / `NavLink` (libellés de navigation, namespace `nav`)
- Header + `NotificationBell` (titres, vide, dates relatives)
- `ErrorDialog`, `Toaster`, `feedback.ts` (titres et descriptions par défaut)
- `ProtectedRoute` (messages d'accès)
- `CreateDemandeWizard` étapes communes (boutons, labels génériques)
- Hook `usePageTitle(key)` qui set `document.title` via `t()`.

## 3. Migration des pages (Phase 3 — itérative)

Ordre de priorité (pages les plus utilisées en premier) :

1. `Dashboard`, `Login`, `Register`
2. `Certificats` + `CertificatDetail`
3. `Utilisations` + `UtilisationDetail`
4. `Transferts` + `TransfertDetail`
5. `Conventions` + `ConventionDetail`
6. `Marches` + `MarcheDetail`
7. `Demandes` + `DemandeDetail` + wizard
8. `DemandesMiseEnPlace` + `MiseEnPlaceDetail`
9. `Modifications`, `CorrectionDouaniere`, `Cloture`, `SousTraitance`
10. `GedDossiers`, `GedConfiguration`, `DocumentGED`, `DossiersList`
11. `Utilisateurs`, `Roles`, `Delegues`, `AuditLogs`, `CommissionRelais`
12. `ReferentielProjets`, `ReferentielTaxes`, `Simulation`, `Reporting`
13. Pages support : `AssistanceIA`, `ChatbotDGD`, `ExtractionDGD`, `Presentation`, `NotFound`, `Index`

Chaque page :
- Remplace chaînes JSX en dur → `t("...")` avec namespace dédié.
- Statuts/enums → helpers `t*`.
- Montants/dates → `formatAmount` / `formatDate`.
- Titre de page → `usePageTitle`.
- Si pluriel : forme i18next (`one`/`other` + variantes arabes `_zero/_two/_few/_many/_other`).
- Refactor opportuniste des utilitaires de directionnalité (`ml-` → `ms-`, etc.).

## 4. Traductions arabes

- Arabe standard moderne, registre administratif fiscal/douanier.
- Si doute → commentaire `// REVIEW` à côté de la clé (impossible en JSON pur : utiliser une clé jumelle `__review__<key>: true` dans le même fichier, OU passer ces fichiers à `.jsonc` ? **Décision** : on garde du JSON pur, et on ajoute un fichier `locales/ar/_REVIEW.md` qui liste les clés à relire). Aucune valeur française laissée en arabe.

## 5. Garanties

- 100% des chaînes visibles passées par `t()` à l'issue de la phase 3.
- L'app reste identique en français si l'utilisateur ne change pas de langue.
- Aucune dépendance hors liste autorisée.
- Pas de modification backend.

## Détails techniques

- **Conventions de clés** : en anglais, hiérarchique, `<page-or-domain>.<section>.<element>`. Actions communes dans `common.actions.*`. Statuts dans `enums.<enum_name>.<VALEUR_BACKEND>`.
- **Interpolation** : `t("certificats.detail.solde", { amount: formatAmount(v) })`.
- **react-hook-form + zod** : fournir une `zod errorMap` traduite branchée globalement (`z.setErrorMap`) — namespace `errors.validation.*`.
- **Devise** : toujours `formatAmount(n)` (par défaut MRU). Suppression progressive des `formatCurrency` legacy au profit du nouveau helper (compat conservée via ré-export).
- **Chargement** : tous les JSON importés statiquement (taille raisonnable) dans `src/i18n/index.ts` pour éviter le code-split asynchrone et le flash de clés brutes.

## Livrables finaux

À la fin de l'implémentation :
1. Liste des clés totales par namespace (sortie du script `i18n:check`).
2. Nombre de chaînes migrées et fichiers touchés (résumé par phase).
3. Liste des éventuelles chaînes encore en dur (composants tiers ou contenus dynamiques backend) à traiter manuellement.

## Hors scope

- Pas de traduction backend, pas de service tiers, pas de remplacement de shadcn/Tailwind, pas de polyfill ICU.
