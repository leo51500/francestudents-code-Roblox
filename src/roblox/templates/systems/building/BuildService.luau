-- Construction serveur : validation de la cible, de la distance, du coût et du
-- prefab. Le serveur clone le modèle, jamais le client.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage.Shared
local Remotes = require(Shared.Remotes)
local GameConfig = require(Shared.GameConfig)
local BuildDefs = require(Shared.BuildDefs)

local Server = script.Parent.Parent
local ServiceRegistry = require(Server.lib.ServiceRegistry)

local BuildService = {}
BuildService.Order = 70

local lastPlace = {}
local MAX_PIECES = 250

local function buildFolder(player)
    local root = Workspace:FindFirstChild("Builds")
    if not root then
        root = Instance.new("Folder")
        root.Name = "Builds"
        root.Parent = Workspace
    end
    local folder = root:FindFirstChild(tostring(player.UserId))
    if not folder then
        folder = Instance.new("Folder")
        folder.Name = tostring(player.UserId)
        folder.Parent = root
    end
    return folder
end

local function prefabFor(definition)
    local assets = ReplicatedStorage:FindFirstChild("Assets")
    local build = assets and assets:FindFirstChild("Build")
    return build and build:FindFirstChild(definition.prefab) or nil
end

local function validPosition(position)
    return typeof(position) == "Vector3"
        and position.X == position.X
        and position.Y == position.Y
        and position.Z == position.Z
        and math.abs(position.X) < 100000
        and math.abs(position.Z) < 100000
end

function BuildService:Start()
    Remotes.get("Build/Place", "RemoteFunction").OnServerInvoke = function(player, pieceId, position, rotationY)
        local now = os.clock()
        if (lastPlace[player] or 0) + 0.25 > now then
            return { ok = false, message = "Trop rapide." }
        end
        lastPlace[player] = now

        if type(pieceId) ~= "string" then
            return { ok = false, message = "Pièce invalide." }
        end
        local definition = BuildDefs.Definitions[pieceId]
        if not definition then
            return { ok = false, message = "Pièce inconnue." }
        end
        if not validPosition(position) then
            return { ok = false, message = "Position invalide." }
        end

        local character = player.Character
        local root = character and (character:FindFirstChild("HumanoidRootPart") or character.PrimaryPart)
        if not root then
            return { ok = false, message = "Personnage indisponible." }
        end
        if (root.Position - position).Magnitude > GameConfig.Building.MaxDistance then
            return { ok = false, message = "Trop loin pour construire." }
        end

        local prefab = prefabFor(definition)
        if not prefab then
            return {
                ok = false,
                message = "Prefab introuvable : ReplicatedStorage/Assets/Build/" .. definition.prefab ..
                    ". Crée-le dans Blender puis insère-le à cet emplacement.",
            }
        end

        local folder = buildFolder(player)
        if #folder:GetChildren() >= MAX_PIECES then
            return { ok = false, message = "Limite de construction atteinte." }
        end

        if definition.cost and definition.cost > 0 then
            if not ServiceRegistry.get("PlayerData"):Spend(player, definition.cost) then
                return { ok = false, message = "Monnaie insuffisante." }
            end
        end

        local grid = GameConfig.Building.Grid
        local snapped = Vector3.new(
            math.floor(position.X / grid + 0.5) * grid,
            math.floor(position.Y / 1 + 0.5),
            math.floor(position.Z / grid + 0.5) * grid
        )

        local piece = prefab:Clone()
        piece.Name = definition.prefab .. "_" .. tostring(#folder:GetChildren() + 1)
        piece:SetAttribute("OwnerId", player.UserId)
        piece.Parent = folder

        local rotation = typeof(rotationY) == "number" and math.rad(math.clamp(rotationY, -180, 180)) or 0
        piece:PivotTo(CFrame.new(snapped) * CFrame.Angles(0, rotation, 0))

        return { ok = true, message = "Pièce placée.", count = #folder:GetChildren() }
    end

    Players.PlayerRemoving:Connect(function(player)
        lastPlace[player] = nil
    end)
end

return BuildService
