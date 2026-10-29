# Brain Battle — Ultimate Quiz Arena

A real-time multiplayer quiz game built with React, Vite, Express, and Socket.IO. Players join without accounts. The server owns the room, timer, answer checks, power-up use, scores, and leaderboard.

## Requirements

- Node.js 20 or newer
- npm

## Run locally

1. Open a terminal in this project folder.
2. Install packages: `npm install`
3. Start the client and game server: `npm run dev`
4. Open **http://localhost:5173** in a browser.

Vite serves the React app on port 5173 and forwards live game connections to the Express/Socket.IO server on port 3001. Leave the terminal running while you play. To stop the game, press `Ctrl+C` there.

## Play with two browser sessions

1. Open **http://localhost:5173** in a regular browser window. Enter a name and choose **Create a room**.
2. Copy the invite link or note the five-character room code.
3. Open the link in a separate browser session (for example, a private/incognito window or another browser). Enter a different player name and join with the code.
4. Back in the host window, confirm both players appear in the lobby, then choose **Start the battle**.
5. Choose an answer in each window. Both should move to the answer reveal together, and the scoreboard should update. Correct answers earn more points when submitted earlier.
6. Use each power-up once during the game: **50/50** privately removes two incorrect choices, **Double Points** doubles your next correct answer, and **Time Freeze** adds five seconds to the shared clock (up to ten total seconds per question).
7. Watch for the **Speed Round** (shorter timer and faster scoring) and **Bonus Round** (double base points). Finish the selected-category set to reach the winner screen. The host can select **Play again** for a newly randomized set.

Use separate sessions rather than two tabs in the same browser profile if you want isolated player storage. Rooms hold up to **8 players total, including the host**. All eight player rows appear in the lobby and scoreboard. A player who joins during a live round appears immediately but starts answering and using power-ups on the next question; this prevents a late arrival from gaining extra time or changing the current round’s answer deadline. The final question does not accept late joiners; they can join again when the host starts a replay. Disconnected seats stay reserved so the player can reconnect.

## Categories and scoring

The host can select one or more of General Knowledge, Science, Technology, Sports, Movies, and Logical Reasoning in the lobby. The bank has ten questions per category. A single-category game draws ten questions; games with multiple categories draw up to twelve questions in a balanced mix. A question is not repeated within a game, and the draw is randomized for replay.

Correct standard answers start at 100 points plus a speed bonus. Speed Round uses a shorter eight-second timer and a larger speed bonus. Bonus Round doubles the round’s points. Double Points is applied by the server to the next correct answer; 50/50 removals are sent only to the player who used it; Time Freeze extends the server’s shared deadline. Each player can use each power-up once per game.

## Checks

- `npm test` runs server-side tests for room creation/joining, category selection and bank coverage, answer validation, server-side power-up rules, Speed and Bonus Round scoring, results, replay, and host handoff after disconnect.
- With a server running, `GAME_URL=http://localhost:3001 npm run test:live` connects three independent Socket.IO clients and checks category setup, shared question/deadline/score updates, all three power-ups, late joining, and next-round eligibility. On PowerShell set it first with `$env:GAME_URL = "http://localhost:3001"`.
- `npm run build` creates the production frontend bundle in `dist/`.

## Production start

Build the frontend with `npm run build`, then run `npm start` with `NODE_ENV=production`. Express serves the built app and Socket.IO from one web service. The server uses in-memory rooms, so a process restart ends active games. A public launch needs a deployed Node service with WebSocket support and a configured public URL; this project has not been deployed.

## Deploy on Render as one web service

Render needs this project in a GitHub repository. In the Render dashboard, create a **Web Service** from that repository, then set the project root directory (leave blank when this folder is the repository root), build command `npm ci && npm run build`, and start command `npm start`. Add the environment variable `NODE_ENV=production`. Leave the service port to Render’s `PORT` variable; the server reads it automatically. Set the health-check path to `/health` if Render asks for one, then deploy. Keep it to one running instance: rooms are held in memory and are not shared between separate server instances. The Express service serves the Vite `dist` files and Socket.IO from the same public origin, so no separate frontend service or CORS URL is required. After deployment, open the generated `https://<service-name>.onrender.com` URL and create a room; use a second browser session to join and check the lobby, question, timer, and scoreboard. A deployment is verified only after those public-URL checks pass.

Render's Free web services can spin down after 15 minutes without inbound traffic and take about a minute to start again. A restart or spin-down ends active in-memory rooms. For a scheduled game challenge, wake the URL beforehand and consider a service plan that stays running if that delay or room reset would be disruptive.
