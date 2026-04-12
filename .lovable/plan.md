

## Plan : Donner accès aux Utilisations pour l'Autorité Contractante (AC)

### Problème
Le rôle `AUTORITE_CONTRACTANTE` n'est pas inclus dans la liste des rôles ayant accès au menu "Utilisations" dans le sidebar. L'AC ne peut donc pas consulter les utilisations effectuées par les entreprises ou sous-traitants sur les certificats qui la concernent.

### Modifications

**1. `src/components/dashboard/DashboardLayout.tsx`**
- Ajouter `"AUTORITE_CONTRACTANTE"` dans le tableau `roles` du lien "Utilisations" (ligne 53)

**2. `src/pages/Utilisations.tsx`**
- L'AC a déjà un accès partiel (ligne 324 : `canCreate` inclut `AUTORITE_CONTRACTANTE`)
- Vérifier que l'affichage en lecture seule fonctionne correctement pour l'AC (pas de boutons d'action de workflow, uniquement consultation + détail)

### Comportement attendu
- L'AC voit le menu "Utilisations" dans le sidebar
- L'AC peut consulter la liste des utilisations liées à ses certificats (filtrage côté backend via son `autoriteContractanteId`)
- L'AC n'a **pas** de boutons de changement de statut (pas de transitions workflow)
- L'AC peut voir le détail d'une utilisation (bouton "Détail" / Eye)

