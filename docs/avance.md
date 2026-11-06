# Guide avancé

[← Les guides](README.md) · [Premiers pas](guide-utilisation.md) · [Contribuer](../CONTRIBUTING.md)

## Développer depuis les sources

Prérequis : Node.js 22.13.0 ou plus récent, npm et Git.

```powershell
npm install
npm run desktop
```

Commandes de contrôle et de construction :

| Commande | Usage |
| --- | --- |
| `npm run lint` | Vérifier le code |
| `npm run build:renderer` | Générer le bundle de l’interface |
| `npm run check:renderer` | Vérifier que le bundle est à jour |
| `npm test` | Exécuter les tests unitaires |
| `npm run test:e2e` | Parcours Electron avec un environnement graphique |
| `npm run build:desktop` | Construire une application Windows locale |
| `npm run dist:win` | Générer les paquets Windows locaux |

Les sources du renderer sont dans `desktop/renderer/src/`. `desktop/renderer/app.js` est généré et versionné : ne le modifie pas directement. Reconstruis-le avec `npm run build:renderer`.

Les tests isolent les réglages et historiques. N’exécute pas de test avec des données personnelles ou un profil contenant des secrets.

## Agent, historique et contexte

Le contexte de l’agent peut inclure les consignes du projet, les fichiers pertinents et les résultats des outils. Le journal de conversation visible est distinct des prompts transmis au modèle. La compaction résume le contexte lorsque nécessaire ; elle ne supprime pas l’historique affiché.

Le transfert vers un autre modèle crée un nouveau fil à partir des échanges textuels disponibles. Les anciennes pièces jointes ne sont pas retransmises automatiquement. Les capacités et estimations de contexte sont décrites dans [model-context.md](model-context.md).

Les profils personnalisés utilisent une API compatible avec le format configuré dans l’application. Vérifie les conditions du fournisseur avant d’y transmettre des fichiers ou des consignes de projet.

## Fichiers et recherche

Les documents, images et archives peuvent être convertis ou indexés localement avant envoi. Les résultats peuvent être partiels et sont signalés à l’agent. Les formats et limites sont détaillés dans [attachments.md](attachments.md).

La recherche web consulte des sources externes lorsque l’utilisateur ou l’agent le demande. Elle est distincte de l’aperçu local de fichiers : l’application n’exécute pas les sites du projet dans un navigateur intégré.

## Skills, MCP et permissions

Les skills fournissent des instructions ; ils n’installent ni n’exécutent automatiquement les scripts associés. Les serveurs MCP peuvent démarrer des programmes locaux. Vérifie le code, l’origine et les accès demandés avant activation. La configuration MCP est conservée localement avec une sauvegarde à chaque modification.

Les modes de permission contrôlent les confirmations de l’agent, pas les droits Windows du processus. **Full accès** peut élargir les opérations aux fichiers hors projet et aux commandes système. Les commandes déjà terminées ou leurs effets distants ne peuvent pas toujours être annulés.

## Git local et mises à jour

Le panneau Git local affiche l’état, le diff, les commits et l’historique du dépôt ouvert. Il ne remplace pas l’usage explicite de Git depuis un terminal.

Les mises à jour automatiques utilisent les releases de `leo51500/francestudents-code-Roblox`. Elles sont disponibles pour l’application Windows installée par NSIS ; le paquet portable peut signaler une version publiée, mais doit être remplacé manuellement. Chaque push sur `main` déclenche `.github/workflows/release-win.yml`, qui incrémente le correctif de `package.json`, crée un tag `vX.Y.Z` et publie la release sous le même titre, avec le `.exe`, son `.blockmap`, `latest.yml` et `SHA256SUMS.txt`.

Le workflow signe l’application Windows avec electron-builder si les secrets GitHub `WIN_CSC_LINK` et `WIN_CSC_KEY_PASSWORD` sont configurés. `WIN_CSC_LINK` doit contenir le certificat de signature PFX encodé en Base64 ; le workflow le décode temporairement sur le runner Windows et efface le fichier après la compilation. `WIN_CSC_KEY_PASSWORD` contient son mot de passe. Sans ces deux secrets, la compilation continue mais la release reste non signée et Smart App Control peut la bloquer. Il faut un certificat de signature de code approuvé par Windows ; un certificat auto-signé ne convient pas à cette fin. `electron-updater` lit `latest.yml` dans la release GitHub et vérifie la signature de l’installateur mis à jour.

Pour préparer les secrets, obtenir d’abord un certificat PFX auprès d’un fournisseur de signature de code reconnu, puis depuis un poste sûr, avec GitHub CLI connecté au dépôt :

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\chemin\certificat.pfx")) | gh secret set WIN_CSC_LINK --repo leo51500/francestudents-code-Roblox
gh secret set WIN_CSC_KEY_PASSWORD --repo leo51500/francestudents-code-Roblox
```

La seconde commande demande le mot de passe sans l’inscrire dans le dépôt. Ne jamais committer le PFX ou son mot de passe, ni les envoyer dans une conversation.

## Données et crédits

Les données utilisateur restent dans le dossier historique de l’application. Ne change pas `build.appId` ni ce dossier sans migration explicite. Les crédits et licences d’origine sont conservés ; voir [CREDITS.md](../CREDITS.md).
