-- Configuration centrale du jeu. Modifier ici, jamais dans les services.
-- Généré par France-Students-code-Roblox pour {{GAME_NAME}}.

local GameConfig = {
    Name = "{{GAME_NAME}}",
    Slug = "{{SLUG}}",
    Genre = "{{GENRE}}",
    Version = "0.1.0",

    DataStoreName = "{{SLUG}}_v1",
    AutosaveSeconds = 120,
    StartingCurrency = 150,
    MaxInventorySlots = 40,

    Combat = {
        BaseDamage = 12,
        Cooldown = 0.55,
        Range = 16,
        AllowPvP = false,
    },

    Building = {
        MaxDistance = 80,
        Grid = 4,
    },
}

return GameConfig
