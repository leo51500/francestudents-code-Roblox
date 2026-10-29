# Crédits

## Projet

**FranceStudent Code Roblox est un fork du projet de [Gab-Desing](https://github.com/Gab-Desing)** : [dépôt](https://github.com/leo51500/francestudents-code-Roblox).

Le crédit de la création revient à Gab-Desing et aux contributeurs. L’historique Git et le champ `author` historique du paquet (Hecone) sont conservés.

Les améliorations sont détaillées dans le [changelog](CHANGELOG.md).

## Dépôt

Le projet FranceStudent Code Roblox, spécialisé Roblox Studio et Blender, est maintenu par [leo51500](https://github.com/leo51500).

## Composants tiers

L’application utilise notamment Electron, CodeMirror, xterm.js, node-pty, Prettier, Marked, DOMPurify, Fuse.js, Lucide et electron-updater. Chaque composant conserve sa licence et son attribution.

EffectCraft (moteur de motion design web, v0.16.0, © 2026 ArtCraft Team and the EffectCraft contributors, licence MIT OR Apache-2.0) est intégré à l’onglet Motion design. Cette distribution modifiée reconstruit le moteur depuis [ses sources](https://github.com/storytold/effectcraft), à une révision épinglée. Le correctif `patches/effectcraft-francestudent.patch` adapte l’interface interne, les traductions et les espaces Simple / Avancé. `npm run vendor:effectcraft` produit le paquet local ; les licences et attributions d’origine sont conservées. Le binaire généré reste hors de Git.

Les licences embarquées sont accessibles dans **Cockpit → Raccourcis → Lire les licences**. Voir les [composants open source](docs/studio.md#composants-open-source).

Le paquet déclare ISC dans `package.json` ; aucun fichier `LICENSE` autonome n’est actuellement présent. Aucun nouveau texte de licence ou détenteur de droits n’est substitué à ceux du projet original.
