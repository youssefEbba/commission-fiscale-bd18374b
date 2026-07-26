## Contexte

Actuellement, l'upload obligatoire avant visa est codé en dur :

- **DGD** → `OFFRE_FISCALE_CORRIGEE`
- **DGI** → `CREDIT_INTERIEUR`

Cela pose problème quand une demande est **100 % crédit intérieur** : le DGD est exclu du circuit, mais le DGI est toujours obligé d'uploader un « Crédit intérieur » au lieu de l'**Offre Fiscale Corrigée**. L'utilisateur a confirmé que, dans ce cas, c'est le **DGI** qui doit uploader l'Offre Fiscale Corrigée avant de viser.

## Règle métier retenue

| Type de crédit | Organismes requis | Qui upload `OFFRE_FISCALE_CORRIGEE` avant visa |
|---|---|---|
| Extérieur seul | DGD, DGTCP, DGB | **DGD** |
| Intérieur seul | DGI, DGTCP, DGB | **DGI** |
| Mixte | DGD, DGI, DGTCP, DGB | **DGD** (DGI conserve `CREDIT_INTERIEUR`) |
| Legacy (non renseigné) | Tous | **DGD** (DGI conserve `CREDIT_INTERIEUR`) |

## Fichiers concernés

### 1. `src/pages/DemandeDetail.tsx`

Remplacer le mapping statique `UPLOAD_BEFORE_VISA` par une dérivation dynamique :

```text
const required = requiredVisasCorrection(selected);
const dgdRequired = required.includes("DGD");
const dgiRequired = required.includes("DGI");
const UPLOAD_BEFORE_VISA: Record<string, { docType: string }> = {
  ...(dgdRequired ? { DGD: { docType: "OFFRE_FISCALE_CORRIGEE" } } : {}),
  ...(dgiRequired ? { DGI: { docType: dgdRequired ? "CREDIT_INTERIEUR" : "OFFRE_FISCALE_CORRIGEE" } } : {}),
};
```

Adapter `checkAndHandleVisa`, `handleOffreCorrigeeUploadAndVisa` et le libellé du dialog pour utiliser ce mapping.

### 2. `src/pages/Demandes.tsx`

Même transformation du `UPLOAD_BEFORE_VISA` statique dans la liste/liste-actions des demandes.

### 3. `src/pages/CorrectionDouaniere.tsx`

Remplacer `UPLOAD_REQUIRED_ROLES` statique par la même logique conditionnée à `requiredVisasCorrection(demande)`.

### 4. i18n (si nécessaire)

Vérifier que les libellés `demandes:dialogs.offre_corrigee.*` et `correction_douaniere:actions.*` restent corrects pour un upload effectué par le DGI. Aucune nouvelle clé n'est requise si les textes sont génériques.

## Vérification

- Demande 100 % crédit intérieur connectée en tant que DGI : le dialog d'upload pré-visa propose bien « Offre Fiscale Corrigée ».
- Demande 100 % crédit extérieur connectée en tant que DGD : le dialog propose « Offre Fiscale Corrigée ».
- Demande mixte : DGD a OFC, DGI a Crédit Intérieur.
- Demande legacy : comportement inchangé (DGD → OFC, DGI → Crédit Intérieur).

## Hors périmètre

Aucune modification des règles de visas (`src/lib/visas.ts`) ni de l'API back-end. Seul le mapping front de l'upload pré-visa est ajusté.