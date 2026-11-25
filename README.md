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
- You start with a Town Center, 4 villagers, 200 food, 200 wood, 100 gold and no stone.
- Grey rocks (stone) can be gathered like other resources (4 near each start, more in the wild).
  Nothing costs stone yet.
- Destroy **every finished enemy Town Center** to win. You lose when all of your finished
  Town Centers are gone (unfinished ones do not count).
- The enemy waits for a grace period before attacking, and later waves grow. The grace period
  and army size depend on the difficulty.

| Building | Cost | Purpose |
|------|------|------|
| Town Center | 300 wood, 100 gold | Trains villagers, receives resources, +5 population |
| House | 50 wood | +5 population (total limit 50) |
| Barracks | 150 wood | Trains swordsmen and archers |
| Blacksmith | 130 wood | Researches attack and armor |

| Unit | Cost | Traits |
|------|------|------|
| Villager | 50 food | Gathers and builds; weak fighter, does not retaliate on its own |
| Swordsman | 60 food, 20 gold | Tough melee unit; x1.4 damage against ranged units |
| Archer | 40 wood, 35 gold | Range 4.5; x1.25 damage against infantry, slow against buildings |

Other rules: every builder after the first works at half speed; villagers who finish a building
help at a nearby site or return to gathering; a villager carrying a load who is told to gather
something else, build, repair or hunt delivers it first (more of the same resource just continues;
move, attack and shelter orders happen at once and keep the load, as does any order when there is no
Town Center to deliver to);
cancelling a building site or a unit in training refunds it in full.

## Features

### Blacksmith upgrades

Two levels per line, researched one at a time through the building's queue. They apply to all of
your current and future units of that class (villagers are unaffected).

| Upgrade | Effect per level | Level 1 | Level 2 |
|------|------|------|------|
| Melee attack (swordsman) | attack +2 | 100 food, 50 gold, 30 s | 170 food, 100 gold, 45 s |
| Ranged attack (archer) | attack +1 | 100 wood, 50 gold, 30 s | 170 wood, 100 gold, 45 s |
| Melee armor (swordsman) | both armors +1 | 90 food, 40 gold, 25 s | 150 food, 80 gold, 40 s |
| Ranged armor (archer) | both armors +1 | 90 wood, 40 gold, 25 s | 150 wood, 80 gold, 40 s |

### Repairing

Right-click a damaged finished building with villagers. Health returns at 80% of building speed
(helpers after the first work at half rate) and is paid for as it goes: restoring a building from
zero costs half its price. Work stops when you run out of resources. Afterwards villagers go back
to what they were gathering.

### Sheltering in the Town Center

Select units and press G, or right-click your Town Center. It holds 10 units, which heal 1.5
health per second and still count toward population. U releases everyone; villagers resume their
gathering. If no free space exists around the building, units stay inside. If the building is
destroyed, they escape onto its rubble with their current health. A villager carrying resources
delivers them first, and one right-clicking a damaged Town Center repairs it instead.

### Rally points

With a Town Center or Barracks selected, right-click the ground or a resource. New units go there;
villagers sent to a resource start gathering (or pick a nearby one of the same kind if it is gone).
Right-click the building itself to clear it.

### Control groups

Ctrl + digit or Alt + digit saves the selection, the digit selects it, and pressing it twice
centers the camera. Some browsers keep Ctrl + digit for switching tabs; use Alt + digit there.

### Animals

Each side gets the same animals in mirrored positions.

| Animal | Meat | Behaviour |
|------|------|------|
| Sheep | 90 food | Belongs to whoever comes within 3 tiles (marked with a ring and flag in the owner's color). Select it and right-click the ground to move it, or box-select it together with villagers. Cannot be taken while its owner stands next to it |
| Deer | 130 food | Runs when startled, then needs a rest |
| Wild boar | 260 food | Fights back; one villager will lose, hunt it in a group |

Idle animals stroll slowly near where they started and pause often. Your own sheep stay close to
where you last sent them.

Right-click an animal with villagers to hunt it. The carcass is a food source that they carry home.

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
| Army size before research / top level `blacksmith` | 7 / 1 | 6 / 2 | 5 / 2 |
| Repair below / workers `repair` | 40% / 1 | 70% / 2 | 90% / 3 |
| Villagers shelter at raiders `shelter` | 3 within 6 | 2 within 8 | 2 within 10 |
| Wounded soldiers heal below `shelter.woundedBelow` | never | 30% | 50% |
| Hunting `hunt` | sheep only | sheep, deer | sheep, deer, boar (4 villagers) |

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
| Right-click | Move, gather, hunt, attack, build, repair, deliver or shelter, depending on the target; with a training building selected, set its rally point |
| Arrow keys, WASD, mouse at the window edge | Scroll |
| H, B, K, T | With villagers: build House, Barracks, Blacksmith, Town Center (Shift + click to keep placing) |
| Q, E | Town Center: Villager. Barracks: Swordsman, Archer |
| Q, E, R, F | Blacksmith: melee attack, ranged attack, melee armor, ranged armor |
| G, U | Shelter in the Town Center, release everyone |
| Ctrl / Alt + digit, digit | Save and select a control group (twice to jump there) |
| `.` (period) / Shift + `.` | Select the next idle villager / all idle villagers, and move the camera |
| Idle villagers button | Click selects all idle villagers; Shift + click selects them one at a time |
| F | Attack move |
| X | Stop, or cancel a building site |
| Esc | Cancel placement or order, clear selection, close a dialog |
| P, Space | Pause and resume |
| F1 | Help |
| Click an item in the queue | Cancel training or research and get a refund |

## Roadmap

None of the following is implemented yet. These are plans and may change.

- **Batch 2**: minimap, fog of war, isometric view
- **Batch 3**: lumber camp and mining camp, mill, farms, economic technologies, market
- **Batch 4**: age upgrades and unit tiers; archery range, stable, spearmen, cavalry; arrow towers,
  walls and gates; healer units; siege weapons
- **Batch 5**: AI scouting, expanding and rebuilding, adapting its army
- **Under consideration**: sound, saving, formations, multiple civilizations, other victory conditions

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
  repair.js             Repairing
  garrison.js           Sheltering and release
  rally.js              Rally points
  research.js           Upgrades
  animals.js            Animal behaviour and hunting
  wander.js             Idle strolling
  production.js         Training and research queues
  combat.js             Damage, chasing, retaliation, attack move
  orders.js             Unit order state machine
  commands.js           Command interface shared by player and AI
  game.js               Fixed-step update and victory check
js/ai/                  Computer opponent (acts only through commands)
  economy.js            Villager jobs, building, training
  tech.js               Blacksmith and research
  care.js               Repairing and sheltering
  hunt.js               Herding and hunting
  ai.js                 Difficulty settings, defence and attack waves
js/view/                Rendering and input
  camera.js             The only place that converts world and screen coordinates
  sprites.js            Original vector art
  sprites-animals.js    Animal art
  groups.js             Control groups
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
- **Ages and technologies**: add them to `data.js` and extend `research.js`.
- **More units**: add them and their `damageBonus` to `data.js`, art to `sprites.js`, names to the
  language files, and include them in the AI's training choice (`economy.js`).
- **Smarter AI**: keep using `RTS.commands.issue`; do not modify world state directly.

## Known limits

- The AI does not gather stone.
- The AI sees the whole map, including your Town Center, and does not scout. The three
  difficulties differ only in settings, not tactics.
- The AI does not rebuild a destroyed Town Center (losing the only one ends the game).
- Moving units do not collide, so they can overlap on the march; they spread out once still.
- Buildings cannot defend themselves, including a Town Center full of units.
- Repairing stops silently when resources run out.
- Wild animals never attack first, and the AI does not avoid boar it is not hunting.
- Gold is limited. In long games it runs out and only villagers (who cost no gold) can still be trained.
- Designed for desktop input; touch is not supported.
