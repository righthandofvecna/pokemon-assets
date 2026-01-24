# Pokémon Assets Module

## Overview

Installable with this link (through the normal Foundry module interface): `https://github.com/righthandofvecna/pokemon-assets/releases/latest/download/module.json`

This module contains assets for trainers and Pokémon, and some sounds. It also adds support for:

- Animated walking spritesheets for tokens
- Token and Tile collisions (tokens can't enter each other's spaces, as if there were walls around the tokens, and tiles can be configured as solid)
- Restricting movement to keyboard-only or disallowing diagonals on a per-scene basis
- Animations and sounds for catching Pokémon and taking damage
- Sliding Ice, One-Way Jumps, Trainer's "Eyes Meeting" Animations and movement, Pokémon Centers & Computers, and scene-to-scene doors (usable through Foundry v13's "Regions" tool)
- Breakable Boulders (*Rock Smash*), Destructible Plants (*Cut*), Destructible Whirlpools (*Whirlpool*), Movable Boulders (*Strength*), Climbable Rocks (*Rock Climb*), Climbable Waterfalls (*Waterfall*), and the ability to use their corresponding field moves to destroy/move/interact with them
- Tile Scripts, which are scripts that run when the user interacts with a tile. A tool for quickly placing signs is also included.
- Interacting with things like Item Piles with the Enter button (configurable), or opening unlocked doors with Enter
- Isometric Perspective module support
- A more efficient Follow Me! module replacement

## Supported Systems
- [Pokemon Tabletop Reunited](https://github.com/pokemon-tabletop-reunited/ptr1e)
- [Pokemon Tabletop Reunited (2e)](https://github.com/pokemon-tabletop-reunited/ptr2e)
- [Pokerole](https://github.com/Pokerole-Software-Development/foundry-pokerole)
- [Pokemon 5e](https://github.com/MissingGlitch/pokemon5e-foundry-module) (expansion for D&D 5e)

## Usage

### Animated Spritesheets

To set up a token to use animated spritesheets, open the Prototype Token settings and navigate to the **"Appearance"** tab. Set your spritesheet as the token image, check the **"Sheet"** checkbox next to the image path, and then choose the Sheet Style as appropriate.

#### Standard Spritesheet Formats
- **4-directions (Down-Left-Right-Up)** - Standard 4-direction overworld sprites
- **4-directions (Reduced Trainer Overworld Style)** - Reduced 3-frame trainer overworld style
- **8-directions (Mystery Dungeon Style)** - PMD-style 8-direction sprites
- **4-directions, Diagonal (Digimon)** - 4 diagonal directions only

#### Third-Party Spritesheet Generators
- **Nihey** - For spritesheets from [Nihey's Retro Sprite Creator](https://retro-sprite-creator.nihey.org/character/new)
- **Universal LPC** - For [Universal LPC Spritesheet Generator](https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator) (download as single image). Note: Because Universal LPC sheets contain many animations, you may experience performance issues with large numbers of these tokens. To improve performance, isolate the walking animation and use one of the standard sheet styles.
- **Memao** - For [Sleeping Robot's Memao Sprite Creator](https://sleepingrobot.itch.io/memao-sprite-creator)

### Setting Sprites

***Method 1.*** **Setting the Trainer Profile.** You can set the actor's profile to one of the images in `modules/pokemon-assets/img/trainers-profile`, which will automatically set the actor's Prototype Token to use the associated spritesheet.

***Method 2.*** **Manual Setting.** The trainer overworld sprites are located in `modules/pokemon-assets/img/trainers-overworld`; the Pokemon ones are in `modules/pokemon-assets/img/pmd-overworld` (but the Pokemon sprites should get automatically set for PTR and PTR2e)

### Custom Sprites
This system is fairly adaptable as far as sprite sheets go. For Gen 4-style sheets, you can base them off [this blank trainer overworld image](img/trainers-overworld/blank_gen4.png).


### Token Following

1. **Follow Target**: Hover over the target token and press `L` (for join **L**ine).
2. **Move Target**: Move the leader token to see the following token move accordingly. Moving a token manually that's following another token will break the follow.
3. **Combat Mode**: Tokens **do not** follow if there is an active combat on the current scene.

### Interacting with Rocks/Trees/Signs/etc

To interact with an already placed object, select your character's token, move it up to the object (be sure it's facing the object) and press `Enter`. This should trigger whatever behavior is defined for that tile/region.

For "Field Moves" like *Rock Smash*, *Cut*, and so on, the selected character needs to be assigned the relevant move, or be the owner of a party which contains a character assigned those moves.

### Interactable Tiles

Select the tool on the Tile layer and double-click the spot you want to place the tile. Click-and-drag functionality will be added in a future update.

### Region Tools

On the Regions layer, while editing a region, you can add new behaviors as defined in this module. To add, click the `Behaviors` tab, and then click the `🧩 (Puzzle Piece)` icon. This should bring up a wizard to run you through, step-by-step, adding the following features: Sliding Ice, One-Way-Jumps, "Eyes Meeting", Pokemon Centers & Computers

## Troubleshooting

- **Token Size Issues**: If tokens don't resize correctly, try refreshing the page. Token resizing via active effect in PTR2e is a known bug that I haven't been able to figure out yet.

