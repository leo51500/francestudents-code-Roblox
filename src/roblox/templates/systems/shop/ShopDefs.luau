-- Offres de la boutique. Le prix et la quantité sont validés côté serveur.

local ShopDefs = {}

ShopDefs.Order = { "bandage", "wood_bundle", "torch" }

ShopDefs.Definitions = {
    bandage = {
        name = "Bandage",
        description = "Rend 25 PV.",
        itemId = "bandage",
        amount = 1,
        price = 25,
    },
    wood_bundle = {
        name = "Lot de bois",
        description = "10 bois pour construire.",
        itemId = "wood",
        amount = 10,
        price = 40,
    },
    torch = {
        name = "Torche",
        description = "Éclaire la nuit.",
        itemId = "torch",
        amount = 1,
        price = 60,
    },
}

return ShopDefs
