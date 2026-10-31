<div align="center">

<img src="desktop/renderer/assets/francestudent-logo.png" width="80" alt="Logo FranceStudent Code Roblox" />

# FranceStudent Code Roblox

**Crée tes jeux Roblox Studio et tes modèles Blender avec un assistant IA en français.**

[Télécharger pour Windows](https://github.com/leo51500/francestudents-code-Roblox/releases/latest) · [Les guides illustrés](docs/README.md)

Un éditeur Luau prêt pour Rojo, un studio EffectCraft pour l'UI et les animations, et Blender pour les modèles 3D. Un chat spécialisé pour chaque espace.

</div>

> [!IMPORTANT]
> **Ce dépôt est le fork [leo51500/francestudents-code-Roblox](https://github.com/leo51500/francestudents-code-Roblox) du projet [FranceStudent Code de Gab-Desing](https://github.com/Gab-Desing/francestudents-code-Roblox).**
> La création du projet revient à **Gab-Desing et aux contributeurs d’origine**. Ce dépôt, maintenu par [leo51500](https://github.com/leo51500), est spécialisé pour Roblox Studio et Blender.
>
> **FranceStudent Code Roblox est une application distincte** (identifiant `fr.francestudent.code.roblox`, dossier de données `~/.francestudent-code-roblox`). Elle s’installe à côté d’une éventuelle version FranceStudent IDE sans partager ni écraser ses réglages.

**Nouveautés 1.5.46 :** une longue demande qui contient « ou » ou parle de « dossiers » n'est plus confondue avec la question « Projet actuel » : elle est transmise à l'assistant, qui peut enfin lire et modifier les fichiers du projet.

**Précédent — 1.5.45 :** l'assistant retrouve un fichier par son nom approximatif, retient les repères stables de ton projet (Rojo, outils Luau, commande de test), peut écrire un jeu jouable complet dès le premier appel (`roblox_game`), et refuse une conclusion « terminé » sans vérification postérieure à la dernière modification — chaque réponse se termine par une checklist de fin de tâche.

**Précédent — 1.5.44 :** l'assistant corrige ses remplacements en un seul essai quand le texte diffère légèrement, la vérification du Luau devient obligatoire avant de conclure, et les erreurs de tes scripts apparaissent directement dans le panneau Roblox avec un clic vers la ligne.

## Le mode Roblox Studio

Ouvre ton projet Rojo, retrouve tes scripts Luau et explique ce que tu veux construire : mécanique de jeu, interface, boutique, optimisation. L'assistant connait Luau typé, Rojo, Wally, StyLua/Selene et les bonnes pratiques Studio (autorité serveur, DataStore, mobile/console). Le cockpit détecte tes fichiers `*.project.json` et propose directement **Build Rojo**, **Rojo serve**, **wally install** et **selene**.

## Les modèles 3D avec Blender

Pour les props, armes, véhicules ou personnages, l'assistant écrit un script Python Blender, l'exécute en arrière-plan (`blender --background --python`) et vérifie le GLB produit avant de te guider pour l'import dans Roblox (échelle 1 stud = 0,28 m, textures 1024 px, polygones optimisés).

Les 16 [skills Roblox/Blender](docs/roblox-blender.md) sont intégrés et disponibles hors ligne.

![Mode Code : fichier HTML ouvert dans l’éditeur, explorateur du projet et assistant à droite](docs/images/mode-code.png)

## Le mode Motion design · Bêta

Passe dans **EffectCraft** pour préparer tes compositions avec un chat spécialisé. Commence avec le mode **Simple**, suis les petits tutos et ouvre le mode **Avancé** pour retrouver les outils complets de l’éditeur.

Les conversations Code et Motion sont séparées : l’assistant motion travaille dans son propre espace.

![Mode Motion : composition Aurora dans EffectCraft, calques et chat spécialisé](docs/images/mode-motion.png)

## Installer l’application

| Ton ordinateur | Fichier à télécharger |
| --- | --- |
| **Windows 64 bits** | [Dernière version stable](https://github.com/leo51500/francestudents-code-Roblox/releases/latest) → `setup.exe` |

L’application est distribuée **uniquement pour Windows**.

1. Ouvre l’installateur Windows.
2. Lance FranceStudent Code Roblox et suis le guide de connexion à ton **compte FranceStudent**.
3. Ouvre un dossier pour coder, ou passe dans le studio Motion pour commencer une composition.

Pas besoin d’installer Node.js ni de fournir une clé API pour utiliser le chat FranceStudent. Certains projets et outils peuvent demander leurs propres dépendances.

**Mises à jour :** Windows peut télécharger et installer les nouvelles versions automatiquement.

## Ce que ce fork ajoute

- **Une application dédiée** : FranceStudent Code Roblox, nom, installateur et données propres (`FranceStudentCodeRoblox-<version>-setup.exe`).
- **Une spécialisation Roblox Studio + Blender** : instructions agent dédiées, 16 skills intégrés, détection Rojo/Wally/Selene et commandes de build dans le cockpit.
- **Une interface harmonisée** : conversations récentes, réglages organisés et suivi du quota.
- **Des pièces jointes plus pratiques** : glisser-déposer, conversion de nombreux formats et envoi en lots quand le service l’exige.
- **Un mode Éco** et un avertissement avant les envois volumineux pour mieux maîtriser la consommation.
- **Des conversations qui se reprennent** : historique lisible, compaction du contexte et import de conversations Codex en bêta.
- **Des outils pour agir** : contrôle des serveurs locaux, annulation des actions et connecteur GitHub en bêta.
- **Une bibliothèque de skills** pour Roblox/Blender, le code et le motion design, avec installation et désinstallation.
- **EffectCraft intégré** : chat motion spécialisé, mode Simple, outils avancés et tutos.

Les [notes de version](CHANGELOG.md) détaillent les ajouts et leurs limites.

## Les skills et le suivi d’usage

### Des outils pour tes animations

La sélection motion propose des skills pour les titres, logos, transitions, mouvements et exports. Les skills **EffectCraft** accompagnent le studio intégré ; les skills **Remotion** s’utilisent dans les projets de code. Le marketplace Code conserve **SkillsMP**.

![Sélection de skills Motion : titres animés, animation de logo, transitions et autres outils à installer](docs/images/skills-motion.png)

### Ton quota, visible dans l’application

Clique sur la jauge pour ouvrir l’onglet **Usage** : budget disponible, compteurs de session et réinitialisation lorsque le service la communique. Le mode Éco réduit les capacités proposées pour limiter la consommation, sans garantir une économie précise.

![Onglet Usage avec jauge du budget de chat et compteurs de la session](docs/images/suivi-usage.png)

<sub>Captures réalisées dans l’application sous Windows, avec le projet fictif Aurora. Les échanges et les chiffres d’usage sont des exemples de démonstration ; le code affiché et la composition EffectCraft sont réels.</sub>

## Garder le contrôle

Les réponses de l’IA et les pièces jointes consomment le quota de ton compte. Commence avec les confirmations activées et vérifie les modifications. Le mode **Full accès** autorise l’agent à agir sans confirmation : utilise-le avec des projets et outils auxquels tu fais confiance.

Télécharge l’installateur depuis les releases de ce fork. Windows peut afficher un avertissement pour une application sans signature d’éditeur reconnue.

## Pour aller plus loin

- [Les guides illustrés](docs/README.md) : installation, connexion, Code, Motion et fonctions principales.
- [Connexion pas à pas](docs/connexion.md) · [Premiers pas](docs/guide-utilisation.md) · [Dépannage](docs/depannage.md).
- [Guide avancé](docs/avance.md) : installation depuis les sources, réglages, formats et extensions.
- [Signaler un problème](https://github.com/leo51500/francestudents-code-Roblox/issues) : indique ta version, ton système et les étapes pour reproduire le souci, sans identifiants.
- [Contribuer](CONTRIBUTING.md) · [Nouveautés](CHANGELOG.md) · [Crédits](CREDITS.md).

Pour reprendre le développement avec n’importe quel assistant IA, commence par [AGENTS.md](AGENTS.md) et [le contexte du projet](docs/AI_CONTEXT.md).
