-- Panneau des missions : liste, progression et acceptation.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Theme = require(script.Parent.Parent.ui.Theme)
local ClientState = require(script.Parent.Parent.ClientState)
local Remotes = require(ReplicatedStorage.Shared.Remotes)

local QuestController = { Order = 50 }

function QuestController:Start()
    local gui = Theme.screenGui("QuestUi")
    local root = Theme.create("Frame", {
        Size = UDim2.fromScale(1, 1),
        BackgroundTransparency = 1,
        BorderSizePixel = 0,
    }, gui)

    local toggle = Theme.button(root, "MISSIONS", {
        Position = UDim2.new(1, -24, 0, 84),
        Size = UDim2.fromOffset(150, 46),
        AnchorPoint = Vector2.new(1, 0),
        TopColor = Theme.Colors.Accent,
        BottomColor = Theme.Colors.AccentDeep,
    })
    toggle.TextSize = 20

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
        Size = UDim2.fromOffset(560, 480),
        AnchorPoint = Vector2.new(0.5, 0.5),
        ZIndex = 31,
    })
    Theme.fit(panel, 900)

    local title = Theme.label(panel, "MISSIONS", {
        Position = UDim2.fromOffset(24, 16),
        Size = UDim2.new(1, -80, 0, 42),
        TextSize = 30,
        ZIndex = 32,
    })
    Theme.cartoonText(title, 3)

    local close = Theme.closeButton(panel)
    close.ZIndex = 33

    local list = Theme.create("ScrollingFrame", {
        Position = UDim2.fromOffset(24, 70),
        Size = UDim2.new(1, -48, 1, -94),
        BackgroundTransparency = 1,
        BorderSizePixel = 0,
        CanvasSize = UDim2.new(),
        AutomaticCanvasSize = Enum.AutomaticSize.Y,
        ScrollBarThickness = 6,
        ZIndex = 32,
    }, panel)

    local layout = Instance.new("UIListLayout")
    layout.Padding = UDim.new(0, 10)
    layout.SortOrder = Enum.SortOrder.LayoutOrder
    layout.Parent = list

    local empty = Theme.label(list, "Aucune mission définie.", {
        Size = UDim2.new(1, -12, 0, 40),
        TextSize = 18,
        ZIndex = 32,
    })

    local quests = {}

    local function progressText(quest)
        local parts = {}
        for index, objective in ipairs(quest.objectives or {}) do
            local value = math.floor(tonumber(quest.progress and quest.progress[index]) or 0)
            table.insert(parts, (objective.label or "Objectif") .. " " .. tostring(value) .. "/" .. tostring(objective.amount))
        end
        return table.concat(parts, "  •  ")
    end

    local function render()
        for _, child in ipairs(list:GetChildren()) do
            if child:IsA("Frame") then
                child:Destroy()
            end
        end
        empty.Visible = #quests == 0

        for index, quest in ipairs(quests) do
            local row = Theme.panel(list, {
                Size = UDim2.new(1, -12, 0, 104),
                LayoutOrder = index,
                ZIndex = 32,
            })

            local name = Theme.label(row, quest.name or quest.id, {
                Position = UDim2.fromOffset(14, 8),
                Size = UDim2.new(1, -160, 0, 26),
                TextSize = 20,
                TextXAlignment = Enum.TextXAlignment.Left,
                ZIndex = 33,
            })
            Theme.cartoonText(name, 2)

            local description = Theme.label(row, quest.description or "", {
                Position = UDim2.fromOffset(14, 34),
                Size = UDim2.new(1, -28, 0, 24),
                TextSize = 14,
                TextXAlignment = Enum.TextXAlignment.Left,
                ZIndex = 33,
            })
            description.TextColor3 = Theme.Colors.Muted

            local progress = Theme.label(row, progressText(quest), {
                Position = UDim2.fromOffset(14, 60),
                Size = UDim2.new(1, -170, 0, 32),
                TextSize = 15,
                TextXAlignment = Enum.TextXAlignment.Left,
                TextWrapped = true,
                ZIndex = 33,
            })
            progress.TextColor3 = Theme.Colors.White

            local status = quest.status or "available"
            local action = Theme.button(row, status == "available" and "ACCEPTER" or (status == "completed" and "TERMINÉ" or "EN COURS"), {
                Position = UDim2.new(1, -14, 0, 34),
                Size = UDim2.fromOffset(132, 42),
                AnchorPoint = Vector2.new(1, 0),
                TextSize = 15,
                TopColor = status == "available" and Theme.Colors.Green or Theme.Colors.PanelLight,
                BottomColor = status == "available" and Theme.Colors.GreenDeep or Theme.Colors.Panel,
            })
            action.ZIndex = 34
            action.Active = status == "available"
            if status == "available" then
                action.Activated:Connect(function()
                    Remotes.get("Quests/Accept"):FireServer(quest.id)
                end)
            end
        end
    end

    local function setOpen(open)
        ClientState.questsOpen = open
        overlay.Visible = open
    end

    toggle.Activated:Connect(function()
        setOpen(not ClientState.questsOpen)
    end)
    close.Activated:Connect(function()
        setOpen(false)
    end)

    Remotes.get("Quests/Sync").OnClientEvent:Connect(function(payload)
        if type(payload) == "table" and type(payload.quests) == "table" then
            quests = payload.quests
            render()
        end
    end)

    task.spawn(function()
        local ok, payload = pcall(function()
            return Remotes.get("Quests/Get", "RemoteFunction"):InvokeServer()
        end)
        if ok and type(payload) == "table" and type(payload.quests) == "table" then
            quests = payload.quests
            render()
        end
    end)

    render()
end

return QuestController
