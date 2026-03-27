

## Plan : Mise à jour du processus d'annulation des certificats

### Contexte
Le backend autorise l'annulation par **AC, DGI, PRESIDENT et DGTCP** (pas DGD ni DGB). Actuellement, le frontend ne permet l'annulation que pour DGI et AC, et uniquement au statut `DEMANDE`.

### Modifications

**Fichier : `src/pages/MiseEnPlaceDetail.tsx`**

1. **Élargir `canAnnuler`** pour inclure les rôles PRESIDENT et DGTCP, et autoriser l'annulation pour tout statut sauf `OUVERT`, `CLOTURE` et `ANNULE` :
   ```typescript
   const canAnnuler = ["DGI", "AUTORITE_CONTRACTANTE", "PRESIDENT", "DGTCP"].includes(role)
     && !["OUVERT", "CLOTURE", "ANNULE"].includes(c.statut);
   ```

2. **Ajouter une boîte de dialogue de confirmation** avant l'annulation, proposant :
   - Message : "Voulez-vous annuler ce certificat ?"
   - Bouton "Confirmer l'annulation" → appel `PATCH /api/certificats-credit/{id}/statut?statut=ANNULE`
   - Après annulation réussie, afficher un toast de succès et rediriger vers la liste

3. **Gestion des erreurs** : afficher les messages backend (403 rôle non autorisé, 400 transition invalide, 409 déjà ouvert) via toast destructive.

### Résumé des rôles
| Rôle | Peut annuler ? |
|------|---------------|
| AC | Oui (ses propres demandes) |
| DGI | Oui |
| PRESIDENT | Oui |
| DGTCP | Oui |
| DGD | Non |
| DGB | Non |

