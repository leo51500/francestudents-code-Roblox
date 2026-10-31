"use strict";
// Maintain this short summary with each release. Unknown versions get a safe fallback.
const releases={
    "1.5.40":{headline:"Le trait de redimensionnement reste collé au bord, comme dans VS Code.",items:[
        {icon:"tools",title:"Trait qui ne se détache plus",text:"À la limite de largeur, le trait continuait à suivre la souris et flottait au milieu des panneaux. Il est maintenant recalé sur le bord réel de la colonne à chaque mouvement : il s'arrête avec elle, même si la souris va plus loin."},
        {icon:"spark",title:"Rendu VS Code",text:"1 px, gris discret, limité à la hauteur des panneaux et visible seulement pendant le glisser : plus de barre blanche en travers de l'interface."}
    ]},
    "1.5.39":{headline:"La barre blanche du redimensionnement ne reste plus à l'écran.",items:[
        {icon:"tools",title:"Plus de trait figé",text:"Un glisser interrompu (souris relâchée hors de la fenêtre, Alt+Tab, perte de focus) laissait un trait blanc en travers des panneaux. L'état de glisser est maintenant effacé dès qu'il ne peut plus être en cours, et le trait n'apparaît que pendant le geste."},
        {icon:"spark",title:"Trait discret",text:"Pendant le glisser, la ligne fait 2 px, reste translucide et couvre seulement la hauteur des panneaux : elle ne traverse plus la barre de titre ni la barre d'état."},
        {icon:"clock",title:"Publication rétablie",text:"Les scripts de diagnostic déposés à la racine avec la 1.5.38 faisaient échouer la vérification automatique ; ils sont retirés."}
    ]},
    "1.5.38":{headline:"Le sélecteur de projets distingue session expirée, droits refusés et panne réseau.",items:[
        {icon:"chat",title:"Message juste",text:"Au lancement, la liste était demandée avant que la connexion soit prête : l'échec s'affichait comme une session expirée. Un refus d'accès ou une coupure réseau n'est plus annoncé de la même façon, et le détail exact reste lisible au survol."},
        {icon:"tools",title:"Projets personnels toujours là",text:"Si la liste des projets partagés est refusée ou absente, tes projets personnels restent affichés et sélectionnables au lieu de disparaître derrière un message de session."},
        {icon:"spark",title:"Plus de requêtes en boucle",text:"Après un échec, l'application attend une minute avant de redemander la liste au lieu de la réclamer toutes les deux secondes ; une reconnexion la recharge aussitôt."}
    ]},
    "1.5.37":{headline:"Les boutons de la barre de titre répondent à nouveau, et « Discussions dans » passe en tête du chat.",items:[
        {icon:"tools",title:"Barre de titre dégagée",text:"Le chat et sa poignée remontaient sous la pastille « Mise à jour » et les boutons de la fenêtre. La grille réserve maintenant une ligne à la barre de titre : tout reste cliquable, quelle que soit la taille de la fenêtre."},
        {icon:"chat",title:"Projet choisi avant d'écrire",text:"Le sélecteur de projet ouvre l'en-tête du chat, sur sa propre ligne et avec son libellé entier : on choisit où part la discussion avant de poser la question."},
        {icon:"spark",title:"Fenêtres étroites",text:"Le centre d'extensions ne passe plus sous le chat et ses onglets restent utilisables ; l'écran de démarrage ne laisse plus l'interface inactive capter les clics."}
    ]},
    "1.5.36":{headline:"Le redimensionnement suit la souris en direct, avec des largeurs entières.",items:[
        {icon:"tools",title:"Panneau qui suit la souris",text:"En disposition personnalisée, la grille lisait l'ancienne variable : la colonne ne bougeait plus pendant le glisser. La largeur choisie est désormais publiée en direct, image par image, comme dans VS Code."},
        {icon:"spark",title:"Calcul sur la taille réelle",text:"Le glisser, les flèches clavier et le double-clic partent de la largeur réellement rendue du panneau, plus jamais d'une valeur périmée : la poignée reste collée au bord et la bulle annonce la vraie taille."}
    ]},
    "1.5.35":{headline:"Le choix de projet reste possible même quand la liste ne se rafraîchit pas.",items:[
        {icon:"chat",title:"Plus de sélecteur bloqué",text:"Après un échec d'actualisation (session expirée, hors ligne), les projets déjà affichés restent sélectionnables dans « Discussions dans »."},
        {icon:"spark",title:"Liste qui revient toute seule",text:"Après une reconnexion ou une minute d'attente, la liste des projets se recharge automatiquement, sans appuyer sur ↻."}
    ]},
    "1.5.34":{headline:"Le séparateur suit le curseur au pixel, et le chat passe en plein écran au clavier.",items:[
        {icon:"tools",title:"Poignée flottante",text:"Pendant le glisser, un sash détaché style VS Code suit le curseur immédiatement, sans attendre le recalcul de la grille. La ligne d'accent reste visible au survol et au focus clavier."},
        {icon:"spark",title:"Ctrl+Maj+M",text:"Nouveau raccourci : bascule le plein écran du chat comme le bouton ⤢. Échap revient à la disposition d'avant."}
    ]},
    "1.5.33":{headline:"Glisser plus précis et liste de projets plus tolérante.",items:[
        {icon:"tools",title:"Tailles arrondies au pixel",text:"Le redimensionnement applique et affiche des valeurs entières : la bulle (« Chat · 420 px ») ne montre plus de décimales et le panneau ne garde aucune largeur impaire."},
        {icon:"chat",title:"Projets encore utilisables",text:"Si l'actualisation échoue, les projets déjà chargés restent sélectionnables et le message en cas de session expirée est plus simple."}
    ]},
    "1.5.32":{headline:"Les poignées de redimensionnement sont plus faciles à attraper et la bulle de taille s'affiche correctement.",items:[
        {icon:"tools",title:"Zone de clic élargie",text:"Les poignées du chat, des fichiers et du panneau bas ont une zone d'accroche agrandie (±4 px) : plus besoin de viser le trait de 4 px pour redimensionner."},
        {icon:"spark",title:"Bulle de taille réparée",text:"La bulle qui affiche la taille en direct (« Chat · 420 px ») avait perdu son style et apparaissait n'importe où. Elle est maintenant bien positionnée et visible."},
        {icon:"chat",title:"Retour visuel au survol",text:"Le survol des poignées affiche une ligne fine couleur accent, et la couleur reste pendant le glisser pour confirmer que la poignée est bien tenue."}
    ]},
    "1.5.31":{headline:"Le chat suit ta souris et tes projets FranceStudent remontent enfin.",items:[
        {icon:"chat",title:"Redimensionnement en direct",text:"Le chat, les fichiers et le panneau bas suivent le pointeur pendant le glisser ; la bulle donne la taille actuelle et le réglage reste mémorisé."},
        {icon:"tools",title:"Projets personnels et partagés",text:"L’application récupère aussi les projets partagés et distingue l’absence de session d’une route de service indisponible."},
        {icon:"spark",title:"Actualisation et reconnexion",text:"Le bouton Actualiser reste disponible après un échec ; si le service refuse la session, le guide de connexion s’ouvre directement."}
    ]},
    "1.5.30":{headline:"Le chat s’agrandit vraiment, puis retrouve sa place.",items:[
        {icon:"chat",title:"Le chat prend toute la fenêtre",text:"Le mode agrandi remplit la fenêtre même après avoir personnalisé les panneaux, et le bouton ou Échap ramène à la disposition d’avant."},
        {icon:"tools",title:"Disposition préservée",text:"Les largeurs choisies pour les panneaux restent intactes quand tu agrandis puis réduis le chat."},
        {icon:"spark",title:"Connexion expliquée simplement",text:"Si ta session FranceStudent manque, l’application t’invite à te connecter puis à actualiser les projets, sans afficher de détails techniques."}
    ]},
    "1.5.29":{headline:"La taille du chat fonctionne partout, et vos projets se choisissent dans le chat.",items:[
        {icon:"tools",title:"Redimensionnement réparé",text:"Le chat s'élargit et se rétrécit à toutes les tailles de fenêtre : la largeur choisie n'est plus écrasée par les règles d'écran."},
        {icon:"chat",title:"Vos projets dans le chat",text:"Un sélecteur « Discussions dans » liste les projets de votre compte : chaque nouvelle discussion est classée dans celui que vous choisissez."},
        {icon:"spark",title:"Plus de superpositions",text:"Le menu « Outils du chat » ne recouvre plus la conversation et le panneau retrouve tout son en-tête."}
    ]},
    "1.5.28":{headline:"Vos discussions rejoignent vos projets FranceStudent, sans chats en série.",items:[
        {icon:"chat",title:"Projets reconnus",text:"L’application liste les projets de votre compte et ne crée plus rien au hasard : choisissez le projet, les nouvelles discussions y sont rattachées."},
        {icon:"tools",title:"Fin des « Tour 28/40 »",text:"Une conversation occupée n’engendre plus une série de nouveaux fils : une seule reprise, puis l’application reprend le fil d’origine."},
        {icon:"spark",title:"Titres clairs",text:"Chaque discussion porte le titre de votre demande réelle, au lieu d’un numéro de tour interne."}
    ]},
    "1.5.27":{headline:"Le chat va où vous voulez, et sa taille s’affiche en direct.",items:[
        {icon:"chat",title:"Chat dans sa propre fenêtre",text:"Détachez le chat : une vraie fenêtre, déplaçable et redimensionnable librement, à sa position mémorisée. La grande fenêtre lui laisse alors toute la place, sans doublon."},
        {icon:"tools",title:"Pas de palier imposé",text:"Les colonnes vont de leur minimum à toute la place libre de la fenêtre ; l’éditeur garde toujours sa largeur utile."},
        {icon:"spark",title:"Taille en direct",text:"Pendant le glisser, une bulle affiche la largeur réelle (« Chat · 642 px »). Les superpositions près des poignées sont corrigées, et la disposition se retrouve au redémarrage."}
    ]},
    "1.5.26":{headline:"Un agent chef d’orchestre et deux spécialistes : interfaces et 3D.",items:[
        {icon:"chat",title:"Il délègue",text:"L’assistant garde la conversation et confie le travail au bon spécialiste avec un brief clair, puis récupère son compte rendu pour vous présenter le résultat."}, 
        {icon:"spark",title:"Sous-agent Interfaces",text:"HUD, menus, boutiques et inventaires en Luau typé, lisibles au doigt comme à la manette, animés avec TweenService et intégrés au projet Rojo."},
        {icon:"tools",title:"Sous-agent 3D",text:"Armes, véhicules, props : le modèle est généré par un script Blender, exporté en GLB, contrôlé puis préparé pour l’import dans Studio — même échelle, même budget de polygones."}
    ]},
    "1.5.25":{headline:"Tous les modèles 3D passent par Blender, et le code est plus lisible.",items:[
        {icon:"tools",title:"Blender par défaut",text:"Un prop, un décor, une arme : l’assistant les modélise dans Blender et les importe, au lieu de vous livrer des Parts à empiler à la main."},
        {icon:"spark",title:"Code plus clair",text:"Les terminaux ont leur propre module et les contrôles de l’agent sont découpés : plus facile à corriger, sans changer le comportement."},
        {icon:"chat",title:"Guides surveillés",text:"Un test mesure la taille de chaque guide envoyé au modèle et alerte si l’un grossit trop, pour que les réponses restent précises."}
    ]},
    "1.5.24":{headline:"Les modèles Blender gardent enfin leurs couleurs.",items:[
        {icon:"spark",title:"Rendu vérifié",text:"Le contrôle à quatre angles est réellement rendu et lu par les tests : taille, quatre vues et présence de la palette."},
        {icon:"tools",title:"Couleurs réparées",text:"La triangulation mélangeait les couleurs en diagonales ; chaque pièce retrouve sa couleur, et les rochers ne sont plus creusés sous le sol."},
        {icon:"chat",title:"Gardes-fous mesurés",text:"Les guides envoyés à l’agent sont vérifiés section par section, et un fichier verrouillé n’est plus jamais réécrit à l’identique."}
    ]},
    "1.5.23":{headline:"Des modèles Blender plus beaux, des sons et un agent qui ne tourne plus en rond.",items:[
        {icon:"spark",title:"Agent débloqué",text:"« Je tourne en rond » n'arrête plus la tâche : l'agent change de démarche, et un fichier verrouillé par Studio est expliqué au lieu d'être réessayé sans fin."},
        {icon:"tools",title:"Biseaux, tores et palette",text:"Biseaux, sphères, cônes, tores, symétrie, creux booléens et colonnes en révolution donnent tout de suite un aspect soigné ; plusieurs couleurs par modèle, et un rendu quatre angles pour juger le résultat."},
        {icon:"chat",title:"Sons et éclairage Voxel",text:"Un guide pour ajouter de vrais sons sans identifiant inventé, et la migration Compatibility → Voxel Lighting expliquée calmement, avec les réglages pour retrouver l'ambiance."}
    ]},
    "1.5.22":{headline:"Les panneaux se redimensionnent sans à-coups.",items:[
        {icon:"tools",title:"Poignées faciles à attraper",text:"La colonne des fichiers, le chat et le panneau du bas se redimensionnent depuis une zone de 3 px de chaque côté du trait : plus besoin de viser un pixel."},
        {icon:"spark",title:"Glisser fluide",text:"Pendant un glisser, la mise en page suit le curseur sans transition ni barre de défilement parasite, puis reprend son mouvement normal relâché."},
        {icon:"chat",title:"Historique immédiat",text:"Rouvrir une conversation l’affiche d’un coup, sans rejouer l’arrivée des messages un par un."}
    ]},
    "1.5.21":{headline:"La 1.5.20 arrive enfin, avec ses notes.",items:[
        {icon:"tools",title:"Publication réparée",text:"La fiche de release est désormais créée puis construite avec les mêmes vérifications que la CI, Electron chargé avant les tests : la 1.5.20 et ses nouveautés (zoom partout, panneau Logs, animations de réflexion) sont enfin disponibles."},
        {icon:"spark",title:"Notes de version à jour",text:"Chaque version publiée reprend ses propres notes ; la 1.5.20 n'a donc pas perdu son résumé en attendant d'être livrée."}
    ]},
    "1.5.20":{headline:"Zoom partout, un panneau Logs et une interface qui respire.",items:[
        {icon:"tools",title:"Zoom partout",text:"Ctrl + molette dans le chat, le code ou les logs, et Ctrl+= / Ctrl+0 : toute l’interface grandit ensemble, ton réglage est mémorisé, une pastille dans la barre d’état le rappelle."},
        {icon:"chat",title:"Un panneau Logs clair",text:"Les erreurs du service et de l’application arrivent au même endroit, avec l’heure et le code HTTP. Filtre, cherche, copie : plus besoin de deviner ce qui a échoué."},
        {icon:"spark",title:"La réflexion se voit",text:"« Il réfléchit… », des points qui respirent, un curseur pendant l’écriture, des boutons qui répondent au clic : l’agent paraît vivant, et tout reste calme si tu réduis les animations dans Windows."}
    ]},
    "1.5.19":{headline:"Roblox Studio répond vraiment à l’agent.",items:[
        {icon:"tools",title:"Studio piloté sans identifiant",text:"L’agent exécute du Luau et lit l’arbre du jeu dans ton Studio ouvert : la session et le jeton sont détectés automatiquement, jamais affichés."},
        {icon:"spark",title:"Plus de « datamodel_type is required »",text:"Correction du dialogue avec l’extension Roblox Studio : les outils Studio et Blender répondent correctement au lieu de refuser la demande."},
        {icon:"chat",title:"Reprise au lieu d’un échec",text:"Si le service refuse une conversation, la demande est reconstruite depuis l’historique au lieu de s’arrêter sur une erreur."}
    ]},
    "1.5.18":{headline:"Thème « Onyx » : noir profond, esprit assistant.",items:[
        {icon:"spark",title:"Plus aucun bleu",text:"Fini les couleurs d’éditeur de code : un noir profond, des bulles douces et du blanc pour l’essentiel. Seuls les statuts (erreur, avertissement, succès) restent colorés."},
        {icon:"chat",title:"Un vrai chat d’IA",text:"Messages plus grands et plus aérés, cartes discrètes pour les outils et le plan, champ de saisie large et arrondi : l’assistant passe au premier plan, le code reste à côté."},
        {icon:"tools",title:"Petites fenêtres corrigées",text:"Entre 900 et 1 100 px, l’éditeur garde une largeur lisible et le chat se resserre. Les onglets du panneau passent à la ligne au lieu d’être coupés."}
    ]},
    "1.5.17":{headline:"Interface plus sombre, sans panneau Git, et sous-agents spécialisés.",items:[
        {icon:"spark",title:"Thème « Cendre » plus sombre",text:"Des gris très profonds, des formes arrondies et un bleu discret : l’interface se rapproche d’un outil de création plutôt que d’un éditeur de bureau générique."},
        {icon:"tools",title:"Panneau Git retiré",text:"Plus d’onglet Versions ni de raccourci Git : le connecteur GitHub gère le compte, le dépôt et les releases. Push, pull et commit restent dans la palette (Ctrl+Maj+P) et le terminal."},
        {icon:"spark",title:"Sous-agents par spécialité",text:"L’agent peut confier une exploration à un sous-agent scripts Luau, interface Roblox, scène 3D ou Blender. Ils lisent le projet, puis l’agent applique les changements."},
        {icon:"chat",title:"Agent plus stable",text:"Chaque étape rappelle la demande de départ, une question mal formée ne bloque plus la tâche, et les relances réseau respectent le délai du service."}
    ]},
    "1.5.16":{headline:"Skills auto-installés, arbre Roblox Studio, tableau de bord Rojo et Wally.",items:[
        {icon:"spark",title:"Skills prêts sans installation",text:"La bibliothèque Roblox/Blender est proposée à l’agent : un skill manquant est installé automatiquement, et les packs se préparent dès qu’un projet Roblox ou Blender est ouvert."},
        {icon:"tools",title:"Arbre Roblox Studio",text:"Bascule fichiers ↔ scène dans l’explorateur : Workspace, ReplicatedStorage, ServerScriptService… Un clic ouvre le script ou le modèle correspondant."},
        {icon:"clock",title:"Rojo et Wally sous la main",text:"Indicateur vert (Studio connecté) ou orange (en attente) dans la barre d’état, onglet Rojo pour recompiler et relancer la sourcemap, boutons wally install et wally update."},
        {icon:"tools",title:"Interface resserrée sur Roblox et Blender",text:"Une barre latérale Fichiers / Studio / Versions / Recherche / Cockpit remplace la colonne d’icônes. Worktrees, marketplace et motion design sont retirés."}
    ]},
    "1.5.15":{headline:"Mises à jour automatiques silencieuses sans assistant.",items:[
        {icon:"tools",title:"Installation en un clic",text:"L’installateur passe en mode direct (oneClick) par utilisateur : plus d’assistant demandant pour qui installer l’application."},
        {icon:"spark",title:"Mise à jour silencieuse",text:"Les mises à jour s’installent automatiquement en arrière-plan sans boîte de dialogue et relancent l’IDE à jour."},
        {icon:"clock",title:"Données et raccourcis préservés",text:"L’emplacement d’installation, tes projets et tes préférences restent inchangés."}
    ]},
    "1.5.14":{headline:"Thème sombre intégral et nouveau logo officiel.",items:[
        {icon:"spark",title:"Nouveau logo officiel",text:"L’emblème vectoriel officiel avec les contours de la France et le R stylisé est déployé dans toute l’interface et sur l’icône Windows."},
        {icon:"tools",title:"Mode sombre complet",text:"Activation du mode sombre système natif Electron et color-scheme sombre sur toute l’application sans flash blanc."},
        {icon:"clock",title:"Tes données préservées",text:"Tes projets, configurations, modèles et historiques restent intacts."}
    ]},
    "1.5.13":{headline:"Des releases Windows plus fiables.",items:[
        {icon:"tools",title:"Dépendances figées",text:"Le lockfile est versionné : le runner installe les mêmes versions natives que ton poste."},
        {icon:"spark",title:"Création Gab-Desing",text:"Gab-Desing reste le nom de création, avec les crédits d’origine conservés."},
        {icon:"clock",title:"Tes réglages inchangés",text:"L’identifiant de mise à jour, les projets et les conversations sont préservés."}
    ]},
    "1.5.12":{headline:"Les mises à jour viennent de ton dépôt.",items:[
        {icon:"tools",title:"Source leo51500",text:"La publication, les mises à jour automatiques et les téléchargements utilisent leo51500/francestudents-code-Roblox."},
        {icon:"spark",title:"Création Gab-Desing",text:"Gab-Desing reste le nom de création, avec les crédits d’origine conservés."},
        {icon:"clock",title:"Tes réglages inchangés",text:"L’identifiant de mise à jour, les projets et les conversations sont préservés."}
    ]},
    "1.5.9":{headline:"Ton nouveau logo est repris dans toute l’application.",items:[
        {icon:"spark",title:"Le logo que tu as fourni",text:"Ton emblème blanc remplace le logo bleu dans l’écran de démarrage, la barre de titre, l’accueil, les nouveautés et l’icône de l’application."},
        {icon:"tools",title:"Icône Windows lisible",text:"L’icône conserve un contraste adapté pour rester reconnaissable sur la barre des tâches et le bureau."},
        {icon:"clock",title:"Projets et réglages préservés",text:"Le changement visuel ne modifie pas tes projets, tes conversations ni les identifiants d’installation et de mise à jour."}
    ]},
    "1.5.8":{headline:"La release automatique publie enfin son installateur.",items:[
        {icon:"tools",title:"Workflow réparable",text:"Le workflow Windows est de nouveau appelable par la Publication automatique : GitHub ne rejette plus le fichier, la fiche et le build repartent ensemble."},
        {icon:"spark",title:"Version 1.5.8",text:"La 1.5.7 n’ayant jamais été publiée, ce correctif est livré comme une nouvelle version plutôt que de réutiliser un tag."},
        {icon:"clock",title:"Déclencheurs conservés",text:"La publication manuelle d’une release et la relance depuis main continuent de fonctionner."}
    ]},
    "1.5.7":{headline:"La release GitHub est publiée automatiquement.",items:[
        {icon:"spark",title:"Première fiche publiée",text:"Le dépôt distant ne contenait encore aucune release : le workflow Publication automatique crée maintenant la fiche v1.5.7 et son installateur Windows."},
        {icon:"tools",title:"Diagnostic clarifié",text:"Le changelog rappelle de vérifier l’onglet Actions et l’activation des workflows avant de conclure à une panne."}
    ]},
    "1.5.6":{headline:"La publication automatique se déclenche et se relance plus clairement.",items:[
        {icon:"tools",title:"Déclenchement simplifié",text:"Tout push sur main, y compris la documentation, peut lancer la création de la release."},
        {icon:"clock",title:"Relance manuelle contrôlée",text:"Le workflow accepte une relance depuis main et vérifie la version avant de créer le tag."},
        {icon:"spark",title:"Préreleases identifiées",text:"Les versions avec suffixe sont publiées comme préreleases GitHub."}
    ]},
    "1.5.5":{headline:"La publication automatique ne reste plus bloquée.",items:[
        {icon:"clock",title:"Notes de release fiables",text:"Le texte de la fiche est construit par scripts/release-body.js ; un résumé manquant n’empêche plus la publication."},
        {icon:"tools",title:"Un tag propre",text:"Le tag v<version> est nettoyé de tout retour à la ligne avant la création de la release."},
        {icon:"spark",title:"Build Windows ciblé",text:"Les exécutables ne sont reconstruits que pour une release nouvellement créée."}
    ]},
    "1.5.4":{headline:"Studio synchronisé, modèles Blender vérifiés.",items:[
        {icon:"tools",title:"Rojo piloté par l’IDE",text:"Le serveur Rojo démarre depuis l’application, choisit un port libre et affiche dans la barre d’état si Roblox Studio est connecté."},
        {icon:"spark",title:"Test réel dans Studio",text:"Nouvel outil roblox_playtest : le projet est construit, ouvert dans Studio, et les erreurs du dernier log sont relues."},
        {icon:"chat",title:"Modèles Blender vérifiés",text:"Blender contrôle désormais triangles, UV, normales, arêtes et textures avant l’import, au lieu de seulement lire l’en-tête du fichier."},
        {icon:"clock",title:"Aller-retour Blender ↔ Roblox",text:"Manifeste de taille en studs, import préparé dans ReplicatedStorage/Assets et export d’un .blend vers un GLB prêt pour Roblox."}
    ]},
    "1.5.3":{headline:"Version Windows uniquement, avec le nouveau logo.",items:[
        {icon:"spark",title:"Un emblème unique",text:"L’hexagone bleu avec le « R » en creux remplace l’ancien logo dans la barre de titre et sur l’écran d’accueil."},
        {icon:"tools",title:"La même icône partout",text:"La fenêtre et l’installateur Windows utilisent la nouvelle icône, régénérée en haute définition et lisible en petit."},
        {icon:"clock",title:"Windows uniquement",text:"Une seule application Windows, un seul installateur, une seule icône."}
    ]},
    "1.5.2":{headline:"Un nouveau logo pour FranceStudent Code Roblox.",items:[
        {icon:"spark",title:"Le nouvel emblème hexagone",text:"L’application et l’écran d’accueil affichent le logo hexagone bleu, dessiné en vectoriel pour rester net à toutes les tailles."},
        {icon:"tools",title:"Une icône cohérente partout",text:"La fenêtre et l’installateur Windows utilisent la même icône, régénérée en haute définition."}
    ]},
    "1.5.1":{headline:"Teste ton propre fournisseur en toute sécurité.",items:[
        {icon:"tools",title:"Profils API personnalisés",text:"Ajoute un nom, un modèle, une URL et une clé pour utiliser une API compatible OpenAI depuis le sélecteur de modèle."},
        {icon:"spark",title:"Clé protégée localement",text:"La clé est conservée dans le coffre sécurisé du système et n’apparaît ni dans le renderer ni dans les conversations."},
        {icon:"chat",title:"FranceStudent reste inchangé",text:"La bêta est séparée et désactivée tant que tu ne sélectionnes pas un fournisseur personnalisé."}
    ]},
    "1.5.0":{headline:"Tes PDF arrivent au bon circuit dès le premier essai.",items:[
        {icon:"tools",title:"Les PDF sont traités comme des documents",text:"Même après une ancienne session, un PDF ne passe plus par la route réservée aux images. Il rejoint automatiquement la conversion locale et le circuit fichiers."},
        {icon:"chat",title:"Une erreur plus claire",text:"Les refus de pièce jointe ne sont plus confondus avec une réponse d’outil incompatible."}
    ]},
    "1.4.9":{headline:"Les outils de l’agent reprennent sans faux blocage.",items:[
        {icon:"tools",title:"Les appels complets sont récupérés",text:"Un fournisseur peut signaler une erreur après avoir transmis un outil valide. FranceStudent le vérifie et poursuit avec ses permissions habituelles."},
        {icon:"chat",title:"Des erreurs moins brutales",text:"Les résultats déjà obtenus restent visibles et les erreurs de protocole ne sont plus présentées comme une suspension définitive."}
    ]},
    "1.4.7":{headline:"Des plans fiables, des suppressions adaptées à ton système.",items:[
        {icon:"chat",title:"Le plan ne bloque plus ta tâche",text:"Les étapes en texte, sans statut ou trop nombreuses sont adaptées localement, sans requête IA supplémentaire."},
        {icon:"tools",title:"La bonne suppression, sur chaque système",text:"L’agent utilise la corbeille et les confirmations de FranceStudent au lieu d’une commande rm ou del."}
    ]},
    "1.4.6":{headline:"L’agent retrouve ses outils, sans gaspiller ton quota.",items:[
        {icon:"tools",title:"Ton projet reste accessible",text:"Si un modèle affirme à tort qu’il ne peut pas lire le projet ouvert, l’IDE vérifie le dossier puis lui fait reprendre la tâche."},
        {icon:"clock",title:"Des reprises plus légères",text:"Après un conflit de conversation, l’agent reprend sans renvoyer tout l’index du projet. Une réponse d’outil invalide n’entraîne plus de requête de secours supplémentaire."},
        {icon:"chat",title:"Des onglets plus lisibles",text:"Conversation, Activité et Usage ont maintenant de vrais boutons avec plus d’espace."}
    ]},
    "1.4.5":{headline:"Ta voix reste sur ton ordinateur. Ton quota aussi.",items:[
        {icon:"chat",title:"Dicte sans envoyer ton audio",text:"La voix est reconnue localement avec Whisper. Le modèle se télécharge une fois ; le texte apparaît comme brouillon modifiable."},
        {icon:"clock",title:"L’index du projet ne coûte plus de quota",text:"L’ouverture et les changements de fichiers restent locaux. Lance /index si tu veux demander un résumé à l’IA."},
        {icon:"spark",title:"Une transcription annulable",text:"Le traitement reste dans un worker séparé. Ton brouillon et les ressources du projet restent disponibles."}
    ]},
    "1.4.4":{headline:"Moins de répétitions, plus de travail utile.",items:[
        {icon:"clock",title:"Des échanges plus légers",text:"Les lectures identiques et les longs journaux réussis évitent les répétitions inutiles. Les détails restent accessibles à l’agent."},
        {icon:"tools",title:"Tes fichiers préparés sur ton ordinateur",text:"Choisis les fichiers utiles dans un ZIP. La préparation locale devient automatique, avec un retour au traitement classique si nécessaire."},
        {icon:"chat",title:"Des connecteurs mieux guidés",text:"Les modèles reçoivent les vrais arguments des outils MCP. Les erreurs et les actions dont le résultat est incertain sont mieux prises en compte."},
        {icon:"spark",title:"Ton projet analysé automatiquement",text:"L’analyse IA revient à l’ouverture quand elle est nécessaire, avec réutilisation du cache. Cette analyse peut consommer du quota."}
    ]},
    "1.4.3":{headline:"Ouvre ton projet, garde ton quota.",items:[
        {icon:"clock",title:"Aucun résumé IA lancé à l’ouverture",text:"L’IDE prépare un index local et reprend le cache disponible. La génération d’un résumé IA se demande explicitement avec /index."},
        {icon:"chat",title:"Le quota expliqué clairement",text:"Les messages de quota pendant l’indexation affichent une carte lisible, l’heure de reprise et le bouton de vérification d’un reset."},
        {icon:"tools",title:"La bêta reste facultative",text:"Le traitement local expérimental des pièces jointes reste désactivé par défaut. L’indexation sans appel IA à l’ouverture s’applique à tous."}
    ]},
    "1.4.2":{headline:"Teste des pièces jointes plus légères.",items:[
        {icon:"spark",title:"Une bêta au choix",text:"Active Pièces jointes locales dans les paramètres IA pour la tester. Désactivée par défaut : le fonctionnement habituel reste disponible."},
        {icon:"tools",title:"Choisis dans ton ZIP",text:"Recherche et coche les fichiers utiles avant l’envoi. L’inventaire se fait sur ton ordinateur, sans requête IA."},
        {icon:"chat",title:"Le contenu utile, au bon moment",text:"Archives et gros textes restent dans un index local. L’agent peut lire les passages nécessaires et poursuivre jusqu’à la fin."},
        {icon:"clock",title:"PDF page par page",text:"Le texte est extrait localement. Les pages scannées ou demandées visuellement passent par la vision du modèle. Le gain de quota dépend de la tâche."}
    ]},
    "1.4.1":{headline:"Plus de place, moins de répétitions.",items:[
        {icon:"chat",title:"Un vrai chat plein écran",text:"Tout l’espace disponible, un en-tête simplifié et les outils secondaires regroupés dans un menu."},
        {icon:"spark",title:"Un plan unique et lisible",text:"Les étapes, leur état et leur progression restent dans une seule carte, sans doublon dans le fil."},
        {icon:"clock",title:"Des échanges plus légers",text:"Les consignes inchangées ne sont plus répétées à chaque demande. Le gain de quota dépend de la facturation du service."},
        {icon:"tools",title:"Des ZIP mieux lus",text:"Les fichiers lisibles sont conservés si une entrée échoue. Un avertissement précise les limites de la lecture."},
        {icon:"tools",title:"Des connecteurs mieux compris",text:"Contrôle visuel moins fragile et rappel de l’accès MCP pour les modèles qui ignorent un connecteur disponible."}
    ]},
    "1.4.0":{headline:"Ton environnement, tes outils, ton rythme.",items:[
        {icon:"chat",title:"Tout sous la main dans le chat",text:"Modèle, réflexion des GPT compatibles, niveau d’accès et jauge du contexte sont réunis près de la saisie. La dictée vocale arrive en bêta."},
        {icon:"tools",title:"Retrouve tes outils Linux",text:"L’environnement WSL par projet utilise tes outils déjà installés pour le terminal, les commandes de l’agent, les tâches et les serveurs."},
        {icon:"spark",title:"Des questions au bon moment",text:"L’agent peut proposer des choix ou un champ de réponse pendant une tâche. Tu peux répondre ou passer."},
        {icon:"tools",title:"Importe tes skills téléchargés",text:"Choisis un SKILL.md, un dossier ou un ZIP, consulte l’aperçu puis importe les ressources."},
        {icon:"clock",title:"Des incidents mieux expliqués",text:"Un diagnostic local et un code FST apparaissent après un arrêt inattendu. "}
    ]},
    "1.3.5":{headline:"Moins de répétitions, un meilleur suivi.",items:[
        {icon:"clock",title:"Des échanges plus légers",text:"Les messages de suivi évitent de répéter les catalogues et consignes. Les longs journaux gardent leurs erreurs utiles."},
        {icon:"chat",title:"Ton plan reste à jour",text:"Les cases sont actualisées dans les réponses de l’agent. Toutes les cinq requêtes, un bref rappel demande où en est le travail."},
        {icon:"tools",title:"Aucun appel dédié aux cases",text:"Le rappel accompagne le message existant. Le gain de quota réel dépend du modèle et de la facturation du service."}
    ]},
    "1.3.4":{headline:"Tes connexions, mieux protegees.",items:[
        {icon:"tools",title:"Moteur mis a jour",text:"Electron 45 corrige des vulnerabilites connues."},
        {icon:"chat",title:"Connexions protegees",text:"Les anciennes sessions et connexions GitHub sont migrees vers le coffre systeme disponible."}
    ]},
    "1.3.3":{headline:"Un IDE plus clair, du chat au studio.",items:[
        {icon:"spark",title:"FranceStudent IDE",text:"Un nouveau nom et une interface plus soignée, avec un studio EffectCraft réorganisé."},
        {icon:"chat",title:"Tes conversations, mieux rangées",text:"Des cartes lisibles, des titres proposés par l’IA et un chat vide quand tu démarres une nouvelle conversation."},
        {icon:"clock",title:"Le quota, sans surprise",text:"Erreurs expliquées, compte à rebours de réinitialisation et vérification d’un reset accordé par le staff."},
        {icon:"tools",title:"Des skills plus simples à gérer",text:"Installer ou désinstaller depuis la même carte, avec un bouton rouge pour la suppression."}
    ]}
};
function createReleaseHighlights({version,enabled=true,load,save}){
    return {
        get(){const content=releases[version] || {headline:"Ton IDE continue de s’améliorer.",items:[{icon:"spark",title:"Améliorations et correctifs",text:"Consulte les notes complètes de cette version pour découvrir tous les changements."}]};return {version,...content,shouldShow:enabled && load().releaseHighlightsSeen!==version,url:`https://github.com/leo51500/francestudents-code-Roblox/releases/tag/v${encodeURIComponent(version)}`};},
        seen(value){if(value!==version)throw new Error("Version de notes invalide.");save({releaseHighlightsSeen:version});return true;}
    };
}
module.exports={createReleaseHighlights,releases};
