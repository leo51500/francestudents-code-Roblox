--!strict
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared", 10)
local Config = require(Shared:WaitForChild("Config", 10) :: ModuleScript)

Players.PlayerAdded:Connect(function(player: Player)
    print(`{Config.GameName} : {player.Name} a rejoint la partie.`)
end)
