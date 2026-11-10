-- Données joueur autoritaires : DataStore, reprises, autosave, réplication.
-- Ordre 0 : tous les autres services peuvent lire les données dans Start.

local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local GameConfig = require(ReplicatedStorage.Shared.GameConfig)
local Remotes = require(ReplicatedStorage.Shared.Remotes)

local PlayerData = {}
PlayerData.Order = 0

local store = DataStoreService:GetDataStore(GameConfig.DataStoreName)
local cache = {}
local loading = {}
local dirty = {}
local saving = {}
local snapshotKeys = { "version", "currency", "inventory", "quests", "stats" }

local function defaultData()
    return {
        version = 1,
        currency = GameConfig.StartingCurrency,
        inventory = {},
        quests = {},
        stats = { joins = 0, elapsed = 0 },
        updatedAt = os.time(),
    }
end

-- Ajoute les champs manquants d'une sauvegarde ancienne sans écraser les données.
local function normalize(data)
    local defaults = defaultData()
    if type(data) ~= "table" then
        return defaults
    end
    for key, value in pairs(defaults) do
        if data[key] == nil then
            data[key] = value
        end
    end
    if type(data.inventory) ~= "table" then
        data.inventory = {}
    end
    if type(data.quests) ~= "table" then
        data.quests = {}
    end
    if type(data.stats) ~= "table" then
        data.stats = defaults.stats
    end
    return data
end

local function snapshot(data)
    local copy = {}
    for _, key in ipairs(snapshotKeys) do
        copy[key] = data[key]
    end
    return copy
end

-- Les appels DataStore échouent parfois (limite, réseau) : cinq essais bornés.
local function attempt(callback, label)
    for index = 1, 5 do
        local ok, result = pcall(callback)
        if ok then
            return true, result
        end
        warn("[PlayerData] " .. label .. " : " .. tostring(result) .. " (essai " .. index .. "/5)")
        task.wait(math.min(2 ^ index, 15))
    end
    return false, nil
end

local function keyFor(player)
    return "player_" .. tostring(player.UserId)
end

function PlayerData:Get(player)
    return cache[player]
end

function PlayerData:WaitFor(player, timeout)
    local waited = 0
    local limit = timeout or 10
    while cache[player] == nil and waited < limit do
        task.wait(0.1)
        waited = waited + 0.1
    end
    return cache[player]
end

function PlayerData:Push(player)
    local data = cache[player]
    if not data then
        return
    end
    dirty[player] = true
    Remotes.get("Data/Changed"):FireClient(player, snapshot(data))
end

function PlayerData:AddCurrency(player, amount)
    local data = cache[player]
    amount = math.floor(tonumber(amount) or 0)
    if not data or amount == 0 then
        return false
    end
    data.currency = math.max(0, data.currency + amount)
    data.updatedAt = os.time()
    self:Push(player)
    return true, data.currency
end

function PlayerData:Spend(player, amount)
    local data = cache[player]
    amount = math.floor(tonumber(amount) or 0)
    if not data or amount <= 0 or data.currency < amount then
        return false
    end
    data.currency = data.currency - amount
    data.updatedAt = os.time()
    self:Push(player)
    return true, data.currency
end

function PlayerData:Save(player)
    local data = cache[player]
    if not data or data.temporary or saving[player] then
        return false
    end
    saving[player] = true
    local payload = snapshot(data)
    payload.updatedAt = os.time()
    local ok = attempt(function()
        store:SetAsync(keyFor(player), payload)
    end, "sauvegarde de " .. player.Name)
    saving[player] = nil
    if ok then
        dirty[player] = false
    end
    return ok
end

local function onPlayerAdded(player)
    if cache[player] or loading[player] then
        return
    end
    loading[player] = true
    local ok, stored = attempt(function()
        return store:GetAsync(keyFor(player))
    end, "chargement de " .. player.Name)

    local data
    if ok then
        data = normalize(stored)
    else
        data = defaultData()
        data.temporary = true
        warn("[PlayerData] Données temporaires pour " .. player.Name .. " : la sauvegarde est désactivée pour cette session.")
    end

    data.stats.joins = (data.stats.joins or 0) + 1
    data.stats.lastSeen = os.time()
    cache[player] = data
    loading[player] = nil
    PlayerData:Push(player)
end

function PlayerData:Start()
    Remotes.get("Data/Get", "RemoteFunction").OnServerInvoke = function(player)
        local data = PlayerData:WaitFor(player, 10)
        return data and snapshot(data) or nil
    end

    Remotes.get("Data/Changed")

    Players.PlayerAdded:Connect(onPlayerAdded)
    Players.PlayerRemoving:Connect(function(player)
        PlayerData:Save(player)
        cache[player] = nil
        dirty[player] = nil
        saving[player] = nil
    end)

    for _, player in ipairs(Players:GetPlayers()) do
        task.spawn(onPlayerAdded, player)
    end

    task.spawn(function()
        while true do
            task.wait(GameConfig.AutosaveSeconds)
            for player in pairs(cache) do
                if dirty[player] then
                    PlayerData:Save(player)
                end
            end
        end
    end)

    game:BindToClose(function()
        for player in pairs(cache) do
            PlayerData:Save(player)
        end
    end)
end

return PlayerData
