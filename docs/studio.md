# Cockpit et éditeur

[← Les guides](README.md) · [Premiers pas](guide-utilisation.md) · [Guide avancé](avance.md)

Le cockpit regroupe les commandes et outils du projet ouvert. Reviens à l’éditeur sans fermer le projet.

## Exécuter et vérifier

La vue **Exécutions** détecte les scripts de `package.json` et les commandes courantes. La détection n’exécute rien. Un clic lance une commande dans le dossier du projet ; sa sortie, son code de retour, son état et sa durée restent consultables pendant la session.

Quatre commandes peuvent tourner simultanément. **Arrêter** termine le groupe de processus ; **Relancer** réexécute la commande. Les commandes personnelles sont conservées dans `.frst/ide-tasks.json`, avec une copie avant retrait.

**Qualité** vérifie la disponibilité de Node.js, npm et Git et regroupe les diagnostics JavaScript/TypeScript des fichiers ouverts. Cela ne remplace pas le lint et les tests du projet.

## Édition et navigation

- Prettier formate les langages pris en charge sans exécuter les plugins du projet.
- **Comparer** affiche la version enregistrée ou Git HEAD à côté du document actuel.
- **Symboles** et `Ctrl+Maj+O` retrouvent les symboles JavaScript/TypeScript et les titres Markdown.
- `Ctrl+F2` ajoute ou retire un repère de ligne ; `Ctrl+Maj+S` enregistre les onglets modifiés.
- La palette de commandes permet de retrouver des fichiers et actions.
- Les réglages de police, indentation, retour à la ligne et enregistrement sont dans **Paramètres → Éditeur et apparence**.

Les encodages UTF-8 et UTF-16 avec BOM sont préservés à l’enregistrement. Les images et médias sont consultables en lecture seule. Les fichiers binaires ne sont pas réécrits comme du texte.

## Aperçu Markdown et recherche web

**Aperçu** affiche le Markdown actif. Le rendu nettoie le HTML dangereux ; les scripts ne sont pas exécutés et les images distantes ne sont pas chargées.

La vue **Internet** et les outils de recherche permettent de consulter des sources externes lorsque tu le demandes. Les résultats restent distincts des fichiers locaux. `view_image` peut joindre une image du projet à une demande, selon les permissions et les capacités du modèle.

## Git local

Le panneau Git affiche l’état du dépôt, les modifications, les différences et l’historique local. Il permet d’initialiser un dépôt et de créer des commits. Il ne propose pas de synchronisation distante depuis l’interface.

## Mises à jour

Les mises à jour automatiques utilisent les releases de `leo51500/francestudents-code-Roblox` pour les installations Windows par NSIS. Les paquets portables peuvent signaler une version publiée, mais doivent être remplacés manuellement. Chaque push sur `main` fait incrémenter automatiquement le correctif, crée le tag `vX.Y.Z` et déclenche `release-win.yml`, qui publie l’installateur, son `.blockmap`, `latest.yml` et `SHA256SUMS.txt`. Le titre GitHub correspond au tag.

## Composants open source

Les licences embarquées sont consultables dans **Cockpit → Raccourcis → Lire les licences**. Le bundle des licences est généré dans `desktop/renderer/vendor/OPEN_SOURCE_LICENSES.txt`.

| Composant | Usage | Licence |
| --- | --- | --- |
| [CodeMirror et Merge](https://codemirror.net/) | Éditeur et comparaison | MIT |
| [Prettier](https://prettier.io/) | Formatage | MIT |
| [Marked](https://github.com/markedjs/marked) | Markdown | MIT |
| [DOMPurify](https://github.com/cure53/DOMPurify) | Nettoyage HTML | MPL-2.0 ou Apache-2.0 |
| [Fuse.js](https://www.fusejs.io/) | Recherche approximative | Apache-2.0 |
| [Lucide](https://lucide.dev/) | Icônes | ISC |
| [xterm.js](https://xtermjs.org/) | Terminal | MIT |
| [electron-updater](https://www.electron.build/v26/docs/features/auto-update/) | Mises à jour | MIT |
