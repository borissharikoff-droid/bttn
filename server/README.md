# BTTN ladder server

Cloud saves and a shared ladder for BTTN, running on Cloudflare Workers + D1.
The server runs the same game logic as the client and recomputes each hero's
power from their gear, so it never trusts a number sent by the client.

## Deploy

```
npm i -g wrangler
wrangler login
wrangler d1 create bttn                      # paste the database_id into wrangler.toml
wrangler d1 execute bttn --remote --file=schema.sql
wrangler secret put SECRET                    # any long random string
node ../tools/build.js                        # refreshes src/game.js from js/
wrangler deploy
```

Then point the game at the server, either from the browser console with
`localStorage.setItem('bttn-api', 'https://bttn-ladder.<account>.workers.dev')`
or by adding `<script>window.BTTN_API = '...'</script>` before the game scripts.

## API

| Method | Path | What it does |
|---|---|---|
| POST | /api/auth | creates an anonymous player and returns a token |
| GET | /api/me | the player's id |
| GET / PUT | /api/save | cloud save (up to 400 KB) |
| PUT | /api/ladder | hero snapshot; checked and recomputed on the server |
| GET | /api/ladder?by=depth\|power&limit=100 | the current season's ladder |

## Testing locally

`node ../tools/test-server.js` runs the server on Node's built-in SQLite and goes through these cases: sign-in, saving, an honest snapshot, a forged enchant, a forged power value, and uploads that come too often.
