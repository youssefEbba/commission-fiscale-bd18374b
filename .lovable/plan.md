

## Transformer les actions des conventions en menu déroulant par rôle

### Probleme actuel
Les actions sont des boutons inline dans la colonne "Actions" du tableau. Le user veut un menu déroulant (DropdownMenu) avec des options contextuelles selon le rôle et le statut.

### Actions par rôle

**DGB** (validateur) :
- Voir les détails
- Valider (si EN_ATTENTE)
- Rejeter avec motif (si EN_ATTENTE)

**DGI** :
- Voir les détails
- Accepter (valider)
- Rejeter

**Autorité Contractante** :
- Voir les détails
- Modifier les informations (si statut != VALIDE)
- Gérer les documents / fichiers (si statut != VALIDE)
- Annuler la convention (si statut != VALIDE)

### Modifications backend requises

Les endpoints suivants pourraient manquer :
1. **PUT /api/conventions/{id}** - Modifier les informations d'une convention (reference, intitule, bailleur, dates, montants)
2. **DELETE /api/conventions/{id}/documents/{docId}** - Supprimer un document
3. **PATCH /api/conventions/{id}/statut?statut=ANNULEE** - Il faut ajouter le statut `ANNULEE` au enum si pas encore fait

### Plan d'implementation (frontend)

1. **Remplacer les boutons inline par un DropdownMenu** dans la colonne Actions du tableau, avec un bouton "..." (MoreHorizontal) comme trigger
2. **Ajouter un Dialog "Détails"** pour afficher toutes les infos de la convention en lecture seule
3. **Ajouter un Dialog "Modifier"** (AC uniquement, si statut != VALIDE) - reprend le formulaire de création pré-rempli, appelle PUT /api/conventions/{id}
4. **Ajouter un Dialog de confirmation "Rejeter"** avec champ motif obligatoire
5. **Ajouter un Dialog de confirmation "Annuler"** (AC uniquement)
6. **Mettre a jour `conventionApi`** dans api.ts avec les nouveaux endpoints (update, delete document)
7. **Ajouter le statut ANNULEE** au type ConventionStatut si le backend le supporte

### Fichiers a modifier
- `src/pages/Conventions.tsx` - Refonte colonne actions + dialogs details/modifier/rejeter/annuler
- `src/lib/api.ts` - Ajouter `update` et potentiellement `deleteDocument` dans conventionApi

### Details techniques
- Utilisation de `DropdownMenu` + `DropdownMenuContent` + `DropdownMenuItem` deja present dans le projet
- Import de `MoreHorizontal` de lucide-react comme trigger
- Chaque item du menu conditionne son affichage sur `role` et `c.statut`

