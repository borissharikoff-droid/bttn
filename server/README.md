# BTTN ladder server

Облачные сохранения и общий рейтинг для BTTN на Cloudflare Workers + D1.
Сервер запускает ту же игровую логику, что и клиент, и сам пересчитывает
силу персонажа по снаряжению, поэтому число от клиента не принимается на веру.

## Запуск

```
npm i -g wrangler
wrangler login
wrangler d1 create bttn                      # вставить database_id в wrangler.toml
wrangler d1 execute bttn --remote --file=schema.sql
wrangler secret put SECRET                    # любая длинная случайная строка
node ../tools/build.js                        # обновляет src/game.js из js/
wrangler deploy
```

Потом укажи адрес сервера игре: в консоли браузера
`localStorage.setItem('bttn-api', 'https://bttn-ladder.<аккаунт>.workers.dev')`
или добавь `<script>window.BTTN_API = '...'</script>` перед скриптами игры.

## API

| Метод | Путь | Что делает |
|---|---|---|
| POST | /api/auth | создаёт анонимного игрока, возвращает токен |
| GET | /api/me | id игрока |
| GET / PUT | /api/save | облачное сохранение (до 400 КБ) |
| PUT | /api/ladder | слепок персонажа; проверяется и пересчитывается на сервере |
| GET | /api/ladder?by=depth\|power&limit=100 | таблица рейтинга текущего сезона |

## Проверка локально

`node ../tools/test-server.js` поднимает сервер на встроенном в Node SQLite и прогоняет сценарии: вход, сохранение, честный слепок, подделанная заточка, подделанная сила, частые отправки.
