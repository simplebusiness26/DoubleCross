# DOUBLECROSS

A fast, mobile-first top-down spy/heist game about deception, traps, gadgets, objectives and escape.

## Core fantasy

Every operative enters the same compact location with a mission. Search rooms, manipulate the environment, deceive rivals, complete objectives and reach extraction before the opposition.

**Core loop:** Enter → Search → Discover → Deceive → Sabotage → Steal → Escape → Rematch.

## Android APK

DoubleCross now includes a native Android shell that packages the game for offline landscape play on Android phones. The `Build Android APK` GitHub Actions workflow builds an installable debug APK on every push to `main` and uploads it as the `DoubleCross-Android-APK` artifact.

The Android app uses the same game source as the web version, so gameplay changes flow into the next APK build automatically.

## Game modes

### Solo Operations
A complete single-player mode built around AI-controlled operatives rather than a reduced multiplayer substitute.

Players can choose:
- **Easy** — forgiving bots, slower reactions, obvious mistakes, light trap use.
- **Medium** — purposeful searching, sensible gadget use, ambushes and counter-traps.
- **Hard** — aggressive objective play, route prediction, deception, trap chains and adaptive counterplay.

Solo matches can include:
- AI teammates working alongside the player.
- AI rivals competing against the player.
- Mixed scenarios with both allies and enemies.
- Mission variants such as extraction, theft, rescue, sabotage and defence.

AI allies should feel useful but not automatic: they can search assigned rooms, carry objectives, guard routes, disable traps and respond to simple contextual commands.

### Multiplayer
2–4 player matches using the same maps, objectives, traps and gadgets as Solo Operations. Private matches and online matchmaking can be layered on after the core simulation is proven.

## First location: The Mansion

A compact, readable espionage playground containing interconnected rooms, cupboards, desks, safes, locked doors, vents, secret passages and extraction points. Objective and useful-item locations are shuffled between matches.

## Design principles

1. Short matches with immediate rematch appeal.
2. Information and prediction matter as much as reflexes.
3. The environment is a weapon.
4. Every trap should have readable counterplay.
5. Bots and human players use the same underlying rules.
6. Mobile controls come first.
7. Original characters, world, art direction and mechanics — inspired by classic competitive spy games, not a direct remake.

## Initial controls

Landscape mobile layout:
- Left thumb: movement.
- Right side: contextual interact/action.
- Gadget button / quick-select.
- Optional teammate command button in Solo Operations.

## Initial milestone

Build a playable Mansion prototype with one human player, AI operatives, searchable rooms, objectives, traps, gadgets, extraction and Easy/Medium/Hard AI difficulty profiles. Once that loop is genuinely fun, expand into multiplayer.
