-- Définitions des missions. Les objectifs utilisent les événements serveur :
-- collect (objet ramassé) et defeat (PNJ tué avec ce tag).

local QuestDefs = {}

QuestDefs.Order = { "gather_wood", "clear_threats" }

QuestDefs.Definitions = {
    gather_wood = {
        name = "Un abri pour la nuit",
        description = "Récolte 5 bois pour préparer la construction.",
        objectives = {
            { type = "collect", itemId = "wood", amount = 5, label = "Bois récolté" },
        },
        rewards = {
            currency = 50,
            items = { bandage = 1 },
        },
    },
    clear_threats = {
        name = "La forêt est hostile",
        description = "Élimine 3 loups autour du camp.",
        objectives = {
            { type = "defeat", tag = "wolf", amount = 3, label = "Loup éliminé" },
        },
        rewards = {
            currency = 120,
            items = { torch = 2 },
        },
    },
}

return QuestDefs
