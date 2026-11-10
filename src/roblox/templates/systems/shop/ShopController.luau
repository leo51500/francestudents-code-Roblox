-- Panneau boutique : cartes d'offres, solde et achat.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Theme = require(script.Parent.Parent.ui.Theme)
local ClientState = require(script.Parent.Parent.ClientState)
local Remotes = require(ReplicatedStorage.Shared.Remotes)

local ShopController = { Order = 60 }

function ShopController:Start()
    local gui = Theme.screenGui("ShopUi")
    local root = Theme.create("Frame", {
        Size = UDim2.fromScale(1, 1),
        BackgroundTransparency = 1,
        BorderSizePixel = 0,
    }, gui)

    local toggle = Theme.button(root, "BOUTIQUE", {
        Position = UDim2.new(1, -24, 0, 144),
        Size = UDim2.fromOffset(150, 46),
        AnchorPoint = Vector2.new(1, 0),
        TopColor = Theme.Colors.Green,
        BottomColor = Theme.Colors.GreenDeep,
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
        Size = UDim2.fromOffset(640, 490),
        AnchorPoint = Vector2.new(0.5, 0.5),
        ZIndex = 31,
    })
    Theme.fit(panel, 900)

    local title = Theme.label(panel, "BOUTIQUE", {
        Position = UDim2.fromOffset(24, 16),
        Size = UDim2.new(1, -200, 0, 42),
        TextSize = 30,
        ZIndex = 32,
    })
    Theme.cartoonText(title, 3)

    local balance = Theme.label(panel, "0", {
        Position = UDim2.new(1, -170, 0, 20),
        Size = UDim2.fromOffset(130, 32),
        TextSize = 22,
        TextXAlignment = Enum.TextXAlignment.Right,
        ZIndex = 32,
    })
    Theme.cartoonText(balance, 2)

    local close = Theme.closeButton(panel)
    close.ZIndex = 33

    local message = Theme.label(panel, "", {
        Position = UDim2.fromOffset(24, 62),
        Size = UDim2.new(1, -48, 0, 26),
        TextSize = 16,
        TextXAlignment = Enum.TextXAlignment.Left,
        ZIndex = 32,
    })
    message.TextColor3 = Theme.Colors.Accent

    local grid = Theme.create("ScrollingFrame", {
        Position = UDim2.fromOffset(24, 94),
        Size = UDim2.new(1, -48, 1, -118),
        BackgroundTransparency = 1,
        BorderSizePixel = 0,
        CanvasSize = UDim2.new(),
        AutomaticCanvasSize = Enum.AutomaticSize.Y,
        ScrollBarThickness = 6,
        ZIndex = 32,
    }, panel)

    local layout = Instance.new("UIGridLayout")
    layout.CellSize = UDim2.fromOffset(184, 150)
    layout.CellPadding = UDim2.fromOffset(12, 12)
    layout.SortOrder = Enum.SortOrder.LayoutOrder
    layout.Parent = grid

    local offers = {}
    local currency = 0
    local buttons = {}

    local function setMessage(text, isError)
        message.Text = text or ""
        message.TextColor3 = isError and Theme.Colors.Red or Theme.Colors.Accent
        if text and text ~= "" then
            task.delay(3, function()
                if message.Text == text then
                    message.Text = ""
                end
            end)
        end
    end

    local function render()
        for _, child in ipairs(grid:GetChildren()) do
            if child:IsA("Frame") then
                child:Destroy()
            end
        end
        buttons = {}
        balance.Text = tostring(currency)

        for index, offer in ipairs(offers) do
            local card = Theme.panel(grid, {
                Size = UDim2.fromOffset(184, 150),
                LayoutOrder = index,
                ZIndex = 32,
            })

            local name = Theme.label(card, offer.name, {
                Position = UDim2.fromOffset(12, 8),
                Size = UDim2.new(1, -24, 0, 28),
                TextSize = 19,
                TextXAlignment = Enum.TextXAlignment.Left,
                ZIndex = 33,
            })
            Theme.cartoonText(name, 2)

            local description = Theme.label(card, offer.description or "", {
                Position = UDim2.fromOffset(12, 38),
                Size = UDim2.new(1, -24, 0, 46),
                TextSize = 13,
                TextWrapped = true,
                TextXAlignment = Enum.TextXAlignment.Left,
                ZIndex = 33,
            })
            description.TextColor3 = Theme.Colors.Muted

            local price = Theme.label(card, tostring(offer.price) .. " C", {
                Position = UDim2.fromOffset(12, 88),
                Size = UDim2.new(1, -24, 0, 24),
                TextSize = 18,
                TextXAlignment = Enum.TextXAlignment.Left,
                ZIndex = 33,
            })
            price.TextColor3 = Theme.Colors.Accent

            local buy = Theme.button(card, "ACHETER", {
                Position = UDim2.new(1, -12, 1, -10),
                Size = UDim2.fromOffset(120, 38),
                AnchorPoint = Vector2.new(1, 1),
                TextSize = 16,
                TopColor = currency >= offer.price and Theme.Colors.Green or Theme.Colors.PanelLight,
                BottomColor = currency >= offer.price and Theme.Colors.GreenDeep or Theme.Colors.Panel,
            })
            buy.ZIndex = 34
            buy.Active = currency >= offer.price
            buttons[offer.id] = buy

            buy.Activated:Connect(function()
                if currency < offer.price then
                    setMessage("Monnaie insuffisante.", true)
                    return
                end
                local ok, result = pcall(function()
                    return Remotes.get("Shop/Buy", "RemoteFunction"):InvokeServer(offer.id)
                end)
                if ok and type(result) == "table" then
                    setMessage(result.message, result.ok ~= true)
                else
                    setMessage("Achat impossible pour le moment.", true)
                end
            end)
        end
    end

    local function setOpen(open)
        ClientState.shopOpen = open
        overlay.Visible = open
    end

    toggle.Activated:Connect(function()
        setOpen(not ClientState.shopOpen)
    end)
    close.Activated:Connect(function()
        setOpen(false)
    end)

    task.spawn(function()
        local ok, payload = pcall(function()
            return Remotes.get("Shop/Get", "RemoteFunction"):InvokeServer()
        end)
        if ok and type(payload) == "table" and type(payload.offers) == "table" then
            offers = payload.offers
            render()
        end

        Remotes.get("Data/Changed").OnClientEvent:Connect(function(data)
            if type(data) == "table" then
                currency = math.floor(tonumber(data.currency) or 0)
                balance.Text = tostring(currency)
                for offerId, button in pairs(buttons) do
                    local offer = nil
                    for _, candidate in ipairs(offers) do
                        if candidate.id == offerId then
                            offer = candidate
                            break
                        end
                    end
                    if offer then
                        button.Active = currency >= offer.price
                    end
                end
            end
        end)

        local loaded, initial = pcall(function()
            return Remotes.get("Data/Get", "RemoteFunction"):InvokeServer()
        end)
        if loaded and type(initial) == "table" and type(initial.currency) == "number" then
            currency = initial.currency
            balance.Text = tostring(currency)
            render()
        end
    end)

    render()
end

return ShopController
