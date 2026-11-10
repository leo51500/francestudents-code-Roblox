-- Inventaire autoritaire : validation serveur, piles, objets consommables.
-- Les changements passent par PlayerData:Push (canal Data/Changed).

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local GameConfig = require(Shared.GameConfig)
local Remotes = require(Shared.Remotes)
local Items = require(Shared.Items)

local Server = script.Parent.Parent
local ServiceRegistry = require(Server.lib.ServiceRegistry)
local GameEvents = require(Server.lib.GameEvents)

local InventoryService = {}
InventoryService.Order = 20

local useCooldown = {}

local function playerData()
    return ServiceRegistry.get("PlayerData")
end

local function sync(player)
    playerData():Push(player)
end

local function countSlots(inventory)
    local count = 0
    for _, amount in pairs(inventory) do
        if amount > 0 then
            count = count + 1
        end
    end
    return count
end

function InventoryService:Get(player)
    local data = playerData():Get(player)
    return data and data.inventory or nil
end

function InventoryService:Count(player, itemId)
    local inventory = self:Get(player)
    return inventory and inventory[itemId] or 0
end

function InventoryService:Add(player, itemId, amount)
    amount = math.floor(tonumber(amount) or 0)
    local definition = Items.get(itemId)
    if not definition then
        return false, "Objet inconnu : " .. tostring(itemId)
    end
    if amount <= 0 then
        return false, "Quantité invalide."
    end

    local data = playerData():Get(player)
    if not data then
        return false, "Données du joueur non chargées."
    end

    local current = data.inventory[itemId] or 0
    if current == 0 and countSlots(data.inventory) >= GameConfig.MaxInventorySlots then
        return false, "Inventaire plein."
    end

    local maximum = definition.stack or 99
    local nextAmount = math.min(current + amount, maximum)
    if nextAmount == current then
        return false, "Pile déjà pleine."
    end

    data.inventory[itemId] = nextAmount
    local added = nextAmount - current
    sync(player)
    GameEvents.fire("item_collected", player, itemId, added)
    return true, nextAmount
end

function InventoryService:Remove(player, itemId, amount)
    amount = math.floor(tonumber(amount) or 0)
    if amount <= 0 then
        return false, "Quantité invalide."
    end
    local data = playerData():Get(player)
    if not data then
        return false, "Données du joueur non chargées."
    end

    local current = data.inventory[itemId] or 0
    if current < amount then
        return false, "Quantité insuffisante."
    end

    local nextAmount = current - amount
    if nextAmount <= 0 then
        data.inventory[itemId] = nil
    else
        data.inventory[itemId] = nextAmount
    end
    sync(player)
    return true, nextAmount
end

function InventoryService:Use(player, itemId)
    local now = os.clock()
    if (useCooldown[player] or 0) + 0.35 > now then
        return false, "Trop rapide."
    end
    useCooldown[player] = now

    local definition = Items.get(itemId)
    if not definition or definition.kind ~= "consumable" then
        return false, "Objet non utilisable."
    end
    if (self:Count(player, itemId) or 0) < 1 then
        return false, "Objet absent de l'inventaire."
    end

    local character = player.Character
    local humanoid = character and character:FindFirstChildOfClass("Humanoid")
    if not humanoid or humanoid.Health <= 0 then
        return false, "Personnage indisponible."
    end
    if humanoid.Health >= humanoid.MaxHealth then
        return false, "Vie déjà au maximum."
    end

    if definition.heal then
        humanoid.Health = math.min(humanoid.MaxHealth, humanoid.Health + definition.heal)
    end
    self:Remove(player, itemId, 1)
    return true, itemId
end

function InventoryService:Start()
    Remotes.get("Inventory/Get", "RemoteFunction").OnServerInvoke = function(player)
        return InventoryService:Get(player)
    end

    Remotes.get("Inventory/Use").OnServerEvent:Connect(function(player, itemId)
        if type(itemId) ~= "string" then
            return
        end
        InventoryService:Use(player, itemId)
    end)
end

return InventoryService
