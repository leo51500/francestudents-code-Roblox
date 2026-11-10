-- Missions : acceptation, progression par événements, récompenses serveur.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Remotes = require(Shared.Remotes)
local QuestDefs = require(Shared.QuestDefs)

local Server = script.Parent.Parent
local ServiceRegistry = require(Server.lib.ServiceRegistry)
local GameEvents = require(Server.lib.GameEvents)

local QuestService = {}
QuestService.Order = 50

local function playerData()
    return ServiceRegistry.get("PlayerData")
end

local function stateOf(player, questId)
    local data = playerData():Get(player)
    if not data then
        return nil
    end
    local state = data.quests[questId]
    if not state then
        state = { status = "available", progress = {} }
        data.quests[questId] = state
    end
    if type(state.progress) ~= "table" then
        state.progress = {}
    end
    return state
end

local function snapshot(player)
    local data = playerData():Get(player)
    if not data then
        return { quests = {} }
    end
    local list = {}
    for _, questId in ipairs(QuestDefs.Order) do
        local definition = QuestDefs.Definitions[questId]
        if definition then
            local state = data.quests[questId]
            table.insert(list, {
                id = questId,
                name = definition.name,
                description = definition.description,
                objectives = definition.objectives,
                rewards = definition.rewards,
                status = state and state.status or "available",
                progress = state and state.progress or {},
            })
        end
    end
    return { quests = list }
end

local function push(player)
    playerData():Push(player)
    Remotes.get("Quests/Sync"):FireClient(player, snapshot(player))
end

local function complete(player, questId)
    local data = playerData():Get(player)
    local state = data and data.quests[questId]
    local definition = QuestDefs.Definitions[questId]
    if not state or not definition or state.status == "completed" then
        return
    end

    state.status = "completed"
    state.completedAt = os.time()

    local rewards = definition.rewards or {}
    if rewards.currency then
        playerData():AddCurrency(player, rewards.currency)
    end
    if rewards.items then
        local inventory = ServiceRegistry.has("InventoryService") and ServiceRegistry.get("InventoryService") or nil
        if inventory then
            for itemId, amount in pairs(rewards.items) do
                inventory:Add(player, itemId, amount)
            end
        end
    end
    push(player)
end

local function advance(player, questId, index, amount)
    local state = stateOf(player, questId)
    local definition = QuestDefs.Definitions[questId]
    if not state or not definition or state.status ~= "active" then
        return
    end
    local objective = definition.objectives[index]
    if not objective then
        return
    end

    local current = math.floor(tonumber(state.progress[index]) or 0)
    local nextValue = math.min(objective.amount, current + amount)
    if nextValue == current then
        return
    end
    state.progress[index] = nextValue

    local completeNow = true
    for objectiveIndex, definitionObjective in ipairs(definition.objectives) do
        local value = math.floor(tonumber(state.progress[objectiveIndex]) or 0)
        if value < definitionObjective.amount then
            completeNow = false
            break
        end
    end

    if completeNow then
        complete(player, questId)
    else
        push(player)
    end
end

local function onItemCollected(player, itemId, amount)
    local data = playerData():Get(player)
    if not data then
        return
    end
    for questId, state in pairs(data.quests) do
        local definition = QuestDefs.Definitions[questId]
        if definition and state.status == "active" then
            for index, objective in ipairs(definition.objectives) do
                if objective.type == "collect" and objective.itemId == itemId then
                    advance(player, questId, index, amount)
                end
            end
        end
    end
end

local function onNpcDefeated(player, tag)
    local data = playerData():Get(player)
    if not data then
        return
    end
    for questId, state in pairs(data.quests) do
        local definition = QuestDefs.Definitions[questId]
        if definition and state.status == "active" then
            for index, objective in ipairs(definition.objectives) do
                if objective.type == "defeat" and objective.tag == tag then
                    advance(player, questId, index, 1)
                end
            end
        end
    end
end

function QuestService:Start()
    Remotes.get("Quests/Get", "RemoteFunction").OnServerInvoke = function(player)
        return snapshot(player)
    end

    Remotes.get("Quests/Sync")

    Remotes.get("Quests/Accept").OnServerEvent:Connect(function(player, questId)
        if type(questId) ~= "string" or not QuestDefs.Definitions[questId] then
            return
        end
        local state = stateOf(player, questId)
        if not state or state.status ~= "available" then
            return
        end
        state.status = "active"
        state.startedAt = os.time()
        state.progress = {}
        push(player)
    end)

    GameEvents.on("item_collected", function(player, itemId, amount)
        if typeof(player) == "Instance" and player:IsA("Player") then
            onItemCollected(player, itemId, amount)
        end
    end)

    GameEvents.on("npc_defeated", function(player, tag)
        if typeof(player) == "Instance" and player:IsA("Player") then
            onNpcDefeated(player, tag)
        end
    end)
end

return QuestService
