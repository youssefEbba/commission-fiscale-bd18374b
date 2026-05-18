## Objectif
Rendre la recherche sur `/dashboard/certificats` explicite et couvrir à la fois la référence du certificat et le nom / raison sociale de l'entreprise.

## Modifications prévues
Fichier concerné : `src/pages/Certificats.tsx`

1. **Placeholder du champ de recherche** : remplacer `"Rechercher..."` par `"Réf. certificat ou entreprise"` pour indiquer clairement les critères supportés.

2. **Logique de filtrage** : étendre le `filter` existant (lignes 167-174) pour inclure `entrepriseRaisonSociale` en plus de `reference`, `entrepriseNom` et `id`. Cela garantit que la recherche fonctionne quel que soit le champ peuplé par le back-end.

## Pas de changement d'architecture
- Pas de sélecteur de critère séparé (choix utilisateur : placeholder explicite uniquement).
- Pas d'appel API supplémentaire : le filtrage reste client-side sur la liste déjà chargée.

## Vérification
- S'assurer que `entrepriseRaisonSociale` est bien typé dans `CertificatCreditDto` (l'API l'utilise déjà dans le tableau, donc le champ est disponible).