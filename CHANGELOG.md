# Changelog

## [1.5.35] — Le sélecteur de projets redevient utilisable après un échec
- **Liste bloquée corrigée** : quand l'actualisation échouait (session expirée, hors ligne), le sélecteur « Discussions dans » restait désactivé même s'il affichait déjà des projets — impossible de choisir. Il reste maintenant utilisable avec ce qui est déjà chargé.
- **Retour automatique** : après une reconnexion (ou une minute après un échec), la liste des projets se recharge d'elle-même au prochain mouvement de statut, sans appuyer sur ↻.

## [1.5.34] — Poignee flottante, raccourci du chat en plein écran
- **Sash flottant style VS Code** : pendant le glisser, une poignée détachée suit le curseur via `transform`, sans attendre le recalcul de la grille ; la ligne d'accent est désormais un pseudo-element `::before` centré, visible au survol et au focus clavier.
- **Raccourci Ctrl+Maj+M** : bascule le plein écran du chat, comme le bouton ⤢ ; Échap le quitte toujours.
- BOM UTF-8 retiré à nouveau de `10-actions.js` (réintroduit par une édition concurrente) et accolade excédentaire corrigée.

## [1.5.33] — Glisser plus précis, messages d'échec plus clairs
- **Tailles sans décimales** : pendant le redimensionnement, la valeur appliquée aux panneaux et la bulle de taille sont arrondies au pixel ; plus de largeur impaire ni de bulle avec des décimales.
- **Session expirée, message simplifié** : quand la liste des projets FranceStudent échoue pour raison de session, le texte invite simplement à se reconnecter ou à reprendre un projet déjà chargé, sans formulation technique.
- **Liste conservée** : si des projets sont déjà affichés dans le sélecteur, un échec d'actualisation ne les désactive plus — on peut continuer à choisir un projet hors ligne.
- BOM UTF-8 retiré des sources modifiées (suite du correctif 1.5.32 sur `package.json`).

## [1.5.32] — Poignees plus faciles a attraper, bulle de taille reparee
- **Zone de clic elargie** : les poignees de redimensionnement (chat, fichiers, panneau bas) ont un pseudoelement transparent de +/-4 px de chaque cote du trait, ce qui rend le glisser bien plus facile a declencher sans viser un pixel precis.
- **Bulle de taille reparee** : la bulle `layout-badge` (« Chat · 420 px ») n'avait aucune regle CSS et apparaissait sans style ni position fixe. Elle est maintenant positionnee en `fixed`, avec fond, bordure et ombre correspondant au theme.
- **Retour visuel clair** : au survol, une ligne fine couleur `--accent` remplace le fond gris indistinct. Pendant le glisser, la couleur d'accent reste pour confirmer que la poignee est tenue.
- **Poignee verticale sur toute la hauteur** : `grid-row` corrige de `1` a `1 / span 2` ; la poignee couvrait seulement la rangee du titre (34 px) au lieu de toute la hauteur.
- Prepare : `npm run build:renderer`. Tests complets a effectuer avant publication.

## [1.5.30] — Le chat s’agrandit et revient à sa place
- **Agrandissement corrigé** : le chat s’étend maintenant sur toute la fenêtre, même après avoir redimensionné les panneaux ou personnalisé la disposition. Le bouton et `Échap` rétablissent ensuite l’affichage précédent.
- **Connexion expliquée simplement** : si la session FranceStudent manque ou a expiré, la liste des projets invite à se reconnecter puis à actualiser, sans afficher de détail de session technique.
- Vérifié : `npm run lint`, `npm run build:renderer`, `npm run check:renderer`, `npm test` et parcours Electron ciblé du chat.

## [1.5.29] — La taille du chat marche partout, et vos projets FranceStudent se choisissent dans le chat
- **Redimensionnement réparé sous 1100 px** : la classe `.layout-custom` n'était appliquée qu'au-dessus de 1001 px, et elle était retirée juste après chaque glisser (`syncLayoutCustom` ignorait `--left-custom` / `--right-custom`). La largeur choisie est conservée à toutes les tailles, dès l'appui sur la poignée. La hauteur du panneau du bas suit les mêmes règles.
- **Chevauchements corrigés** : le menu « Outils du chat » (popover) restait positionné au centre de la fenêtre, donc au milieu de la conversation ; il est désormais ancré à son bouton et masqué tant qu'il n'est pas ouvert. La grille réservait deux fois la hauteur de la barre de titre, ce qui coupait le haut du panneau : corrigé.
- **Projets FranceStudent dans le chat** : nouveau sélecteur « Discussions dans » en haut du panneau. Il liste les projets du compte (aucun n'est créé), indique le projet actif, actualise la liste (↻) et ouvre le site (↗). Chaque nouvelle discussion y est rattachée ; « Aucun projet » la laisse dans l'historique général.
- **Aucun projet fantôme** : un projet supprimé sur le site est retiré du sélecteur et du rattachement au démarrage.
- Vérifié : `npm run lint`, `npm run check:renderer`, `npm test` (886 tests, 883 réussis, 3 ignorés), et contrôles Electron réels (projets affichés, poignée fonctionnelle à 1000 px et 900 px, bulle de taille).

## [1.5.28] — Les discussions rejoignent le projet FranceStudent, et fin des chats en série
- **Projets FranceStudent dans l’application** : `/fr-project` sans argument liste les projets réels du compte (aucun n’est créé au passage) et indique le projet actif. Le nom choisi est recherché parmi eux ; `/fr-project "Nom" --creer` est la seule façon d’en créer un.
- **Fin des chats « Tour 28/40 », « Tour 29/40 »…** : un second 409 (fil occupé) ne reconstruit plus un nouveau fil à chaque tentative. L’application revient au fil d’origine, retente une seule fois après une courte attente, puis s’arrête en gardant le travail déjà fait. Un seul nouveau fil au maximum par demande.
- **Titres lisibles** : un fil repris reçoit un titre tiré de la demande réelle (« Ajoute une boutique d’armes. ») et non du tour d’agent ; un tour de suivi ne donne jamais de titre.
- **Rattachement fiable** : les nouveaux fils restent rattachés au projet choisi, dès la première réponse, sans jamais dupliquer la conversation.
- Vérifié : `npm run lint`, `npm test` (886 tests, 883 réussis, 3 ignorés dont les parcours nécessitant une clé réelle), nouveaux tests sur le titre des chats et sur la reprise 409.

## [1.5.27] — Placez le chat où vous voulez, et voyez sa taille en direct
- **Chat détaché dans sa propre fenêtre** : le bouton « détacher » du panneau agent ouvre le chat dans une vraie fenêtre système. On la place et on la redimensionne librement (bords, multi-écrans), sa position et sa taille sont mémorisées, et la grande fenêtre masque alors sa colonne pour qu’aucun affichage ne se superpose. La fermer la rétablit.
- **Chat masquable** : bouton « masquer » dans l’en-tête et raccourci **Ctrl+Alt+A** ; la colonne revient avec sa largeur réglée.
- **Aucun palier imposé** : les bornes fixes (150-600 px, 280-900 px, 60-600 px) sont remplacées par les vraies limites de la fenêtre. Une colonne va de son minimum utile à toute la place libre, l’éditeur conservant toujours sa largeur minimale. La place restante est mesurée sur l’élément réellement affiché, plus une constante supposée.
- **Bulle de taille corrigée** : elle n’apparaissait jamais car l’élément était cherché avant d’être créé. Pendant un glisser, un double-clic ou un ajustement clavier, elle affiche la largeur réelle de la zone (« Chat · 642 px ») près du curseur, puis s’efface.
- **Chevauchement poignée/boutons** : la zone de saisie de ±5 px est maintenant au-dessus du bouton voisin, donc un clic près du trait saisit la poignée au lieu du bouton de l’en-tête du chat. La poignée affiche aussi trois points au survol.
- **Disposition retrouvée** : panneaux masqués inclus, la disposition est restaurée au redémarrage, et le glissement s’applique même sans pose intermédiaire du pointeur.
- **Contrôle visuel** : nouveau test Electron qui glisse la poignée, vérifie la bulle, l’élargissement et la restauration après redémarrage.

## [1.5.26] — Sous-agents spécialisés : Interfaces et 3D
- **L’agent principal orchestre.** Il garde la conversation, choisit le sous-agent, lui écrit un brief autonome, récupère son compte rendu et présente le résultat. Le prompt principal reçoit un catalogue généré et la consigne de découpage (produire d’abord ce dont l’autre dépend, reprendre les chemins réels du premier compte rendu, puis assembler et vérifier).
- **Nouveau sous-agent « Interfaces »** (`roblox-interface`) : ScreenGui, HUD, menus, boutiques et inventaires en Luau `--!strict`, adaptation tactile/manette/clavier, animations `TweenService`, intégration Rojo (`src/client`, `src/shared`), remotes validés côté serveur. Skills réutilisés : `roblox-luau`, `roblox-ui`, `roblox-server-authority`, `roblox-monetization`.
- **Nouveau sous-agent « 3D »** (`roblox-3d`) : script Python Blender exécuté en arrière-plan, puis `inspect` → `validate` → `render` (+ `view_image`) → `import_roblox`. Règle 1 stud = 0,28 m, textures 1024 px, budget de triangles, conseils d’import Studio. Skills réutilisés : `blender-model`, `blender-script`, `blender-optimize`, `blender-lowpoly-style`, `blender-texture`.
- **Ajouter un sous-agent se limite à un fichier.** Registre `src/agent/subagents/` : chaque rôle déclare son libellé, sa méthode, ses skills, ses zones d’écriture et ses outils (`write: true` obligatoire pour écrire, outil inconnu refusé au chargement). Un import dans `BUILTIN` et il apparaît dans le catalogue de l’orchestrateur, dans `task` et dans les tests.
- **Le moteur de sous-agent est générique** : chaque rôle ne voit que ses outils, ses skills sont installés et chargés automatiquement, les écritures passent par les confirmations et les hooks de l’agent principal, et le parent ne reçoit que le résumé (`report`, `files_written`, `files_read`, `incomplete`). Garde-fous : limite de tours par rôle, aucun rôle code dans l’espace Motion design.
- **Suivi visible** : les sous-agents apparaissent dans le panneau Activité (rôle, brief, fichiers écrits, compte rendu repliable), une ligne discrète dans la TUI, silence dans le CLI classique.
- Vérifié : `npm run lint`, `npm run check:renderer`, `npm test` (878 tests, dont 10 nouveaux sur le registre).

## [1.5.25] — Tout modèle 3D passe par Blender, et le code respire
- **Règle du projet : tout modèle 3D passe par Blender.** Prop, décor, accessoire, arme, personnage statique : l’agent écrit un script Blender, l’exécute, vérifie le GLB puis l’importe. Il ne livre plus un empilement de Parts à construire à la main. Exceptions annoncées : géométrie volontairement en Parts (modifiable, alignée à la grille) ou demande explicite. Règle appliquée dans le prompt, le brief jeu, les skills `roblox-building`, `blender-model` et la documentation.
- **`desktop/main.js` allégé** : les terminaux (spawn et session interactive node-pty) sont extraits dans `desktop/terminals.js` (276 lignes retirées du fichier principal, comportement inchangé). Les dépendances du module sont injectées, sans cycle de `require`.
- **Style** : `mcpAttemptKey` et les contrôles les plus denses de la boucle agent sont découpés en fonctions nommées et blocs lisibles. Aucun changement de comportement, vérifié par les tests existants.
- **Budget des guides du prompt** : nouveau test qui mesure la taille de chaque guide (Roblox, éclairage, Blender, référence, sons) et échoue si l’un dépasse sa borne. Pire cas mesuré : 7 344 caractères.
- **Nom du produit clarifié** : un tableau dans `CONTRIBUTING.md` explique pourquoi `package.name` reste `project-frstcli` (dossier de profil Electron), face à `build.productName` et `build.appId` ; commentaire `//name` dans `package.json`.
- **Caches Python retirés de Git** : `__pycache__/` et `*.pyc` ignorés, le fichier versionné est déréférencé (le fichier local reste).
- Vérifié : `npm test` (868 tests), `npm run lint`, build du renderer, et rendu Blender réel.

## [1.5.24] — Le rendu quatre angles vérifié pour de vrai
- **Rendu Blender contrôlé réellement** : nouveau test d'intégration qui lance Blender, rend `prop_palette.py` et lit le PNG produit (taille 1024, contenu de chacun des quatre quarts, présence des couleurs de la palette). Il est ignoré proprement si Blender n'est pas installé.
- **Trois bugs trouvés par ce rendu, corrigés** :
  - `_mesh_from_bmesh` utilisait `bpy` sans l'importer (`NameError` à la première sphère) ;
  - les couleurs se répartissaient en diagonales après la triangulation, car les faces étaient réindexées par position ; elles suivent maintenant le matériau de chaque sommet ;
  - le bruit des rochers pouvait creuser le modèle sous le sol ; la base reste plate.
- **Le rendu utilise EEVEE** (repli Workbench) pour montrer les matériaux, au lieu d'un modèle gris.
- **Guides du prompt mesurés par section** : `briefSections` expose les guides réellement ajoutés (Roblox, éclairage, Blender, référence, sons). Les tests ne cherchent plus un mot dans le prompt complet, où `rbxassetid` et « tourne » donnaient de faux positifs. Le mot `asset` seul ne déclenche plus les outils Blender.
- **Fichier verrouillé vérifié de bout en bout** : nouveau test `runAgent` qui simule un `EBUSY` et confirme qu’une écriture verrouillée n’est **jamais** rejouée à l’identique, que le fichier d’origine reste intact et que l’agent reçoit la consigne de sortie.
- Vérifié : `npm test`, `npm run lint`, build du renderer, et le test d’intégration Blender avec un rendu réel examiné.

## [1.5.23] — Blender low-poly, sons, éclairage Voxel et fin des tours en rond
- **L’agent ne s’arrête plus sur « Je tourne en rond »** : une action identique déjà réussie est ignorée et relancée avec une consigne de changement de démarche, au lieu de couper la tâche au deuxième avertissement. Une action qui vient d’échouer peut être rejouée (relire après correction, relancer un build) ; seule une répétition persistante arrête l’agent, avec un compte rendu des dernières étapes. Les commandes de vérification (`npm test`, `rojo build`, rendu Blender) ont droit à deux fois plus de répétitions. Nouveau module `src/agent/stuck-guard.js`.
- **Fichier utilisé par une autre instance du Studio / en lecture seule** : ce n’est plus une boucle sans fin. `write_file` et `edit_file` reconnaissent le verrou (EBUSY, EPERM, « autre instance », « lecture seule »), expliquent que le contenu n’est pas perdu et proposent un enregistrement sous un autre nom ou la fermeture de la session qui garde le fichier. L’agent ne prétend jamais avoir enregistré.
- **Migration Compatibility → Voxel Lighting** : la fenêtre de Studio est expliquée comme une information Roblox, pas comme une erreur. L’agent compare le rendu et ajuste `Ambient`, `OutdoorAmbient`, `Brightness` et `ClockTime`, avec le lien de l’[annonce DevForum](https://devforum.roblox.com/t/compatibility-lighting-becomes-retro-tone-mapping-sunset-migration/3128560).
- **Sons** : nouveau guide et skill `roblox-sound`. L’agent ne fabrique jamais un `rbxassetid` : il demande le son réel, puis l’intègre avec `SoundGroup`, `RollOffMode` et un volume discret.
- **Géométrie Blender** : `blender_common.py` gagne biseau, sphère, cône, tore, symétrie, booléens (creuser), révolution (colonnes, vases) et bruit déterministe pour les rochers. Nouveau modèle `prop_palette.py` qui montre la chaîne complète.
- **Plusieurs couleurs par modèle** : palette limitée (bois, métal, feuillage, pierre, or…) appliquée avant `join`. `inspect` explique le comportement réel de l’importeur 3D de Roblox (un sous-mesh par matériau, cinq couleurs maximum, texture qui remplace les couleurs de base).
- **Contrôle visuel** : le rendu assemble quatre angles (face, trois-quarts, côté, dessus) dans une image 1024 px ; la consigne de l’agent est de comparer à la demande, lister trois défauts, corriger et recommencer deux fois au maximum.
- **Espace de référence** : quand une image est jointe, l’agent décrit silhouette, proportions et couleurs avant de modéliser, puis compare le rendu à cette description.
- **Skill `blender-lowpoly-style`** : silhouette d’abord, proportions exagérées, palette limitée, biseaux, et recettes caisse, rocher, maison et épée.
- Vérifié : `node --test test/blender.test.js test/stuck-guard.test.js test/prompt-roblox-guides.test.js test/agent-context.test.js` au vert. La suite complète (`npm test`) et le rendu Blender réel quatre angles restent à contrôler avant publication.
## [1.5.22] — Séparateurs qui suivent le curseur

- **Poignées de mise en page fiables** : les trois séparateurs (colonne des fichiers, chat, panneau du bas) captent le pointeur sur une zone élargie de 3 px de chaque côté du trait, au lieu d’un trait d’un pixel qu’il fallait viser. `touch-action` est neutralisé pour éviter que le geste soit détourné.
- **Glisser sans retard** : pendant un glisser, `html.layout-dragging` désactive les transitions de largeur de `#app`, y compris en disposition personnalisée ; la colonne suit le curseur image par image et la poignée ne décroche plus.
- **Plus de barre de défilement parasite** : `#app` masque son débordement, ce qui évite l’apparition d’une barre horizontale quand la largeur d’une colonne est ajustée au pixel près.
- **Historique rechargé sans animation** : l’entrée du transcript reçoit sa classe `is-replayed` après sa création, donc la conversation rouverte s’affiche immédiatement au lieu de rejouer l’arrivée des messages.
- Vérifié : `npm run check:renderer` (bundle à jour), `eslint .` sans erreur, `npm test` au vert (842 réussis, 0 échec). Le geste de glisser lui-même reste à contrôler dans l’application empaquetée.

## [1.5.21] — Publication corrigée pour la 1.5.20

- **Release 1.5.20 non publiée** : la fiche `v1.5.20` n'a pas été créée. Le workflow Windows appelé par **Publication automatique** démarrait sans préparation d'Electron, alors que `npm test` charge Electron via `prepare:electron` ; il est désormais aligné sur la CI (installation puis chargement d'Electron avant les vérifications).
- **Versions du verrou alignées** : `package-lock.json` indiquait encore 1.5.19 en tête de fichier et dans `packages[""]` ; il porte maintenant la version de `package.json`.
- Vérifié : versions cohérentes entre `package.json` et `package-lock.json` ; publication à contrôler dans **Actions** après le push.

## [1.5.20] — Zoom partout, panneau Logs, animations de réflexion

- **Zoom partout** : `Ctrl` + molette dans le chat, l'éditeur, le terminal et les Logs ; `Ctrl+=`, `Ctrl+−` et `Ctrl+0` (aussi dans le menu Affichage). Le niveau suit l'ensemble de la fenêtre, donc les conversations, les dialogues et les aperçus grandissent ensemble. Il est mémorisé (`settings.desktopZoom`) et réappliqué avant le premier affichage. Une pastille « 100 % » dans la barre d'état montre le niveau et revient à 100 % au clic.
- **Panneau Logs** : nouvel onglet du panneau bas (`Ctrl+Maj+L`, ou bouton dans les outils du chat) avec compteur d'erreurs. Les erreurs HTTP 4xx/5xx, les pannes réseau (ETIMEDOUT, ECONN…), les refus de modération et les erreurs de l'interface y sont horodatés avec leur code, leur source et un filtre Tout / Erreurs / Avertissements / Réseau, plus la recherche, la copie et le vidage. Les messages d'erreur du service gagnent un bouton « Ouvrir les logs ». Le journal reste local : aucun contenu de conversation ni secret n'y est ajouté, et rien n'est envoyé.
- **Animations de réflexion** : indicateur d'activité redessiné et ligne « Il réfléchit… » au bas du chat, qui change de formule et disparaît dès le premier mot de la réponse. Curseur d'écriture sur le message en cours, arrivée douce des messages, tremblement discret sur les erreurs. L'historique rechargé s'affiche sans animation.
- **Boutons plus nets** : enfoncement à l'action, soulèvement au survol, cercle d'envoi pendant la requête, cartes du cockpit et d'accueil qui réagissent. Tout est neutralisé quand Windows est réglé sur « réduire les animations ».
- **Mise en page consolidée** : rail de navigation sur toute la hauteur (logo en haut, outils en bas), logo agrandi à 24 px, titre du produit lisible. Le chat et le panneau du bas s'arrêtent exactement au-dessus de la barre d'état (24 px), les onglets du panneau restent sur une ligne et commencent à gauche, et la barre d'état ne rogne plus ses pastilles. Cockpit, Paramètres, Extensions et Motion couvrent exactement la surface restante à toutes les tailles. Sous 900 px, la colonne des fichiers est réellement repliée : `Ctrl+B` et le surlignage des onglets restent cohérents.
- **Cartes d'action lisibles** : texte à droite de l'icône, descriptions qui ne se coupent plus mot par mot, cartes de même hauteur, libellés du panneau 100 % affichés.
- Vérifié : captures réelles à 900, 1024, 1280, 1500 et 3440 px de large, zoom 120-175 % sur le chat et le panneau, panneau Logs rempli par des erreurs simulées. `npm test` au vert ; les tests d'interface `workbench`, `chat-layout`, `project-studio`, `extension-center` et `desktop` passent, y compris `workbench`, qui échouait avec la mise en page précédente.

## [1.5.19] — Roblox Studio via MCP réellement pilotable

- **`execute_luau` refusé avec « datamodel_type is required » (capture utilisateur)** : l'extension Roblox Studio lit les métadonnées de protocole dans `params._meta` et non dans l'ancien message `initialize`. Le client MCP envoie désormais `io.modelcontextprotocol/protocolVersion` et `clientCapabilities` à chaque appel d'outil. Vérifié contre le Studio réellement ouvert : l'exécution répond `OK`.
- **Identifiants Studio fournis par l'application** : `auth_token` (lu dans `%LOCALAPPDATA%\Roblox\StudioMCP\auth.token`) et `studio_id` (découvert une fois par la liste des studios ouverts) ne sont plus jamais demandés au modèle ni affichés dans le chat. La session est oubliée à chaque redémarrage du serveur.
- **`search_game_tree` fonctionne aussi** : le serveur exige `datamodel_type` sur toutes ses opérations, pas seulement l'exécution. Le mode par défaut est `Edit` (le Play reste un choix explicite).
- **Conseils explicites quand la session manque** : jeton absent, Studio fermé ou extension déconnectée produisent une explication actionnable au lieu de l'erreur brute du serveur.
- **`roblox_env`** : un outil déclaré dans `aftman.toml`/`rokit.toml`/`wally.toml` mais encore introuvable indique qu'il faut redémarrer l'application (les binaires Aftman n'entrent dans le `PATH` qu'au démarrage suivant).
- **Fil refusé par le service (HTTP 409)** : si la reprise immédiate échoue aussi, la demande est reconstruite depuis l'historique local avant de renoncer, au lieu d'afficher « La requête n'a pas abouti ».
- Vérifié : serveurs MCP démarrés et outils listés, capture d'écran réelle de Studio, `execute_luau` et `search_game_tree` réussis sans aucun identifiant fourni, `rojo build` et `rojo sourcemap` exécutés sur un projet de test.
- **Constat de connexion** : la connexion par e-mail réussit, mais l'échange de jeton (`/api/auth/api-token`) renvoie `Invalid client metadata` (HTTP 400) avec un nouveau compte. C'est côté service, sans rapport avec l'interface ; l'erreur actuelle ne le dit pas assez et sera rendue explicite à la prochaine version.

## [1.5.18] — Thème « Onyx » : noir profond, identité d'assistant IA

- **Plus aucun bleu** : les jetons `--accent` et `--link` ne sont plus des couleurs de marque mais le blanc cassé ; sélection, focus, boutons principaux et indicateurs de quota passent en neutralité. Les anciens bleus d'IDE codés en dur (`#0078d4`, `#007acc`, `#00a2ff`, `#3979dc`, `#5b8cff`), les thèmes `midnight` et les icônes de fichiers bleues sont retirés. Seules les couleurs sémantiques (erreur, avertissement, succès) restent colorées.
- **Noirs neutres** : base `#08090a`, barres `#050506`, surfaces `#0d0e10`, survol `#141518`, actif `#1b1d21`. Aucune teinte froide. Contraste mesuré dans l'application : texte principal 14,24:1, navigation 18,83:1, bouton Envoyer 18,07:1.
- **Identité de chat d'IA** : messages de l'assistant hors bulle, en grande lecture (13,5 px, interligne 1,72), bulle utilisateur arrondie 16 px, cartes d'outils et de plan sur surface avec bordure de 1 px. Compositeur en champ large arrondi 18 px avec ombre douce, boutons d'action en pastilles, accueil de l'assistant avec un titre plus grand et des cartes en grille.
- **Fenêtre étroite corrigée** : entre 900 et 1 100 px, le chat est borné (300 à 360 px) pour laisser lire la colonne de code ; sous 900 px, la barre latérale se range automatiquement. Les onglets du panneau inférieur s'enroulent au lieu d'être tronqués ou de défiler, et la barre de défilement qui coupait la zone centrale est supprimée.
- Vérifié par captures réelles à 1440×900 et 900×600.

## [1.5.17] — Interface « Cendre », panneau Git retiré, sous-agents spécialisés

- **Thème « Cendre »** : palette entièrement recomposée sur des gris très sombres (`#0a0b0e` → `#23262e`), accent bleu remplacé par un bleu froid `#5b8cff` réservé aux liens, boutons principaux en blanc cassé. Contraste mesuré dans l'application réelle : 11,56:1 pour le texte principal, 15,81:1 pour la navigation, 10,75:1 pour l'onglet actif. Les anciennes couleurs codées en dur (barre d'état, terminal xterm, palette de commandes, écran de démarrage, cartes d'extension, aperçu web) suivent désormais les jetons.
- **Moins « Visual Studio »** : la colonne latérale passe de 132 px à 168 px avec des onglets neutres (plus de barre d'accent ni de fond bleu), des séparateurs gris au survol, une barre de titre plate à 34 px, des onglets de fichiers en cartes arrondies sans soulignement, et des en-têtes de panneaux uniformes. Les cartes de démarrage passent en une colonne sous 1 200 px et les onglets du panneau inférieur défilent au lieu d'être tronqués sous 900 px.
- **Panneau Git retiré** : plus d'onglet « Versions », de raccourci `Ctrl+Maj+G` ni de vue Git. Le compte, le remote et les releases passent par le **connecteur GitHub** (palette `Ctrl+Maj+P`), qui gagne la connexion par token, la liaison et la création de dépôt sans dépendre de l'ancien panneau. `push`, `pull`, `fetch` et le commit restent dans la palette et le terminal ; les fichiers modifiés restent dans l'onglet Modifications.
- **Sous-agents spécialisés** : l'outil `task` accepte un `role` (`roblox-luau`, `roblox-interface`, `roblox-3d`, `blender`, `general`). Chaque rôle ajoute les conventions du métier au compte rendu, ce qui permet d'explorer l'interface et la scène en parallèle sans gonfler le contexte principal. Les sous-agents restent **en lecture seule** : c'est l'agent principal qui applique les modifications, donc aucune écriture concurrente. Un rôle inconnu est refusé explicitement.
- **Rappel de la demande** : les suivis (tours 2 et suivants) rappellent la demande utilisateur et la liste des outils réellement enregistrés pour l'espace courant. Corrige les dérives vers un objectif voisin sur les tâches longues, sans appel modèle supplémentaire.
- **Questions interactives** : un QCM mal formé par le modèle (choix uniques, en double ou invalides) ne suspend plus la tâche ; l'interface retombe sur une réponse libre et conserve les choix exploitables. La question reste obligatoire.
- **Suppression de fichiers** : consigne explicite d'utiliser `delete_path` avec un chemin relatif au projet, jamais `rm`, `del` ou `Remove-Item`.
- **GitHub** : lier un dépôt explique clairement que la liaison ne télécharge aucun fichier, refuse un dossier qui n'est pas un dépôt Git et demande une confirmation avant de remplacer un remote `origin` existant. Les erreurs MCP « not a git repository » indiquent le dossier de lancement à vérifier.
- **Relances réseau** : plus d'attente inutile après un HTTP 409 (reprise immédiate dans un nouveau fil) ; les HTTP 408/429 respectent l'en-tête `Retry-After` du service, borné à 60 s.

## [1.5.16] — Skills auto-installés, arbre Roblox Studio, tableau de bord Rojo et Wally

- **Skills automatiques** : le catalogue de l'agent propose désormais aussi la bibliothèque embarquée (Roblox, Blender, qualité). `use_skill` installe le skill à la volée s'il n'est pas encore sur le disque : l'agent ne répond plus « ce skill n'est pas installé ».
- **Préchargement contextuel** : dès qu'un projet contient `default.project.json`, `wally.toml`, `.luaurc`, un fichier `.luau` ou `.blend`, les skills Roblox (et Blender si un `.blend` est présent) sont écrits dans `.frst/skills/`. Corrige aussi le préchargement côté application de bureau : il ne se déclenchait jamais auparavant.
- **Arbre Roblox Studio** : un bouton dans l'explorateur bascule entre les fichiers et la scène du jeu (Workspace, ReplicatedStorage, ServerScriptService…), lue depuis `default.project.json`. Un clic sur un script ou un modèle ouvre le vrai fichier ; les dossiers `init.luau` deviennent des ModuleScript, les chemins absents sont signalés.
- **`roblox_scene`** accepte `tree: true` et renvoie la même hiérarchie à l'agent.
- **Tableau de bord Rojo en direct** : la barre d'état affiche Rojo en vert quand Studio est connecté, en orange en attente et propose le panneau Rojo. Un onglet « Rojo » ajoute les actions `rojo build` (recompiler) et la relance de la sourcemap, avec l'état du dernier build et les scripts modifiés depuis.
- **Wally** : détection de `wally.toml`, boutons `wally install` et `wally update` dans l'explorateur, indexation des paquets de `Packages/` et `ServerPackages/` (listés et cliquables), alias `.luaurc` ajoutés pour que luau-lsp les complète.
- **Interface resserrée sur Roblox et Blender** : la barre d'activité à icônes (style Visual Studio) devient une barre latérale à onglets texte — Fichiers, Studio, Versions, Recherche, Cockpit. Worktrees, marketplace SkillsMP et motion design sont retirés de l'interface (modules morts supprimés côté bureau).
- **Corrections** : la barre latérale reprend sa place sous la barre de titre (elle était clippée à 42 px), le mode plein écran du chat la masque de nouveau, `uninstallCenterSkill` restaurée (la confirmation de désinstallation était cassée), boutons d'action du chat de nouveau cliquables en fenêtre étroite, centre d'extensions sans débordement sous 1050 px, requêtes LSP attendues au lieu de « `sync is not a function` ».

## [1.5.15] — Mises à jour automatiques silencieuses sans assistant

- Suppression de l'assistant d'installation NSIS : configuration en mode un clic direct (`oneClick: true`, `perMachine: false`) pour installer automatiquement l'application dans le profil utilisateur sans demander pour qui l'installer ni afficher d'étapes manuelles.
- Installation des mises à jour entièrement silencieuse (`updater.quitAndInstall(true, true)`) : l'application applique la mise à jour en arrière-plan sans boîte de dialogue et redémarre directement avec la nouvelle version.
- Maintien de l'emplacement d'installation, des projets et des paramètres existants.

## [1.5.14] — Thème sombre intégral et nouveau logo officiel

- Mode sombre complet : activation du thème sombre natif Electron (`nativeTheme.themeSource = "dark"`) et application de `color-scheme: dark` sur l'ensemble de l'interface, des composants et des contrôles pour éviter tout flash blanc.
- Élimination des fonds blancs résiduels sur l'hôte de prévisualisation web et le navigateur local.
- Nouveau logo officiel : intégration de l'emblème vectoriel avec hexagone, contours de la France et « R » stylisé dans `desktop/renderer/assets/francestudent-logo.svg`.
- Régénération des assets haute définition `francestudent-logo.png` et `desktop/icon.png` (1024 × 1024).
- Maintien des données de projet, de l'identité de l'application et des canaux de mise à jour.

## [1.5.13] — Dépendances figées pour la release Windows

- `package-lock.json` est de nouveau versionné (retiré du `.gitignore`) : le workflow **Publier les exécutables Windows** installe exactement les mêmes versions que le poste de développement, au lieu de résoudre les dépendances à la volée.
- Élimine la divergence de versions natives (`sharp`, `7z-wasm`) suspectée dans l’échec `test/document-conversion.test.js` (`Unable to deserialize cloned data…`) observé uniquement sur le runner GitHub : les tests passent en local (810 pass, 0 fail).
- Gab-Desing reste le nom de création ; la publication reste sur `leo51500/francestudents-code-Roblox`.

## [1.5.12] — Dépôt de publication leo51500

- La publication GitHub, les mises à jour automatiques et les liens de téléchargement pointent désormais vers `leo51500/francestudents-code-Roblox` (`package.json`, `desktop/startup-updates.js`, interface et documentation).
- Gab-Desing reste le nom de création : les crédits d’origine sont conservés partout.

## [1.5.10] — Installateur allégé

- L’installateur Windows ne contient plus les binaires de la dictée locale destinés à Linux et macOS (environ 125 Mo) ni les moteurs GPU DirectML et dxcompiler (environ 36 Mo) : la dictée tourne avec le processeur (`device:"cpu"`), comme avant.
- Les variantes WebAssembly inutilisées d’`onnxruntime-web` (asyncify, WebGPU, JSPI) sont retirées du paquet ; la variante CPU utilisée par le worker de dictée reste. `onnxruntime-node` et `onnxruntime-web` restent déclarés comme dépendances, donc toujours inclus par electron-builder, mais sont nettoyés à l’empaquetage.
- Nouveau hook `scripts/after-pack.js` branché sur `build.afterPack`; il ne touche qu’à la copie de build, jamais à `node_modules`.
- Résultat mesuré : `FranceStudentCodeRoblox-1.5.10-setup.exe` pèse environ 208 Mo au lieu de 291 Mo. Le chargement du moteur ONNX et la création d’un tenseur ont été vérifiés dans le paquet produit.

## [1.5.9] — Nouveau logo dans toute l’application
- Remplacement des couleurs par l’emblème blanc que tu as fourni dans l’écran de démarrage, la barre de titre, l’accueil, les nouveautés et le logo d’interface exporté.
- L’icône Windows garde une variante bleue contrastée pour être visible sur le bureau, la barre des tâches et les tuiles sombres.
- Mise à jour des assets avec `node scripts/make-logo.js` ; l’identité d’installation, les données et le canal de mise à jour ne changent pas.

## [1.5.8] — Le build Windows de la release se lance enfin

- Cause du run rouge sur `d656e20` (« 1.57 release ») : `auto-release.yml` appelle `release-win.yml` via `workflow_call`, mais ce dernier n’avait plus que les déclencheurs `release` / `workflow_dispatch`. GitHub rejetait le fichier entier avec « workflow is not reusable as it is missing a `on.workflow_call` trigger » : même la création de la fiche `v1.5.7` n’a pas eu lieu.
- `release-win.yml` expose de nouveau un déclencheur `workflow_call` avec l’entrée `tag` (utilisée par le dispatch manuel et le checkout), et retombe sur l’événement `release` pour une publication faite à la main.
- Le correctif est livré en 1.5.8 : 1.5.7 n’a jamais eu de release publiée, aucun tag public n’est réutilisé.

## [1.5.7] — Publication automatique déclenchée

- Le dépôt distant ne contenait aucune release : l’automatisation n’avait donc jamais publié. Cette version relance le workflow **Publication automatique** depuis `main`, qui crée la fiche `v1.5.7` puis lance le build Windows.
- Avant de conclure à une panne du workflow, vérifier dans **Actions** qu’un run existe : un push sur `main` peut aussi être refusé si les Actions sont désactivées dans les réglages du dépôt.

## [1.5.6] — Relance manuelle et préreleases

- Le workflow accepte une relance depuis `main` et refuse toute version différente de `package.json`.
- Les versions avec suffixe sont publiées comme préreleases GitHub.

## [1.5.5] — Publication automatique plus fiable

- Les notes de release sont générées par `scripts/release-body.js` au lieu d’une commande `node -e` insérée dans le workflow : un résumé absent ou illisible ne bloque plus la création de la fiche.
- Le tag est nettoyé de tout retour à la ligne avant `gh release create`.
- Le build Windows ne se lance que si la fiche vient d’être créée ; une release existante n’est jamais reconstruite inutilement.
- `CONTRIBUTING.md` explique le diagnostic quand aucune release n’apparaît : Actions activées, permissions d’écriture du jeton, nouvelle version requise.

## [1.5.4] — Studio synchronisé et modèles Blender vérifiés

- **Rojo géré par l’IDE** : nouvel outil `rojo_serve` (start / status / stop / connect). Le serveur réserve un port réellement libre, écoute uniquement sur 127.0.0.1 et indique si Roblox Studio est connecté. La barre d’état affiche le port et l’état de synchronisation.
- `roblox_env` action `studio` démarre maintenant le serveur au lieu de seulement écrire une commande à copier.
- **Test réel dans Studio** : nouvel outil `roblox_playtest` (build Rojo, ouverture de la place dans Roblox Studio, relecture des erreurs du dernier log Studio via `action:"logs"`).
- **Blender : validation réelle** : `blender action:"validate"` lance `validate_model.py` dans Blender et vérifie triangles par mesh, UV, normales, arêtes non-manifold, faces dégénérées, transformations non appliquées, taille en studs et textures trop grandes.
- **Boucle Roblox ↔ Blender** : actions `manifest` (manifeste JSON avec taille en studs lue dans le GLB), `import_roblox` (copie dans `src/ReplicatedStorage/Assets` + étapes Studio) et `export_blender` (`.blend` → GLB propre pour Roblox).
- **Nouveaux modèles Blender** : `prop_tree.py`, `prop_weapon.py`, `prop_panel.py`, `tile_ground.py`, plus `validate_model.py` et `export_for_roblox.py`.
- `inspect` renvoie désormais la taille en studs du GLB et le manifeste associé.

## [1.5.3] — Version Windows uniquement et nouveau logo

- L’interface affiche le nouveau logo : hexagone bleu, « R » en creux et éclats blancs, en SVG vectoriel net à toutes les tailles.
- La fenêtre et l’installateur Windows utilisent la même icône, régénérée en 1024 × 1024 (`desktop/icon.png`).
- `scripts/make-logo.js` repart directement de `desktop/renderer/assets/francestudent-logo.svg` et ne génère plus que l’icône Windows.
- **Release à chaque modification** : `.github/workflows/auto-release.yml` se déclenche à chaque push sur `main` et publie la release Windows correspondant à la version de `package.json`.
- Coloration Luau : la classe de caractères des crochets est corrigée (`[\]`), plus aucune perte de caractères dans les commentaires longs.

## [1.5.2] — Nouveau logo

- L’application affiche le nouveau logo hexagone bleu, dessiné en SVG vectoriel : il reste net dans la barre de titre, au démarrage et sur l’écran d’accueil.

## [1.5.1] — Fournisseurs personnalisés en bêta

- Ajout de profils personnalisés avec nom, modèle, URL et clé API.
- Les clés sont conservées dans le coffre sécurisé du système et ne sont jamais exposées au renderer.
- Le routage compatible OpenAI est disponible depuis le sélecteur de modèle.
- Le compte FranceStudent et son fonctionnement restent inchangés par défaut.

## [1.5.0] — Pièces jointes PDF plus fiables

- Les PDF mal classés dans la file d’images sont automatiquement redirigés vers le traitement local des documents.
- L’IDE n’envoie plus un PDF à la route réservée aux images PNG/JPEG/WEBP.
- Les erreurs HTTP 400 de pièce jointe ne sont plus présentées comme une incompatibilité du protocole d’outils.

## [1.4.9] — Outils agent plus fiables

- Les appels d’outils natifs complets sont récupérés même si le fournisseur ajoute une erreur de flux générique.
- Les erreurs de protocole restantes sont présentées sans suspendre abusivement les résultats déjà reçus.

## [1.4.8] — Questions et interface plus lisibles

- Les questions interactives tolèrent les choix incomplets ou mal formés et basculent proprement vers une réponse libre au lieu de suspendre la tâche.
- Les consignes et commandes des questions sont affichées sur plusieurs lignes, avec les séparateurs de commandes lisibles.
- Les onglets Conversation, Activité et Usage disposent d’un espacement et d’une zone cliquable cohérents.
- Le quota du compte s’actualise automatiquement toutes les cinq requêtes modèle sans ajouter de requête au modèle.

Historique du fork d’amélioration de **extraopaa**. **FranceStudent IDE est un projet de [Gab-Desing](https://github.com/Gab-Desing/francestudents-code-Roblox).** La numérotation du fork est indépendante des tags historiques du dépôt amont.

## [1.5.6] — Publication automatique corrigée
- Le workflow n’ignore plus les pushes de documentation ; tout push sur `main` peut le déclencher.
- `workflow_dispatch` permet de relancer depuis `main` ; la version est contrôlée contre `package.json`.
- Les préreleases sont détectées par leur suffixe de version.
- La procédure de diagnostic distingue l’absence de déclenchement d’un run en échec.

## [1.4.7] — Plans agent et suppressions plus fiables

- Les mises à jour de plan acceptent les formats de réponse courants des modèles ; les longues listes sont limitées localement et un plan vide ne bloque plus le travail.
- L’agent reçoit une consigne multiplateforme claire : supprimer avec l’outil sécurisé de l’IDE, jamais une commande shell dépendante de Windows ou Unix.
- Aucun appel IA supplémentaire n’est ajouté pour normaliser un plan.

## [1.4.6] — Reprises agent moins coûteuses

- Après un conflit de flux (HTTP 409), le nouveau fil reçoit la tâche et les résultats récents sans renvoyer l’index complet du projet.
- Une réponse d’outil invalide reçoit au plus la correction déjà prévue. Si le protocole reste invalide, l’IDE explique localement le blocage au lieu de lancer une requête modèle supplémentaire en lecture seule.
- Si l’agent affirme sans preuve qu’il ne peut pas accéder aux fichiers du projet sélectionné, l’IDE vérifie une fois le dossier localement puis lui demande de poursuivre ; un refus utilisateur ou une véritable erreur d’accès n’est jamais contourné.

## [1.4.5] — Dictée locale et quota mieux maîtrisé

- Dictée vocale transcrite sur l’ordinateur avec Whisper et le processeur, sans envoyer l’audio à FranceStudent ni consommer le quota. Le modèle (environ 100 Mo) est téléchargé une fois avant l’accès au micro ; la transcription reste un brouillon modifiable.
- L’ouverture d’un projet et les changements de fichiers mettent à jour l’index local sans appel IA. La génération d’un résumé IA est explicite avec `/index` et réutilise le cache.
- Le moteur local est isolé dans un worker annulable ; l’audio et les échantillons sont effacés après traitement.

## [1.4.4] — Moins de répétitions, des connecteurs mieux guidés

- Lorsqu’un modèle nie l’accès à une application MCP sans l’avoir essayé, récupération locale du schéma réel d’un outil avant la reprise unique. Validation, hooks, annulation et affichage habituels conservés ; aucune commande de l’application exécutée automatiquement par cette découverte. Pas de reprise en mode plan/Éco ni après un refus ou une tentative réelle, y compris dans un lot.

- Images classiques : uploads identiques réutilisés uniquement au sein du même envoi ; copies strictement identiques transmises une seule fois à la vision, avec correspondance explicite des positions d’origine. Aucun rééchantillonnage supplémentaire ni cache interconversation ; un nouvel envoi explicite est toujours traité.
- Ajout des pièces jointes sérialisé pour éviter les traitements concurrents ; même nom et même taille ne suffisent plus à supprimer un fichier dont le contenu diffère. Les petites lectures restent inchangées si une référence serait plus coûteuse que leur contenu.
- Analyse IA automatique du projet rétablie à la demande du contributeur : reprise du résumé inchangé, actualisation des seuls fichiers modifiés, /index pour forcer. Cette analyse peut consommer du quota.
- Consommation : lectures répétées identiques référencées dans la même conversation, sans modifier les résultats conservés ni les prompts de reprise. Gros JSON MCP/EffectCraft minifiés sans changer chaînes ou nombres ; journaux de vérifications réussies allégés avec détail complet accessible localement. Échecs et avertissements gardent leur traitement détaillé.
- Pièces jointes locales généralisées : sélection des ZIP et indexation ciblée automatiques pour tous, avec repli classique si la préparation locale est indisponible. Annuler la sélection n’envoie rien ; un index plein conserve les pièces déjà actives. Suppression de l’ancien réglage bêta.
- Préchargement des fichiers cités limité à un premier extrait de 160 lignes ; l’agent conserve les outils pour lire toute la suite selon le besoin.
- Fiabilité : erreurs de canal MCP contenues, appels dont le résultat est incertain non répétés automatiquement dans la tâche, véritables erreurs MCP signalées comme échecs. Correction des réponses d’outils invalides limitée au budget du protocole, sans relances réseau aveugles ni repli supplémentaire payant.
- Réponses SSE/MCP et arguments d’outils bornés pour limiter les risques de saturation mémoire ; événements SSE invalides rejetés avec une erreur lisible.
- Pour les captures MCP avec GPT 6.1 Sol uniquement : question courte de réception, réponse Oui/Non, sans description ni JSON obligatoires. Les autres modèles et pièces jointes conservent leur contrôle visuel existant. Une réception confirmée n’est pas présentée comme une description du contenu.
- Traduction des appels natifs OpenAI portant le nom d’un outil MCP disponible en appels `mcp_call` locaux, avec les permissions et l’isolation Code/Motion habituelles. Les noms ambigus ne sont pas choisis automatiquement.
- Lecture des appels `tool_calls` Chat Completions en plus des événements Responses, sans exécuter d’appel incomplet.
- Exemple concret de découverte MCP dans les nouvelles demandes ; une description de schéma ne compte plus comme une connexion vérifiée à l’application. Reprise unique conservée, sans boucle de relances.

## [1.4.3] — Ouvrir le projet sans consommer de quota IA

- Ouverture du projet sans génération IA automatique de RESUME.md : index local et cache existant uniquement ; résumé IA sur demande explicite avec /index, hors bêta également.
- Quota épuisé au démarrage : l’échec du résumé IA du projet est présenté dans la carte de quota, avec compte à rebours et vérification du reset. Le contexte partiel est expliqué ; le message technique reste replié.

## [1.4.2] — Pièces jointes locales en bêta expérimentale

- Fonction proposée uniquement via une option « Bêta expérimentale » dans les paramètres, désactivée par défaut et réversible ; traitement habituel conservé pour les autres utilisateurs.
- Choix des fichiers d’un ZIP avant l’envoi : inventaire local, recherche, cases à cocher et sélection globale ; aucun fichier non sélectionné transmis à l’agent.
- Archives et gros textes conservés dans un index local en mode agent : seuls l’inventaire et les passages demandés sont envoyés. Extraction, recherche et pagination sans appel IA ; images des archives envoyées sur demande seulement.
- Lecture complète toujours possible par blocs via `read_attachment`, avec séparation Code/Motion. Aucun modèle local à télécharger ni commande fournie par le document à exécuter.

## [1.4.1] — Un chat plus clair, des échanges plus légers

- Suppression de la jauge de contexte du chat et de son actualisation périodique ; la compaction automatique et le suivi du quota dans Usage restent disponibles.
- MCP et modèles OpenAI : rappel que les connecteurs sont exécutés par l’IDE, et une reprise unique lorsqu’un modèle déclare ne pas avoir accès à une application du catalogue sans avoir essayé MCP. Aucun contournement d’un refus ou d’un échec réel ; pas de reprise supplémentaire en mode Éco.
- Quota : nouvelles demandes allégées dans une conversation déjà initialisée, sans répéter le catalogue d’outils et les consignes inchangées. Réinitialisation au changement de configuration ou de conversation ; plus de relecture automatique du fichier actif ni de listing racine à chaque suivi. La demande utilisateur reste intégrale.
- Captures MCP : lecture du JSON visuel entouré de texte, une seule reformulation automatique sans renvoyer l’image si le format est incorrect, et suppression du double affichage des erreurs de soumission. Un accès visuel non confirmé reste signalé.
- ZIP joints au chat : conservation des fichiers lisibles lorsqu’une entrée est trop grosse ou illisible, avertissement explicite de lecture partielle et repli local sur 7-Zip pour les compressions ZIP non prises en charge par le premier lecteur.
- Plan de travail unique : compteur, progression et étapes mieux présentés, sans copie supplémentaire dans le fil ; les mises à jour conservent l’état ouvert/replié et le plan reste disponible dans l’historique/export.
- Plein écran Code/Motion sur toute la largeur et la hauteur utiles, sans centrage étroit ni barres latérales superflues.
- Un seul en-tête de conversation ; suppression du libellé Agent et de la barre projet/accès en doublon. L’accès reste réglable près de la saisie.
- Favoris, export, import Codex, mode Éco et options secondaires regroupés dans le menu Outils du chat ; informations de session repliables, sans perte d’historique.

## [1.4.0] — Un chat plus pratique, un environnement adapté

- Import local de skills téléchargés : fichier SKILL.md, dossier avec ressources ou archive ZIP, avec aperçu, choix de destination et activation explicite après installation.
- Environnement WSL optionnel par projet : commandes de l’agent, tâches, serveurs, diagnostics, Git en lecture et nouveaux terminaux utilisent la distribution Linux choisie. Vérification du dossier et des outils avant activation, adaptation des chemins et du prompt Linux, arrêt ciblé des groupes de processus sans fermer toute la distribution.
- Réglage de réflexion directement dans le chat pour les GPT compatibles connus. Niveaux filtrés par modèle et par l’API FranceStudent ; préférence du compte lue et enregistrée via gptReasoning, avec confirmation serveur et indication du coût potentiel.
- Consigne commune Code/Motion : exploiter les pièces jointes transmises sans rechercher leur original sur le PC, même en accès complet ; signaler un contenu inaccessible au lieu de parcourir les dossiers personnels.
- Choix du niveau d’accès depuis la saisie du chat : sur approbation, automatique ou accès complet, avec descriptions et mémorisation optionnelle, synchronisé avec les paramètres.
- Choix du modèle directement dans la saisie du chat et jauge du contexte de la conversation active, distincte du quota du compte, en Code et Motion.

- Questions interactives déclenchées par l’agent pendant les tâches : QCM, sélection multiple ou réponse libre, avec bouton Passer. L’agent reçoit la réponse puis reprend ; Full accès ne répond pas automatiquement aux questions.


- Répertoire de codes `FST-…` et message au redémarrage après un arrêt inattendu, avec raison disponible et diagnostic copiable. La cause reste explicitement inconnue si elle n’a pas pu être enregistrée.
- Journal technique local limité à 50 événements, sans messages, fichiers, jetons ni traces complètes ; aucun envoi automatique.
- Gestion des erreurs de connexion du terminal Windows, protection des envois à une fenêtre fermée et récupération contrôlée de l’interface après son arrêt.
- Affichage des réponses en flux regroupé ; les très longs messages restent complets dans un rendu texte léger. Le tampon initial des terminaux est borné.
- Fermeture : une erreur de nettoyage ne bloque plus les autres opérations d’arrêt.

## [1.3.5] — Quota et suivi du plan

- Suivi du plan commun à tous les modèles en Code et Motion : état du plan rappelé à chaque tour et cases actualisées depuis les réponses normales de l’agent.
- Suivi du plan intégré aux réponses normales : aucun appel supplémentaire uniquement pour les cases. Une erreur ou une interruption ne coche pas automatiquement les étapes restantes.
- Toutes les cinq requêtes de l’agent, un bref « Où en es-tu ? » demande une actualisation du plan dans le message déjà envoyé, sans appel supplémentaire.
- Consommation : messages de suivi allégés, catalogues et consignes initiales non répétés à chaque tour ; journaux longs raccourcis en conservant le début, la fin et les métadonnées d’erreur.

## [1.3.4] — Sécurité et migration des profils

- Sécurité : Electron 45.0.0, retrait des dépendances vulnérables et audit complet bloquant dans les workflows.
- Chiffrement système des connexions GitHub et des cookies FranceStudent, avec migration automatique des anciens profils.
- Vérification de la fenêtre et du frame émetteurs de tous les appels IPC natifs.
- Migration testée des anciens identifiants, réglages et historiques, sans modification de l’identité de mise à jour.

- Carte rouge « Conversation verrouillée » pour CHAT_LOCKED et les signalements du fournisseur, avec explication, indication d’ouvrir un nouveau chat et bouton « J’ai bien compris ». Aucun nouveau chat ni renvoi de demande n’est déclenché par ce bouton.






## [1.3.3] — 23 octobre 2026 · FranceStudent IDE et interface simplifiée

- Guide de reprise pour les contributeurs et assistants IA : point d’entrée AGENTS.md, contexte commun, repères d’architecture, tests et publication. Entrées légères Claude, Gemini et Copilot sans duplication de l’historique privé. Le workflow Windows lit désormais le nom attendu de l’installeur dans package.json.
- Validation générale : tests unitaires exécutés dans des dossiers de données isolés par processus, pour ne plus dépendre des préférences réelles de l’utilisateur ni les modifier. Protection des titres des anciennes conversations lors du passage au titrage IA.
- Identité visuelle commune aux fenêtres Mode Éco, import Codex, GitHub, skills, MCP et confirmations. En-têtes illustrés, sections, champs et boutons harmonisés, actions accessibles pendant le défilement, dispositions adaptées aux petites fenêtres. Remplacement des confirmations natives par des fenêtres de l’IDE, avec annulation au clavier.
- Application renommée FranceStudent IDE, avec conservation du dossier de données existant et de l’identité de mise à jour.
- Court écran de nouveautés au premier lancement de chaque version installée, consultable à nouveau dans les paramètres. Résumé embarqué, sans requête réseau supplémentaire.
- Cartes illustrées pour les erreurs API, avec explication et détail technique repliable. Quota épuisé : compte à rebours en heures/minutes et bouton « J’ai reçu un reset », confirmé uniquement par l’API. Actualisation silencieuse toutes les 15 minutes et vérification à l’échéance connue.
- Conversations récentes présentées en cartes, regroupées par date, avec titres courts proposés dans les réponses de l’agent sans requête supplémentaire. Les titres personnalisés sont préservés.
- Nouvelle conversation : effacement du chat visible en code comme en motion, sans supprimer les conversations sauvegardées.
- Skills : bouton Installer clarifié, remplacé après installation par Désinstaller en rouge. Action disponible dans les bibliothèques code/motion et les téléchargements communautaires associés.
- En-tête EffectCraft harmonisé, commandes de lecture plus lisibles ; retrait du bouton Agent redondant dans la barre latérale et des limites techniques du compte dans Usage.

## [1.3.2] — 23 octobre 2026 · Isolation motion, historique et vision MCP

- Vision MCP : les captures et ressources images renvoyées par les serveurs (notamment Roblox) sont préparées et jointes à la prochaine requête visuelle, au lieu d’être remplacées par du texte « non affiché ». Réception vérifiée par le circuit de vision existant ; une image invalide produit une erreur explicite sans masquer les autres résultats.
- Réouverture lisible des conversations : les anciens prompts techniques sont remplacés par la demande réelle, les tours internes sont masqués et les réponses/outils retrouvent les cartes du chat. Correction appliquée aussi aux historiques API déjà mis en cache ; les journaux complets des nouvelles conversations sont conservés.
- Isolation du motion design : contexte, outils, rendus, skills de projet, activité et historique distincts du code. Aucun chargement du dossier, des instructions, du profil, des hooks ou des serveurs MCP du projet code dans une tâche EffectCraft. Les outils de fichiers et de shell sont bloqués dans le chat motion, même en Full accès.
- Toute erreur « maximum token limit » déclenche la compaction et une tentative de reprise, quel que soit le plafond annoncé, même sans valeur numérique. Prise en charge des erreurs HTTP et des erreurs reçues dans le flux SSE.
- Plein écran du chat motion : l’éditeur EffectCraft ne recouvre plus le chat. Sortir du plein écran retrouve la composition et le brouillon ; changer d’espace rétablit l’affichage normal.

## [1.3.1] — 23 octobre 2026 · Skills motion, contexte et historique

- Nouvel onglet Motion design dans le centre d’extensions, accessible aussi par le bouton Skills d’EffectCraft. Le marketplace code SkillsMP reste séparé et conserve sa recherche habituelle.
- Huit skills natifs hors ligne : titres, logos, transitions, mouvements fluides, réseaux sociaux, infographies, sous-titres et export.
- Cinq skills de la collection officielle Remotion, sélectionnés selon les installations affichées sur Skills.sh au 23 octobre 2026 : bases, rendu, création, sous-titres et animation/mise en page. Source du classement et compatibilité affichées.
- Import Remotion avec ses ressources annexes, depuis une archive épinglée et vérifiée par SHA-256. Aperçu obligatoire, annulation et installation désactivée conservés. La recherche SkillsMP habituelle importe toujours seulement le SKILL.md.
- Catalogues de l’agent adaptés au moteur : EffectCraft dans le chat motion, Remotion dans le chat code. Aucun skill n’est installé automatiquement.
- Images : suppression de la question de mémoire périodique. Description visuelle vérifiée une seule fois à la réception ; images non renvoyées sur les tours suivants. Cette réception initiale utilise une requête par lot d’images. Un refus de vision est signalé avant d’exécuter la tâche.
- Compaction : suivi distinct de chaque conversation, restauration à la réouverture et consultation de l’occupation serveur pendant les tâches. L’erreur « maximum token limit of 250000 » déclenche une compaction et une reprise ; la limite réelle est mémorisée par modèle et service. Une reprise échouée conserve l’identifiant initial.
- Historique visible enregistré localement avec les messages, actions et résultats, indépendant du contexte compacté. Réouverture complète et récupération des anciens messages via l’API si aucun journal local n’existe. Les actions anciennes non conservées par le serveur ne peuvent pas être recréées.

## [1.3.0] — 23 octobre 2026 · EffectCraft piloté par le chat motion design

- Remplacement du studio canvas natif par le véritable éditeur EffectCraft 0.16.0, reconstruit depuis une révision épinglée avec une interface interne adaptée à FranceStudent. Sources des modifications et procédure de compilation incluses.
- Mode Simple par défaut : quatre outils lisibles, une grande composition et une timeline allégée. Le bouton Avancé retrouve les panneaux et outils complets. Palette, espacements et traductions des panneaux harmonisés avec l’IDE.
- Trois petits tutos : premier titre, mouvement, enregistrement et export. Ils préparent une demande modifiable sans déclencher l’IA ni consommer de quota.
- Chat spécialisé dans l’animation, consignes accessibles aux débutants, actions lisibles et contexte de code exclu des demandes motion.
- Interface harmonisée : thème sombre EffectCraft, en-tête compact, contrôles Lecture / Arrêter / Annuler / Enregistrer, éditeur sur toute la hauteur disponible, chat à droite.
- Conversations, modèles, brouillons et exports de conversation distincts entre code et motion design. Une tâche ou des demandes en attente doivent être terminées avant de changer de chat.
- Outil `effectcraft` pour l’agent : inspection, découverte des schémas de commandes, compositions, calques, textes, propriétés, keyframes, effets, lecture et rendus PNG consultables avec `view_image`. Les confirmations habituelles s’appliquent aux modifications ; Full accès reste disponible.
- Enregistrer sauvegarde dans le stockage local d’EffectCraft. Origine locale stable entre lancements pour retrouver ce stockage ; fermer l’onglet conserve le moteur et le projet ouvert. Le menu File d’EffectCraft permet les imports et copies de projet.
- Compatibilité WebGL activée pour éviter la perte de périphérique WebGPU constatée dans Electron. Les rendus lourds peuvent être plus lents ; l’intégration reste en bêta.
- Vérification du terminal PowerShell et du véritable moteur dans le paquet Windows 1.3.0. Test Electron avec des réponses IA contrôlées : création de composition, ajout d’un titre, rendu PNG, sauvegarde, modes Simple / Avancé, tutos et conservation du projet au retour dans l’onglet.

## [1.2.1] — 22 octobre 2026 · Studio motion design natif et message de budget épuisé

- Onglet **Motion design** : nouveau studio natif qui ne dépend plus d’EffectCraft. Il s’appuie sur un moteur sans DOM (easings, interpolation de keyframes, presets) couvert par des tests automatiques. Le rendu et l’ergonomie dans l’IDE n’ont pas encore été vérifiés visuellement.
- Message « budget de chat épuisé » (HTTP 429) : au lieu du texte brut avec le JSON de l’erreur, l’IDE affiche une carte intégrée au thème avec l’heure de reprise en heure de Paris, le temps restant et un bloc « Détails techniques » replié. Le CLI et le terminal affichent toujours le message d’origine.
- Limites : 4 tests automatiques étaient déjà en échec avant cette version (runCommand cd/cwd, policy denialReason, 2 confirmations desktop-backend). L’installateur n’est pas signé.

## [1.2.0] — 22 octobre 2026 · Motion design EffectCraft et images moins coûteuses

- Nouvel onglet **Motion design** : intégration d’EffectCraft v0.14.0 (version alpha), chargé depuis `desktop/vendor-effectcraft`. Ce dossier n’est pas versionné ; il se télécharge avec `npm run vendor:effectcraft`. Le rendu WebGPU dans Electron et le pilotage de la timeline ne sont pas encore vérifiés.
- Images jointes : elles ne sont plus renvoyées automatiquement à chaque requête de la même conversation. Toutes les cinq requêtes, l’agent est interrogé (sans images ni outils) pour savoir s’il se souvient encore des images ; en cas de réponse négative, d’hésitation ou d’erreur, elles sont renvoyées. Le découpage en lots de quatre images n’a pas changé.
- Crédits mis à jour pour EffectCraft.
- Limites : la mémoire des images dépend du modèle et du fournisseur ; la question de contrôle consomme une petite requête.

## [1.1.7] — 22 octobre 2026 · Interface harmonisée et connecteur GitHub bêta

- Refonte visuelle de l’espace de travail : couleurs, espacements, boutons, navigation, accueil, chat, cartes, dialogues et panneaux cohérents. Meilleure adaptation aux petites fenêtres.
- Catégories dans les paramètres, recherche dans toutes les sections et focus clavier visible.
- Désinstallation accessible depuis la bibliothèque et les skills installés, avec confirmation et conservation dans `.trash`. Les connexions MCP peuvent être retirées ; leur programme externe n’est pas désinstallé.
- Téléchargements de skills : progression réelle en octets, annulation et nouvelle tentative. Les instructions restent consultables avant installation, désactivées par défaut pour les skills communautaires.
- Connecteur GitHub **Bêta** : consultation des dépôts, issues, PR et releases ; brouillons de release, ajout de fichiers et publication explicite. L’agent peut lire et modifier des fichiers distants, créer des commits avec une liste de fichiers, pousser, créer des PR et des issues selon les permissions du token.
- Full accès : bouton d’annulation par action, sans nouvelle confirmation systématique et sans arrêter toute la tâche. Annulation des modifications suivies disponible après l’action ; les effets de commandes ou opérations distantes déjà terminées ne sont pas automatiquement réversibles.
- Images conservées dans les requêtes suivantes de la même conversation, du même modèle et du même projet, jusqu’à quatre images récentes. Les envois en lots conservent les observations visuelles et joignent les quatre dernières images à la demande finale. La vision reste dépendante du modèle et du fournisseur ; renvoyer les images peut consommer du quota.

## [1.1.6] — 22 octobre 2026 · Boutons et suivi de consommation

- Boutons de conversation redessinés : icônes cohérentes, badge Bêta séparé, état du mode Éco et disposition adaptée à la largeur du panneau.
- Jauge de quota cliquable et nouvel onglet Usage avec quota restant, réinitialisation et limites du compte.
- Compteurs de requêtes et tokens de session, avec distinction entre estimations et relevés réels.
- Consultation et actualisation de l’usage pendant une tâche, sans lancer de génération IA ni perdre le brouillon.

## [1.1.5] — 22 octobre 2026 · Liens partagés Codex

- Reconnaissance du format de partage Codex `https://chatgpt.com/s/cx_…`.
- Lecture de l’instantané public chargé par la page, au lieu de rechercher la conversation dans un HTML vide.
- Import des messages utilisateur, commentaires et réponses de l’agent dans l’ordre, sans appliquer les différences de fichiers ni importer les résumés internes.
- Exemple de lien et documentation de l’import actualisés. Correction vérifiée sur un lien réel et couverte par un test de régression.

## [1.1.4] — 22 octobre 2026 · Fichiers, mode Éco et reprise de conversation

- Prise en charge élargie des fichiers : PDF, SVG, documents Office, présentations, tableaux, archives et extraction de contenu avec signalement des limites.
- Glisser-déposer et pièces jointes nombreuses envoyées en lots ; avertissement de quota dès cinq fichiers.
- Mode Éco avec explication avant activation, contexte automatique réduit et agent limité à quatre tours.
- Import de conversation Codex en bêta pour continuer dans le projet déjà ouvert avec un autre modèle.
- Historique repositionné dans la fenêtre, noms des modèles et confirmation de suppression désactivable.
- Boutons Démarrer, Arrêter et Ouvrir le site dans les réponses contenant une commande de serveur local reconnue.
- Récupération des appels d’outils locaux rejetés par le backend et diagnostics réseau plus précis.
- Compaction du contexte adaptée au modèle sélectionné.
- Choix de mise à jour au démarrage et README simplifié, accompagné d’un guide avancé.

Installateur Windows x64 avec les fichiers nécessaires aux mises à jour. Les versions portables restent locales.

## [1.1.3] — 22 octobre 2026 · Navigateur local, images et pièces jointes

### Navigateur et interface

- Serveurs localhost ouverts dans un onglet Chromium indépendant, avec une barre inspirée du Simple Browser de VS Code : adresse, précédent/suivant, actualiser et ouverture externe.
- Ouverture depuis les liens du chat, du terminal et le champ d’adresse de l’ancien aperçu.
- Stockage local, appels API et WebSockets fonctionnels, même pour les pages refusant l’affichage en iframe.
- Message d’erreur et bouton Réessayer quand le serveur est indisponible ; retour aux onglets de code sans perdre leur contenu.
- Écran de démarrage du chat réorganisé : cartes alignées, icônes homogènes et actions de contexte lisibles.
- Enregistrement automatique du modèle par défaut à la sélection, avec confirmation dans les paramètres et conservation après redémarrage.

### Images et captures de l’agent

- Préparation commune des images avant téléversement, y compris les captures ouvertes par `view_image` : copie limitée à 6000 pixels par côté et 5 Mo, original conservé.
- Correction du refus Claude pour les captures dépassant 8000 pixels ; reprise textuelle possible si une ancienne image hors limites reste dans l’historique serveur.
- Dimensions et avertissement de lisibilité renvoyés à l’agent après réduction d’une capture.
- Avertissement pour les pièces jointes du chat fortement réduites ou compressées ; confirmation avant envoi avec conservation du brouillon en cas d’annulation.
- Arrêt des relances répétées pour les erreurs de requête définitives du fournisseur.

### File d’attente

- Prompts accompagnés de fichiers et d’images, modification des pièces jointes et affichage de leurs noms dans la file.
- Conservation locale des pièces jointes avec leur tâche après redémarrage, stockage séparé et borné.
- **Orienter** transmet aussi les fichiers à la prochaine étape de l’agent ; une consigne non transmise reste en attente si la tâche s’arrête.
- Nettoyage des fichiers liés lors du retrait d’une demande ou de l’effacement des tâches terminées.

### Distribution

- Validation : 562 tests unitaires réussis, 3 ignorés et 12 parcours Electron réussis. Démarrage et redimensionnement d’une grande capture vérifiés dans le paquet Windows.
- Installateur Windows x64, `.blockmap`, `latest.yml` et empreinte SHA-256 sur GitHub. Les versions portables restent exclusivement locales.
- Projet original de **Gab-Desing** ; cette version est une amélioration du fork maintenu par extraopaa.

## [1.1.2] — 22 octobre 2026 · Images et démarrage

- Correction du prompt d’agent qui excluait à tort les capacités d’image.
- Indication explicite des pièces jointes visuelles dans la requête, sans inventer de description si la vision est indisponible.
- Validation de l’UUID d’image renvoyé par le téléversement ; erreur visible plutôt qu’une pièce jointe invalide.
- Conservation des téléversements réussis en cas d’échec d’une image suivante.
- 26 tests ciblés validés, dont le parcours image, les relances et les appels en arrière-plan.
- Lecture réelle de deux images de contrôle vérifiée sur le modèle API `gpt-5.6-terra`, en chat puis avec le protocole Agent. Les autres modèles n’ont pas été vérifiés individuellement.
- Écran de chargement au démarrage avec vérification des mises à jour, bouton pour continuer et délai limité en cas de service indisponible.
- Recherche des versions publiées aussi en mode portable, sans installation automatique.
- Suppression du sélecteur Agent / Plan de la saisie : les demandes utilisent directement le mode Agent.
- Sept tests ciblés de mises à jour validés ; démarrage, vérification publique, bouton de passage et délai de secours vérifiés dans Electron.
- Publication GitHub limitée à l’installateur et aux fichiers de mise à jour ; portable exclusivement local. Le workflow applique désormais cette règle.

## [1.1.1] — Compaction automatique

### Ajouté

- Compaction automatique entre deux appels lorsque le contexte approche de son budget estimé.
- Résumé des consignes, décisions, fichiers, vérifications et travail restant, puis reprise automatique de la demande.
- Récupération par compaction après un refus explicite pour contexte trop long.
- Messages de progression ; historique affiché et prompts en attente conservés.

### Fiabilité

- Conversation conservée si le résumé échoue ou reste vide ; mémoire locale bornée.
- 25 tests ciblés validés : compaction, relances API, annulation et pièces jointes.
- Démarrage du paquet Windows 1.1.1 et présence du code de compaction vérifiés.

### Distribution

- Installateur NSIS Windows x64 et exécutable portable.
- `latest.yml` et `.blockmap` pour les mises à jour de la version installée.
- Empreintes des exécutables dans `SHA256SUMS.txt`.

### À savoir

Seuil par défaut : 80 % d’un budget estimé de 100 000 tokens, réglable par `FS_AUTO_COMPACT_TOKENS`. La fenêtre exacte dépend du modèle ; le service ne la fournit pas. Le suivi du volume repart au redémarrage. La mise à jour complète depuis une installation précédente n’a pas encore été validée de bout en bout sur une release publique.

## 1.1.0 — Agent, cockpit et interface

Version de travail locale précédant la première release publique du fork. Les évolutions sont regroupées sans reconstituer des dates de publication intermédiaires.

### Agent et autonomie

- File de prompts intégrée : édition, suppression, ordre, pause, reprise et orientation.
- Autorisations simplifiées, Full accès et avertissement visible.
- Scripts PowerShell, commandes en arrière-plan et arrêt des processus.
- Recherche autonome, sources, captures et lecture d’images selon le modèle.
- Plan de travail, activité et points de reprise des outils de fichiers.

### Espace de travail

- Cockpit : scripts, commandes personnalisées, sorties, diagnostics et outils locaux.
- Prettier, comparaison, aperçu Markdown et HTML local isolé.
- Symboles, préférences d’éditeur, enregistrement automatique, thèmes et repères.
- Inspection des formats non éditables ; encodages UTF-8 et UTF-16.

### Extensions et compte

- Bibliothèque de skills, profils, import et marketplace SkillsMP.
- Gestion des serveurs MCP stdio et de leurs outils.
- Paramètres recherchables, budgets de contexte, connexion guidée et déconnexion.
- Préparation des mises à jour via GitHub Releases pour la version installée.

## Origine

L’historique du [projet de Gab-Desing](https://github.com/Gab-Desing/francestudents-code-Roblox) est conservé. L’éditeur, le terminal, le CLI et les intégrations existantes proviennent de cette base.

[1.1.1]: https://github.com/extraopaa/francestudents-ide/releases/tag/v1.1.1
[1.1.2]: https://github.com/extraopaa/francestudents-ide/releases/tag/v1.1.2
[1.1.6]: https://github.com/extraopaa/francestudents-ide/releases/tag/v1.1.6
[1.1.5]: https://github.com/extraopaa/francestudents-ide/releases/tag/v1.1.5
[1.1.4]: https://github.com/extraopaa/francestudents-ide/releases/tag/v1.1.4
[1.1.3]: https://github.com/extraopaa/francestudents-ide/releases/tag/v1.1.3

## [1.5.6] — Publication automatique corrigée
- Le workflow n’ignore plus les pushes de documentation : tout push sur `main` peut le déclencher.
- `workflow_dispatch` permet de relancer depuis `main` ; la version est contrôlée contre `package.json`.
- Les préreleases sont détectées par leur suffixe de version.
- La procédure de diagnostic distingue l’absence de déclenchement d’un run en échec.

## [1.5.6] — Publication automatique corrigée
- Le workflow n’ignore plus les pushes de documentation : tout push sur `main` peut le déclencher.
- `workflow_dispatch` permet de relancer depuis `main` ; la version est contrôlée contre `package.json`.
- Les préreleases sont détectées par leur suffixe de version.
- La procédure de diagnostic distingue l’absence de déclenchement d’un run en échec.

## [1.5.6] — Publication automatique corrigée
- Le workflow n’ignore plus les pushes de documentation : tout push sur `main` peut le déclencher.
- `workflow_dispatch` permet de relancer depuis `main` ; la version est contrôlée contre `package.json`.
- Les préreleases sont détectées par leur suffixe de version.
- La procédure de diagnostic distingue l’absence de déclenchement d’un run en échec.


## [1.5.6] — Publication automatique corrigée
- Le workflow n’ignore plus les pushes de documentation : tout push sur `main` peut le déclencher.
- `workflow_dispatch` permet de relancer depuis `main` ; la version est contrôlée contre `package.json`.
- Les préreleases sont détectées par leur suffixe de version.
- La procédure de diagnostic distingue l’absence de déclenchement d’un run en échec.

## [1.5.31] — Le chat suit le pointeur, projets personnels et partagés
- **Redimensionnement réellement en direct** : le chat, l’explorateur et le panneau inférieur suivent la souris pendant le geste, sans attendre une animation de rattrapage ; la bulle affiche la taille et la préférence reste mémorisée.
- **Projets FranceStudent** : liste également les projets partagés. Si le endpoint partagé est absent sur une instance, les projets personnels restent affichés et l’état l’indique.
- **Connexion et actualisation** : le message distingue session refusée, endpoint absent, refus de requête, erreur du service et panne réseau. L’actualisation se réactive après une erreur et le guide de reconnexion est accessible depuis le chat.
- Vérifié : `npm run build:renderer`, `npm run check:renderer`, tests ciblés API projets et Electron du chat/redimensionnement, `npm run lint`.
