

# Correction : Auto-association de l'AC connectee lors de la creation d'un projet

## Probleme

Quand un utilisateur connecte en tant qu'Autorite Contractante cree un projet, le formulaire lui demande de selectionner une AC dans une liste deroulante. C'est inutile : l'AC connectee devrait etre automatiquement associee au projet.

## Solution

- **Pour le role AC** : Supprimer le champ de selection et utiliser directement le `userId` de l'utilisateur connecte comme `autoriteContractanteId`. Le dialogue affichera simplement un message de confirmation avec le nom de l'AC connectee.
- **Pour les roles Admin (ADMIN_SI, PRESIDENT)** : Conserver le selecteur d'AC, car un admin peut creer un projet au nom de n'importe quelle AC.

## Modifications techniques

### Fichier : `src/pages/ReferentielProjets.tsx`

1. **Initialisation du formulaire** : Si l'utilisateur est AC, pre-remplir `autoriteContractanteId` avec `user.userId` automatiquement.
2. **Dialogue de creation** :
   - Si AC : afficher "Projet cree en votre nom (nom de l'utilisateur)" au lieu du selecteur.
   - Si Admin : garder le selecteur actuel.
3. **Suppression de l'appel `fetchAutorites()`** pour les AC (inutile puisque la valeur est deja connue).
4. **Validation** : pour les AC, ne plus verifier la selection puisque la valeur est definie automatiquement.

