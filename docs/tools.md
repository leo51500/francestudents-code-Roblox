# Outils de l'agent (src/tools/)

Les outils du catalogue sont exécutés dans l’application, via le registre local,
avec les validations et permissions habituelles. Le protocole normal demande au
modèle une action JSON dans le texte de sa réponse. Si le fournisseur émet malgré
tout un appel natif (`function_call`), `src/api/local-tool-calls.js` reconstitue
ses arguments et convertit le premier appel complet et valide en action JSON.
Les outils inconnus et les appels incomplets ne sont jamais exécutés. Un rejet
du dispatch serveur (« Unsupported tool ignored by the backend ») peut ainsi être
récupéré sans contourner la validation locale. Si le modèle rapporte uniquement
ce rejet dans sa réponse finale, l’agent lui rappelle le protocole une fois et
reprend la tâche, sauf si un véritable refus ou échec local a déjà été reçu.

## Organisation

- `tools.js` : façade. Elle réexporte TOOLS, validateToolCall et describeCall, et définit summarizeResult, setProject, unsetProject et undoLast.
- `registry.js` : la liste des outils. Chaque module fournit `name`, `run`, `check` et `describe`. validateToolCall vérifie le nom et les arguments avant l'exécution.
- `security.js` : normalizeRelative, resolveInWorkspace, assertRealInside et PATH_LIMITS. Ce fichier contient les blocages (fichiers d'identifiants, noms réservés Windows, sortie du projet).
- `diff.js` : affichage des différences.
- `fs/` : un fichier par outil (list-directory, read-file, search-files, create-directory, write-file, edit-file, move-path, copy-path, delete-path, remember), plus pair.js pour les outils à deux chemins.
- `core/` : briques communes.
  - `args.js` : contrôle des arguments (requireString, optionalString, optionalInt).
  - `fs-utils.js` : ensureParent (mkdir en mode 0o700), entre autres.
  - `freshness.js` : readTextFile et assertFreshRead.
  - `atomic.js` : writeAtomic(target, content, {expected, read}).
  - `journal.js` : journal des modifications et undoLast.
  - `walk.js` : walkFiles(dir, relDir, {maxFiles}).
- `command/` : run_command (index.js, parse.js, runner.js, program.js). program.js contient filterEnv, killTree et resolveProgram, sortis de runner.js.

## Outils Roblox

`src/roblox/` contient la logique de production ; `src/tools/roblox/` l’expose :

- `roblox_game` (`game.js`) : `init` (blueprint + structure Rojo), `add_system`,
  `scaffold`, `status`, `validate`, `build` (Rojo), `phase`, `systems`, `plan`.
- `roblox_asset` (`asset.js`) : `schema`, `spec` (JSON de primitives), `import`
  (GLB, glTF, FBX, OBJ, STL, BLEND → `assets/sources/`), `build` (Blender
  `--background`), `audio` (MP3, OGG, WAV, FLAC → `assets/audio/`), `upload`
  (LOD0 ou son avec le compte connecté dans le plugin Roblox Blender), `plugin`
  (vérifie la connexion sans envoyer), `login` (rétablit la session OAuth dans
  le navigateur), `list`, `show`. L’upload par le plugin ne demande aucune clé ;
  `provider:"opencloud"` reste une option avec `ROBLOX_OPEN_CLOUD_KEY`,
  `ROBLOX_CREATOR_ID` et `ROBLOX_CREATOR_TYPE`.

Les fichiers sont écrits avec confirmation groupée et journal d’annulation
(`src/roblox/project.js`) ; le build et les rapports utilisent `build/` dans le
projet. Ces outils ne dépendent d’aucun MCP : Blender, Rojo et `luau-compile`
sont détectés dans les réglages, le PATH et des emplacements connus.

## Ajouter un outil

1. Créer `src/tools/fs/<nom>.js`, qui exporte `{ name, run, check, describe }`.
2. L'ajouter à `MODULES` dans `registry.js`.
3. Si besoin, ajouter un cas dans `summarizeResult` (tools.js).
4. Ajouter un test dans `test/`.

## Règles de sécurité

- Tout chemin passe par resolveInWorkspace : il est relatif, normalisé et filtré.
- Avant d'écrire, assertRealInside suit les liens et jonctions avec realpath, et refuse une cible réelle située hors du projet.
- Les écritures passent par writeAtomic (fichier temporaire puis renommage). L'écriture est refusée si le fichier a changé depuis la lecture.
- Limites : CONFIG.maxWriteChars pour content et new_string, CONFIG.maxReadBytes pour la lecture.

## Performance

- search_files : parcourt les fichiers avec walkFiles, puis les lit par lots de 8 en parallèle. Le texte est mis en minuscules une seule fois par fichier, et le fichier est sauté s'il ne contient pas la recherche. Limites : CONFIG.maxSearchFiles et CONFIG.maxSearchResults.
- read_file : compte les lignes sans split. Le découpage n'est fait que si start_line ou end_line est demandé.
- readTextFile : lit avec fs.open. Un octet nul dans les 4 premiers Ko fait refuser le fichier sans lire la suite.
- Banc : `node scripts/bench-search.js` (2000 fichiers, 5 passes, médiane).

## Tests

`npm test` lance `node --test test/*.test.js`. Fichiers liés aux outils : security, atomic, real-inside, search-files, result-shape, command-parse, command-runner et program. Sous Windows, program.test.js utilise un dossier temporaire avec de faux outil.cmd et outil.exe pour tester findOnWindows et resolveProgram ; ces tests sont ignorés sur les autres systèmes.
