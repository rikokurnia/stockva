# Nusara master asset pack

45 isolated transparent PNG sprites for a desktop-first isometric tokenized-stock city game.

## Contents

| Folder | Count | Contents |
|---|---:|---|
| `nvidia`, `tesla`, `amazon`, `blackrock` | 16 | Minus, level 1, level 2, level 3 |
| `functional` | 3 | City Hall, Stock Exchange, Oracle Data Center |
| `vehicles` | 6 | Upper-left and upper-right for each of three vehicles |
| `roads` | 11 | Two straights, four corners, four T-junctions, intersection |
| `effects` | 4 | Construction, upgrade, negative performance, selection |
| `buttons` | 5 | Buy, sell, swap, portfolio, settings |

`roads/road_sprite_sheet.png` is a high-resolution overview of the 11 road tiles; the same tiles are provided individually. Sidewalks are integrated. Road tiles contain no trees, benches, or grass fill; only the pavement and its dark outer curb remain against transparency.

## Game placement

- Building state images use a common 768 × 960 transparent canvas and bottom-center anchor **(384, 928)**. Swap states without shifting that anchor. Level 1 and level 3 are independently generated to preserve complete roof and base silhouettes. Their plot contours are visually aligned but not pixel-identical.
- Every road tile is **512 × 296** pixels. Align tile diamonds with neighboring centers offset by `(±256, ±148)`. Roads connect at the centers of the upper-left, upper-right, lower-left, and lower-right tile edges. Keep the transparent padding of the sprite sheet out of the tile grid.
- The six vehicle sprites point away toward upper-left or upper-right. Horizontally mirror in the engine for opposite directions as requested. Resize all vehicles together to suit your chosen lane size.
- Inspect `manifest.json` for names, dimensions, anchors, and road connections.

## Production notes

Art was generated with the supplied island map as the style reference. Exact official trademark geometry and company lettering on generated facades should be reviewed at the final in-game display size. The road geometry is deterministic, while decorative rendering and building contours are illustrative.
