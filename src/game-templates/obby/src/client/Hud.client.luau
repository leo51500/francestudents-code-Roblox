--!strict

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui", 10) :: PlayerGui?
if not playerGui then
    error("PlayerGui introuvable : le HUD ne peut pas démarrer.")
end

local Shared = ReplicatedStorage:WaitForChild("Shared", 10) :: Folder?
if not Shared then
    error("Dossier Shared introuvable : vérifie le build Rojo.")
end

local Config = require(Shared:WaitForChild("Config", 10) :: ModuleScript)
local connections: { RBXScriptConnection } = {}

local function track(connection: RBXScriptConnection)
    table.insert(connections, connection)
end

local function disconnectAll()
    for _, connection in connections do
        connection:Disconnect()
    end
    table.clear(connections)
end

local screen = Instance.new("ScreenGui")
screen.Name = "ObbyHud"
screen.ResetOnSpawn = false
screen.IgnoreGuiInset = true
screen.DisplayOrder = 20
screen.Parent = playerGui

local panel = Instance.new("Frame")
panel.Name = "Panel"
panel.AnchorPoint = Vector2.new(0, 0)
panel.Position = UDim2.fromOffset(18, 18)
panel.Size = UDim2.fromOffset(250, 118)
panel.BackgroundColor3 = Color3.fromRGB(18, 22, 32)
panel.BackgroundTransparency = 0.18
panel.BorderSizePixel = 0
panel.Parent = screen

local corner = Instance.new("UICorner")
corner.CornerRadius = UDim.new(0, 14)
corner.Parent = panel

local padding = Instance.new("UIPadding")
padding.PaddingTop = UDim.new(0, 12)
padding.PaddingBottom = UDim.new(0, 12)
padding.PaddingLeft = UDim.new(0, 14)
padding.PaddingRight = UDim.new(0, 14)
padding.Parent = panel

local layout = Instance.new("UIListLayout")
layout.FillDirection = Enum.FillDirection.Vertical
layout.Padding = UDim.new(0, 4)
layout.SortOrder = Enum.SortOrder.LayoutOrder
layout.Parent = panel

local title = Instance.new("TextLabel")
title.Name = "Title"
title.LayoutOrder = 1
title.BackgroundTransparency = 1
title.Size = UDim2.new(1, 0, 0, 22)
title.Font = Enum.Font.GothamBold
title.TextSize = 17
title.TextColor3 = Config.HudAccent
title.TextXAlignment = Enum.TextXAlignment.Left
title.Text = Config.GameName
title.Parent = panel

local function makeLine(name: string, order: number, color: Color3): TextLabel
    local label = Instance.new("TextLabel")
    label.Name = name
    label.LayoutOrder = order
    label.BackgroundTransparency = 1
    label.Size = UDim2.new(1, 0, 0, 20)
    label.Font = Enum.Font.Gotham
    label.TextSize = 15
    label.TextColor3 = color
    label.TextXAlignment = Enum.TextXAlignment.Left
    label.Text = ""
    label.Parent = panel
    return label
end

local coinsLabel = makeLine("Coins", 2, Color3.fromRGB(255, 224, 120))
local checkpointLabel = makeLine("Checkpoint", 3, Color3.fromRGB(170, 240, 190))
local timeLabel = makeLine("Time", 4, Color3.fromRGB(225, 230, 240))
local bestLabel = makeLine("Best", 5, Color3.fromRGB(190, 200, 215))

local function pulse(label: TextLabel)
    local tween = TweenService:Create(
        label,
        TweenInfo.new(0.12, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
        { TextSize = 18 }
    )
    tween:Play()
    task.delay(0.14, function()
        TweenService:Create(
            label,
            TweenInfo.new(0.18, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
            { TextSize = 15 }
        ):Play()
    end)
end

local function formatTime(seconds: number): string
    local total = math.max(0, seconds)
    local minutes = math.floor(total / 60)
    local rest = total - minutes * 60
    return string.format("%d:%05.2f", minutes, rest)
end

local function readCoins()
    local value = player:GetAttribute("Coins")
    coinsLabel.Text = `Pièces : {typeof(value) == "number" and value or 0}`
end

local function readCheckpoint()
    local value = player:GetAttribute("Checkpoint")
    checkpointLabel.Text = `Checkpoint : {typeof(value) == "number" and value or 0}`
end

local function readTime()
    local value = player:GetAttribute("Elapsed")
    local elapsed = typeof(value) == "number" and value or 0
    local finished = player:GetAttribute("Finished") == true
    timeLabel.Text = finished and `Terminé : {formatTime(elapsed)}` or `Temps : {formatTime(elapsed)}`
end

local function readBest()
    local value = player:GetAttribute("BestTime")
    local best = typeof(value) == "number" and value or 0
    bestLabel.Text = best > 0 and `Meilleur : {formatTime(best)}` or "Meilleur : aucun"
end

readCoins()
readCheckpoint()
readTime()
readBest()

track(player:GetAttributeChangedSignal("Coins"):Connect(function()
    readCoins()
    pulse(coinsLabel)
end))
track(player:GetAttributeChangedSignal("Checkpoint"):Connect(function()
    readCheckpoint()
    pulse(checkpointLabel)
end))
track(player:GetAttributeChangedSignal("Elapsed"):Connect(readTime))
track(player:GetAttributeChangedSignal("Finished"):Connect(readTime))
track(player:GetAttributeChangedSignal("BestTime"):Connect(readBest))

-- Le HUD reste lisible sur mobile : taille bornée à la largeur réelle de l'écran.
local viewport = workspace.CurrentCamera and workspace.CurrentCamera.ViewportSize or Vector2.new(1280, 720)
if viewport.X < 520 then
    panel.Size = UDim2.fromOffset(math.min(230, viewport.X - 24), 112)
    title.TextSize = 15
end

track(player.AncestryChanged:Connect(function(_, parent)
    if not parent then
        disconnectAll()
    end
end))

-- Les attributs sont écrits par le serveur : le client ne décide ni des pièces
-- ni du temps. Aucune connexion n'est recréée à chaque apparition du personnage.
