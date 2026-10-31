# Historique du contexte — archives

> Sections conservées pour référence. Le document actif est [AI_CONTEXT.md](AI_CONTEXT.md) ;
> le journal des versions publiées reste [CHANGELOG.md](../CHANGELOG.md).

## Préparation de la release 1.4.0


Import local rétabli : desktop/local-skill-import.js, IPC localSkillImport, 55-local-skills.js et branche local de l’éditeur existant. Fichier Markdown, dossier et ZIP (une seule racine SKILL.md), ressources incluses, aperçu à token temporaire gardé dans main, choix nom/portée, skill désactivé, aucune exécution à l’import. Réutilisation des limites et contrôles de chemins de extension-center.install ; pas d’écrasement d’un dossier déjà installé. Limites : 200 ressources/4 Mo, profondeur 12, 1000 éléments de dossier, ZIP indexé avant décompression pour refuser les grandes archives. Le renderer ne transmet pas les octets des ressources lors de l’installation, seulement le token. Tests locaux : test/local-skill-import.test.js et import UI dans e2e/chat-composer.e2e.test.js.

Les nouveaux rappels de suivi sont compacts ; délimiteur RAPPELS INTERNES ajouté à la reconstitution d’historique pour ne jamais les confondre avec une réponse utilisateur. Le script WSL d’arguments est une chaîne ordinaire : ne pas le convertir en template JS sans traiter les expansions Bash. setsid --wait conserve le lien de durée de vie avec wsl.exe. Le test d’arrêt brutal accepte un code Windows non nul différent du 77 demandé : la fermeture forcée de ConPTY peut rapporter un fast-fail natif ; c’est la détection d’arrêt non propre qui est vérifiée.

### Finition des contrôles du chat

Le compositeur utilise deux rangées stables : `chat-model-row` (modèle, contexte, micro) et `chat-settings-row` (accès/réflexion). Réutiliser `chatControlContent` pour les icônes SVG, labels et chevrons. Les requêtes container de la saisie masquent le préfixe Réflexion sur panneau étroit pour garder la valeur lisible ; les outils secondaires restent identifiables par leurs titres et noms accessibles. Les boutons ont des états focus/hover cohérents et le micro un petit badge β. Ne pas revenir à une suite libre de textes et symboles qui se replie aléatoirement. Le test chat-composer vérifie le bouton Envoyer à 900×600 et l’aperçu a été contrôlé visuellement. La confirmation de suppression ferme explicitement le menu d’historique, y compris au clavier et après annulation.


### Refonte plein écran du chat (après 1.4.0, non encore publiée)

56-chat-layout.js regroupe les actions dans la navigation du chat, masque les anciens agent-header/agent-context-bar mais conserve leurs ancrages DOM utilisés par Motion, et déplace les outils secondaires existants dans un popover accessible chat-more-tools. Les IDs et handlers sont conservés. Le choix de mode et l’effacement d’affichage sont rangés dans ce menu. La sélection d’accès reste dans le compositeur. Pas de centrage max 900 px : focus-agent occupe tout l’espace utile, sans barre d’activité ni statut. Les rangées de contrôles se réunissent en une ligne lorsque le compositeur est large ; les cartes de démarrage sont en trois colonnes en plein écran large. Échap quitte le focus seulement hors tâche, dialogue, menu et commande slash. Code/Motion restent isolés ; le focus Motion masque puis restaure le vrai studio.

03-transcript.js replie uniquement les notices techniques de démarrage reconnues (connexion/projet/mémoire/indexation) et le message précis de transmission du projet, dans un groupe de session consultable. Aucun message utilisateur/assistant, erreur ou avertissement arbitraire supprimé. Le journal local et l’historique conservent les données originales. Les parcours import Codex, Éco et favoris passent désormais par chat-more-tools. Test dédié e2e/chat-layout.e2e.test.js : dimensions plein écran Code/Motion, retour par Échap, accessibilité du menu et vue étroite ; capture release/chat-fullscreen-next.png contrôlée visuellement. Parcours spécifiques du compositeur, import, Éco, file et migration Windows également passés. Cette refonte est séparée des assets 1.4.0 déjà publiés : ne pas remplacer leur contenu sous le même tag.



### Import ZIP de skills : exclusions cohérentes (1.4.1)


Le scénario de régression ZIP de test/local-skill-import.test.js (dépendances volumineuses et faux SKILL.md exclus) a réussi en préparation 1.4.1. L’utilisateur a ensuite précisé que son signalement concernait un ZIP joint au chat ; voir la section dédiée. Son archive exacte n’a pas été fournie.

### Plan de travail unique et présentation (1.4.1)

57-work-plan.js fournit le rendu commun du plan. Les événements plan sont toujours enregistrés via recordStudioEntry pour l’historique et l’export, mais n’ajoutent plus de carte dans le transcript : ils mettent à jour agent-live-plan. Le même composant est utilisé par renderAgentActivity. Les items texte historiques sont interprétés à partir de leurs marqueurs ✓/◉/○ et cases Markdown ; les données structurées steps sont privilégiées lorsqu’elles sont présentes. La carte conserve l’état ouvert/replié, le scroll des étapes et le focus du résumé ; des mises à jour identiques ne reconstruisent pas le DOM. Le composant utilise uniquement son état DOM pour pouvoir être appelé par les modules antérieurs à son chargement dans le bundle concaténé (pas de variable let tardive en TDZ).

La progression se fonde exclusivement sur les étapes completed. Un run terminé avec des étapes non vérifiées affiche À poursuivre, pas Terminé. Les plans relus dans l’historique sont repliés par défaut ; une nouvelle conversation réinitialise le plan. Les messages de l’agent demandent de ne pas recopier la liste du plan dans la réponse finale sans demande utilisateur ; il s’agit d’une instruction, pas d’une suppression heuristique des réponses. La carte reste accessible au clavier, indique aria-current=step et utilise des textes de statut accessibles.

Le scénario e2e/work-plan.e2e.test.js a réussi dans la suite complète puis dans les contrôles ciblés 1.4.1 : un seul plan après événements plan+activité, mises à jour, pliage, états incomplets, réinitialisation et relecture historique. Le build renderer a été régénéré et la capture plein écran contrôlée visuellement.

### ZIP joints au chat (1.4.1)

Le signalement concerne bien une archive jointe dans le chat que l’agent semble ne pas réussir à décompresser/lire. Les fichiers ne sont pas importés dans le projet : les contenus sont ouverts/converts localement, envoyés dans le texte des pièces jointes, et les images par les lots existants. Ne pas demander à l’agent de chercher l’original sur le PC.

src/api/archive-input.js ajoute allowPartial (désactivé par défaut) : en mode chat, une entrée dépassant 25 Mo ou le budget de décompression de 100 Mo est signalée sans décompression, tandis que les autres entrées sûres restent lisibles ; erreurs de flux/compression signalées par entrée. Les erreurs de structure, traversées de chemins et plus de 10 000 entrées restent des refus de l’archive. Le lecteur strict de l’import de skills conserve son comportement. Le décompte des entrées reste global même en cas de filtre.

src/api/file-conversion.js active cette lecture partielle pour les ZIP du chat. Les méthodes de compression ZIP non supportées par yauzl peuvent être reprises par le moteur 7z-wasm déjà installé, uniquement en mémoire et avec ses contrôles de chemins/tailles. Les données récupérées sont rapprochées des entrées validées du premier inventaire ; un échec de repli ne supprime pas les contenus déjà lus. Les archives chiffrées ne sont pas déchiffrées sans mot de passe et aucun secret n’est demandé automatiquement.

convertArchiveContents borne l’inventaire et le texte global, conserve les premiers contenus transmis au lieu de remplacer toute l’archive par un aperçu binaire en cas de dépassement, et signale les fichiers omis (noms bornés + compte). Une entrée chiffrée/illisible marque effectivement partial=true ; un fichier vide est identifié sans prétendre à un défaut de lecture. resolvePendingFiles affiche un avertissement ZIP partiel lors de sa première conversion, sans le répéter pour chaque relance. Le texte envoyé précise que les chemins sont internes à l’archive et ne doivent pas être recherchés sur la machine.

Les scénarios test/document-conversion.test.js ont réussi en préparation 1.4.1 : entrée ZIP >25 Mo avec texte exploitable à côté, entrée chiffrée + entrée publique, dépassement du budget texte conservant le contenu déjà lu, ZIP LZMA via 7-Zip. Aucun ZIP concret ni message d’erreur de l’utilisateur n’a été fourni ; ne pas prétendre avoir reproduit son archive précise.
# Contexte de reprise â€” dÃ©veloppeurs et assistants IA

## Sections de préparation déplacées depuis AI_CONTEXT.md (31 octobre 2026)

### Saisie du chat (prochaine mise Ã  jour, non validÃ©e en exÃ©cution)

`50-chat-composer.js` dÃ©place le bouton modÃ¨le existant dans le compositeur (identifiants et menu conservÃ©s). En 1.4.1, la jauge de contexte a Ã©tÃ© retirÃ©e Ã  la demande du contributeur, ainsi que ses appels pÃ©riodiques Ã  `chatContext`. Lâ€™IPC backend reste disponible pour les diagnostics ; la compaction automatique et le quota Usage sont indÃ©pendants. Le changement dâ€™identitÃ© du chat annule toujours une dictÃ©e en cours.



`51-chat-access.js` ajoute le menu dâ€™accÃ¨s directement au compositeur, via un popover natif avec navigation clavier, descriptions des trois modes et mÃ©morisation optionnelle. Il rÃ©utilise exclusivement lâ€™IPC `autoApprove` et `applySettings`/`applyStatus` : aucune seconde politique de permissions. Les sÃ©lecteurs existants `[data-access-mode]` restent rÃ©servÃ©s aux paramÃ¨tres ; le nouveau menu utilise `[data-chat-access]`. Lâ€™ancien badge `agent-access` reste en place pour les ancrages Motion. Le rÃ©glage sâ€™applique Ã  la session entiÃ¨re, y compris Code et Motion ; Full accÃ¨s nâ€™auto-rÃ©pond pas Ã  ask_user. Validation dâ€™exÃ©cution Ã  faire avant publication : synchronisation paramÃ¨tres/menu, mode personnalisÃ©, clavier, petits panneaux, changements pendant tÃ¢che et actions en attente. Tests diffÃ©rÃ©s selon la prÃ©fÃ©rence du contributeur.

### PiÃ¨ces jointes et recherche locale

`src/attachment-policy.js` dÃ©finit la consigne commune : une piÃ¨ce jointe et son nom ne constituent pas une demande de retrouver lâ€™original sur le PC. Elle est ajoutÃ©e au prompt agent (Code/Motion) et aux requÃªtes contenant des fichiers/images pour couvrir aussi le chat simple ; un rappel court persiste dans les suivis, y compris aprÃ¨s compaction. Pas de recherche de repli via fichiers, shell ou MCP, mÃªme en Full accÃ¨s. Un contenu inaccessible doit Ãªtre signalÃ© ; une recherche dâ€™original nÃ©cessite une demande explicite et ciblÃ©e. Les lectures utiles du projet et ressources au chemin explicitement fourni restent possibles. Il sâ€™agit dâ€™une instruction au modÃ¨le, pas dâ€™un nouveau bac Ã  sable ni dâ€™une dÃ©tection infaillible de lâ€™intention des commandes. Tests Ã  effectuer avant publication : demande avec piÃ¨ce jointe accessible/inaccessible, suivis, compaction, Code/Motion et recherche locale explicitement demandÃ©e.

### Profils de terminal (prochaine mise Ã  jour)


IPC trusted `terminalPreferences` get/save/distributions ; WSL utilise execFile `wsl.exe --list --quiet` avec dÃ©lai 8 s et dÃ©codage UTF-16LE ou UTF-8. La liste ne dÃ©marre/installe aucune distribution. La sauvegarde WSL vÃ©rifie la distribution installÃ©e. Lancement PTY : arguments distincts `--distribution â€¦ --cd <chemin>` sans shell intermÃ©diaire. Les chemins UNC wsl$/wsl.localhost sont convertis vers le chemin Linux et imposent la distribution correspondante ; pour un choix par dÃ©faut, celle du chemin UNC est dÃ©duite. Le cwd du processus hÃ´te wsl.exe reste le dossier utilisateur Windows. Les terminaux natifs conservent le cwd du projet. Le terminal simple lance Ã©galement le profil sÃ©lectionnÃ©, mais reste un mode de secours sans Ã©tat de shell persistant.


### Niveau de rÃ©flexion GPT (prochaine mise Ã  jour)

`src/api/reasoning.js` contient les capacitÃ©s vÃ©rifiÃ©es et GET/PATCH `/user/instructions` (`gptReasoning`). Le PATCH ne transmet que ce champ, prÃ©servant les instructions et autres prÃ©fÃ©rences du compte. La valeur est relue aprÃ¨s sauvegarde ; aucune rÃ©ussite optimiste. Enum FranceStudent vÃ©rifiÃ©e via sa spec publique le 24/10/2026 : none/minimal/low/medium/high/xhigh. Ne pas ajouter max, non exposÃ© par FranceStudent. ModÃ¨les connus GPT-5.6 Sol/Luna/Terra, GPT-6 Sol/Luna : none/low/medium/high/xhigh. GPT-6.1 Sol : low/medium/high/xhigh. Aucun minimal pour ces modÃ¨les. Les modÃ¨les inconnus restent sans contrÃ´le ; les IDs observÃ©s ne servent que si aucune identitÃ© de modÃ¨le explicite nâ€™existe.

Sources officielles consultÃ©es le 24/10/2026 : https://developers.openai.com/api/docs/models/gpt-6.1-sol ; https://developers.openai.com/api/docs/models/gpt-6-sol ; https://developers.openai.com/api/docs/models/gpt-6-luna ; https://developers.openai.com/api/docs/models/gpt-5.6-sol ; https://developers.openai.com/api/docs/models/gpt-5.6-luna ; https://developers.openai.com/api/docs/models/gpt-5.6-terra. SpÃ©cification service : https://api.francestudent.ai/v3/api-docs. Le support fournisseur nâ€™est pas une preuve dâ€™application effective par le proxy FranceStudent : le parcours rÃ©el reste Ã  valider.

`53-gpt-reasoning.js` fournit un popover du compositeur, niveaux filtrÃ©s, indication explicite Â« prÃ©fÃ©rence du compte Â» et coÃ»t potentiel. IPC trusted `reasoning` revalide le modÃ¨le actif et le niveau cÃ´tÃ© main. Sauvegarde interdite en tÃ¢che ; verrou court contre envois/changements de modÃ¨le/dÃ©connexion pendant le PATCH. Les rÃ©ponses dâ€™anciens chargements sont ignorÃ©es, les niveaux incompatibles du compte sont affichÃ©s Â« Ã  choisir Â», sans mutation automatique. Le rÃ©glage est global, non propre au chat. Tests prÃ©parÃ©s `test/reasoning.test.js`, non exÃ©cutÃ©s selon la prÃ©fÃ©rence du contributeur. Avant publication : vÃ©rifier API rÃ©elle GET/PATCH/relecture, refus HTTP/401, prÃ©servation des autres prÃ©fÃ©rences, modÃ¨le changÃ©, tÃ¢che en cours, Code/Motion, clavier et cohÃ©rence entre clients.

### WSL : environnement du projet (remplace la limitation terminal seul ci-dessus)

La demande WSL couvre dÃ©sormais le travail de dÃ©veloppement du projet : rÃ©glage optionnel ParamÃ¨tres â†’ GÃ©nÃ©ral â†’ Environnement du projet Â· WSL, dans `54-wsl-project.js`. Le profil de terminal seul reste disponible mais lâ€™environnement WSL du projet a prioritÃ©. IPC `projectEnvironment` get/check/save, associÃ© Ã  lâ€™identitÃ© du workspace et interdit de changement pendant agent/jobs/tÃ¢ches. Sauvegarde par projet dans `projectExecutionEnvironments` (clÃ© workspace Windows normalisÃ©e ; casse de la partie Linux UNC conservÃ©e). Distribution effective et chemin Linux gelÃ©s aprÃ¨s vÃ©rification explicite du dossier avec WSL. Lâ€™activation dÃ©marre la distribution pour vÃ©rifier Bash, setsid et le dossier ; elle ne lance pas de tests, nâ€™installe ni WSL ni dÃ©pendances. Bouton VÃ©rifier sans sauvegarde. Aucun changement automatique pour les autres projets ou Motion.

`src/execution-environment.js` centralise la configuration et les cibles WSL : args sÃ©parÃ©s distribution/--cd, conversion des arguments de chemins Windows absolus par wslpath (montages personnalisÃ©s compris), shell de connexion Bash pour le PATH Linux, groupe de processus setsid. Un marqueur stderr alÃ©atoire transmet uniquement le PGID au lanceur, retirÃ© de la sortie affichÃ©e ; Stop vise ce groupe avec TERM puis KILL, pas la distribution entiÃ¨re. Ne pas utiliser wsl --shutdown/terminate pour annuler une tÃ¢che. Les wrappers Windows et Linux restent sÃ©parÃ©s : Windows est le cwd du processus hÃ´te, --cd est le dossier Linux effectif. Les chemins UNC wsl$/wsl.localhost sÃ©lectionnent leur distribution et refusent les contradictions. Les cwd Linux sous le projet sont reconvertis vers lâ€™hÃ´te pour les contrÃ´les de fichiers.

Routages : runner commun des commandes de lâ€™agent/jobs (`src/tools/command/runner.js`) aprÃ¨s les contrÃ´les de permissions dâ€™origine ; shell Full accÃ¨s Bash dans shell.js ; profils terminal ; tÃ¢ches et serveurs `desktop/project-studio.js` ; diagnostics ESLint/tsc (binaires Linux .bin, sorties ramenÃ©es aux chemins du projet) ; lecture Git desktop ; diagnostic dâ€™environnement du cockpit. Le prompt et son cache incluent lâ€™environnement ; Node/version Linux ne sont pas confondus avec lâ€™Electron hÃ´te. Le parseur/policy hors Full accÃ¨s nâ€™est pas remplacÃ© par un shell libre. Aucun prÃ©fixe magique permettant de contourner les contrÃ´les. Les outils de fichiers restent cÃ´tÃ© hÃ´te et utilisent les chemins relatifs.

Limites explicites : interface/Ã©diteur et serveur LSP embarquÃ© restent natifs, ainsi que connecteurs GitHub et serveurs MCP Windows configurÃ©s. Ne pas annoncer une session distante complÃ¨te de type VS Code Remote. Le PATH des outils gÃ©rÃ©s par nvm/etc doit Ãªtre chargÃ© par Bash de connexion ; rien nâ€™est installÃ© automatiquement. Lâ€™option rÃ©pond Ã  la rÃ©utilisation des outils/packages WSL pour les exÃ©cutions du projet, pas au remplacement de toutes les intÃ©grations Windows. Les terminaux dÃ©jÃ  ouverts ne migrent pas.

Validation de cette extension NON exÃ©cutÃ©e, selon la consigne de rÃ©server les tests Ã  la publication. Avant release : vrais projets Windows/UNC WSL, distribution explicite/dÃ©faut/disparue, espaces/accents, npm/pnpm/python existants seulement dans Linux, commandes autorisÃ©es/refusÃ©es/Full accÃ¨s, pipeline et stdin, sorties et diagnostics, serveurs accessibles depuis le navigateur Windows, Stop/Ctrl+C/jobs descendants sans tuer une autre session WSL, changements de projet/environnement, reprise native et non-rÃ©gression Windows/Motion. VÃ©rifier le packaging des nouveaux modules. Les premiÃ¨res descriptions terminal seul dans ce contexte sont remplacÃ©es par cette section.

Tests WSL prÃ©parÃ©s dans `test/execution-environment.test.js` (non exÃ©cutÃ©s) : opt-in par projet et isolation Motion, chemins UNC/casse Linux, arguments littÃ©raux non interpolÃ©s, masque du marqueur PGID, arrÃªt ciblÃ© sans shutdown/terminate de distribution, conversion cwd sous le projet. Les contrÃ´les rÃ©els de processus et distributions restent indispensables avant publication.
