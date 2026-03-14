

## Plan : Filtrer les documents envoyés au service IA

**Objectif** : Lors de la soumission d'une demande, envoyer uniquement l'Offre Fiscale, l'Offre Financière et le DQE au service IA (au lieu de tous les documents).

### Modification unique

**Fichier** : `src/components/demandes/CreateDemandeWizard.tsx` (lignes 450-465)

Ajouter un filtre sur les documents récupérés via `demandeCorrectionApi.getDocuments()` avant de construire `sourceUrls`. Seuls les documents dont le `typeDocument` contient `OFFRE_FISCALE`, `OFFRE_FINANCIERE` ou `DQE` seront transmis à l'endpoint `/api/fiscal-context/{id}`.

```typescript
const AI_DOC_TYPES = ["OFFRE_FISCALE", "OFFRE_FINANCIERE", "DQE"];

const uploadedDocs = await demandeCorrectionApi.getDocuments(demande.id);
const sourceUrls = uploadedDocs
  .filter((d: any) => d.chemin && AI_DOC_TYPES.some(t => d.typeDocument?.includes(t)))
  .map((d: any) => d.chemin.replace(/\\/g, "/"));
```

Aucun autre fichier n'est impacté.

