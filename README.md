# Skyline Courier

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Janetide/flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Janetide/flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A complete, original flight game that plays offline in a desktop browser.
Fly the Kestrel K-2, a small prop courier plane, over a procedural valley:
chase view or cockpit view, lit instruments, a runway and glowing rings
ahead, and three missions that ask for different kinds of flying.

## How to play

Serve the game and open it in a desktop browser:

```sh
node serve.mjs
# open http://localhost:8080
```

No network is needed once the page loads: every file it uses is under
`game/`, and every sound is synthesized in code with WebAudio.

| Control | What it does |
| --- | --- |
| W / ↑, S / ↓ | Pitch up / down |
| A / ←, D / → | Bank left / right |
| Shift / Ctrl, mouse wheel | Throttle up / down |
| Q / E | Rudder |
| Hold mouse | Steer by pointer position |
| G | Landing gear up / down |
| B | Brake (on the ground) |
| C | Chase / cockpit camera |
| P | Pause |
| R | Restart the mission |
| M | Back to the menu |
| X | Sound on / off |

## Missions

1. **Ring Run** — fly through 8 glowing rings in order before the fuel
   runs out. Gentle banks win: hard turns bleed speed.
2. **Valley Landing** — take off, circle the valley and land on the runway.
   Gear down, under 170 km/h, sink under 4.5 m/s, wings level.
3. **Courier Dash** — race through 5 delivery gates against the clock.
   Each gate adds 20 seconds.

Fuel burns faster at full throttle and while climbing hard, and damage comes
from hard landings, scraping rings and hitting terrain. A stall drops the
nose: throttle up and push down to recover.

## Screenshots

`1-cover.jpg` is the ring run mid-flight; `2-takeoff.jpg` is the takeoff
roll; `3-landing.jpg` is the final approach; `4-cockpit.jpg` is the cockpit
view low over the meadow. All four are real renders of the game's own code,
taken in headless Chromium with `?shot=…&seed=…` (`shots.mjs`).

## Files

- `game/index.html` — the page; loads `game/src/main.js` as a module.
- `game/src/config.js` — every tuning number in one place.
- `game/src/random.js` — seeded RNG and value noise for the world.
- `game/src/terrain.js` — the valley heightfield, runway, trees, towns,
  clouds, ring and gate courses.
- `game/src/physics.js` — the flight model: throttle, lift, stall, turns,
  landings, fuel and damage.
- `game/src/aircraft.js` — the Kestrel, drawn in canvas paths, and the
  chase / cockpit cameras.
- `game/src/render.js` — sky, projected terrain carpet, runway, rings,
  trees, houses and clouds.
- `game/src/hud.js` — airspeed and altitude tapes, compass tape, artificial
  horizon, throttle / fuel / damage bars, mission panel and timer.
- `game/src/missions.js` — the three missions: setup, objectives, scoring.
- `game/src/audio.js` — synthesized engine, wind and event sounds.
- `game/src/input.js` — keyboard and mouse input.
- `game/src/shots.js` — screenshot staging for the four cover shots.
- `game/src/main.js` — boot, the fixed-step loop and the six screens.
- `main.ts` — hands the game in: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json` with `buildDossier`.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

## License

MIT — see `LICENSE`.
