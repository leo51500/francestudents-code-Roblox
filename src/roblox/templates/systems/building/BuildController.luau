-- Construction côté client : choisit une pièce, affiche un fantôme sur la
-- grille, puis demande le placement au serveur. Le client ne clone jamais la
-- pièce définitive : il ne fait que prévisualiser.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")

local Theme = require(script.Parent.Parent.ui.Theme)
local ClientState = require(script.Parent.Parent.ClientState)
local Remotes = require(ReplicatedStorage.Shared.Remotes)
local GameConfig = require(ReplicatedStorage.Shared.GameConfig)
local BuildDefs = require(ReplicatedStorage.Shared.BuildDefs)

local BuildController = { Order = 70 }

local selected = nil
local ghost = nil
local ghostPosition = nil
local rotationY = 0
local placing = false

local function buildFolder()
    local assets = ReplicatedStorage:FindFirstChild("Assets")
    return assets and assets:FindFirstChild("Build") or nil
end

local function setGhostTransparency(instance, value)
    for _, descendant in ipairs(instance:GetDescendants()) do
        if descendant:IsA("BasePart") then
            descendant.Transparency = value
            descendant.CanCollide = false
            descendant.CanQuery = false
            descendant.CanTouch = false
            descendant.Anchored = true
        end
    end
    if instance:IsA("BasePart") then
        instance.Transparency = value
        instance.CanCollide = false
        instance.Anchored = true
    end
end

local function destroyGhost()
    if ghost then
        ghost:Destroy()
        ghost = nil
    end
    ghostPosition = nil
end

local function makeGhost(prefab)
    destroyGhost()
    local clone = prefab:Clone()
    clone.Name = "Ghost_" .. prefab.Name
    setGhostTransparency(clone, 0.55)
    clone.Parent = Workspace
    ghost = clone
end

local function raycastPosition()
    local camera = Workspace.CurrentCamera
    local character = Players.LocalPlayer.Character
    if not camera then
        return nil
    end

    local mouse = UserInputService:GetMouseLocation()
    local ray = camera:ViewportPointToRay(mouse.X, mouse.Y)
    local parameters = RaycastParams.new()
    parameters.FilterType = Enum.RaycastFilterType.Exclude
    parameters.FilterDescendantsInstances = { character, ghost }
    parameters.IgnoreWater = true

    local result = Workspace:Raycast(ray.Origin, ray.Direction * 400, parameters)
    if not result then
        return nil
    end

    local grid = GameConfig.Building.Grid
    local point = result.Position
    return Vector3.new(
        math.floor(point.X / grid + 0.5) * grid,
        math.floor(point.Y + 0.5),
        math.floor(point.Z / grid + 0.5) * grid
    )
end

local function updateGhost()
    if not ghost then
        return
    end
    local position = raycastPosition()
    if not position then
        return
    end
    ghostPosition = position
    ghost:PivotTo(CFrame.new(position) * CFrame.Angles(0, math.rad(rotationY), 0))
end

local function stopPlacing()
    placing = false
    selected = nil
    rotationY = 0
    destroyGhost()
end

local function startPlacing(pieceId)
    local definition = BuildDefs.Definitions[pieceId]
    if not definition then
        return false, "Pièce inconnue."
    end

    local folder = buildFolder()
    local prefab = folder and folder:FindFirstChild(definition.prefab)
    if not prefab then
        return false, "Prefab Blender absent : ReplicatedStorage/Assets/Build/" .. definition.prefab
    end

    selected = pieceId
    placing = true
    rotationY = 0
    makeGhost(prefab)
    updateGhost()
    return true
end

function BuildController:Start()
    local player = Players.LocalPlayer

    local gui = Theme.screenGui("BuildUi")
    local root = Theme.create("Frame", {
        Size = UDim2.fromScale(1, 1),
        BackgroundTransparency = 1,
        BorderSizePixel = 0,
    }, gui)

    local toggle = Theme.button(root, "CONSTRUIRE", {
        Position = UDim2.new(0, 24, 1, -208),
        Size = UDim2.fromOffset(150, 44),
        TopColor = Theme.Colors.Accent,
        BottomColor = Theme.Colors.AccentDeep,
    })
    toggle.TextSize = 18

    local overlay = Theme.create("Frame", {
        Size = UDim2.fromScale(1, 1),
        BackgroundColor3 = Theme.Colors.Background,
        BackgroundTransparency = 0.45,
        BorderSizePixel = 0,
        Visible = false,
        ZIndex = 30,
    }, root)

    local panel = Theme.panel(overlay, {
        Position = UDim2.fromScale(0.5, 0.5),
        Size = UDim2.fromOffset(520, 360),
        AnchorPoint = Vector2.new(0.5, 0.5),
        ZIndex = 31,
    })
    Theme.fit(panel, 900)

    local title = Theme.label(panel, "CONSTRUCTION", {
        Position = UDim2.fromOffset(24, 16),
        Size = UDim2.new(1, -80, 0, 42),
        TextSize = 28,
        ZIndex = 32,
    })
    Theme.cartoonText(title, 3)

    local close = Theme.closeButton(panel)
    close.ZIndex = 33

    local hint = Theme.label(panel, "Choisis une pièce, puis clique dans le monde. R pivote, Échap annule.", {
        Position = UDim2.fromOffset(24, 64),
        Size = UDim2.new(1, -48, 0, 30),
        TextSize = 15,
        TextXAlignment = Enum.TextXAlignment.Left,
        ZIndex = 32,
    })
    hint.TextColor3 = Theme.Colors.Muted

    local list = Theme.create("ScrollingFrame", {
        Position = UDim2.fromOffset(24, 104),
        Size = UDim2.new(1, -48, 1, -128),
        BackgroundTransparency = 1,
        BorderSizePixel = 0,
        CanvasSize = UDim2.new(),
        AutomaticCanvasSize = Enum.AutomaticSize.Y,
        ScrollBarThickness = 6,
        ZIndex = 32,
    }, panel)

    local layout = Instance.new("UIGridLayout")
    layout.CellSize = UDim2.fromOffset(220, 110)
    layout.CellPadding = UDim2.fromOffset(12, 12)
    layout.SortOrder = Enum.SortOrder.LayoutOrder
    layout.Parent = list

    local status = Theme.label(root, "", {
        Position = UDim2.new(0.5, 0, 0, 30),
        Size = UDim2.fromOffset(520, 40),
        AnchorPoint = Vector2.new(0.5, 0),
        TextSize = 18,
        TextXAlignment = Enum.TextXAlignment.Center,
        Visible = false,
        ZIndex = 20,
    })
    Theme.cartoonText(status, 2)

    local function flash(message, isError)
        status.Text = message
        status.TextColor3 = isError and Theme.Colors.Red or Theme.Colors.Accent
        status.Visible = true
        task.delay(4, function()
            if status.Text == message then
                status.Visible = false
            end
        end)
    end

    for index, pieceId in ipairs(BuildDefs.Order) do
        local definition = BuildDefs.Definitions[pieceId]
        if definition then
            local card = Theme.panel(list, {
                Size = UDim2.fromOffset(220, 110),
                LayoutOrder = index,
                ZIndex = 32,
            })

            local name = Theme.label(card, definition.name, {
                Position = UDim2.fromOffset(12, 8),
                Size = UDim2.new(1, -24, 0, 26),
                TextSize = 18,
                TextXAlignment = Enum.TextXAlignment.Left,
                ZIndex = 33,
            })
            Theme.cartoonText(name, 2)

            local description = Theme.label(card, definition.description or "", {
                Position = UDim2.fromOffset(12, 36),
                Size = UDim2.new(1, -24, 0, 34),
                TextSize = 13,
                TextWrapped = true,
                TextXAlignment = Enum.TextXAlignment.Left,
                ZIndex = 33,
            })
            description.TextColor3 = Theme.Colors.Muted

            local cost = Theme.label(card, tostring(definition.cost or 0) .. " C", {
                Position = UDim2.fromOffset(12, 74),
                Size = UDim2.fromOffset(90, 24),
                TextSize = 16,
                TextXAlignment = Enum.TextXAlignment.Left,
                ZIndex = 33,
            })
            cost.TextColor3 = Theme.Colors.Accent

            local choose = Theme.button(card, "PLACER", {
                Position = UDim2.new(1, -12, 1, -10),
                Size = UDim2.fromOffset(100, 34),
                AnchorPoint = Vector2.new(1, 1),
                TextSize = 15,
            })
            choose.ZIndex = 34

            choose.Activated:Connect(function()
                local ok, reason = startPlacing(pieceId)
                if ok then
                    overlay.Visible = false
                    ClientState.buildingOpen = false
                    flash("Clique dans le monde pour poser " .. definition.name .. ". R pivote, Échap annule.", false)
                else
                    flash(reason, true)
                end
            end)
        end
    end

    local function setOpen(open)
        ClientState.buildingOpen = open
        overlay.Visible = open
        if open then
            stopPlacing()
        end
    end

    toggle.Activated:Connect(function()
        setOpen(not ClientState.buildingOpen)
    end)
    close.Activated:Connect(function()
        setOpen(false)
    end)

    RunService.RenderStepped:Connect(function()
        if placing and ghost then
            updateGhost()
        end
    end)

    UserInputService.InputBegan:Connect(function(input, processed)
        if processed then
            return
        end
        if not placing then
            return
        end

        if input.KeyCode == Enum.KeyCode.Escape then
            stopPlacing()
            flash("Placement annulé.", false)
            return
        end
        if input.KeyCode == Enum.KeyCode.R then
            rotationY = (rotationY + 90) % 360
            return
        end
        if input.UserInputType ~= Enum.UserInputType.MouseButton1 and input.UserInputType ~= Enum.UserInputType.Touch then
            return
        end
        if ClientState.anyPanelOpen() or not ghostPosition or not selected then
            return
        end

        local pieceId = selected
        local position = ghostPosition
        local rotation = rotationY
        task.spawn(function()
            local ok, result = pcall(function()
                return Remotes.get("Build/Place", "RemoteFunction"):InvokeServer(pieceId, position, rotation)
            end)
            if ok and type(result) == "table" then
                flash(result.message or "", result.ok ~= true)
                if result.ok ~= true then
                    return
                end
                if player.Character == nil then
                    stopPlacing()
                end
            else
                flash("Placement impossible pour le moment.", true)
            end
        end)
    end)

    player.CharacterAdded:Connect(function()
        if placing then
            stopPlacing()
        end
    end)
end

return BuildController
