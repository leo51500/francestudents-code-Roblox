# Sous-agents spécialisés

Un sous-agent travaille dans un **contexte propre** (il ne voit pas la conversation ni le
dossier code de l'agent principal) et ne renvoie que son **compte rendu**. L'agent principal
(orchestrateur) choisit le rôle, écrit un brief autonome, récupère le résumé et présente le
résultat à l'utilisateur.

## Rôles embarqués

| Rôle | Fichier | Outils |
| --- | --- | --- |
| `general` | `src/agent/subagent-roles.js` | lecture seule |
| `roblox-interface` (Interfaces) | `src/agent/subagents/roblox-interface.js` | lecture + écriture Luau + outils Roblox |
| `roblox-3d` (3D / Blender) | `src/agent/subagents/roblox-3d.js` | lecture + écriture + outil `blender` |

## Ajouter un sous-agent

1. Créer `src/agent/subagents/<nom>.js` qui exporte un objet :

```js
module.exports = {
    name: "mon-role",                 // identifiant utilisé par task { "role": "mon-role" }
    label: "Nom lisible",
    summary: "Quand l'orchestrateur doit le choisir (une phrase).",
    instructions: "Méthode, règles et livrable attendu. Français, factuel.",
    tools: ["read_file", "write_file"], // sous-ensemble du registre ; déjà précisés par défaut
    skills: ["roblox-ui"],            // skills installés automatiquement et ajoutés au prompt
    write: true,                      // false/absent : le rôle reste en lecture seule
    writes: ["src/client/UI/**"],     // zones écrites (contrôle de chevauchement)
    maxTurns: 40                      // garde-fou ; 0 = aucune limite
};
```

2. L'ajouter à `BUILTIN` dans `src/agent/subagents/index.js`.

Le rôle est alors proposé automatiquement : il apparaît dans le catalogue injecté dans le
prompt de l'orchestrateur, il est accepté par `task { "role": "<nom>" }`, et les tests du
registre vérifient qu'il déclare des outils et des skills connus.

## Écriture et sécurité

- Un rôle sans `write: true` reçoit uniquement `list_directory`, `read_file`, `search_files`.
- Un rôle en écriture ne peut appeler que ses `tools` ; les mutations passent par les mêmes
  confirmations que l'agent principal (hooks `preToolUse` / `postToolUse` compris).
- Dans l'espace **Motion design**, aucun rôle code n'est lancé : le dossier code reste isolé.
- Les hooks sont exécutés, mais un hook `preToolUse` du projet exige une confirmation
  explicite de l'utilisateur la première fois.
