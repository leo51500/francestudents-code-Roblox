-- Registre des services serveur : permet à un système de dépendre d'un autre
-- sans require circulaire. Tous les services sont enregistrés avant Start.

local ServiceRegistry = {}
local services = {}

function ServiceRegistry.set(name, service)
    services[name] = service
end

function ServiceRegistry.has(name)
    return services[name] ~= nil
end

function ServiceRegistry.get(name)
    local service = services[name]
    if not service then
        error("Service introuvable : " .. name .. ". Vérifie que son système est installé.", 2)
    end
    return service
end

return ServiceRegistry
