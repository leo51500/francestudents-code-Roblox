# Skills et serveurs MCP

[← Les guides](README.md) · [Guide avancé](avance.md)

Les **skills** apportent des instructions spécialisées à l’agent. Les serveurs **MCP** connectent des outils et peuvent démarrer un programme local. Leur installation n’accorde pas automatiquement les mêmes capacités.

## Installer et gérer un skill

1. Ouvre **Extensions** dans la barre latérale.
2. Parcours la bibliothèque intégrée ou la marketplace communautaire et lis les instructions.
3. Choisis la portée : compte utilisateur ou projet courant.
4. Installe le skill, puis vérifie son état dans **Mes skills**.

Les skills communautaires sont installés désactivés. Seul leur fichier d’instructions est récupéré depuis le lien public fourni ; les scripts externes ne sont pas exécutés à l’installation. Vérifie le contenu et la licence avant activation.

Dans **Mes skills**, tu peux importer un fichier `SKILL.md`, un dossier ou une archive ZIP. Les imports restent désactivés jusqu’à activation manuelle. Les limites et exclusions sont décrites dans [guide-utilisation.md](guide-utilisation.md).

Les profils mémorisent un ensemble de skills actifs. Appliquer un profil peut désactiver les autres skills de la portée correspondante.

## Connecter un serveur MCP

Dans **Extensions → Serveurs MCP**, renseigne le nom, la commande, les arguments et les variables nécessaires. Ajouter ou réactiver une connexion peut lancer le programme configuré.

Vérifie l’origine et les permissions du serveur avant de l’activer. Les variables de configuration sont stockées localement : n’y place que les secrets nécessaires. Retirer une connexion supprime sa configuration de l’application avec sauvegarde ; cela ne désinstalle pas son programme.

Les serveurs MCP doivent être compatibles avec Windows.
