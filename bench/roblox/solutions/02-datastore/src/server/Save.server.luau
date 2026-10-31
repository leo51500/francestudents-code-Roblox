--!strict
local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")

local store = DataStoreService:GetDataStore("BenchPieces")

local function loadCoins(player: Player): number
    local ok, saved = pcall(function()
        return store:GetAsync(tostring(player.UserId))
    end)
    if ok and type(saved) == "number" then
        return saved
    end
    return 0
end

local function saveCoins(player: Player)
    local leaderstats = player:FindFirstChild("leaderstats")
    local coins = leaderstats and leaderstats:FindFirstChild("Coins")
    if not coins or not coins:IsA("IntValue") then
        return
    end
    local ok, err = pcall(function()
        store:SetAsync(tostring(player.UserId), coins.Value)
    end)
    if not ok then
        warn(`Sauvegarde impossible pour {player.Name} : {err}`)
    end
end

Players.PlayerAdded:Connect(function(player: Player)
    local leaderstats = Instance.new("Folder")
    leaderstats.Name = "leaderstats"

    local coins = Instance.new("IntValue")
    coins.Name = "Coins"
    coins.Value = loadCoins(player)
    coins.Parent = leaderstats

    leaderstats.Parent = player
end)

Players.PlayerRemoving:Connect(saveCoins)
