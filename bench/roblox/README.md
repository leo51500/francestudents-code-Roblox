# Banc de tâches Roblox

Ce banc mesure le **résultat** de l'agent sur des tâches Roblox concrètes, sans appeler de modèle. Chaque tâche fournit un énoncé, une solution de référence et des contrôles déterministes. Le score est donc reproductible d'une exécution à l'autre.

## Lancer

```sh
npm run bench:roblox
npm run bench:roblox -- --task obby-game --verbose
npm run bench:roblox -- --task datastore --solution .frst/essais/datastore
npm run bench:roblox -- --json
```

- Sans argument : note les solutions de référence. Toute tâche en échec signale un défaut du banc ou du contrôle, pas de l'agent.
- `--solution <dossier>` : note la production de l'agent pour la tâche donnée. Le dossier est copié dans un espace temporaire ; l'original n'est pas modifié.
- `--json` : sortie machine (`summary.percent` pour suivre une progression).
- `--verbose` : affiche aussi les contrôles réussis.

Le code de sortie vaut `1` si une tâche échoue et `2` si les arguments sont invalides.

## Contrôles disponibles

| Clé | Effet |
| --- | --- |
| `files` | Chemins attendus dans la solution. |
| `luau.clean` | Aucun diagnostic Luau (erreur ou avertissement). |
| `luau.fail_on` | Échec pour les codes listés (`error` couvre toutes les erreurs). |
| `require` | Motifs regex qui doivent apparaître dans un fichier. |
| `forbid` | Motifs regex qui ne doivent pas apparaître. |
| `json` | Valeur d'un champ de `default.project.json` (`equals`, `exists`). |
| `build` | `rojo build` optionnel : ignoré si Rojo n'est pas installé. |

## Tâches

| Id | Difficulté | Poids | Compétences mesurées |
| --- | --- | --- | --- |
| `leaderstats` | facile | 1 | boucle joueurs, hiérarchie d'Instance, conventions Luau |
| `datastore` | moyen | 2 | UserId, `pcall`, chargement/sauvegarde, arrivée/départ |
| `remote-authority` | moyen | 2 | RemoteEvent partagé, validation de type, cooldown, client passif |
| `rojo-project` | moyen | 2 | mapping DataModel, `$path`, projet constructible |
| `obby-game` | expert | 4 | serveur autoritaire, checkpoints, DataStore, HUD, Boucle de jeu complète |

Ajouter une tâche : créer un dossier dans `solutions/`, l'entrée dans `tasks.json`, puis relancer `npm run bench:roblox -- --task <id> --verbose`. Une solution de référence doit passer **tous** les contrôles avant de servir de mesure.
