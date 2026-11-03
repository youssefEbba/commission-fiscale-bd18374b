# SGCI — Commission fiscale

Application web du Système de Gestion des Crédits d’Impôt (Ministère des Finances, Mauritanie).

## Développement

```bash
npm ci --legacy-peer-deps
npm run dev
```

Le proxy Vite relaie `/api` et `/ws` vers le backend. En production, nginx sert le bundle et proxifie uniquement l’API et le WebSocket (pas MinIO).

## Build

```bash
npm run build
npm test
```

Les pièces jointes transitent par l’API authentifiée ; les jetons WebSocket passent en en-tête STOMP, jamais dans l’URL.
