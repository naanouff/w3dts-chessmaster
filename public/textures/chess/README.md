# Chess photo PBR maps

Sampled [ambientCG](https://ambientcg.com/) 1K JPGs for `ChessDemoProject`.

| Set | Files | Use |
|-----|--------|-----|
| **Marble020** | Color, NormalGL, Roughness | White match pieces |
| **Metal010** | Color, NormalGL, Roughness, Metalness | Black match pieces |
| **Wood094** | Color, NormalGL, Roughness | Light (honey) checker squares |
| **Wood051** | Color, NormalGL, Roughness | Dark (walnut) squares + frame |
| **Metal048C** | Color, NormalGL, Roughness, Metalness | Gold board plinth / chamfered slab |

Licence: typically **CC0** on ambientCG — verify on the asset page if redistributing.

Runtime packs roughness + metalness into a glTF ORM texture (G / B). The checker is composed at load into a 2048² atlas (dark squares rotate grain 90°). Piece meshes get a cylindrical UV unwrap so the sampled maps wrap the lathe.
