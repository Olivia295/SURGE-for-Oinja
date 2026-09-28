<div align="center">
  <img src="public/favicon.svg" alt="SURGE lightning emblem" width="56" height="56" />
  <h1>SURGE for Oinja</h1>
  <p><strong>Into the swarm. Beyond the limit.</strong></p>
  <p>A third-person survival game set in the Oinja universe.<br />Build electrical combos, take on mechanical swarms, and keep the circuit alive.</p>
  <p><a href="https://oinja-game.vercel.app"><strong>Play in your browser ↗</strong></a> · <a href="https://oinja-website.vercel.app">Explore the Oinja universe ↗</a></p>
  <p><strong>English</strong> · <a href="README.zh-CN.md">简体中文</a></p>
</div>

[![The SURGE game menu, starting abilities, and Old Harbor Workshop](public/preview.jpg)](https://oinja-game.vercel.app)

> [!NOTE]
> Made for a desktop browser and keyboard. No installation or account is needed to play. Mobile touch controls are not supported.

## Make the build your own

Start with any of **eight abilities**. Fill **four ability slots**, add an independent **support companion or weapon**, and turn individual attacks into a connected build.

- **Abilities that work together.** Pull enemies into Shock Fist, discharge conductive marks with explosions, or use Chain Lightning to energize Volt Mist. Five automatic links change how paired abilities behave.
- **Choices that change the run.** Two evolution branches per ability, 14 mods, rerolls, and replacements that inherit your investment.
- **A short survival arc.** Five enemy types, elite encounters, and a boss at 12 minutes. Defeat it before the 15-minute limit. Standard difficulty includes one emergency revival; Danger I and II offer more pressure.
- **Power beyond your four slots.** Map facilities can unlock support such as Workshop Titan, Critical Tempest, and Orbital Cannon.

Attacks fire automatically. Your job is to move, dodge, shape the crowd, choose your upgrades, and time **Sync Burst**.

## Two places to survive

| Old Harbor Workshop | Tidal Observatory |
| --- | --- |
| Alleys, cargo yards, shopfronts, ramps, and passages beneath raised walkways. | Conservatories, water gardens, observation instruments, and an elevated ring connected by broad ramps. |
| Restore power, open shortcuts, and turn industrial equipment against the swarm. | Circle the courtyards, travel between levels, and use the open routes to gather enemies. |

Each map has **12 facility locations**, with one of each of six facility types selected per run. Repair stations, power relays, escort carts, hoists, conveyors, and guarded caches give you reasons to leave your usual route.

![Tidal Observatory gameplay with a support unit](docs/images/observatory.jpg)

Four optional random encounters add a different decision along the way:

| Encounter | What you do |
| --- | --- |
| Magnetic Hunt | Keep a kill streak going inside the marked area. |
| Battery Run | Reach a sequence of collection points. |
| Overload Exchange | Trade shields and a little health for a short risk window, then a damage boost. |
| Fault Echoes | Track down two marked elites before time runs out. |

Rewards include healing, shields, Sync charge, and temporary buffs. These encounters do not take up your support slot.

## Controls

| Key | Action |
| --- | --- |
| **WASD** / **Arrow keys** | Move |
| **Space** | Dodge |
| **Q** | Release Sync Burst when charged |
| **E** | Use a nearby facility or accept an encounter |
| **1 / 2 / 3** | Pick an upgrade |
| **R** | Reroll upgrade choices |
| **Tab** / **M** | Open the map |
| **Esc** | Pause or return |

The map and upgrade screen pause combat. The camera follows automatically.

## Language and saved runs

On a first visit, SURGE follows the browser's preferred supported language: **English** or **Simplified Chinese**. Chinese variants use Simplified Chinese; other languages fall back to English. You can change language in the menu or settings, and a manual choice takes priority on later visits.

Runs, settings, and unlocks are saved **in the current browser**. Refresh and choose **Continue run** to resume. There is no account or cloud synchronization; clearing browser storage removes that browser's progress.

## Run locally

Requires **Node.js 22** and npm. Repository access is required to clone; the [hosted game](https://oinja-game.vercel.app) is public.

```sh
git clone https://github.com/Olivia295/SURGE-for-Oinja.git
cd SURGE-for-Oinja
npm ci
npm run dev
```

Open the local URL printed by Vite. To check and preview the production build:

```sh
npm test
npm run build
npm run preview -- --port 4180
```

`npm run build` includes TypeScript checking. The game uses **Three.js**, **Rapier**, **TypeScript**, and **Vite**; it needs no application server or API keys.

## Inside the project

| Path | Purpose |
| --- | --- |
| `src/surge/` | Current game: combat, progression, maps, rendering, UI, and translations |
| `src/physics/` | Rapier movement and collision |
| `public/assets/` | Game models and assets |
| `tests/` | Automated rule and regression checks |
| `tools/surge/` | Browser checks, navigation checks, and scripted playtests |
| `docs/` | Design and validation notes, primarily in Chinese |

Start with the [0.4 design and validation notes](docs/15-worlds-events-and-language.md) or the [Tidal Observatory map notes](docs/observatory-map.md). Early documents describe earlier versions and are not the current feature list. Local archives, raw modelling files, and generated QA evidence are excluded from Git.

The existing checks cover game rules, navigation, language, and save/restore flows. Desktop Chrome has been tested; automated runs are not a substitute for human balance testing or validation on every browser.

## Publishing

The public address remains **[oinja-game.vercel.app](https://oinja-game.vercel.app)**. Deployment is manual; a GitHub push does not publish the game. From a checkout already linked to the owner's Vercel project:

```sh
npm test
npm run build
npx vercel deploy --prod --yes
```

`vercel.json` contains the build settings. `.vercelignore` excludes local records, internal documents, and unused legacy environments from deployment.

---

**Part of the Oinja universe.** Oinja's mechanical and electrical identity carries into this game. Its combat systems, support machines, and playable maps are adaptations for play, not additions to the original character canon. Discover the character and world in the [Oinja archive](https://oinja-website.vercel.app).
