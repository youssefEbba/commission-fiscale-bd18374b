

## Plan : Renommer « Nouvelle demande » → « Nouvelle demande de correction »

Deux endroits à modifier :

1. **`src/pages/Dashboard.tsx` (ligne 28)** : Changer le label `"Nouvelle demande"` en `"Nouvelle demande de correction"` dans le tableau `QUICK_ACTIONS`.

2. **`src/pages/Demandes.tsx` (ligne 525)** : Changer le texte du bouton `Nouvelle demande` en `Nouvelle demande de correction`.

Le wizard (`CreateDemandeWizard.tsx`) a déjà le bon libellé.

