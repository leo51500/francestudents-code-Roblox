# {{GAME_NAME}}

Projet Roblox généré et maintenu par **France-Students-code-Roblox**.

## Démarrer

1. Ouvre ce dossier comme projet dans l'application.
2. `roblox_game action:validate` vérifie la structure, les fichiers et les assets.
3. `roblox_game action:build` construit `build/{{SLUG}}.rbxlx`.
4. Ouvre la place dans Roblox Studio, ou synchronise avec Rojo (`rojo serve`).

## Organisation

| Dossier | Rôle |
| --- | --- |
| `src/shared/` | configuration, remotes, définitions d'objets et de missions |
| `src/server/` | services autoritaires chargés par `Main.server.luau` |
| `src/client/` | contrôleurs d'interface chargés par `Main.client.luau` |
| `assets/blender/` | bibliothèque Python et spécifications des modèles |
| `assets/library.json` | registre des assets, LOD et identifiants Roblox |
| `game.blueprint.json` | état de production : systèmes, écrans, phases |

## Règle de travail

- Aucune géométrie n'est fabriquée avec des Parts : les modèles viennent de
  Blender (`roblox_asset`), puis sont insérés dans Studio.
- Les interfaces sont des objets GUI natifs (`ScreenGui`, `Frame`, `UIStroke`,
  `UICorner`, `UIGradient`), pas du HTML.
- Un système n'est déclaré terminé qu'après `roblox_game action:validate`.
- La place n'est déclarée livrée qu'après `roblox_game action:build` réussi.
