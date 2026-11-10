-- Création et récupération des RemoteEvent / RemoteFunction.
-- Le serveur crée le dossier et les remotes à la demande ; le client attend.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Remotes = {}
local folder = nil

local function ensureFolder()
    if folder then
        return folder
    end
    folder = ReplicatedStorage:FindFirstChild("Remotes")
    if not folder then
        folder = Instance.new("Folder")
        folder.Name = "Remotes"
        folder.Parent = ReplicatedStorage
    end
    return folder
end

function Remotes.get(name, className)
    className = className or "RemoteEvent"
    if RunService:IsServer() then
        local parent = ensureFolder()
        local remote = parent:FindFirstChild(name)
        if not remote then
            remote = Instance.new(className)
            remote.Name = name
            remote.Parent = parent
        elseif not remote:IsA(className) then
            error("Le remote " .. name .. " existe avec un autre type que " .. className .. ".")
        end
        return remote
    end

    local parent = ReplicatedStorage:WaitForChild("Remotes", 30)
    if not parent then
        error("Dossier Remotes introuvable : le serveur n'a pas démarré.")
    end
    local remote = parent:WaitForChild(name, 30)
    if not remote then
        error("Remote introuvable côté client : " .. name)
    end
    return remote
end

return Remotes
