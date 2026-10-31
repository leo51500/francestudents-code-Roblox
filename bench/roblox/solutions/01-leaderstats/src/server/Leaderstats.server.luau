--!strict
local Players = game:GetService("Players")

local function addLeaderstats(player: Player)
    local leaderstats = Instance.new("Folder")
    leaderstats.Name = "leaderstats"

    local coins = Instance.new("IntValue")
    coins.Name = "Pièces"
    coins.Value = 0
    coins.Parent = leaderstats

    leaderstats.Parent = player
end

Players.PlayerAdded:Connect(addLeaderstats)

for _, player in Players:GetPlayers() do
    addLeaderstats(player)
end
