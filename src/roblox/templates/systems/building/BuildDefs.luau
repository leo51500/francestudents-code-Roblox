-- Pièces constructibles. Les prefabs sont des modèles Blender placés dans
-- ReplicatedStorage/Assets/Build/<prefab>.

local BuildDefs = {}

BuildDefs.Order = { "wood_wall", "wood_floor" }

BuildDefs.Definitions = {
    wood_wall = {
        name = "Mur en bois",
        description = "Mur simple pour fermer un abri.",
        prefab = "WoodWall",
        cost = 15,
    },
    wood_floor = {
        name = "Sol en bois",
        description = "Plateforme de construction.",
        prefab = "WoodFloor",
        cost = 10,
    },
}

return BuildDefs
