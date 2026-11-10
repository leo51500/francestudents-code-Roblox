-- PNJ serveur : apparition depuis des prefabs Blender, patrouille et poursuite.
-- Aucun modèle n'est fabriqué avec des Parts : un prefab manquant est signalé.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage = game:GetService("ServerStorage")
local Workspace = game:GetService("Workspace")

local NpcDefs = require(ReplicatedStorage.Shared.NpcDefs)
local Server = script.Parent.Parent
local ServiceRegistry = require(Server.lib.ServiceRegistry)

local NpcService = {}
NpcService.Order = 40

local active = {}
local warned = {}

local function warnOnce(key, message)
    if warned[key] then
        return
    end
    warned[key] = true
    warn("[Npc] " .. message)
end

local function humanoidOf(model)
    return model and model:FindFirstChildOfClass("Humanoid")
end

local function rootOf(model)
    return model and (model:FindFirstChild("HumanoidRootPart") or model.PrimaryPart)
end

local function nearestPlayer(npc, range)
    local origin = rootOf(npc)
    if not origin then
        return nil
    end
    local best, bestDistance = nil, range
    for _, player in ipairs(Players:GetPlayers()) do
        local character = player.Character
        local humanoid = humanoidOf(character)
        local target = rootOf(character)
        if humanoid and humanoid.Health > 0 and target then
            local distance = (origin.Position - target.Position).Magnitude
            if distance < bestDistance then
                best, bestDistance = character, distance
            end
        end
    end
    return best
end

local function spawn(def, point)
    local prefabs = ServerStorage:FindFirstChild("NpcPrefabs")
    local template = prefabs and prefabs:FindFirstChild(def.model)
    if not template then
        warnOnce("prefab:" .. def.model, "prefab introuvable : ServerStorage/NpcPrefabs/" .. def.model .. ". Crée le modèle dans Blender puis insère-le.")
        return nil
    end

    local npc = template:Clone()
    local humanoid = humanoidOf(npc)
    if not humanoid then
        warnOnce("humanoid:" .. def.model, def.model .. " n'a pas de Humanoid.")
        npc:Destroy()
        return nil
    end

    npc:SetAttribute("NpcTag", def.tag)
    npc:SetAttribute("NpcId", def.id)
    npc.Name = def.label .. "_" .. tostring(math.random(1000, 9999))

    humanoid.MaxHealth = def.health
    humanoid.Health = def.health
    humanoid.WalkSpeed = def.walkSpeed

    local folder = Workspace:FindFirstChild("Npcs")
    if not folder then
        folder = Instance.new("Folder")
        folder.Name = "Npcs"
        folder.Parent = Workspace
    end
    npc.Parent = folder

    if point then
        local root = rootOf(npc)
        if root then
            npc:PivotTo(CFrame.new(point.Position))
        end
        npc:SetAttribute("HomePosition", point.Position)
    end

    active[npc] = {
        def = def,
        home = point and point.Position or rootOf(npc) and rootOf(npc).Position or Vector3.new(),
        nextAttack = 0,
        nextPatrol = 0,
    }

    task.spawn(function()
        while npc.Parent and humanoid.Health > 0 do
            local state = active[npc]
            if not state then
                break
            end
            local target = nearestPlayer(npc, def.detection)
            if target then
                local npcRoot = rootOf(npc)
                local targetRoot = rootOf(target)
                if npcRoot and targetRoot then
                    humanoid:MoveTo(targetRoot.Position)
                    local distance = (npcRoot.Position - targetRoot.Position).Magnitude
                    if distance <= def.attackRange and os.clock() >= state.nextAttack then
                        state.nextAttack = os.clock() + def.attackCooldown
                        local combat = ServiceRegistry.has("CombatService") and ServiceRegistry.get("CombatService") or nil
                        if combat then
                            combat:Damage(nil, target, def.damage)
                        end
                    end
                end
            else
                local root = rootOf(npc)
                if root then
                    local offset = Vector3.new(
                        math.random(-def.patrolRadius, def.patrolRadius),
                        0,
                        math.random(-def.patrolRadius, def.patrolRadius)
                    )
                    humanoid:MoveTo(state.home + offset)
                end
            end
            task.wait(0.6)
        end
        active[npc] = nil
        if npc.Parent then
            npc:Destroy()
        end
    end)

    humanoid.Died:Connect(function()
        active[npc] = nil
        task.delay(4, function()
            if npc.Parent then
                npc:Destroy()
            end
        end)
        task.delay(15, function()
            spawn(def, point)
        end)
    end)

    return npc
end

function NpcService:Start()
    local spawns = Workspace:FindFirstChild("NpcSpawns")
    if not spawns then
        warn("[Npc] Workspace/NpcSpawns absent : aucun PNJ ne peut apparaître. Crée des Parts nommés avec l'attribut NpcId dans un dossier NpcSpawns.")
        return
    end

    for _, id in ipairs(NpcDefs.Order) do
        local def = NpcDefs.get(id)
        if def then
            local points = {}
            for _, child in ipairs(spawns:GetChildren()) do
                if child:IsA("BasePart") and child:GetAttribute("NpcId") == id then
                    table.insert(points, child)
                end
            end
            if #points == 0 then
                warn("[Npc] Aucun point NpcSpawns avec NpcId=" .. id .. ".")
            end
            for index = 1, math.min(def.spawnCount, #points) do
                spawn(def, points[index])
            end
        end
    end
end

return NpcService
