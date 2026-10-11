# Assets and licenses

Mall Rats does not ship third-party 3D models, textures, sound beds or music. Characters, clothing, boards, mall architecture, signage, particles and audio are generated at runtime from code in `src/render/` and `src/audio/`.

Store names (Pizza Orbit, Mertz & Gable, Pretzel Planet, …) are original fiction.

## Fonts (bundled via Fontsource)

| Family | Used for | License | Package |
| --- | --- | --- | --- |
| **Bungee** by David Jonathan Ross | Logo, store signs, HUD numerals | SIL Open Font License 1.1 | `@fontsource/bungee` |
| **Permanent Marker** by Font Diner | Sticker-style deck graphics and some banners | Apache License 2.0 | `@fontsource/permanent-marker` |
| **Rubik** by Hubert & Fischer / Meir Sadan / Cyreal | UI body and buttons | SIL Open Font License 1.1 | `@fontsource/rubik` |

OFL and Apache licenses allow bundling in a game as long as the fonts themselves are not sold as a standalone product. Full texts ship inside the Fontsource packages (`node_modules/@fontsource/*/LICENSE`).

## Runtime libraries

| Library | License | Role |
| --- | --- | --- |
| three.js | MIT | WebGL renderer |
| React / React DOM | MIT | UI overlays |
| Vite | MIT | Bundler |
| Vitest | MIT | Unit tests |
| Playwright | Apache 2.0 | End-to-end tests |
| Capacitor | MIT | Native shell |

## Audio

`src/audio/audio.ts` synthesizes:

- UI ticks, purchase/sell, crash, grind sparks, coin hits, whooshes (short oscillators / noise bursts).
- A 116 BPM run bed and a 96 BPM menu bed (layered pulse + bass, no sampled loops).

There are no MP3/OGG files in the repo.

## Images

`public/favicon.svg` is original. Canvas textures (floors, grip tape, deck art, face stickers, sign atlas) are drawn with the 2D canvas API when the renderer boots.
