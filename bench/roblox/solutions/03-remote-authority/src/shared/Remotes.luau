--!strict
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local buy = Instance.new("RemoteEvent")
buy.Name = "BuyItem"
buy.Parent = ReplicatedStorage

return table.freeze({
    BuyItem = buy,
})
