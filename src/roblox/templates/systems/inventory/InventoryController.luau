-- Panneau d'inventaire : cartes d'objets, quantités, utilisation.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Theme = require(script.Parent.Parent.ui.Theme)
local ClientState = require(script.Parent.Parent.ClientState)
local Remotes = require(ReplicatedStorage.Shared.Remotes)
local Items = require(ReplicatedStorage.Shared.Items)

local player = Players.LocalPlayer
local InventoryController = { Order = 20 }

local inventory = {}
local refresh

function InventoryController:Start()
    local gui = Theme.screenGui("InventoryUi")
    local root = Theme.create("Frame", {
        Size = UDim2.fromScale(1, 1),
        BackgroundTransparency = 1,
        BorderSizePixel = 0,
    }, gui)

    local toggle = Theme.button(root, "SAC", {
        Position = UDim2.new(0, 24, 1, -154),
        Size = UDim2.fromOffset(120, 44),
        TopColor = Theme.Colors.Blue,
        BottomColor = Theme.Colors.BlueDeep,
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
        Size = UDim2.fromOffset(620, 470),
        AnchorPoint = Vector2.new(0.5, 0.5),
        ZIndex = 31,
    })
    Theme.fit(panel, 900)

    local title = Theme.label(panel, "INVENTAIRE", {
        Position = UDim2.fromOffset(24, 16),
        Size = UDim2.new(1, -80, 0, 42),
        TextSize = 30,
        ZIndex = 32,
    })
    Theme.cartoonText(title, 3)

    local close = Theme.closeButton(panel)
    close.ZIndex = 33

    local grid = Theme.create("ScrollingFrame", {
        Position = UDim2.fromOffset(24, 70),
        Size = UDim2.new(1, -48, 1, -94),
        BackgroundTransparency = 1,
        BorderSizePixel = 0,
        CanvasSize = UDim2.new(),
        AutomaticCanvasSize = Enum.AutomaticSize.Y,
        ScrollBarThickness = 6,
        ZIndex = 32,
    }, panel)

    local layout = Instance.new("UIGridLayout")
    layout.CellSize = UDim2.fromOffset(180, 128)
    layout.CellPadding = UDim2.fromOffset(12, 12)
    layout.SortOrder = Enum.SortOrder.LayoutOrder
    layout.Parent = grid

    local empty = Theme.label(grid, "Inventaire vide. Récolte des ressources ou achète des objets.", {
        Size = UDim2.new(1, -20, 0, 60),
        TextSize = 20,
        TextWrapped = true,
        TextXAlignment = Enum.TextXAlignment.Left,
        Visible = false,
        ZIndex = 32,
    })
    Theme.cartoonText(empty, 1)

    local function setOpen(open)
        ClientState.inventoryOpen = open
        overlay.Visible = open
        if open then
            refresh()
        end
    end

    local function useItem(itemId)
        Remotes.get("Inventory/Use"):FireServer(itemId)
    end

    refresh = function()
        for _, child in ipairs(grid:GetChildren()) do
            if child:IsA("Frame") then
                child:Destroy()
            end
        end

        local count = 0
        for _, itemId in ipairs(Items.Order) do
            local amount = inventory[itemId] or 0
            local definition = Items.get(itemId)
            if amount > 0 and definition then
                count = count + 1
                local card = Theme.panel(grid, {
                    BackgroundColor3 = definition.color or Theme.Colors.Panel,
                    Size = UDim2.fromOffset(180, 128),
                    LayoutOrder = count,
                    ZIndex = 32,
                })

                local name = Theme.label(card, definition.name, {
                    Position = UDim2.fromOffset(12, 8),
                    Size = UDim2.new(1, -24, 0, 28),
                    TextSize = 20,
                    TextXAlignment = Enum.TextXAlignment.Left,
                    ZIndex = 33,
                })
                Theme.cartoonText(name, 2)

                local quantity = Theme.label(card, "x" .. tostring(amount), {
                    Position = UDim2.new(1, -62, 0, 8),
                    Size = UDim2.fromOffset(50, 28),
                    TextSize = 20,
                    TextXAlignment = Enum.TextXAlignment.Right,
                    ZIndex = 33,
                })
                Theme.cartoonText(quantity, 2)

                local description = Theme.label(card, definition.description or "", {
                    Position = UDim2.fromOffset(12, 40),
                    Size = UDim2.new(1, -24, 0, 46),
                    TextSize = 14,
                    TextWrapped = true,
                    TextXAlignment = Enum.TextXAlignment.Left,
                    TextYAlignment = Enum.TextYAlignment.Top,
                    ZIndex = 33,
                })
                description.TextColor3 = Theme.Colors.White

                if definition.kind == "consumable" then
                    local use = Theme.button(card, "UTILISER", {
                        Position = UDim2.new(1, -12, 1, -10),
                        Size = UDim2.fromOffset(110, 34),
                        AnchorPoint = Vector2.new(1, 1),
                        TextSize = 16,
                        TopColor = Theme.Colors.Green,
                        BottomColor = Theme.Colors.GreenDeep,
                    })
                    use.ZIndex = 34
                    use.Activated:Connect(function()
                        useItem(itemId)
                    end)
                end
            end
        end

        empty.Visible = count == 0
    end

    toggle.Activated:Connect(function()
        setOpen(not ClientState.inventoryOpen)
    end)
    close.Activated:Connect(function()
        setOpen(false)
    end)

    local function applyData(data)
        if type(data) == "table" and type(data.inventory) == "table" then
            inventory = data.inventory
            if ClientState.inventoryOpen then
                refresh()
            end
        end
    end

    task.spawn(function()
        Remotes.get("Data/Changed").OnClientEvent:Connect(applyData)
        local ok, data = pcall(function()
            return Remotes.get("Data/Get", "RemoteFunction"):InvokeServer()
        end)
        if ok then
            applyData(data)
        end
    end)

    refresh()
end

return InventoryController
