

## Probleme identifie

Quand le DGD clique sur "Apposer Visa", le systeme detecte qu'il n'a pas encore uploade l'Offre Fiscale Corrigee et ouvre le dialogue d'upload. Apres l'upload reussi, le dialogue se ferme mais **le visa n'est pas automatiquement appose**. Le DGD doit re-cliquer sur "Apposer Visa" une seconde fois.

## Solution

Modifier `handlePreVisaUpload` dans `src/pages/CorrectionDouaniere.tsx` pour qu'apres l'upload reussi du document, il enchaine automatiquement avec l'appel API d'apposition du visa (`demandeCorrectionApi.postDecision(demande.id, "VISA")`), puis rafraichisse les decisions et la demande.

### Changement concret

Dans la fonction `handlePreVisaUpload` (ligne ~188), apres le `fetchDocs()` et la fermeture du dialogue, ajouter :
1. Appel a `demandeCorrectionApi.postDecision(demande.id, "VISA")`
2. Toast de succes "Visa appose avec succes"
3. Rafraichissement des decisions et de la demande (`fetchDecisions()` + `fetchDemande()`)

Cela transforme le flux en une seule action : upload + visa en un seul clic sur "Uploader".

