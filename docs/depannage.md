# Résoudre un problème

[← Les guides](README.md) · [Connexion](connexion.md) · [Signaler un problème](https://github.com/extraopaa/francestudents-ide/issues)

Note la version de l’application, les étapes qui reproduisent le problème et le message d’erreur. Ne partage jamais de mot de passe, token ou contenu privé dans un rapport public.

## Arrêt inattendu

Au redémarrage, le diagnostic indique les éléments détectés et un code `FST-…`. Utilise **Copier le diagnostic** et transmets ce texte avec l’action qui précédait l’arrêt. Le code `FST-001` signifie que la cause reste inconnue. Le journal ne contient pas le texte des conversations ni le contenu des fichiers, et aucun envoi automatique n’est effectué. Voir le [répertoire des codes](error-codes.md).

## Connexion et modèles

Vérifie Internet et les identifiants FranceStudent. Le mot de passe est vidé après une tentative : saisis-le à nouveau. Le formulaire ne gère pas les étapes de captcha ou d’authentification à deux facteurs.

Pour un fournisseur personnalisé, vérifie le nom du modèle, l’adresse du service et la clé enregistrée dans **Paramètres**. Les API natives ne sont pas nécessairement compatibles avec un endpoint au format OpenAI.

## Quota et contexte

L’onglet **Usage** distingue le budget communiqué par le compte des compteurs de la session. Si le quota est épuisé, consulte la date de réinitialisation affichée. Une erreur de limite de contexte et un quota épuisé sont deux situations différentes.

Si la compaction ne permet pas de reprendre, garde l’historique et ouvre une nouvelle conversation avec un résumé du travail. Les anciennes pièces jointes doivent être ajoutées à nouveau si elles sont nécessaires.

## Fichiers et commandes

Vérifie que le projet ouvert est le bon et que ses fichiers sont enregistrés. Une conversion de document peut être partielle ; consulte [formats et limites](attachments.md).

Si une commande échoue, vérifie son code de retour et sa sortie dans le terminal ou le cockpit. Les outils et dépendances spécifiques au projet doivent être installés séparément. N’utilise Full accès que si tu fais confiance au projet et aux commandes exécutées.

## Skills et MCP

Si un skill n’a aucun effet, vérifie qu’il est activé dans la portée sélectionnée et que son fichier d’instructions est valide. Pour un serveur MCP, contrôle la commande, les arguments, les variables et la sortie du programme ; désactiver puis réactiver peut relancer une connexion.
