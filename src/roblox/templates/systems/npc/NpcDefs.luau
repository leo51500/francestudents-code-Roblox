-- Définitions des PNJ. Les modèles viennent de Blender et doivent être placés
-- dans ServerStorage/NpcPrefabs/<model> ; les points d'apparition dans
-- Workspace/NpcSpawns avec l'attribut NpcId = <id>.

local NpcDefs = {}

NpcDefs.Order = { "wolf" }

NpcDefs.Definitions = {
    wolf = {
        label = "Loup",
        model = "Wolf",
        tag = "wolf",
        health = 60,
        walkSpeed = 16,
        damage = 8,
        attackRange = 6,
        attackCooldown = 1.2,
        detection = 42,
        spawnCount = 3,
        patrolRadius = 14,
    },
}

function NpcDefs.get(id)
    return NpcDefs.Definitions[id]
end

return NpcDefs
