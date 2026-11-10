-- Ciblage client : vise sous le curseur et demande une attaque au serveur.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")

local Theme = require(script.Parent.Parent.ui.Theme)
local ClientState = require(script.Parent.Parent.ClientState)
local Remotes = require(ReplicatedStorage.Shared.Remotes)
local GameConfig = require(ReplicatedStorage.Shared.GameConfig)

local player = Players.LocalPlayer
local CombatController = { Order = 30 }

local function humanoidAncestor(instance)
    local current = instance
    while current and current ~= Workspace do
        if current:IsA("Model") then
            local humanoid = current:FindFirstChildOfClass("Humanoid")
            if humanoid then
                return current
            end
        end
        current = current.Parent
    end
    return nil
end

function CombatController:Start()
    local gui = Theme.screenGui("CombatUi")
    local root = Theme.create("Frame", {
        Size = UDim2.fromScale(1, 1),
        BackgroundTransparency = 1,
        BorderSizePixel = 0,
    }, gui)

    local marker = Theme.label(root, "+", {
        Position = UDim2.fromScale(0.5, 0.5),
        Size = UDim2.fromOffset(48, 48),
        AnchorPoint = Vector2.new(0.5, 0.5),
        TextSize = 40,
        TextTransparency = 1,
        TextStrokeTransparency = 1,
    })

    local lastAttack = 0

    local function flash(hit)
        marker.TextColor3 = hit and Theme.Colors.Accent or Theme.Colors.Red
        marker.TextTransparency = 0
        marker.TextStrokeTransparency = 0
        TweenService:Create(marker, TweenInfo.new(0.3), {
            TextTransparency = 1,
            TextStrokeTransparency = 1,
        }):Play()
    end

    Remotes.get("Combat/Feedback").OnClientEvent:Connect(function(feedback)
        if type(feedback) == "table" then
            flash(feedback.hit == true)
        end
    end)

    local function tryAttack()
        if ClientState.anyPanelOpen() then
            return
        end
        local now = os.clock()
        if lastAttack + GameConfig.Combat.Cooldown > now then
            return
        end
        lastAttack = now

        local camera = Workspace.CurrentCamera
        local character = player.Character
        if not camera or not character then
            return
        end

        local mouse = UserInputService:GetMouseLocation()
        local ray = camera:ViewportPointToRay(mouse.X, mouse.Y)
        local parameters = RaycastParams.new()
        parameters.FilterType = Enum.RaycastFilterType.Exclude
        parameters.FilterDescendantsInstances = { character }

        local result = Workspace:Raycast(ray.Origin, ray.Direction * (GameConfig.Combat.Range + 8), parameters)
        local target = result and humanoidAncestor(result.Instance) or nil
        if target then
            Remotes.get("Combat/Attack"):FireServer(target)
        end
    end

    UserInputService.InputBegan:Connect(function(input, processed)
        if processed then
            return
        end
        if input.UserInputType == Enum.UserInputType.MouseButton1
            or input.UserInputType == Enum.UserInputType.Touch then
            tryAttack()
        end
    end)
end

return CombatController
