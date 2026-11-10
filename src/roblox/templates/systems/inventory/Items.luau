-- Catalogue d'objets. Ajoute les objets du jeu ici : identifiant, nom,
-- description, type et pile maximale. Les icônes sont dessinées par l'UI.

local Items = {}

Items.Order = { "wood", "stone", "bandage", "torch" }

Items.Definitions = {
    wood = {
        name = "Bois",
        description = "Ressource de construction.",
        stack = 99,
        kind = "material",
        color = Color3.fromRGB(146, 96, 52),
    },
    stone = {
        name = "Pierre",
        description = "Ressource solide pour les murs.",
        stack = 99,
        kind = "material",
        color = Color3.fromRGB(132, 136, 148),
    },
    bandage = {
        name = "Bandage",
        description = "Rend 25 points de vie.",
        stack = 20,
        kind = "consumable",
        heal = 25,
        color = Color3.fromRGB(232, 232, 240),
    },
    torch = {
        name = "Torche",
        description = "Éclaire la nuit.",
        stack = 10,
        kind = "tool",
        color = Color3.fromRGB(255, 176, 64),
    },
}

function Items.get(id)
    return Items.Definitions[id]
end

return Items
