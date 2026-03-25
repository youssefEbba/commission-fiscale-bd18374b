

## Masquer "Documents de decision" avant le statut ADOPTEE

### Probleme
La section "Documents de decision" (Offre Fiscale Corrigee, Lettre d'Adoption) s'affiche toujours, meme quand la demande n'est pas encore adoptee. Ces documents ne sont pertinents qu'apres adoption.

### Modifications

**1. `src/pages/Demandes.tsx` (~ligne 809)**
Envelopper le bloc "Documents de decision" avec une condition :
```
if (selectedDemande?.statut === "ADOPTEE" || selectedDemande?.statut === "NOTIFIEE")
```
Le bloc entier (lignes 809-855 environ) ne s'affiche que si le statut est ADOPTEE ou NOTIFIEE.

**2. `src/pages/CorrectionDouaniere.tsx` (~ligne 470)**
Envelopper le bloc "Documents de decision" avec une condition :
```
if (demande?.statut === "ADOPTEE" || demande?.statut === "NOTIFIEE")
```
Le bloc entier (lignes 470-520 environ) ne s'affiche que si le statut est ADOPTEE ou NOTIFIEE.

### Fichiers a modifier
- `src/pages/Demandes.tsx`
- `src/pages/CorrectionDouaniere.tsx`

