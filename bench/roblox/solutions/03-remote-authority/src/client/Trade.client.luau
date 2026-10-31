--!strict
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local player = Players.LocalPlayer
local Remotes = ReplicatedStorage:WaitForChild("Remotes", 5)

local function requestBuy()
    Remotes.BuyItem:FireServer("Épée")
end

local button = Instance.new("TextButton")
button.Name = "BoutonAchat"
button.Text = "Acheter (10 pièces)"
button.Size = UDim2.fromOffset(180, 44)
button.Parent = player:WaitForChild("PlayerGui", 5)

button.Activated:Connect(requestBuy)
