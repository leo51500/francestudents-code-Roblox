-- Bus d'événements serveur (BindableEvent) pour découpler les systèmes.
-- Exemple : InventoryService émet item_collected, QuestService l'écoute.

local ServerStorage = game:GetService("ServerStorage")

local GameEvents = {}
local folder = nil

local function ensureFolder()
    if folder then
        return folder
    end
    folder = ServerStorage:FindFirstChild("GameEvents")
    if not folder then
        folder = Instance.new("Folder")
        folder.Name = "GameEvents"
        folder.Parent = ServerStorage
    end
    return folder
end

local function signal(name)
    local parent = ensureFolder()
    local event = parent:FindFirstChild(name)
    if not event then
        event = Instance.new("BindableEvent")
        event.Name = name
        event.Parent = parent
    end
    return event
end

function GameEvents.fire(name, ...)
    signal(name):Fire(...)
end

function GameEvents.on(name, callback)
    return signal(name).Event:Connect(callback)
end

return GameEvents
