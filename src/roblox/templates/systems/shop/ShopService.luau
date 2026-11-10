-- Boutique serveur : lecture des offres, achat transactionnel avec remboursement
-- si l'objet ne peut pas être livré.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage.Shared
local Remotes = require(Shared.Remotes)
local ShopDefs = require(Shared.ShopDefs)

local Server = script.Parent.Parent
local ServiceRegistry = require(Server.lib.ServiceRegistry)

local ShopService = {}
ShopService.Order = 60

local buyCooldown = {}

local function offerList()
    local offers = {}
    for _, id in ipairs(ShopDefs.Order) do
        local offer = ShopDefs.Definitions[id]
        if offer then
            table.insert(offers, {
                id = id,
                name = offer.name,
                description = offer.description,
                itemId = offer.itemId,
                amount = offer.amount,
                price = offer.price,
            })
        end
    end
    return offers
end

function ShopService:Start()
    Remotes.get("Shop/Get", "RemoteFunction").OnServerInvoke = function()
        return { offers = offerList() }
    end

    Remotes.get("Shop/Buy", "RemoteFunction").OnServerInvoke = function(player, offerId)
        local now = os.clock()
        if (buyCooldown[player] or 0) + 0.4 > now then
            return { ok = false, message = "Patiente un instant." }
        end
        buyCooldown[player] = now

        if type(offerId) ~= "string" then
            return { ok = false, message = "Offre invalide." }
        end
        local offer = ShopDefs.Definitions[offerId]
        if not offer then
            return { ok = false, message = "Offre inconnue." }
        end

        local data = ServiceRegistry.get("PlayerData"):Get(player)
        if not data then
            return { ok = false, message = "Données non chargées." }
        end
        if data.currency < offer.price then
            return { ok = false, message = "Monnaie insuffisante." }
        end

        local inventory = ServiceRegistry.get("InventoryService")
        if not ServiceRegistry.get("PlayerData"):Spend(player, offer.price) then
            return { ok = false, message = "Paiement refusé." }
        end

        local ok, detail = inventory:Add(player, offer.itemId, offer.amount)
        if not ok then
            ServiceRegistry.get("PlayerData"):AddCurrency(player, offer.price)
            return { ok = false, message = tostring(detail or "Livraison impossible.") }
        end

        return { ok = true, message = offer.name .. " acheté.", balance = data.currency }
    end
end

return ShopService
