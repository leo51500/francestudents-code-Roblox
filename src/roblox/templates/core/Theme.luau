-- Thème cartoon Roblox : panneaux arrondis, contours épais, dégradés saturés.
-- Toute l'interface du jeu passe par ces helpers pour rester cohérente.

local Players = game:GetService("Players")
local Workspace = game:GetService("Workspace")

local Theme = {}

Theme.Colors = {
    Ink = Color3.fromRGB(28, 20, 34),
    Panel = Color3.fromRGB(52, 38, 66),
    PanelLight = Color3.fromRGB(72, 54, 92),
    Background = Color3.fromRGB(18, 14, 24),
    Accent = Color3.fromRGB(255, 186, 48),
    AccentDeep = Color3.fromRGB(214, 132, 20),
    Green = Color3.fromRGB(84, 200, 84),
    GreenDeep = Color3.fromRGB(40, 132, 52),
    Red = Color3.fromRGB(232, 72, 72),
    RedDeep = Color3.fromRGB(160, 36, 44),
    Blue = Color3.fromRGB(64, 164, 240),
    BlueDeep = Color3.fromRGB(34, 96, 176),
    White = Color3.fromRGB(255, 255, 255),
    Muted = Color3.fromRGB(198, 190, 210),
}

Theme.Font = Enum.Font.FredokaOne

function Theme.create(className, props, parent)
    local instance = Instance.new(className)
    for key, value in pairs(props or {}) do
        if value ~= nil then
            instance[key] = value
        end
    end
    instance.Parent = parent
    return instance
end

function Theme.corner(instance, radius)
    local corner = Instance.new("UICorner")
    corner.CornerRadius = UDim.new(0, radius or 12)
    corner.Parent = instance
    return corner
end

function Theme.stroke(instance, color, thickness)
    local stroke = Instance.new("UIStroke")
    stroke.Color = color or Theme.Colors.Ink
    stroke.Thickness = thickness or 3
    stroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
    stroke.LineJoinMode = Enum.LineJoinMode.Round
    stroke.Parent = instance
    return stroke
end

function Theme.gradient(instance, top, bottom)
    local gradient = Instance.new("UIGradient")
    gradient.Color = ColorSequence.new(top or Theme.Colors.PanelLight, bottom or Theme.Colors.Panel)
    gradient.Rotation = 90
    gradient.Parent = instance
    return gradient
end

function Theme.panel(parent, props)
    props = props or {}
    if props.BackgroundColor3 == nil then
        props.BackgroundColor3 = Theme.Colors.Panel
    end
    if props.BorderSizePixel == nil then
        props.BorderSizePixel = 0
    end
    local panel = Theme.create("Frame", props, parent)
    Theme.corner(panel, 14)
    Theme.stroke(panel, Theme.Colors.Ink, 3)
    Theme.gradient(panel, Theme.Colors.PanelLight, Theme.Colors.Panel)
    return panel
end

function Theme.label(parent, text, props)
    props = props or {}
    if props.BackgroundTransparency == nil then
        props.BackgroundTransparency = 1
    end
    if props.Font == nil then
        props.Font = Theme.Font
    end
    if props.TextColor3 == nil then
        props.TextColor3 = Theme.Colors.White
    end
    if props.TextSize == nil then
        props.TextSize = 20
    end
    if props.Text == nil then
        props.Text = text or ""
    end
    return Theme.create("TextLabel", props, parent)
end

-- Texte blanc épais avec contour sombre, lisible sur n'importe quel fond.
function Theme.cartoonText(label, thickness)
    label.TextStrokeTransparency = 0
    label.TextStrokeColor3 = Theme.Colors.Ink
    label.TextColor3 = Theme.Colors.White
    label.Font = Theme.Font
    local stroke = Instance.new("UIStroke")
    stroke.Color = Theme.Colors.Ink
    stroke.Thickness = thickness or 2
    stroke.Parent = label
    return label
end

function Theme.button(parent, text, props)
    props = props or {}
    local button = Theme.create("TextButton", {
        Text = text,
        Font = Theme.Font,
        TextSize = props.TextSize or 22,
        TextColor3 = Theme.Colors.White,
        BackgroundColor3 = props.BackgroundColor3 or Theme.Colors.Green,
        AutoButtonColor = true,
        BorderSizePixel = 0,
        Size = props.Size or UDim2.fromOffset(170, 52),
        Position = props.Position,
        AnchorPoint = props.AnchorPoint,
        LayoutOrder = props.LayoutOrder,
        Visible = props.Visible,
    }, parent)
    button.TextStrokeTransparency = 0
    button.TextStrokeColor3 = Theme.Colors.Ink
    Theme.corner(button, 12)
    Theme.stroke(button, Theme.Colors.Ink, 3)
    Theme.gradient(button, props.TopColor or Theme.Colors.Green, props.BottomColor or Theme.Colors.GreenDeep)
    return button
end

function Theme.closeButton(parent)
    local button = Theme.create("TextButton", {
        Text = "X",
        Font = Theme.Font,
        TextSize = 24,
        TextColor3 = Theme.Colors.White,
        TextStrokeTransparency = 0,
        TextStrokeColor3 = Theme.Colors.Ink,
        BackgroundColor3 = Theme.Colors.Red,
        BorderSizePixel = 0,
        Size = UDim2.fromOffset(44, 44),
        Position = UDim2.new(1, 10, 0, -10),
        AnchorPoint = Vector2.new(1, 0),
        ZIndex = 20,
    }, parent)
    Theme.corner(button, 10)
    Theme.stroke(button, Theme.Colors.Ink, 3)
    Theme.gradient(button, Theme.Colors.Red, Theme.Colors.RedDeep)
    return button
end

function Theme.screenGui(name)
    local player = Players.LocalPlayer
    local gui = Instance.new("ScreenGui")
    gui.Name = name
    gui.ResetOnSpawn = false
    gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
    gui.DisplayOrder = 10
    gui.Parent = player:WaitForChild("PlayerGui")
    return gui
end

-- Échelle lisible sur téléphone comme sur grand écran.
function Theme.fit(root, referenceWidth)
    local scale = Instance.new("UIScale")
    scale.Parent = root
    local reference = referenceWidth or 1280

    local function update()
        local camera = Workspace.CurrentCamera
        local width = camera and camera.ViewportSize.X or reference
        scale.Scale = math.clamp(width / reference, 0.62, 1.18)
    end

    update()
    local camera = Workspace.CurrentCamera
    if camera then
        camera:GetPropertyChangedSignal("ViewportSize"):Connect(update)
    end
    return scale
end

return Theme
