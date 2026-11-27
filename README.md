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
  For now stone can only be sold at the Market; arrow towers and walls in batch 4 will use it.
- Destroy **every finished enemy Town Center** to win. You lose when all of your finished
  Town Centers are gone (unfinished ones do not count).
- The enemy waits for a grace period before attacking, and later waves grow. The grace period
  and army size depend on the difficulty.
- Hidden difficulty "Peaceful World": click Hard five times in the difficulty list to reveal it.
  The computer builds up and defends itself but never attacks.

| Building | Cost | Purpose |
|------|------|------|
| Town Center | 300 wood, 100 gold | Trains villagers, receives every resource, researches Handcarts, +5 population |
| House | 50 wood | +5 population (total limit 50) |
| Barracks | 150 wood | Trains swordsmen, archers and spearmen (Feudal) |
| Archery Range (Feudal) | 150 wood | Trains skirmishers and longbowmen; researches the longbowman upgrade |
| Stable (Feudal) | 150 wood | Trains cavalry |
| Arrow Tower (Feudal) | 25 wood, 125 stone | One tile; shoots enemy units within 7 tiles |
| Stone Wall (Feudal) | 5 stone per tile | Blocks the way; click the start, then the end, to lay a whole line |
| Gate (Feudal) | 30 stone | Your units pass, enemies cannot; can replace a tile of your own wall |
| Temple (Castle) | 175 wood | Trains healers |
| Siege Workshop (Castle) | 200 wood | Trains battering rams |
| Blacksmith | 130 wood | Researches attack and armor |
| Lumber Camp | 100 wood | Receives wood; researches Keen axes |
| Mining Camp | 100 wood | Receives gold and stone; researches Gold digging and Stone cutting |
| Mill | 100 wood | Receives food; researches Rich harvest; queues farm reseeds |
| Farm | 60 wood | Needs a finished Mill; one villager farms it, 175 food each |
| Market | 175 wood | Buys and sells food, wood and stone for gold |
| Pen | 120 wood | With 2 white sheep inside, a black lamb is born every 50 s; lambs become white sheep after 60 s |

| Unit | Cost | Traits |
|------|------|------|
| Villager | 50 food | Gathers and builds; weak fighter, does not retaliate on its own |
| Swordsman | 60 food, 20 gold | Tough melee unit; x1.4 damage against ranged units |
| Spearman (Feudal) | 35 food, 25 wood | Cheap; x5.5 damage against cavalry, loses to swordsmen and archers |
| Cavalry (Feudal) | 80 food, 50 gold | Fast, tough, high pierce armor; runs down archers |
| Skirmisher (Feudal) | 25 food, 35 wood | No gold; x3.5 damage against archers, high pierce armor; weak in melee |
| Healer (Castle) | 100 gold | Cannot attack; heals nearby wounded allies when idle (1.5 HP/s) |
| Battering Ram (Castle) | 160 wood, 75 gold | Attacks buildings only and tears them down fast; arrows barely hurt it; slow |
| Longbowman (Feudal, Archery Range) | 50 wood, 45 gold | Outranges (5.5), outdamages and outlasts archers |
| Archer | 40 wood, 35 gold | Range 4.5; x1.25 damage against infantry, slow against buildings |

Other rules: every builder after the first works at half speed; villagers who finish a building
help at a nearby site or return to gathering; a villager carrying a load who is told to gather
something else, build, repair or hunt first delivers it to the nearest building that accepts it (more of the same resource just continues;
move, attack and shelter orders happen at once and keep the load, as does any order when there is no
Town Center to deliver to);
cancelling a building site or a unit in training refunds it in full.
Buildings cannot be moved; finished ones (except Town Centers and farms) can be demolished for 75% of
their cost, scaled down further by lost hit points, plus a full refund of their queue.

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

### Ages

- Three ages: Dark → Feudal → Castle. Select the Town Center and press R; it costs food (plus gold for
  the Castle Age) and time, and the Town Center cannot train villagers meanwhile.
- Feudal Age: needs two of Barracks, Lumber Camp, Mining Camp and Mill; 400 food, 60 s.
- Castle Age: needs two of Blacksmith, Archery Range, Stable and Market; 700 food, 200 gold, 90 s.
- Feudal unlocks the Blacksmith, Market, Archery Range, Stable, Spearmen, Skirmishers and Handcarts, plus level 2
  economy upgrades and level 1 Blacksmith upgrades.
- Castle unlocks level 3 economy upgrades and level 2 Handcarts and Blacksmith upgrades.
- The top bar shows your age; select the Town Center to see what the next age needs.
- Counters: cavalry beat archers, archers beat spearmen, spearmen beat cavalry, skirmishers beat
  archers; swordsmen beat archers and skirmishers up close and also beat spearmen.

### Defense and siege

- **Arrow towers** shoot the nearest enemy unit in range once finished. In the Castle Age, press Q at a
  tower for Stronger towers: +3 attack and +1 range for all your towers.
- **Stone walls**: with villagers press Z, click the start and then the end; a site goes on every tile
  of the line (as far as your stone lasts) and villagers build them from the nearest one.
- **Gates**: press U and place one on open ground or on a tile of your own wall to replace it. Your
  units walk through; enemies cannot.
- An army that cannot reach its target because of walls attacks the enemy building in its way.
- **Battering rams** only attack buildings and healers cannot attack, so right-clicking an enemy unit
  does nothing for them.

### Unit upgrades

Researched at the training building; existing and future units of that type get stronger, change
name and wear a plume (white for the first level, gold for the second).

| Upgrade (building, key) | Age | Effect | Cost |
|------|------|------|------|
| Swordsman → Heavy Swordsman (Barracks R) | Feudal | +15 HP, +2 attack, +1 armor | 100 food, 40 gold, 30 s |
| Heavy Swordsman → Elite Swordguard (Barracks R) | Castle | +20 HP, +2 attack, +1 armor | 200 food, 100 gold, 45 s |
| Longbowman → Elite Longbowman (Archery Range R) | Castle | +10 HP, +1 attack, +1 range | 150 food, 100 gold, 40 s |
| Cavalry → Heavy Cavalry (Stable E) | Castle | +40 HP, +3 attack, +1 armor | 250 food, 150 gold, 50 s |

### Economy

- **Drop-off buildings**: villagers deliver to the nearest building of yours that accepts what they
  carry. A lumber camp or mining camp next to woods or a mine saves a lot of walking.
- **Farms**: need a finished Mill. Units can walk across them and one villager farms each one at a
  time; the villager who builds a farm starts farming it, and others sent to a busy farm look for an
  empty one. A farm disappears when its food runs out.
- **Reseeds**: select a Mill and press E to pay for one farm in advance (up to 30), X cancels one
  with a refund. When any farm runs out, one reseed is used and the farm refills in place.
- **Economy upgrades** (researched through the building's queue; they affect villagers and farms only):

| Upgrade (building) | Effect | Level 1 | Level 2 | Level 3 |
|------|------|------|------|------|
| Rich harvest (Mill) | Food in farms finished or reseeded later | +60: 75 food, 75 wood, 20 s | +75: 125 food, 125 wood, 35 s | +100: 250 wood, 150 gold, 50 s |
| Keen axes (Lumber Camp) | Woodcutting speed | +15%: 100 food, 50 wood, 25 s | +15%: 150 food, 100 wood, 35 s | +10%: 300 food, 200 wood, 50 s |
| Gold digging (Mining Camp) | Gold mining speed | +15%: 100 food, 75 wood, 25 s | +15%: 200 food, 150 wood, 40 s | — |
| Stone cutting (Mining Camp) | Stone mining speed | +15%: 100 food, 75 wood, 25 s | +15%: 200 food, 150 wood, 40 s | — |
| Handcarts (Town Center) | Villager carry and speed | +3 carry, +10% speed: 150 food, 50 wood, 30 s | +5 carry, +10% speed: 250 food, 150 wood, 45 s | — |

- **Market**: buy or sell 100 food, wood or stone for gold. The base price is 100 gold; buying costs
  15% more and selling pays 15% less. Each purchase raises that price by 6 and each sale lowers it
  by 6 (range 20–300), then it drifts back by 0.4 per second. Each side has its own prices.

### Pens

- Select your sheep and right-click a pen to lead them in. Once inside they cannot leave: move orders
  only move them around within the pen. Villagers can walk in to slaughter white sheep.
- Enemies cannot take penned sheep (they can still kill them). If the pen is demolished or destroyed,
  the sheep are free again.
- With at least 2 of your white sheep inside, a black lamb is born every 50 s; with fewer the timer
  pauses (progress is kept).
- After 60 s a lamb becomes an ordinary white sheep worth 90 food when slaughtered. Lambs cannot be
  slaughtered (villagers just walk to them) and leave no meat if enemy soldiers kill them.
- No more lambs are born while 6 of your sheep (lambs included) are inside; slaughter or lead one out
  and the next arrives right away.
- Sheep outside a pen are like wild ones: an enemy unit can take them when none of yours is nearby.

### Cursor hints

With units selected, the cursor over a target shows what a right-click will do: an axe (cut wood),
a pickaxe (mine gold or stone), a basket (berries, farms, meat), a spear (hunt or slaughter), a sword
(attack), a hammer (build; with a green cross, repair), a sack (deliver), a shield (garrison) or a
fence (lead sheep into a pen). Otherwise it stays the normal cursor (move).

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

### Isometric view

The battlefield is drawn in an isometric view: the map is a diamond, and things lower on screen are
in front and cover what is behind them. Click a building's walls or footprint to select it, and a
tree or deposit by its shape; box selection uses the rectangle on screen. Arrow keys and edge
scrolling move the camera in screen directions.

### Fog of war

Unexplored ground is black. Explored ground you cannot currently see is dimmed and shows the terrain,
resources and buildings as you last saw them, never enemy units. Everything inside the sight range of
your units, buildings and sheep is shown. You cannot select or target what you cannot see (resources
you have seen can still be assigned), and you cannot build on unexplored ground.

The computer follows the same rules: it only uses what it sees and remembers, and sends a scout to
find you.

### Minimap

The bottom-right minimap shows terrain, resources, buildings, units and the current view. Left-click
or drag to move the camera; right-click to move the selected units (press F first to attack-move),
or to set the rally point of a selected training building.

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

## Fishing

With villagers selected, right-click water (the cursor turns into a rod) and they fish from the shore.
Each side has a small pond near home; the ponds in the wild work too. A bite takes 10–40 seconds, and
just before it the float jumps and a "!" appears. Ponds never run dry, but fishing is slower than
berries or farms.

| Catch | Chance | Food |
|------|------|------|
| Old boot | 15% | 0 |
| Small fish | 55% | 8 |
| Big fish | 25% | 20 |
| Golden fish | 5% | 60 |

With a full load (a big catch may exceed it) the villager delivers it to a food drop-off and comes
back. A rally point can be set on water. The computer does not fish.

## Difficulty

Pick a difficulty on the start screen or in the Restart dialog. The default is Normal; Restart
preselects the current game's difficulty (reloading the page returns to Normal). The current
difficulty is shown in the top bar. Difficulty **only changes how the computer behaves**. It gets
no extra resources or combat stats, and it can act only through the same command interface as you.

| Parameter (`js/data.js`) | Easy | Normal | Hard |
|------|------|------|------|
| Grace period `graceTime` (s) | 480 | 360 | 240 |
| Think interval `thinkInterval` (s) | 2.5 | 1.0 | 0.5 |
| Villager target `villagerTarget` | 10 | 14 | 18 |
| First wave `attackSize` | 4 | 6 | 8 |
| Growth per wave `waveGrowth` | 1 | 1 | 3 |
| Largest wave `attackSizeMax` | 8 | 10 | 20 |
| Minimum gap between waves `waveInterval` (s) | 150 | 100 | 55 |
| Army limit `armyMax` | 10 | 14 | 26 |
| Barracks limit `maxBarracks` | 1 | 2 | 3 |
| Army size before research / top level `blacksmith` | 7 / 1 | 6 / 2 | 5 / 2 |
| Repair below / workers `repair` | 40% / 1 | 70% / 2 | 90% / 3 |
| Villagers shelter at raiders `shelter` | 3 within 6 | 2 within 8 | 2 within 10 |
| Wounded soldiers heal below `shelter.woundedBelow` | never | 30% | 50% |
| Hunting `hunt` | sheep only | sheep, deer | sheep, deer, boar (4 villagers) |
| Town Center limit `expand.towns` | 1 | 2 | 2 |
| Villagers / army before expanding `expand` | never expands | 14 / 6 | 15 / 8 |
| Extra villagers with two Town Centers `expand.extraVillagers` | 0 | 4 | 6 |
| Counter-picking strength `counter.bias` | 0 (even mix) | 1 | 3 |
| Remembers enemies it saw `counter.memory` (s) | 60 | 100 | 150 |

On Normal (and Peaceful World, which shares its base settings) the computer grows in long matches:
after 10 minutes its army limit and largest wave each gain 2 per minute, up to 24 and 16 (`ai.late` in
`js/data.js`). Easy and Hard do not change over time. While saving for the Castle Age late in a match it still adds one soldier every 30 seconds (`ai.late.drip`).

When you destroy an enemy Town Center and they still have another, a message says how many are left.

### How the computer expands and adapts

- **Expanding**: on Normal and Hard, once in the Feudal Age with enough villagers and soldiers, the
  computer builds a second Town Center by a distant gold deposit or grove it has seen (or toward the
  middle of the map if it knows none). Both train villagers, and it places drop-off buildings by far
  resources.
- **Rebuilding**: if one of its two Town Centers is destroyed, it rebuilds once it can afford to.
  The victory rule is unchanged: losing every Town Center loses the game at once.
- **Counter-picking**: it remembers the enemy soldiers it saw recently and trains more of the units
  that beat them (the table is `counters` in `js/data.js`). On every difficulty, Spearmen and
  Skirmishers are only trained after it sees what they counter.

## Achievements

Listed when a match ends. The sheep line always shows; the others only when earned. Thresholds are in
`achievements.need` in `js/data.js`.

| Achievement | Condition |
|------|------|
| Sheep property | Always shows how many sheep became yours (the percentage is an estimate) |
| Blitz | Win within 10 minutes |
| Flawless | Win without losing a unit |
| Good Lord | Win without losing a villager (unless Flawless) |
| Battle Hardened | Defeat 30 enemy units |
| Demolition Crew | Raze 10 enemy buildings |
| Moving Up | Reach the Castle Age |
| Second Home | End with 2 finished Town Centers |
| Full House | Train up to the population limit of 50 |
| Labor Violation | Take down 10 enemy villagers |
| Boar Snack | Lose a villager to a wild boar |
| Shepherd's Betrayal | Slaughter 5 of your own sheep |
| Second Thoughts | Demolish your own buildings 3 times |
| Shrewd Trader | Make 10 market trades |
| Miser | End holding 2000 resources in total |
| Pitchforks Only | Win without training a soldier |
| All Talk | Last 5 minutes without training a soldier, and do not win |

## Language

The interface is available in English and Traditional Chinese. Switch at any time with the
language button on the start screen or in the top bar; the game keeps running as it was.
The default follows the browser language (Traditional Chinese for any `zh` locale, otherwise
English). Your choice is saved in `localStorage`. Where that is unavailable (some browsers under
`file://`, or private mode) switching still works but is not remembered.

## Civilizations

Choose one on the start screen or in the Restart dialog (Random by default). The computer always
picks at random, and both are shown at the top left of the battlefield. Each civilization has its
own building style, emblem and top bar color; team colors (blue and red) stay on every roof.

| Civilization | Bonuses | Weakness | Unique unit (Feudal Age) |
|------|------|------|------|
| Greenwood (timber, steep roofs) | Wood gathering +30%; ranged units range +1 | Cavalry health -20 | Ranger (Archery Range, F): fast, far-sighted archer |
| Ironrock (stone, battlements) | Gold and stone gathering +30%; melee armor +2; Arrow Tower range +2 | Villager speed -10% | Stoneguard (Barracks, C): slow, heavily armored infantry |
| Goldplain (thatched domes) | Farm food +120; villager speed +20%; Cavalry and Lancer health +40 | Ranged units range -0.5 | Lancer (Stable, R): fastest rider, strong against archers and villagers |

## Sound

Gathering, building, combat and attack warnings have sounds, synthesized in the browser (no audio
files, no music). Only events on screen are heard, except the warning. The top bar button turns
sound off, and the choice is remembered.

## Controls

| Input | Action |
|------|------|
| Left-click / drag | Select (Shift adds, double-click selects the same type on screen) |
| Right-click | Move, gather, fish, hunt, attack, build, repair, deliver or shelter, depending on the target; with a training building selected, set its rally point |
| Enter | Jump to the fight when under attack |
| Arrow keys, WASD, mouse at the window edge (in fullscreen, keeps scrolling after the mouse moves onto another monitor) | Scroll |
| Mouse wheel | Zoom (90%–130%, centred on the cursor) |
| H, T, L, N, M, C, O, Y | With villagers (Economy page): House, Town Center, Lumber Camp, Mining Camp, Mill, Farm, Pen, Market (Shift + click to keep placing) |
| B, R, V, K, I, Z, U, J, E | With villagers (Military page): Barracks, Archery Range, Stable, Blacksmith, Arrow Tower, Stone Wall, Gate, Temple, Siege Workshop |
| Tab | With villagers: switch the build menu between Economy and Military (hotkeys work on both) |
| Q, E, R | Town Center: Villager, Handcarts, next age. Barracks: Swordsman Q, Archer E, Spearman F. Archery Range: Skirmisher Q, Longbowman E. Stable Q: Cavalry. Lumber Camp Q: Keen axes. Mining Camp: Gold digging, Stone cutting |
| Q, E, X | Mill: Rich harvest, queue a reseed, cancel one reseed |
| Q, E, R / Z, C, V | Market: buy food, wood, stone / sell food, wood, stone |
| Q, E, R, F | Blacksmith: melee attack, ranged attack, melee armor, ranged armor |
| G, U | Shelter in the Town Center, release everyone |
| Ctrl / Alt + digit, digit | Save and select a control group (twice to jump there) |
| `.` (period) / Shift + `.` | Select the next idle villager / all idle villagers, and move the camera |
| Idle villagers button | Click selects all idle villagers; Shift + click selects them one at a time |
| F | Attack move |
| X | Stop, or cancel a building site |
| Delete (Mac: Backspace) | Demolish the selected building (partial refund) |
| Esc | Cancel placement or order, clear selection, close a dialog |
| P, Space | Pause and resume |
| F1 | Help |
| Click an item in the queue | Cancel training or research and get a refund |

## Roadmap

None of the following is implemented yet. These are plans and may change.

- **Under consideration**: more mounted units (scout cavalry, cavalry archers, camels), trade carts, saving, selectable formations, other victory conditions,
  individual building upgrades

## Tests

```
node tests/run-tests.js          # full, a few minutes
node tests/run-tests.js --quick  # skips whole-match simulations
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
  civs.js               Civilization bonuses
  mapgen.js             Symmetric random maps
  movement.js           Path following, re-planning, spreading out
  gather.js             Gathering and delivery
  fish.js               Fishing
  construction.js       Placement checks and building
  repair.js             Repairing
  garrison.js           Sheltering and release
  rally.js              Rally points
  research.js           Upgrades (military and economy)
  farm.js               Farm food, farmers and reseeds
  market.js             Market prices and trading
  pen.js                Pens, growing lambs, demolishing buildings
  animals.js            Animal behaviour and hunting
  wander.js             Idle strolling
  fog.js                Fog of war and memory
  production.js         Training and research queues
  alerts.js             Last place each player was attacked
  formation.js          Front and back rows for mixed groups
  combat.js             Damage, chasing, retaliation, attack move, breaching walls
  towers.js             Arrow towers shooting
  heal.js               Healers
  orders.js             Unit order state machine
  commands.js           Command interface shared by player and AI
  game.js               Fixed-step update and victory check
js/ai/                  Computer opponent (acts only through commands)
  economy.js            Villager jobs, building, training
  camps.js              Drop-off buildings, mill and farms, economy upgrades
  age.js                Advancing the age (required buildings, saving up)
  tech.js               Blacksmith and research
  care.js               Repairing and sheltering
  hunt.js               Herding and hunting
  scout.js              Scouting
  expand.js             Second Town Center and rebuilding
  counter.js            Army mix based on the enemies it saw
  ai.js                 Difficulty settings, defence and attack waves
js/view/                Rendering and input
  camera.js             The only place that converts world and screen coordinates (isometric)
  depth.js              Draw order, click and box-selection hit tests
  sprites.js            Original vector art: resources and units
  sprites-civ.js        Building styles of each civilization
  sprites-buildings.js  Building and construction-site art
  sprites-animals.js    Animal art
  minimap.js            Minimap
  groups.js             Control groups
  scenery.js            Decorative scenery beyond the map edge
  ground.js             Ground and fog drawing
  fishing.js            Fishing rod, float and catch animation
  render.js             Entities and on-field markers
  alert.js              When to warn about attacks
  upgrade-info.js       Research names and effect descriptions
  actions.js            Command buttons and selection details
  tooltip.js            Hover box for command buttons
  civ-picker.js         Civilization cards, emblems, on-field label and top bar color
  sound-events.js       Which sounds the current frame should make
  sound.js              Synthesized sound effects and the on/off setting
  hud.js                Top bar, panel, dialogs
  input.js              Mouse, keyboard, scrolling
  cursor.js             Cursor icons for the right-click action
js/main.js              Start-up and main loop
tests/                  Node tests
```

Code comments and test names are written in Traditional Chinese.

## Extending

- **New text**: add the same key to `zh-TW.js` and `en.js`. Simulation errors are returned as
  codes and shown through `error.<code>`.
- **New building art**: describe it in `sprites-buildings.js` with footprint coordinates plus a
  height, and register its wall height (click area) and top (health bar) in `depth.js`. Draw order
  sorts by footprint center, which is only guaranteed for square footprints.
- **Changing the view**: the projection lives in `project` / `unproject` in `camera.js`; check the
  building art and draw order along with it.
- **Ages and technologies**: add them to `data.js` and extend `research.js`.
- **More units**: add them and their `damageBonus` to `data.js`, art to `sprites.js`, names to the
  language files, and include them in the AI's training choice (`economy.js`) and its `counters` table (`data.js`).
- **Smarter AI**: keep using `RTS.commands.issue`; do not modify world state directly.

## Known limits

- The AI does not use the Market, pens or demolition, and builds no walls, gates or temples (no
  healers). It only prepares for the Castle Age with a full army, so rams show up in long games.
- Buildings do not change appearance with the age.
- With villagers selected there are many build buttons; in a short window, Garrison and Stop need
  the panel scrolled (their hotkeys always work).
- Pathfinding uses the real map, so units route around obstacles they have not seen.
  difficulties differ only in settings, not tactics.
- While saving for the Castle Age the AI still spends food on upgrades, so it may take very long.
- Moving units do not collide, so they can overlap on the march; they spread out once still.
- Buildings cannot defend themselves, including a Town Center full of units.
- Repairing stops silently when resources run out.
- Wild animals never attack first, and the AI does not avoid boar it is not hunting.
- Gold is limited. In long games it runs out and only villagers (who cost no gold) can still be trained.
- Designed for desktop input; touch is not supported.
