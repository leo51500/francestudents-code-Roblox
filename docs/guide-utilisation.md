# Bien commencer avec francestudents-code-Roblox

[← Les guides](README.md) · [Connexion](connexion.md) · [Guide avancé](avance.md)

## 1. Se connecter et ouvrir un projet

Connecte-toi avec ton compte FranceStudent, puis choisis le dossier de code à ouvrir dans l’explorateur. Aucun token ni clé API n’est requis pour utiliser ce compte. Les profils de fournisseurs personnalisés sont facultatifs.

Pour une question générale, tu peux commencer sans projet. Pour modifier des fichiers, ouvre leur dossier et vérifie que le nom du projet affiché est le bon.

La barre **Discussions dans** sélectionne séparément un projet FranceStudent synchronisé avec le site. Les nouvelles conversations seront classées dans ce groupe ; le bouton **+** en crée un, et l’icône de discussion permet de reprendre une conversation déjà présente dans ce projet. Le dossier local ouvert dans l’explorateur reste indépendant de ce classement.

## 2. Travailler avec l’agent

Décris le résultat attendu et les contraintes importantes : fichiers concernés, comportement à préserver et manière de vérifier le résultat. L’agent peut lire et modifier le projet, exécuter des commandes autorisées et présenter les changements dans la conversation.

Les demandes reçues pendant une tâche peuvent être mises en file ou transmises comme consigne. **Stop** interrompt la tâche ; **Annuler l’action** tente d’interrompre l’opération en cours.

Si l’agent a besoin d’une précision, réponds à sa question depuis la carte affichée au-dessus de la saisie. **Passer** indique que tu ne réponds pas et n’accorde aucune permission. Les questions et réponses restent dans l’historique.

## 3. Vérifier et restaurer le travail

Consulte les changements avant de les accepter. L’onglet **Sauvegardes** permet de prévisualiser puis restaurer l’état des fichiers avant une demande à l’agent. Une sauvegarde de sécurité est créée avant restauration.

Les sauvegardes ne couvrent pas les onglets non enregistrés, les fichiers exclus ni les effets externes des commandes. Une restauration peut aussi annuler des modifications manuelles postérieures à la demande sélectionnée.

Les conversations précédentes restent disponibles dans l’historique. Une nouvelle conversation efface le fil affiché, pas les conversations enregistrées. La compaction peut poursuivre le travail dans un nouveau fil serveur tout en conservant le journal visible.

## 4. Utiliser l’éditeur, les fichiers et les extensions

- L’explorateur ouvre les fichiers dans l’éditeur ; le terminal et les tâches du projet sont accessibles depuis le cockpit.
- L’aperçu intégré affiche le Markdown de façon isolée. Les fichiers binaires et médias sont consultables en lecture seule.
- Les pièces jointes peuvent être déposées dans la saisie. Vérifie leur contenu et le quota avant d’envoyer.
- Les **skills** ajoutent des instructions spécialisées. Les serveurs **MCP** peuvent fournir des outils supplémentaires ; vérifie leur provenance avant de les activer.
- Le panneau Git affiche l’état, les modifications et l’historique local, et permet de créer des commits.

Consulte [Pièces jointes](attachments.md), [Skills et serveurs MCP](extensions.md) et [Cockpit et éditeur](studio.md) pour les détails.

## 5. Choisir modèle et autorisations

Le modèle se choisit dans la zone de saisie. Les profils personnalisés utilisent le point d’accès et la clé configurés dans **Paramètres** ; les données transmises suivent les conditions du fournisseur sélectionné.

Commence avec **Sur approbation**. **Automatique** et **Full accès** réduisent les confirmations : Full accès peut autoriser des commandes et des accès hors du dossier du projet. Utilise-le uniquement avec des projets et outils de confiance.

## Raccourcis utiles

| Raccourci | Action |
| --- | --- |
| Ctrl+O | Ouvrir un dossier |
| Ctrl+P | Aller à un fichier |
| Ctrl+Maj+P | Palette de commandes |
| Ctrl+S | Enregistrer |
| Ctrl+L | Aller à la saisie |
| Ctrl+B | Afficher ou masquer la barre latérale |
| Ctrl+J | Afficher ou masquer le panneau du bas |

Un problème ? Consulte le [dépannage](depannage.md).
