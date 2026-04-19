

## Analyse

Le backend expose maintenant un récapitulatif fiscal complet avec deux blocs (cordon douanier et TVA intérieure) et trois champs dérivés en lecture sur `CertificatCreditDto` :
- `creditExterieurRecap` ≈ b + d
- `creditInterieurNetRecap` ≈ g − d
- `totalCreditImpotRecap` ≈ e + h

Côté front, la saisie DGTCP a déjà été enrichie (a, b, c=f, d, g) dans le précédent message. Il reste à **afficher** le récapitulatif complet et lisible dans la **page détail du certificat de crédit** (`/dashboard/certificats/:id`), où l'utilisateur se trouve actuellement, ainsi que dans **la page détail de mise en place** (`/dashboard/mise-en-place/:id`).

Je vais lire les fichiers concernés pour cadrer précisément le plan.

