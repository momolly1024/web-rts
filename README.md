# Lords at War

English | [繁體中文](README.zh-TW.md)

An original medieval real-time strategy prototype: single player against the computer, plain
JavaScript and HTML5 Canvas, no dependencies and no build step.

## Run it

Double-click `index.html` (`file://` works). A desktop browser such as Chrome or Edge with a
mouse and keyboard is recommended.

## How to play

- You are the Blue lord (top left of the map); the opponent is the Red lord (bottom right).
  Both halves of the map are point-symmetric.
- You start with a Town Center, 4 villagers, 200 food, 200 wood and 100 gold.
- Destroy **every finished enemy Town Center** to win. You lose when all of your finished
  Town Centers are gone (unfinished ones do not count).
- The enemy waits for a grace period before attacking, and later waves grow. The grace period
  and army size depend on the difficulty.

| Building | Cost | Purpose |
|------|------|------|
| Town Center | 300 wood, 100 gold | Trains villagers, receives resources, +5 population |
| House | 50 wood | +5 population (total limit 50) |
| Barracks | 150 wood | Trains swordsmen and archers |

| Unit | Cost | Traits |
|------|------|------|
| Villager | 50 food | Gathers and builds; weak fighter, does not retaliate on its own |
| Swordsman | 60 food, 20 gold | Tough melee unit; x1.4 damage against ranged units |
| Archer | 40 wood, 35 gold | Range 4.5; x1.25 damage against infantry, slow against buildings |

Other rules: every builder after the first works at half speed; villagers who finish a building
help at a nearby site or return to gathering; switching resource drops the current load;
cancelling a building site or a unit in training refunds it in full.

## Difficulty

Pick a difficulty on the start screen or in the Restart dialog. The default is Normal; Restart
preselects the current game's difficulty (reloading the page returns to Normal). The current
difficulty is shown in the top bar. Difficulty **only changes how the computer behaves**. It gets
no extra resources or combat stats, and it can act only through the same command interface as you.

| Parameter (`js/data.js`) | Easy | Normal | Hard |
|------|------|------|------|
| Grace period `graceTime` (s) | 480 | 300 | 240 |
| Think interval `thinkInterval` (s) | 2.5 | 1.0 | 0.5 |
| Villager target `villagerTarget` | 10 | 14 | 18 |
| First wave `attackSize` | 4 | 6 | 8 |
| Growth per wave `waveGrowth` | 1 | 2 | 3 |
| Largest wave `attackSizeMax` | 8 | 14 | 20 |
| Minimum gap between waves `waveInterval` (s) | 150 | 75 | 55 |
| Army limit `armyMax` | 10 | 18 | 26 |
| Barracks limit `maxBarracks` | 1 | 2 | 3 |

## Language

The interface is available in English and Traditional Chinese. Switch at any time with the
language button on the start screen or in the top bar; the game keeps running as it was.
The default follows the browser language (Traditional Chinese for any `zh` locale, otherwise
English). Your choice is saved in `localStorage`. Where that is unavailable (some browsers under
`file://`, or private mode) switching still works but is not remembered.

## Controls

| Input | Action |
|------|------|
| Left-click / drag | Select (Shift adds, double-click selects the same type on screen) |
| Right-click | Move, gather, attack, help build or deliver, depending on the target |
| Arrow keys, WASD, mouse at the window edge | Scroll |
| H, B, T | With villagers: build House, Barracks, Town Center (Shift + click to keep placing) |
| Q, E | Town Center: Villager. Barracks: Swordsman, Archer |
| F | Attack move |
| X | Stop, or cancel a building site |
| Esc | Cancel placement or order, clear selection, close a dialog |
| P, Space | Pause and resume |
| F1 | Help |
| Click an item in the training queue | Cancel it and get a refund |

## Roadmap

None of the following is implemented yet. These are plans and may change.

- **B1**: isometric view, minimap (click to move the camera), fog of war
- **B2**: Town Center age upgrades (Frontier → Town → Castle, unlocking new buildings, units and
  technologies), more unit counters (spearmen, cavalry), arrow towers and stone walls
- **B3**: smarter AI (scouting, expanding, rebuilding the Town Center, adapting its army to yours)
- **Under consideration**: drop-off buildings such as lumber camps and mills, rally points,
  control groups, sound, saving

## Tests

```
node tests/run-tests.js
```

Only Node.js is needed. The tests load the simulation and language files in the `<script>` order
of `index.html`.

## Layout

```
index.html              Page skeleton and script order
css/style.css           Interface styles
js/namespace.js         Global RTS namespace and helpers
js/data.js              Tables: units, buildings, resources, counters, difficulty and AI settings
js/i18n/                Interface text
  zh-TW.js              Traditional Chinese strings
  en.js                 English strings
  i18n.js               Language detection, switching and lookup
js/sim/                 Simulation (no DOM, no display text)
  map.js                Tile grid, walkability, free-tile search
  pathfind.js           A* pathfinding
  world.js              Entities, resources, population and queries
  mapgen.js             Symmetric random maps
  movement.js           Path following, re-planning, spreading out
  gather.js             Gathering and delivery
  construction.js       Placement checks and building
  production.js         Training queues
  combat.js             Damage, chasing, retaliation, attack move
  orders.js             Unit order state machine
  commands.js           Command interface shared by player and AI
  game.js               Fixed-step update and victory check
js/ai/                  Computer opponent (acts only through commands)
  economy.js            Villager jobs, building, training
  ai.js                 Difficulty settings, defence and attack waves
js/view/                Rendering and input
  camera.js             The only place that converts world and screen coordinates
  sprites.js            Original vector art
  render.js             Drawing
  actions.js            Command buttons and selection details
  hud.js                Top bar, panel, dialogs
  input.js              Mouse, keyboard, scrolling
js/main.js              Start-up and main loop
tests/                  Node tests
```

Code comments and test names are written in Traditional Chinese.

## Extending

- **New text**: add the same key to `zh-TW.js` and `en.js`. Simulation errors are returned as
  codes and shown through `error.<code>`.
- **Isometric view**: change the conversion and limits in `camera.js` and redraw `sprites.js`.
  Ground and footprints are already drawn as four-point polygons and sprites are sorted by screen
  height. The simulation needs no change.
- **Minimap**: add `js/view/minimap.js` reading `world.map` and `world.entities`.
- **Fog of war**: units and buildings already have `vision`. Add visibility data to the
  simulation, then filter in `render.js`, in picking (`input.js`) and in AI queries
  (`ai.js`, `economy.js`).
- **Ages**: add requirements and research to `data.js`; the queue in `production.js` can take
  research items.
- **More units**: add them and their `damageBonus` to `data.js`, art to `sprites.js`, names to the
  language files, and include them in the AI's training choice (`economy.js`).
- **Smarter AI**: keep using `RTS.commands.issue`; do not modify world state directly.

## Known limits

- The AI sees the whole map, including your Town Center, and does not scout. The three
  difficulties differ only in settings, not tactics.
- The AI does not rebuild a destroyed Town Center (losing the only one ends the game).
- Moving units do not collide, so they can overlap on the march; they spread out once still.
- There is no repairing, and buildings cannot defend themselves.
- Gold is limited. In long games it runs out and only villagers (who cost no gold) can still be trained.
- Designed for desktop input; touch is not supported.
