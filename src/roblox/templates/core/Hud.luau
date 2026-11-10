-- HUD permanent : vie, monnaie, menu. Objets GUI natifs, style cartoon.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local Theme = require(script.Parent.Theme)
local ClientState = require(script.Parent.Parent.ClientState)
local Remotes = require(ReplicatedStorage.Shared.Remotes)

local player = Players.LocalPlayer
local gui = Theme.screenGui("Hud")
local root = Theme.create("Frame", {
    Size = UDim2.fromScale(1, 1),
    BackgroundTransparency = 1,
    BorderSizePixel = 0,
}, gui)

local currencyValue = 0
local currencyLabel

local function setCurrency(value)
    currencyValue = math.floor(tonumber(value) or 0)
    if currencyLabel then
        currencyLabel.Text = tostring(currencyValue)
    end
end

-- Vie -----------------------------------------------------------------------
local healthPanel = Theme.panel(root, {
    Position = UDim2.new(0, 24, 1, -96),
    Size = UDim2.fromOffset(262, 40),
    AnchorPoint = Vector2.new(0, 0),
})
local healthTrack = Theme.create("Frame", {
    Size = UDim2.fromScale(1, 1),
    BackgroundColor3 = Theme.Colors.Background,
    BackgroundTransparency = 0.25,
    BorderSizePixel = 0,
}, healthPanel)
Theme.corner(healthTrack, 12)
local healthFill = Theme.create("Frame", {
    Size = UDim2.fromScale(1, 1),
    BackgroundColor3 = Theme.Colors.Green,
    BorderSizePixel = 0,
}, healthTrack)
Theme.corner(healthFill, 12)
Theme.gradient(healthFill, Theme.Colors.Green, Theme.Colors.GreenDeep)
local healthText = Theme.label(healthTrack, "100 / 100", {
    Size = UDim2.fromScale(1, 1),
    TextSize = 20,
    TextScaled = false,
})
Theme.cartoonText(healthText, 2)

-- Monnaie -------------------------------------------------------------------
local currencyPanel = Theme.panel(root, {
    Position = UDim2.new(1, -24, 0, 24),
    Size = UDim2.fromOffset(176, 48),
    AnchorPoint = Vector2.new(1, 0),
})
local coin = Theme.create("Frame", {
    Position = UDim2.new(0, 10, 0.5, 0),
    Size = UDim2.fromOffset(30, 30),
    AnchorPoint = Vector2.new(0, 0.5),
    BackgroundColor3 = Theme.Colors.Accent,
    BorderSizePixel = 0,
}, currencyPanel)
Theme.corner(coin, 15)
Theme.stroke(coin, Theme.Colors.Ink, 2)
local coinLabel = Theme.label(coin, "C", {
    Size = UDim2.fromScale(1, 1),
    TextSize = 18,
    TextScaled = false,
})
Theme.cartoonText(coinLabel, 1)

currencyLabel = Theme.label(currencyPanel, "0", {
    Position = UDim2.new(0, 52, 0, 0),
    Size = UDim2.new(1, -62, 1, 0),
    TextSize = 24,
    TextXAlignment = Enum.TextXAlignment.Left,
})
Theme.cartoonText(currencyLabel, 2)

-- Menu ----------------------------------------------------------------------
local menuButton = Theme.button(root, "MENU", {
    Position = UDim2.new(0, 24, 0, 24),
    Size = UDim2.fromOffset(120, 46),
    TopColor = Theme.Colors.Blue,
    BottomColor = Theme.Colors.BlueDeep,
})
menuButton.TextSize = 20

local overlay = Theme.create("Frame", {
    Size = UDim2.fromScale(1, 1),
    BackgroundColor3 = Theme.Colors.Background,
    BackgroundTransparency = 0.45,
    BorderSizePixel = 0,
    Visible = false,
    ZIndex = 40,
}, root)

local menu = Theme.panel(overlay, {
    Position = UDim2.fromScale(0.5, 0.5),
    Size = UDim2.fromOffset(430, 380),
    AnchorPoint = Vector2.new(0.5, 0.5),
    ZIndex = 41,
})
Theme.fit(menu, 900)

local title = Theme.label(menu, "PAUSE", {
    Position = UDim2.fromOffset(0, 22),
    Size = UDim2.new(1, 0, 0, 46),
    TextSize = 34,
    TextXAlignment = Enum.TextXAlignment.Center,
    ZIndex = 42,
})
Theme.cartoonText(title, 3)

local resume = Theme.button(menu, "REPRENDRE", {
    Position = UDim2.fromOffset(40, 96),
    Size = UDim2.new(1, -80, 0, 54),
})
resume.ZIndex = 42

local respawn = Theme.button(menu, "RÉAPPARAÎTRE", {
    Position = UDim2.fromOffset(40, 164),
    Size = UDim2.new(1, -80, 0, 54),
    TopColor = Theme.Colors.Accent,
    BottomColor = Theme.Colors.AccentDeep,
})
respawn.ZIndex = 42

local sensitivity = Theme.label(menu, "Sensibilité : 1.0", {
    Position = UDim2.fromOffset(40, 238),
    Size = UDim2.new(1, -80, 0, 34),
    TextSize = 20,
    TextXAlignment = Enum.TextXAlignment.Center,
    ZIndex = 42,
})
Theme.cartoonText(sensitivity, 2)

local minus = Theme.button(menu, "-", {
    Position = UDim2.fromOffset(40, 285),
    Size = UDim2.fromOffset(64, 48),
    TopColor = Theme.Colors.PanelLight,
    BottomColor = Theme.Colors.Panel,
})
minus.ZIndex = 42
local plus = Theme.button(menu, "+", {
    Position = UDim2.new(1, -104, 0, 285),
    Size = UDim2.fromOffset(64, 48),
    TopColor = Theme.Colors.PanelLight,
    BottomColor = Theme.Colors.Panel,
})
plus.ZIndex = 42
local closeMenu = Theme.closeButton(menu)
closeMenu.ZIndex = 43

local function refreshSensitivity()
    sensitivity.Text = string.format("Sensibilité : %.1f", UserInputService.MouseDeltaSensitivity)
end

local function setMenu(open)
    ClientState.menuOpen = open
    overlay.Visible = open
end

menuButton.Activated:Connect(function()
    setMenu(true)
end)
resume.Activated:Connect(function()
    setMenu(false)
end)
closeMenu.Activated:Connect(function()
    setMenu(false)
end)
respawn.Activated:Connect(function()
    Remotes.get("Player/Respawn"):FireServer()
    setMenu(false)
end)
minus.Activated:Connect(function()
    UserInputService.MouseDeltaSensitivity = math.clamp(UserInputService.MouseDeltaSensitivity - 0.1, 0.2, 2)
    refreshSensitivity()
end)
plus.Activated:Connect(function()
    UserInputService.MouseDeltaSensitivity = math.clamp(UserInputService.MouseDeltaSensitivity + 0.1, 0.2, 2)
    refreshSensitivity()
end)
UserInputService.InputBegan:Connect(function(input, processed)
    if processed then
        return
    end
    if input.KeyCode == Enum.KeyCode.Escape and ClientState.menuOpen then
        setMenu(false)
    end
end)
refreshSensitivity()

-- Données -------------------------------------------------------------------
task.spawn(function()
    local channel = Remotes.get("Data/Changed")
    channel.OnClientEvent:Connect(function(data)
        if type(data) == "table" then
            setCurrency(data.currency)
        end
    end)

    for _ = 1, 3 do
        local ok, data = pcall(function()
            return Remotes.get("Data/Get", "RemoteFunction"):InvokeServer()
        end)
        if ok and type(data) == "table" then
            setCurrency(data.currency)
            break
        end
        task.wait(1)
    end
end)

-- Vie du personnage ----------------------------------------------------------
local currentHumanoid = nil

local function bindCharacter(character)
    local humanoid = character:WaitForChild("Humanoid", 10)
    if not humanoid then
        return
    end
    currentHumanoid = humanoid

    local function update()
        local maxHealth = math.max(1, humanoid.MaxHealth)
        local ratio = math.clamp(humanoid.Health / maxHealth, 0, 1)
        healthFill.Size = UDim2.fromScale(ratio, 1)
        healthText.Text = string.format("%d / %d", math.ceil(humanoid.Health), math.ceil(humanoid.MaxHealth))
    end

    update()
    humanoid.HealthChanged:Connect(update)
    humanoid:GetPropertyChangedSignal("MaxHealth"):Connect(update)
end

if player.Character then
    bindCharacter(player.Character)
end
player.CharacterAdded:Connect(bindCharacter)

return { setCurrency = setCurrency, getHumanoid = function() return currentHumanoid end }
