# VASSAL starter package

This folder contains a tiny from-zero VASSAL starter kit:

- `starter_hex_map_20x15.png`: a 20 x 15 flat-topped hex map.
- `blue_inf_1.png`, `blue_armor_1.png`, `red_inf_1.png`, `red_armor_1.png`: four test counters.

Use these VASSAL grid settings for the starter map:

- Board image: `starter_hex_map_20x15.png`
- Orientation: flat-topped, so leave `Sideways` unchecked.
- X offset: `72`
- Y offset: `72`
- Hex Height: `73`
- Hex Width: `63`
- Snap to defined point: checked
- Show Grid: optional. Keep it checked while aligning, then uncheck it if the map image grid is enough.

## VASSAL click path

1. Close the menu currently open on `Main Map [Map Window]`.
2. Expand `Main Map [Map Window]`.
3. Right-click `[Map Boards]`.
4. Choose `Add Board`.
5. Open the new `[Board]` properties.
6. Set `Name` to `Starter Map`.
7. Set `Board image` to `starter_hex_map_20x15.png`.
8. Right-click the new `[Board]`.
9. Choose `Add Hex Grid`.
10. Open `[Hex Grid]` properties and enter the grid values above.
11. Right-click `[Hex Grid]`.
12. Choose `Add Grid Numbering`.
13. Use numeric horizontal and vertical numbering. If you want labels like `0101`, set one leading zero for both directions.

## Add test counters

1. Expand `[Game Piece Palette]`.
2. If it has no container, right-click it and add a `Panel` or `Scrollable List`.
3. Right-click the container and choose `Add Single Piece`.
4. In the `Basic Piece` image chooser, select one of the counter PNG files.
5. Add useful traits later, such as `Mark When Moved`, `Delete`, `Clone`, and `Report Action`.

The starter goal is simple: map visible, hex snap working, test counters draggable.
