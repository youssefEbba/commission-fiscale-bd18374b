# Alignement Front — Contrats back-end commission

Livrable front consommant les 5 phases livrées côté back. Découpé en chantiers indépendants, testables un par un.

---

## Phase A — Demande de correction : marché optionnel + crédits + routing visas

### A1. Wizard correction (`CreateDemandeWizard.tsx`)
- Retirer l'étape/section "création de marché".
- Ajouter un champ texte libre `intituleMarche` (obligatoire).
- Ajouter deux champs numériques `creditInterieur` et `creditExterieur` (défaut 0, min 0).
- Validation front avant soumission : `creditInterieur + creditExterieur > 0`, sinon bloquer avec message clair.
- Ne plus envoyer `marcheId` (sauf mode édition d'une demande liée à un marché existant, à conserver pour rétro-compat).
- Payload : `{ intituleMarche, creditInterieur, creditExterieur, ... }`.

### A2. Types (`src/lib/api.ts`)
- Étendre `DemandeCorrectionDto`, `CreateDemandeCorrectionRequest`, `UpdateDemandeCorrectionRequest` avec `intituleMarche`, `creditInterieur`, `creditExterieur`.
- `marcheId` devient optionnel.

### A3. Détail demande (`DemandeDetail.tsx`, `CorrectionDouaniere.tsx`)
- Afficher `intituleMarche` en tête si présent (sinon fallback sur marché lié).
- Afficher les 2 enveloppes crédit (Intérieur / Extérieur) avec `formatAmount`.
- Masquer visuellement la ligne / colonne d'un membre exclu :
  - DGI masquée si `creditInterieur == 0`.
  - DGD masquée si `creditExterieur == 0`.
- Appliquer la même règle dans `MiseEnPlaceDetail.tsx` pour visas et champs montants (masquer champ Cordon si DGD exclue, champ TVA intérieure si DGI exclue).

### A4. Notifications / listes de tâches
- Ne pas afficher de bandeau "en attente DGI/DGD" pour l'utilisateur d'un rôle exclu (utiliser les crédits pour filtrer côté affichage).

---

## Phase B — Références lisibles `PREFIXE-NN/AAAA`

### B1. Types (`src/lib/api.ts`)
Ajouter `reference?: string` à `DemandeCorrectionDto`, `CertificatCreditDto`, `MarcheDto`, `UtilisationCreditDto`.

### B2. Affichage
Priorité `reference` sinon fallback `numero` (helper `displayRef(entity) => entity.reference ?? entity.numero`) dans :
- Listes : `Demandes.tsx`, `DemandesMiseEnPlace.tsx`, `Certificats.tsx`, `Utilisations.tsx`, `Marches.tsx`, `CorrectionDouaniere.tsx`.
- Détails : `DemandeDetail.tsx`, `CertificatDetail.tsx`, `UtilisationDetail.tsx`, `MarcheDetail.tsx`, `MiseEnPlaceDetail.tsx`.
- PDF : `certificatSignaturePdf.ts`, `liquidationPdf.ts` (afficher `reference` en en-tête, garder `numero` en pied technique).
- Notifications : `NotificationBell.tsx` (utiliser `reference` dans le libellé lorsque disponible dans le payload).

---

## Phase C — Entreprise & Autorité

### C1. Types + API
- `EntrepriseDto` : ajouter `entrepriseEtrangere`, `registreCommerceEtranger`, `groupement`, `chefDeFileId`, `chefDeFileRaisonSociale`, `nifAffiche`.
- `AutoriteContractanteDto` : ajouter `ministereTutelleNom`, `ministereTutelleCode`.
- `RegisterRequest` : champs optionnels `acMinistereTutelleNom`, `acMinistereTutelleCode`.

### C2. Formulaire entreprise (création + édition, `Utilisateurs.tsx` / `Register.tsx` / création entreprise dans wizard)
- Case à cocher "Entreprise étrangère" → cache le NIF, montre `registreCommerceEtranger` (requis).
- Case "Groupement" → sélecteur d'entreprise "Chef de file" (exclure l'entreprise en cours d'édition).
- Validation front alignée sur les règles back.

### C3. Affichage NIF
- Dans les listes/détails entreprise et les sélecteurs (`SearchableSelect`), afficher `nifAffiche` (fallback `nif`).

### C4. Ministère de tutelle
- Formulaire inscription AC (`Register.tsx`) : ajouter 2 champs optionnels ministère (nom + code).
- Écran AC (liste + fiche) : afficher ministère.
- En-têtes PDF (certificat, liquidation) : afficher le ministère de tutelle de l'AC.

---

## Phase D — Intitulé

- `MarcheDto.intitule` et `ConventionDto.intitule` : afficher en priorité dans les listes/détails.
- `DemandeCorrectionDto` : afficher `conventionReference` + `conventionIntitule` dans la liste corrections et sur la fiche.

---

## Phase E — Consultation CI (search / journal / fiche)

Nouveau module frontal "Consultation crédits" accessible aux rôles nationaux + AC/Entreprise (périmètre appliqué côté back).

### E1. Client API (`src/lib/api.ts`)
- `certificatCreditApi.search(params)` → `GET /api/certificats-credit/search` avec pagination (`PageResponse<CertificatCreditDto>`).
- `certificatCreditApi.journal({ from, to, page, size })` → `GET /api/certificats-credit/journal` → `CertificatCreditJournalDto`.
- `certificatCreditApi.fiche(reference)` → `GET /api/certificats-credit/fiche?reference=...` → `CertificatCreditFicheDto` (encoder la référence, elle contient `/`).
- Types : `PageResponse<T>`, `CertificatCreditJournalDto`, `CertificatCreditFicheDto`.

### E2. UI Recherche multi-critères
Nouvel écran `src/pages/CreditsRecherche.tsx` :
- Formulaire : NIF, N° marché, Réf convention, Projet, AC (select), Statut, période from/to.
- Table paginée résultats.
- Ligne cliquable → fiche (E3).

### E3. Fiche par référence
`src/pages/CreditFiche.tsx` ou dialog : bloc entreprise (nifAffiche), convention, marché, AC (+ministère), intituleMarche, documents, utilisations, TVA stock.

### E4. Journal daté
Nouvel onglet dans `Reporting.tsx` "Statistiques crédits d'impôt" (déjà scindé) :
- Ajout d'une sous-section "Journal" avec filtres date + tableau paginé + agrégats (nombre, totaux Cordon / TVA / soldes).
- Utilise `dateMiseEnPlace` (fallback `dateEmission`) déjà géré côté back.

### E5. Routing (`App.tsx`) + navigation (`DashboardLayout.tsx`)
- Route `/dashboard/credits/recherche` et `/dashboard/credits/fiche/:reference` (référence URL-encodée).
- Entrée menu "Consultation crédits" (rôles concernés).

---

## Ordre d'implémentation proposé

1. **Types & api client** (Phase A2, B1, C1, E1) — foundation, non visible mais débloque tout.
2. **Phase B (références)** — impact large mais mécanique (helper `displayRef`).
3. **Phase A** — wizard + détails + masquage membres exclus.
4. **Phase D** — intitulé conventions/marchés.
5. **Phase C** — entreprise étrangère / groupement / ministère.
6. **Phase E** — module Consultation CI (search + fiche + journal).

Chaque phase est livrée indépendamment ; le back tolère l'absence des nouveaux champs (rétro-compat).

---

## Hors périmètre

- Modification des workflows back / permissions / RLS.
- Génération de références (côté back).
- Migration `numero` → `reference` : les deux cohabitent, `reference` est prioritaire à l'affichage.
