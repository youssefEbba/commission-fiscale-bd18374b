

## Plan: Adapter le frontend aux changements backend (Mise en place CI)

### Contexte

Le backend a ete modifie pour :
1. Permettre la creation de demande **sans montants** (montantCordon n'est plus obligatoire)
2. Ajouter un endpoint DGTCP pour renseigner les montants : `PATCH /api/certificats-credit/{id}/montants`
3. Exiger les montants avant l'ouverture du credit

Le frontend doit etre mis a jour pour refleter ce nouveau flux.

### Changements prevus

**1. `src/lib/api.ts`** — Ajouter la methode `updateMontants` dans `certificatCreditApi`

```typescript
updateMontants: (id: number, montantCordon: number, montantTVAInterieure: number) =>
  apiFetch<CertificatCreditDto>(`/certificats-credit/${id}/montants`, {
    method: "PATCH",
    body: { montantCordon, montantTVAInterieure },
  }),
```

**2. `src/pages/DemandesMiseEnPlace.tsx`** — 3 modifications :

- **Formulaire de creation** : Retirer les champs montants s'ils existent (la creation se fait sans montants, juste correction + docs). Deja OK dans le code actuel.

- **Vue detail** : Afficher "Non renseigne" au lieu de "0" quand les montants sont null.

- **Action DGTCP "Renseigner les montants"** : Ajouter un dialogue specifique pour le DGTCP quand le statut est `EN_OUVERTURE_DGTCP` (ou `VALIDE_PRESIDENT`) et que les montants ne sont pas encore renseignes. Ce dialogue contient 2 champs (montantCordon, montantTVAInterieure) et appelle `PATCH /api/certificats-credit/{id}/montants`. Apres succes, rafraichir la liste.

- **Bouton "Ouvrir le credit"** : Garder tel quel — le backend refusera si les montants ne sont pas encore renseignes, et le toast affichera l'erreur du backend.

### Flux resultant pour le DGTCP

1. Prendre en charge (VALIDE_PRESIDENT → EN_OUVERTURE_DGTCP)
2. Cliquer "Renseigner montants" → dialogue avec 2 champs → PATCH
3. Cliquer "Ouvrir le credit" (EN_OUVERTURE_DGTCP → OUVERT) → OK car montants renseignes

