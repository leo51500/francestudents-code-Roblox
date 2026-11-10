-- Point d'entrée serveur : enregistre tous les services puis les démarre
-- dans l'ordre déclaré. Un service en erreur n'empêche pas les autres.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local Server = script.Parent
local Remotes = require(ReplicatedStorage.Shared.Remotes)
local ServiceRegistry = require(Server.lib.ServiceRegistry)

local ordered = {}

for _, module in ipairs(Server.services:GetChildren()) do
    if module:IsA("ModuleScript") then
        local ok, service = pcall(require, module)
        if ok and type(service) == "table" then
            table.insert(ordered, { module = module, service = service })
        else
            warn("[Boot] Service inaccessible " .. module.Name .. " : " .. tostring(service))
        end
    end
end

table.sort(ordered, function(a, b)
    return (a.service.Order or 100) < (b.service.Order or 100)
end)

for _, item in ipairs(ordered) do
    ServiceRegistry.set(item.module.Name, item.service)
end

for _, item in ipairs(ordered) do
    if type(item.service.Start) == "function" then
        local ok, err = pcall(item.service.Start, item.service)
        if ok then
            print("[Boot] " .. item.module.Name .. " démarré.")
        else
            warn("[Boot] " .. item.module.Name .. " a échoué : " .. tostring(err))
        end
    end
end

-- Réapparition demandée par le menu, limitée à une fois toutes les 5 secondes.
local respawnAt = {}
Remotes.get("Player/Respawn").OnServerEvent:Connect(function(player)
    local now = os.clock()
    if (respawnAt[player] or 0) + 5 > now then
        return
    end
    respawnAt[player] = now
    player:LoadCharacter()
end)

Players.PlayerRemoving:Connect(function(player)
    respawnAt[player] = nil
end)

print("[Boot] {{GAME_NAME}} prêt.")
