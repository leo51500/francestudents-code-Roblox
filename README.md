<div align="center">

<img src="desktop/icon.png" width="80" alt="Logo France-Students-code-Roblox" />

# France-Students-code-Roblox

**Un environnement de programmation en français, adapté et maintenu par GAB DESING.**

[Guides](docs/README.md) · [Journal des modifications](CHANGELOG.md)

</div>

> **Origine :** projet créé par [EsteG7](https://github.com/EsteG7/francestudents-ide), puis maintenu par [extraopaa](https://github.com/extraopaa). Cette reprise est modifiée par **GAB DESING**, mainteneur actuel. Les auteurs, crédits et licences d’origine sont conservés ; ce fork n’est pas une version officielle du projet amont.

Chaque push sur `main` publie une release Windows. Si la version de `package.json` n’a pas encore de tag, cette version est publiée telle quelle ; sinon, le correctif est incrémenté automatiquement. Le workflow crée le tag `vX.Y.Z` et une release au titre identique. L’application installée vérifie et télécharge les mises à jour en arrière-plan. Au démarrage, tu peux choisir de passer ou de redémarrer pour installer ; aucune mise à jour ne s’installe sans ton accord. Après ton accord, l’installateur se lance en silencieux puis relance l’application. Windows peut encore afficher une demande d’autorisation, car les exécutables ne sont pas signés. Le paquet portable reste à mettre à jour manuellement.

## Fonctionnalités conservées

- Éditeur de projet, explorateur de fichiers, terminal et outils de vérification.
- Agent IA avec historique visible, reprise de conversations, plans et sauvegardes avant modification.
- Git local pour consulter l’état, les changements et l’historique, puis créer des commits.
- Skills installables et serveurs MCP configurables pour ajouter des outils.
- Notifications Windows avec son système à chaque demande de l’agent, même au premier plan, et à la fin d’une tâche en arrière-plan ; elles sont désactivables dans les réglages.
- Spécialisation **Roblox + Blender** : modèles 3D créés dans Blender ou importés
  depuis un GLB/glTF/FBX/OBJ/STL/BLEND, génération des LOD, upload avec le compte
  connecté dans le plugin Roblox (modèles et sons), et insertion dans Studio via
  les serveurs MCP. Blender et Studio sont détectés (Steam, installation ou
  fichier choisi) et peuvent être ouverts depuis l’application ; le même panneau
  lance n’importe quelle application installée (menu Démarrer, Store, Steam) et
  l’agent peut l’ouvrir avec `open_app`. Voir
  [Roblox + Blender](docs/roblox-blender.md).
- Connexion au compte FranceStudent, sélection du modèle et profils de fournisseurs personnalisés.
- Pièces jointes, recherche documentaire, aperçus Markdown et suivi du quota.

Les skills intégrés `roblox-blender`, `roblox-lod`, `roblox-ui` et
`roblox-audio` sont livrés avec l’application et actifs par défaut. La géométrie
et les textures 3D se créent dans Blender, même sans le mot « Blender » ; les
sons sont préparés avec leurs licences, importés par `action:audio` puis envoyés
avec le compte du plugin Roblox avant le câblage des `Sound`.
L’agent vérifie les étapes visuelles par capture (`look` ou `screen_capture`).
Les interfaces de jeu utilisent des GUI natives au style cartoon Roblox,
jamais une page web. Les connexions MCP Blender et Roblox Studio peuvent être
ajoutées en un clic depuis **Extensions**.

## Démarrer depuis les sources

Avec Node.js 22.13.0 ou plus récent et npm :

```powershell
npm install
npm run desktop
```

Connecte-toi avec ton compte FranceStudent. L’application n’a pas besoin d’une clé API pour ce compte. Les outils et dépendances propres au projet ouvert restent à installer séparément.

## Sauvegardes et autorisations

L’onglet **Sauvegardes** permet de prévisualiser puis restaurer l’état des fichiers avant une demande à l’agent. Une sauvegarde de sécurité est créée avant la restauration. Les fichiers non enregistrés, les fichiers exclus et les actions externes ne sont pas couverts.

Commence avec les confirmations activées et vérifie les modifications. **Full accès** permet à l’agent d’agir sans confirmation : réserve-le aux projets et outils auxquels tu fais confiance.

## Documentation

- [Guides illustrés](docs/README.md) · [Connexion](docs/connexion.md) · [Premiers pas](docs/guide-utilisation.md)
- [Extensions, skills et MCP](docs/extensions.md) · [Pièces jointes](docs/attachments.md)
- [Guide avancé](docs/avance.md) · [Dépannage](docs/depannage.md)
- [Contribuer](CONTRIBUTING.md) · [Crédits](CREDITS.md)
- [Signaler un problème](https://github.com/leo51500/francestudents-code-Roblox/issues)

Pour le contexte de développement commun aux assistants, consulter [AGENTS.md](AGENTS.md) et [docs/AI_CONTEXT.md](docs/AI_CONTEXT.md).
