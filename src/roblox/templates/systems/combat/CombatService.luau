-- Combat autoritaire : cadence, portée, cible vivante, PvP optionnel.
-- Aucun dégât n'est appliqué à partir d'une valeur envoyée par le client.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local GameConfig = require(ReplicatedStorage.Shared.GameConfig)
local Remotes = require(ReplicatedStorage.Shared.Remotes)

local Server = script.Parent.Parent
local GameEvents = require(Server.lib.GameEvents)

local CombatService = {}
CombatService.Order = 30

local cooldowns = {}

local function humanoidOf(model)
    if typeof(model) ~= "Instance" or not model:IsA("Model") then
        return nil
    end
    return model:FindFirstChildOfClass("Humanoid")
end

local function rootOf(model)
    return model:FindFirstChild("HumanoidRootPart") or model.PrimaryPart
end

function CombatService:Damage(attacker, targetModel, amount)
    local humanoid = humanoidOf(targetModel)
    if not humanoid or humanoid.Health <= 0 then
        return false, "Cible invalide."
    end

    local damage = math.clamp(math.floor(tonumber(amount) or 0), 0, 500)
    if damage <= 0 then
        return false, "Dégâts invalides."
    end

    humanoid:TakeDamage(damage)

    local tag = targetModel:GetAttribute("NpcTag")
    if humanoid.Health <= 0 and tag and attacker then
        GameEvents.fire("npc_defeated", attacker, tag, targetModel)
    end
    return true, damage
end

local function onAttack(player, target)
    local character = player.Character
    local attackerHumanoid = character and character:FindFirstChildOfClass("Humanoid")
    if not attackerHumanoid or attackerHumanoid.Health <= 0 then
        return
    end

    local now = os.clock()
    if (cooldowns[player] or 0) + GameConfig.Combat.Cooldown > now then
        return
    end
    cooldowns[player] = now

    local targetHumanoid = humanoidOf(target)
    if not targetHumanoid or targetHumanoid.Health <= 0 then
        Remotes.get("Combat/Feedback"):FireClient(player, { hit = false })
        return
    end

    if not GameConfig.Combat.AllowPvP then
        local otherPlayer = game:GetService("Players"):GetPlayerFromCharacter(target)
        if otherPlayer then
            Remotes.get("Combat/Feedback"):FireClient(player, { hit = false })
            return
        end
    end

    local attackerRoot = rootOf(character)
    local targetRoot = rootOf(target)
    if not attackerRoot or not targetRoot then
        return
    end

    if (attackerRoot.Position - targetRoot.Position).Magnitude > GameConfig.Combat.Range + 2 then
        Remotes.get("Combat/Feedback"):FireClient(player, { hit = false, reason = "range" })
        return
    end

    local ok, damage = CombatService:Damage(player, target, GameConfig.Combat.BaseDamage)
    Remotes.get("Combat/Feedback"):FireClient(player, {
        hit = ok == true,
        damage = damage,
    })
end

function CombatService:Start()
    Remotes.get("Combat/Attack").OnServerEvent:Connect(function(player, target)
        onAttack(player, target)
    end)

    Remotes.get("Combat/Feedback")

    game:GetService("Players").PlayerRemoving:Connect(function(player)
        cooldowns[player] = nil
    end)
end

return CombatService
