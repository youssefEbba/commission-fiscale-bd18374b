Objectif : permettre au Président de générer une lettre d'adoption pré-remplie (PDF institutionnel) avant de l'uploader et d'adopter la demande.

````text
Flux actuel :
  EN_VALIDATION → clic "Adopter" → modale upload LETTRE_ADOPTION → ADOPTEE

Flux cible :
  EN_VALIDATION → bouton "Générer la lettre d'adoption" → PDF téléchargeable
                → modale upload LETTRE_ADOPTION (pré-remplissable) → ADOPTEE
````

## 1. Générateur PDF `src/lib/adoptionLetterPdf.ts`

Créer un générateur jsPDF reprenant le style institutionnel du certificat :
- En-tête : République Islamique de Mauritanie, Ministère des Finances, Commission Fiscale, emblème officiel (`logo-official.png`).
- Titre : « LETTRE D'ADOPTION ».
- Corps pré-rempli avec les données de la demande :
  - Référence demande (`reference` fallback `numero`).
  - Date du jour.
  - Entreprise / Groupement (raison sociale, NIF affiché).
  - Convention (référence + intitulé) et/ou Marché (numéro + intitulé).
  - Crédits demandés : extérieur, intérieur, total, nature (intérieur / extérieur / mixte).
  - Mention d'adoption : "La Commission Fiscale, réunie en session, a examiné la demande de correction [...] et a décidé de l'adopter."
  - Signature Président (ligne pointillée + libellé).
- Pied de page : référence technique, date.
- Pas de QR code (pas de vérification publique requise pour une lettre interne).

Fonction exportée :
```ts
export async function generateAdoptionLetterPdf(
  demande: DemandeCorrectionDto,
  ctx?: { convention?: ConventionDto | null; marche?: MarcheDto | null; entreprise?: EntrepriseDto | null; autorite?: AutoriteContractanteDto | null; }
): Promise<Blob>
```

## 2. Bouton de génération dans les écrans de demande

### `src/pages/DemandeDetail.tsx`
- Ajouter un bouton « Télécharger la lettre d'adoption » (icône `Download`) à côté du bouton « Adopter », visible uniquement :
  - rôle `PRESIDENT` (ou rôle effectif via commission-relais),
  - statut `EN_VALIDATION`,
  - pas de lettre d'adoption déjà uploadée.
- Au clic : appel `generateAdoptionLetterPdf(selected, ctx)` puis `URL.createObjectURL` + téléchargement via ancre invisible.

### `src/pages/Demandes.tsx`
- Ajouter la même action dans la ligne/tableau ou dans la modale d'adoption (selon l'emplacement du bouton "Adopter").
- Mêmes règles de visibilité.

## 3. Intégration avec la modale d'adoption existante

Option retenue : **génération séparée, upload manuel ensuite** (plus sûr, l'utilisateur contrôle le document).
- La modale d'upload reste inchangée dans un premier temps.
- Le bouton de génération affiche un hint : « Générez le projet de lettre, imprimez-le, signez-le, puis uploadez-le ici. »
- Si faisable sans risque : pré-remplir le champ `file` de la modale d'adoption avec le Blob généré (optionnel, à évaluer lors de l'implémentation).

## 4. Types et helpers

- Réutiliser `hasCreditInterieur` / `hasCreditExterieur` de `src/lib/visas.ts` pour déterminer la nature du crédit.
- Réutiliser `displayRef(demande)` pour la référence lisible.
- Réutiliser `formatAmount` pour les montants (affichage Ouguiya).

## 5. Traductions

Ajouter dans `src/i18n/locales/fr/demandes.json` et `ar/demandes.json` :
- `demandes:detail.generate_adoption_letter`
- `demandes:detail.generate_adoption_letter_hint`
- `demandes:detail.adoption_letter_title`

## 6. QA

- Générer un PDF de test à partir d'une demande fictive.
- Convertir en image (`pdftoppm`) et inspecter :
  - pas de chevauchement,
  - marges correctes,
  - texte tronqué,
  - emblème présent,
  - montants et références corrects.
- Vérifier que le bouton n'apparaît que pour `PRESIDENT` en `EN_VALIDATION`.

## Fichiers impactés

- `src/lib/adoptionLetterPdf.ts` (nouveau)
- `src/pages/DemandeDetail.tsx`
- `src/pages/Demandes.tsx`
- `src/i18n/locales/fr/demandes.json`
- `src/i18n/locales/ar/demandes.json`

## Hors périmètre

- Modification du workflow back (statuts, permissions).
- Signature électronique.
- Envoi automatique de la lettre par email.
- Archivage spécifique de la lettre générée (le document uploadé reste le document de référence).