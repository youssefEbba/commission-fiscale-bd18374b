# Développement des points Front-only

Livrable UI/UX uniquement, sans modification back. 6 chantiers indépendants.

---

## 1. UX upload — ligne entière cliquable

Créer un composant réutilisable `UploadRow` qui rend toute la ligne cliquable (via un `<label htmlFor>` pleine largeur) avec focus clavier visible et curseur pointer.

Remplacer les blocs upload existants dans :
- `src/components/ged/DocumentGED.tsx`
- `src/pages/Utilisations.tsx`
- `src/pages/MiseEnPlaceDetail.tsx`
- `src/components/demandes/CreateDemandeWizard.tsx`
- `src/pages/Modifications.tsx`
- `src/pages/Cloture.tsx`

Comportement conservé : validation type/taille, aperçu nom de fichier, statut (requis/optionnel).

## 2. UX upload — bouton « Retirer » avant soumission

Sur chaque fichier sélectionné localement (avant envoi serveur), afficher un bouton croix `X` qui vide la sélection locale sans déclencher l'endpoint de suppression. Intégré directement dans `UploadRow` du point 1.

Fichiers déjà persistés : garder les actions existantes « Remplacer » / « Supprimer » (contrôlées par rôle, non touchées).

## 3. Liste entreprises — tri A→Z + scroll mobile

Factoriser un composant `EntrepriseSelector` (ou patcher les 3 sélecteurs existants) :
- Tri client `raisonSociale` (localeCompare, insensible casse/accents).
- Conteneur scrollable : `max-h-[50vh]`, `overscroll-contain`, `-webkit-overflow-scrolling: touch`.
- Retirer tout body scroll lock qui bloque le scroll intérieur sur mobile.
- Gestion clavier virtuel iOS/Android : `scrollIntoView({ block: 'nearest' })` sur focus input recherche.

Écrans concernés : `CreateDemandeWizard`, mise en place (création demande), utilisations (sélection bénéficiaire).

## 4. Renommage « Organisme » → « Membre »

Substitutions UI uniquement (les enums back restent). Champs à modifier :
- `src/i18n/locales/fr/demandes.json` : "Statut par organisme" → "Statut par membre", "Tous les organismes…" → "Tous les membres…"
- `src/i18n/locales/fr/mise_en_place.json` : "Statut par organisme" → "Statut par membre"
- `src/i18n/locales/fr/correction_douaniere.json` : "Décisions par organisme" → "Décisions par membre", "l'organisme ayant émis…" → "le membre ayant émis…"
- Équivalents AR dans `src/i18n/locales/ar/*.json` (traduire « Organisme » → « عضو »).
- Commentaires JSX purement cosmétiques dans `DemandesMiseEnPlace.tsx`, `MiseEnPlaceDetail.tsx`, `DemandeDetail.tsx` (facultatif).

## 5. Refonte contenu page d'accueil

Sections concernées : `HeroSection`, `FeaturesSection`, `ProcessSection`, `CTASection`.

**Bloqué** : en attente des textes et visuels exacts fournis par la commission. Pas de démarrage code tant que le contenu n'est pas fourni — sera traité dans un chantier séparé une fois reçu.

## 6. Reporting scindé en deux onglets

Refactor `src/pages/Reporting.tsx` pour afficher deux onglets shadcn `Tabs` :

1. **Reporting applicatif** — activité, workflows, audit. Réutilise `ReportingCharts` (onglets Demandes, Utilisations, Audit) et les KPIs de volume (`ReportingKPIs` haut).
2. **Statistiques crédits d'impôt** — KPIs métier CI : certificats, montants Cordon/TVA, soldes, taux adoption/rejet. Réutilise la partie financière de `ReportingKPIs` + onglets Certificats et Conv/Projets de `ReportingCharts`.

Répartition côté front uniquement (mêmes endpoints `reportingApi.getSummary` + `getDemandesTimeseries`). Ajouter i18n `reporting.tabs.app` et `reporting.tabs.stats` (FR + AR).

---

## Détails techniques

### Composant `UploadRow` (points 1 & 2)
Emplacement : `src/components/ui/upload-row.tsx`.
Props : `id`, `label`, `required?`, `accept?`, `maxSizeMB?`, `file?: File | null`, `onFileChange: (f: File | null) => void`, `helperText?`.
Structure :
```
<label htmlFor={id} className="flex w-full items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/50 focus-within:ring-2 focus-within:ring-ring">
  <Icon />
  <div className="flex-1">{label}{required && "*"} · {file?.name ?? helperText}</div>
  {file && <button type="button" onClick={clear}><X /></button>}
  <input id={id} type="file" className="sr-only" ... />
</label>
```
Le `<button>` de retrait `stopPropagation` pour ne pas rouvrir le picker.

### Ordre d'implémentation
1. Créer `UploadRow` + i18n reporting (parallèle).
2. Migrer les 6 écrans d'upload.
3. Sélecteur entreprises (composant partagé si simple, sinon patch en place).
4. Renommage Organisme → Membre (FR + AR).
5. Refactor page Reporting en 2 onglets.
6. Point 5 (landing) reste bloqué jusqu'à réception du contenu.

### Hors périmètre
- Endpoints, DTO, permissions : inchangés.
- Enums back (`ORGANISME_*`) : non renommés, seul le libellé UI change.
- Actions serveur d'upload (`PUT`/`DELETE` sur documents persistés) : inchangées.
