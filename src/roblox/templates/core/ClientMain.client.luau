-- Point d'entrée client : charge les contrôleurs dans l'ordre déclaré.

local Players = game:GetService("Players")

local Client = script.Parent
local player = Players.LocalPlayer

local ordered = {}

for _, module in ipairs(Client.controllers:GetChildren()) do
    if module:IsA("ModuleScript") then
        local ok, controller = pcall(require, module)
        if ok and type(controller) == "table" then
            table.insert(ordered, { module = module, controller = controller })
        else
            warn("[Client] Contrôleur inaccessible " .. module.Name .. " : " .. tostring(controller))
        end
    end
end

table.sort(ordered, function(a, b)
    return (a.controller.Order or 100) < (b.controller.Order or 100)
end)

player:WaitForChild("PlayerGui", 30)

for _, item in ipairs(ordered) do
    if type(item.controller.Start) == "function" then
        local ok, err = pcall(item.controller.Start, item.controller)
        if ok then
            print("[Client] " .. item.module.Name .. " démarré.")
        else
            warn("[Client] " .. item.module.Name .. " a échoué : " .. tostring(err))
        end
    end
end

print("[Client] {{GAME_NAME}} prêt.")
