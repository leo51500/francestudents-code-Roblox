--!strict
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local Remotes = require(ReplicatedStorage:WaitForChild("Remotes", 5))
local cooldowns: { [number]: number } = {}

local function findCoins(player: Player): IntValue?
    local leaderstats = player:FindFirstChild("leaderstats")
    local coins = leaderstats and leaderstats:FindFirstChild("Coins")
    return coins and coins:IsA("IntValue") and coins or nil
end

local function onBuy(player: Player, item: unknown)
    if typeof(item) ~= "string" or #item > 40 then
        return
    end

    local now = os.clock()
    local last = cooldowns[player.UserId]
    if last and now - last < 0.5 then
        return
    end
    cooldowns[player.UserId] = now

    local coins = findCoins(player)
    if not coins or coins.Value < 10 then
        return
    end
    coins.Value -= 10
end

Remotes.BuyItem.OnServerEvent:Connect(onBuy)

Players.PlayerAdded:Connect(function(player: Player)
    cooldowns[player.UserId] = nil
end)

Players.PlayerRemoving:Connect(function(player: Player)
    cooldowns[player.UserId] = nil
end)
