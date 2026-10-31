--!strict

local Config = {
    GameName = "__GAME_NAME__",
    StoreName = "__STORE_NAME__",

    -- Parcours
    PlatformCount = 22,
    PlatformSize = 9,
    PlatformSpacing = 4.2,
    Radius = 18,
    CheckpointEvery = 5,

    -- Règles
    CoinValue = 1,
    CoinRespawnSeconds = 12,
    FallLimit = -28,
    RespawnDelay = 0.4,

    -- Affichage
    HudAccent = Color3.fromRGB(255, 196, 58)
}

return table.freeze(Config)
