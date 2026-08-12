Mise à jour des URLs backend (REST + WebSocket)

## Objectif
Changer l'adresse du backend Spring Boot et du WebSocket pour pointer vers le nouveau tunnel ngrok fourni.

## Changements à apporter

### Fichier : `src/lib/apiConfig.ts`
- Mettre à jour `API_BASE` vers `https://stateless-dryadic-marylouise.ngrok-free.dev/api`.
- Mettre à jour `WS_BASE` vers `wss://stateless-dryadic-marylouise.ngrok-free.dev/ws`.
- Conserver les headers `ngrok-skip-browser-warning` existants.
- Ne pas modifier `AI_SERVICE_BASE` (reste sur localhost) sauf instruction contraire.

## Vérification
- Vérifier que le build Vite ne signale pas d'erreur de syntaxe après la modification.
- Vérifier que les appels API et la connexion WebSocket utilisent la nouvelle URL.

## Notes
- Pas d'impact métier : il s'agit uniquement d'une reconfiguration d'URL.
- L'utilisateur a précisé la nouvelle URL dans le chat.
