--!strict

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local DataStoreService = game:GetService("DataStoreService")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared", 10) :: Folder
local Config = require(Shared:WaitForChild("Config", 10) :: ModuleScript)

local course = Instance.new("Folder")
course.Name = "Course"
course.Parent = Workspace

local startPosition = Vector3.new(0, 3, 0)
local checkpoints: { [number]: BasePart } = {}
local bestStore = DataStoreService:GetDataStore(Config.StoreName)
local running = true

local function makePart(name: string, size: Vector3, position: Vector3, color: Color3, parent: Instance): Part
    local part = Instance.new("Part")
    part.Name = name
    part.Anchored = true
    part.CanCollide = true
    part.Size = size
    part.Position = position
    part.Color = color
    part.Material = Enum.Material.SmoothPlastic
    part.TopSurface = Enum.SurfaceType.Smooth
    part.BottomSurface = Enum.SurfaceType.Smooth
    part.Parent = parent
    return part
end

local function platformPosition(index: number): Vector3
    local angle = index * 0.62
    local height = 3 + index * Config.PlatformSpacing
    return Vector3.new(math.cos(angle) * Config.Radius, height, math.sin(angle) * Config.Radius)
end

local function addCheckpoint(index: number, platform: BasePart)
    local pad = makePart(
        `Checkpoint{index}`,
        Vector3.new(Config.PlatformSize, 0.6, Config.PlatformSize),
        platform.Position + Vector3.new(0, 1, 0),
        Color3.fromRGB(84, 220, 120),
        course
    )
    pad.CanCollide = false
    pad.Transparency = 0.35

    checkpoints[index] = pad

    pad.Touched:Connect(function(hit: BasePart)
        local character = hit:FindFirstAncestorOfClass("Model")
        if not character then
            return
        end

        local player = Players:GetPlayerFromCharacter(character)
        if not player then
            return
        end

        local current = player:GetAttribute("Checkpoint")
        if typeof(current) ~= "number" or current >= index then
            return
        end

        player:SetAttribute("Checkpoint", index)
        player:SetAttribute("CheckpointPosition", pad.Position + Vector3.new(0, 4, 0))
    end)
end

local function addCoin(index: number, platform: BasePart)
    local coin = makePart(
        `Coin{index}`,
        Vector3.new(1.8, 1.8, 0.4),
        platform.Position + Vector3.new(0, 3.2, 0),
        Color3.fromRGB(255, 214, 64),
        course
    )
    coin.CanCollide = false
    coin.Material = Enum.Material.Neon
    coin:SetAttribute("Available", true)

    task.spawn(function()
        while running do
            task.wait(0.15)
            if coin.Parent then
                coin.CFrame = CFrame.new(coin.Position) * CFrame.Angles(0, os.clock() * 2.4, 0)
            end
        end
    end)

    coin.Touched:Connect(function(hit: BasePart)
        if coin:GetAttribute("Available") ~= true then
            return
        end

        local character = hit:FindFirstAncestorOfClass("Model")
        if not character then
            return
        end

        local player = Players:GetPlayerFromCharacter(character)
        if not player then
            return
        end

        coin:SetAttribute("Available", false)
        coin.Transparency = 1
        player:SetAttribute("Coins", (player:GetAttribute("Coins") or 0) + Config.CoinValue)

        task.delay(Config.CoinRespawnSeconds, function()
            if coin.Parent then
                coin:SetAttribute("Available", true)
                coin.Transparency = 0
            end
        end)
    end)
end

local function buildCourse()
    local start = makePart(
        "Start",
        Vector3.new(24, 2, 24),
        startPosition,
        Color3.fromRGB(70, 120, 210),
        course
    )

    local spawn = Instance.new("SpawnLocation")
    spawn.Name = "Spawn"
    spawn.Anchored = true
    spawn.Neutral = true
    spawn.Duration = 0
    spawn.Size = Vector3.new(12, 1, 12)
    spawn.Position = startPosition + Vector3.new(0, 1.5, 0)
    spawn.Color = Color3.fromRGB(120, 200, 255)
    spawn.Parent = course

    checkpoints[0] = spawn

    local previous = start

    for index = 1, Config.PlatformCount do
        local position = platformPosition(index)
        local isCheckpoint = index % Config.CheckpointEvery == 0
        local platform = makePart(
            isCheckpoint and `CheckpointPlatform{index}` or `Platform{index}`,
            Vector3.new(Config.PlatformSize, 1, Config.PlatformSize),
            position,
            isCheckpoint and Color3.fromRGB(84, 190, 120) or Color3.fromRGB(235, 238, 245),
            course
        )

        -- Un pont fin relie visuellement les plateformes sans créer de saut impossible.
        local gap = (position - previous.Position).Magnitude
        if gap > Config.PlatformSpacing + 6 then
            local middle = (position + previous.Position) / 2
            makePart(
                `Bridge{index}`,
                Vector3.new(3, 0.6, (position - previous.Position).Magnitude),
                middle,
                Color3.fromRGB(120, 130, 150),
                course
            ).CFrame = CFrame.lookAt(middle, position)
        end

        if isCheckpoint then
            addCheckpoint(index, platform)
        end

        addCoin(index, platform)
        previous = platform
    end

    local finish = makePart(
        "Finish",
        Vector3.new(18, 2, 18),
        previous.Position + Vector3.new(0, 3, 0),
        Color3.fromRGB(255, 196, 58),
        course
    )
    finish.Material = Enum.Material.Neon
end

local function leaderstatsFor(player: Player): Folder
    local folder = player:FindFirstChild("leaderstats") :: Folder?
    if folder then
        return folder
    end

    folder = Instance.new("Folder")
    folder.Name = "leaderstats"

    local coins = Instance.new("IntValue")
    coins.Name = "Pièces"
    coins.Value = 0
    coins.Parent = folder

    local best = Instance.new("IntValue")
    best.Name = "Meilleur"
    best.Value = 0
    best.Parent = folder

    folder.Parent = player
    return folder
end

local function loadBest(player: Player)
    local ok, result = pcall(function()
        return bestStore:GetAsync(tostring(player.UserId))
    end)

    if ok and typeof(result) == "number" then
        player:SetAttribute("BestTime", result)
        local stats = leaderstatsFor(player)
        local best = stats:FindFirstChild("Meilleur") :: IntValue?
        if best then
            best.Value = math.floor(result)
        end
    end
end

local function saveBest(player: Player, seconds: number)
    local ok = pcall(function()
        bestStore:SetAsync(tostring(player.UserId), seconds)
    end)

    if not ok then
        warn(`[${Config.GameName}] Meilleur temps non enregistré pour {player.Name}`)
    end
end

local function respawnAtCheckpoint(player: Player)
    local character = player.Character
    if not character then
        return
    end

    local root = character:FindFirstChild("HumanoidRootPart") :: BasePart?
    if not root then
        return
    end

    local position = player:GetAttribute("CheckpointPosition")
    if typeof(position) ~= "Vector3" then
        position = startPosition + Vector3.new(0, 6, 0)
    end

    root.CFrame = CFrame.new(position)
    root.AssemblyLinearVelocity = Vector3.zero
end

local function resetRun(player: Player)
    player:SetAttribute("Coins", 0)
    player:SetAttribute("Checkpoint", 0)
    player:SetAttribute("CheckpointPosition", startPosition + Vector3.new(0, 6, 0))
    player:SetAttribute("Elapsed", 0)
    player:SetAttribute("Finished", false)
    player:SetAttribute("StartedAt", os.clock())
end

local function onCharacter(player: Player)
    local character = player.Character
    if not character then
        return
    end

    local humanoid = character:WaitForChild("Humanoid", 10) :: Humanoid?
    if not humanoid then
        return
    end

    humanoid.Died:Connect(function()
        task.wait(Config.RespawnDelay)
        respawnAtCheckpoint(player)
    end)
end

local finishedConnection: RBXScriptConnection? = nil

local function onPlayerAdded(player: Player)
    leaderstatsFor(player)
    resetRun(player)
    loadBest(player)
    onCharacter(player)

    player.CharacterAdded:Connect(function()
        task.wait(0.1)
        onCharacter(player)
    end)

    player:SetAttribute("BestTime", player:GetAttribute("BestTime") or 0)
end

-- Fin de parcours : temps, meilleur temps, arrêt du chrono.
local function finishRun(player: Player)
    if player:GetAttribute("Finished") == true then
        return
    end

    local startedAt = player:GetAttribute("StartedAt")
    if typeof(startedAt) ~= "number" then
        return
    end

    local elapsed = math.max(0, os.clock() - startedAt)
    player:SetAttribute("Finished", true)
    player:SetAttribute("Elapsed", elapsed)

    local best = player:GetAttribute("BestTime")
    if typeof(best) ~= "number" or best <= 0 or elapsed < best then
        player:SetAttribute("BestTime", elapsed)
        local stats = leaderstatsFor(player)
        local label = stats:FindFirstChild("Meilleur") :: IntValue?
        if label then
            label.Value = math.floor(elapsed)
        end
        saveBest(player, elapsed)
    end
end

Players.PlayerAdded:Connect(onPlayerAdded)
Players.PlayerRemoving:Connect(function(player: Player)
    local stats = player:FindFirstChild("leaderstats") :: Folder?
    local label = stats and stats:FindFirstChild("Meilleur") :: IntValue?
    if label and label.Value > 0 then
        local elapsed = player:GetAttribute("Elapsed")
        if typeof(elapsed) == "number" and elapsed > 0 and elapsed < label.Value then
            saveBest(player, elapsed)
        end
    end
end)

for _, player in Players:GetPlayers() do
    task.spawn(onPlayerAdded, player)
end

buildCourse()

-- Zone d'arrivée : détection du contact avec la plateforme Finish.
local finishPad = course:WaitForChild("Finish", 10) :: BasePart?
if finishPad then
    finishPad.Touched:Connect(function(hit: BasePart)
        local character = hit:FindFirstAncestorOfClass("Model")
        if not character then
            return
        end
        local player = Players:GetPlayerFromCharacter(character)
        if player then
            finishRun(player)
        end
    end)
end

local heartbeatAccumulator = 0

finishedConnection = RunService.Heartbeat:Connect(function(delta: number)
    heartbeatAccumulator += delta
    if heartbeatAccumulator < 0.25 then
        return
    end
    heartbeatAccumulator = 0

    for _, player in Players:GetPlayers() do
        local character = player.Character
        local root = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
        if root and root.Position.Y < Config.FallLimit then
            respawnAtCheckpoint(player)
        end

        if player:GetAttribute("Finished") ~= true then
            local startedAt = player:GetAttribute("StartedAt")
            if typeof(startedAt) == "number" then
                player:SetAttribute("Elapsed", math.max(0, os.clock() - startedAt))
            end
        end
    end
end)

game:BindToClose(function()
    running = false
    if finishedConnection then
        finishedConnection:Disconnect()
    end
    task.wait(0.2)
end)
