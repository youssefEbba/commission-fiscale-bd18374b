
# Mise à jour de l'API backend et WebSocket

1. Mettre à jour `src/lib/apiConfig.ts` avec les URLs fournies :
   - API REST : `https://stateless-dryadic-marylouise.ngrok-free.dev`
   - WebSocket : `https://stateless-dryadic-marylouise.ngrok-free.dev`
2. Vérifier que les appels API et la connexion STOMP utilisent bien ces variables de configuration.
3. S'assurer que le header `ngrok-skip-browser-warning` reste présent sur les requêtes authentifiées.
