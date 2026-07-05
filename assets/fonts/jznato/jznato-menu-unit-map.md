# JZNATO menu unit mapping

This file maps the Chinese unit labels from the menu screenshot to JZNATO v11 glyphs. The primary machine-readable version is `jznato-menu-unit-map.json`.

## Sources used

- `JZNATO-readme.md`: the author states that JZNATO is broadly based on NATO APP-6C and is intended for wargame NATO counters.
- `JZNATO.xlsx`, sheet `JZNATO TLA`: author-supplied character table with TLA, keyboard character, description, decimal codepoint, and hex code.
- NATO/APP-6 reference basis: APP-6 is NATO joint military symbology; land unit icons are framed; infantry is a saltire/X, cavalry/reconnaissance is a single diagonal line, armour is stylized tank tracks, and motorized/mountain are modifiers.

## Mapping

| Chinese label | Meaning | JZNATO TLA | Character | Dec | Hex | Author description | Certainty |
|---|---|---:|---:|---:|---:|---|---|
| 步兵单位 | infantry | INF | `1` | 49 | 31 | infantry | high/exact |
| 机械化单位 | mechanized infantry | MEC | `9` | 57 | 39 | mechanised infantry | high/exact for mechanized infantry |
| 坦克单位 | armoured / tank | ARM | `-` | 45 | 2D | armoured | high/exact |
| 指挥部 | headquarters | HQQ | `}` | 125 | 7D | headquarters | high/exact in JZNATO |
| 骑兵 | cavalry | CAV | `!` | 33 | 21 | cavalry | high/exact |
| 滑雪 | ski | SKI | `K` | 75 | 4B | ski | high/exact in JZNATO |
| 山地 | mountain infantry | MTN | `2` | 50 | 32 | infantry mountain | high/exact for mountain infantry |
| 摩托化步兵 | motorized infantry | MOT | `4` | 52 | 34 | infantry motorised | high/exact |
| 安保部队 | security / border security | BOR | `L` | 76 | 4C | border | medium/best match, not exact |

## Important notes

- `安保部队` has no exact `security` entry in the JZNATO author table. I mapped it to `BOR` / `L` / `border` as the closest available JZNATO glyph, suitable as a project convention for border/security-style troops.
- `山地` is mapped to `MTN` / `2` / `infantry mountain` because the menu looks like unit-type selection. If you later need the raw mountain overlay, JZNATO also has `OMT` / `,` / `overlay mountain`.
- `摩托化步兵` is mapped to the primary author entry `MOT` / `4` / `infantry motorised`. There is also a variant `INM` / `d` / `infantry motorised version 2`, and an overlay `/` / `overlay motorised`.
- `机械化单位` is mapped to `MEC` / `9` / `mechanised infantry`. Variants include `MEW` / `u` / `mechanised wheeled` and `MAM` / `v` / `mechanised amphibious`.

## Visual proof

See `JZNATO-final-menu-glyphs-proof.png` in this folder. It renders the selected glyphs directly from `JZNATO-v11.otf`.

## External references

- JZNATO repository: https://github.com/jzedwards/jzfonts
- NATO Joint Military Symbology / APP-6 overview: https://en.wikipedia.org/wiki/NATO_Joint_Military_Symbology
- APP-6(C) archived PDF reference: https://web.archive.org/web/20150921231042/http://armawiki.zumorc.de/files/NATO/APP-6(C).pdf
