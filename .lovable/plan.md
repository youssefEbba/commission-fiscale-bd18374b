# Lancer le site sur votre ordinateur

Le site n'a pas besoin d'être modifié. L'erreur « Missing script: dev » apparaît parce que les commandes sont lancées dans le dossier `Downloads`. Ce dossier contient un autre projet (Capacitor), pas le site.

## Étapes à suivre (dans l'invite de commandes Windows)

```text
cd %USERPROFILE%
git clone https://github.com/youssefEbba/commission-fiscale-bd18374b.git
cd commission-fiscale-bd18374b
git checkout lovable
npm install
npm run dev
```

Si le dossier existe déjà, faites seulement `cd` vers ce dossier, puis `git pull`, `npm install` et `npm run dev`.

Ouvrez ensuite l'adresse affichée (http://localhost:8080).

## À propos des 3 alertes « uuid »
- Elles sont modérées et concernent l'autre projet de Downloads (Capacitor), pas le site.
- Ne lancez pas `npm audit fix --force` : cette commande peut casser les dépendances.

## Si une autre erreur apparaît
Copiez le texte complet affiché après `npm run dev` et envoyez-le ici.
