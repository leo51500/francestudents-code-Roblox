# __GAME_NAME__

Jeu Roblox complet prêt pour Rojo : parcours vertical, checkpoints, pièces,
chronomètre, meilleur temps persistant et HUD client.

## Structure

- `default.project.json` : arborescence Rojo (ReplicatedStorage.Shared, ServerScriptService.Server, StarterPlayerScripts.Client).
- `src/shared/Config.luau` : toutes les valeurs de jeu (plateformes, pièces, chute, réapparition).
- `src/server/Main.server.luau` : autorité serveur. Génère le parcours, gère checkpoints, pièces,
  chute, chrono et DataStore (clé `UserId`, appels protégés par `pcall`).
- `src/client/Hud.client.luau` : HUD lisible PC/mobile, branché sur les attributs du joueur.

## Lancer

```sh
rojo build default.project.json --output build/game.rbxlx
```

Ouvre `build/game.rbxlx` dans Roblox Studio, puis **Play**. Pour modifier en direct :

```sh
rojo serve
```

et connecte le plugin Rojo de Studio.

## Boucle de jeu

1. Le joueur apparaît sur la plateforme de départ.
2. Il saute de plateforme en plateforme ; tomber sous `FallLimit` le renvoie au dernier checkpoint.
3. Chaque pièce ajoute `CoinValue` au compteur.
4. La plateforme dorée termine la course : temps final, meilleur temps enregistré.

## Étendre

- `PlatformCount`, `PlatformSpacing`, `Radius`, `CheckpointEvery` dans `Config.luau`.
- Les pièces et checkpoints sont créés à partir de ces valeurs : aucun asset externe n'est requis.
- Pour remplacer la géométrie par un modèle Blender, importe le GLB dans `ReplicatedStorage`
  et clone-le sur chaque plateforme ; ne remplace pas le script serveur par une logique client.
- Ne téléverse jamais un `rbxassetid` inventé pour un son. Ajoute un son publié par ton compte
  dans `SoundService` avec un `SoundGroup`, puis règle son volume.

## Vérifier

```sh
roblox_check
roblox_playtest {"build":true}
roblox_playtest {"action":"logs"}
```

Un build en échec ou une erreur Studio interdit d'annoncer le jeu comme fonctionnel.
