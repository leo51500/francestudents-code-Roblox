-- Contrôleur permanent du HUD. Le module Hud construit l'interface ; ce
-- contrôleur ne fait que l'enregistrer dans l'ordre de démarrage client.

local Hud = require(script.Parent.Parent.ui.Hud)

local HudController = { Order = 10 }

function HudController:Start()
    self.hud = Hud
end

return HudController
