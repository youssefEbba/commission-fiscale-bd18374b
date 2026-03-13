

## Plan: Intégrer le nouvel endpoint `GET /api/utilisateurs/sous-traitants`

Le backend expose maintenant `GET /api/utilisateurs/sous-traitants` avec la permission `sous_traitant.list` pour le rôle ENTREPRISE. Il faut l'intégrer dans le frontend pour charger les sous-traitants lors de la sélection d'une entreprise.

### Modifications

**1. `src/lib/api.ts`**
- Ajouter un nouveau DTO `SousTraitantUtilisateurDto` avec les champs : `id`, `username`, `nomComplet`, `email`, `actif`, `entrepriseId`, `entrepriseRaisonSociale`, `entrepriseNif`
- Ajouter la méthode `getSousTraitants` dans `utilisateurApi` qui appelle `GET /utilisateurs/sous-traitants`

**2. `src/pages/SousTraitance.tsx`**
- Remplacer la logique de `handleSelectEntreprise` : au lieu d'appeler `getByEntreprise` puis `getAll` en fallback, appeler le nouvel endpoint `getSousTraitants()` et filtrer par `entrepriseId` sélectionné
- Supprimer l'état `usersAccessDenied` et la logique de fallback associée
- Adapter le type de `entrepriseUsers` pour accepter `SousTraitantUtilisateurDto[]` (compatible car contient `id`, `nomComplet`, `entrepriseId`)
- L'affichage du select utilisateur restera conditionnel : visible uniquement si des utilisateurs sont trouvés pour l'entreprise sélectionnée

