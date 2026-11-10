-- État partagé des contrôleurs client (panneaux ouverts, cible visée).
-- Ce module ne contient aucune donnée de jeu : uniquement de l'interface.

local ClientState = {
    inventoryOpen = false,
    shopOpen = false,
    questsOpen = false,
    buildingOpen = false,
    menuOpen = false,
}

function ClientState.anyPanelOpen()
    return ClientState.inventoryOpen
        or ClientState.shopOpen
        or ClientState.questsOpen
        or ClientState.buildingOpen
        or ClientState.menuOpen
end

return ClientState
