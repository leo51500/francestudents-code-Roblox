---
name: roblox-ui
description: Construire une interface de jeu Roblox native au style cartoon Roblox (HUD, boutique, inventaire, gamepasses) avec cadres épais, dégradés, badges et icônes, puis la vérifier par captures sur plusieurs tailles d'écran. Ne jamais produire une page web.
---

# Interface de jeu Roblox — native et cartoon, jamais un site web

Ce skill s'applique à toute interface d'un jeu Roblox : boutique, inventaire,
HUD, menu, gamepasses, récompenses, barre de monnaie, écran de fin, etc.
L'interface se construit dans **Roblox Studio** avec les objets GUI natifs.
Elle ne se construit pas comme une page web.

## 1. Règles absolues

- **Pas de HTML, CSS, JavaScript web, React, Vue, Tailwind, Electron.** Aucun
  fichier `.html`, `.css` ou composant de navigateur pour une UI Roblox.
- **Pas de mise en page de site web** : pas de tableau de bord blanc, pas de
  fines lignes de séparation, pas de petits textes gris, pas de menus
  déroulants de formulaire, pas de cartes plates sans contour.
- Utilise uniquement les classes Roblox : `ScreenGui`, `Frame`, `TextLabel`,
  `TextButton`, `ImageLabel`, `ImageButton`, `TextBox`, `ScrollingFrame`,
  `CanvasGroup`, `UIListLayout`, `UIGridLayout`, `UIPadding`, `UICorner`,
  `UIStroke`, `UIGradient`, `UIScale`, `UIAspectRatioConstraint`,
  `UISizeConstraint`, `UITextSizeConstraint`.
- Crée l'interface sous `StarterGui` avec `ScreenGui.ResetOnSpawn = false` et
  `IgnoreGuiInset = true`. Ne modifie pas `PlayerGui` à la main dans l'éditeur.
- Si un asset (icône, cadre 9-slice, image de fond) n'existe pas, ne fabrique
  jamais un `rbxassetid` au hasard. Utilise un asset réel du projet, un asset
  officiel vérifié, ou construis une icône géométrique simple avec des Frames.
  Demande une image à l'utilisateur si le rendu en dépend.

## 2. Langage visuel à reproduire

Les captures de référence montrent le style des jeux Roblox populaires. Il faut
reproduire ce langage, pas une interface de site web.

### Panneau principal

- Grand panneau centré, coins arrondis (`UICorner` 14–24 px), bordure sombre
  épaisse (`UIStroke` 3–5 px, `ApplyStrokeMode = Border`).
- Ombre portée décalée : un `Frame` sombre translucide derrière le panneau,
  décalé de 6–12 px vers le bas et la droite, même rayon.
- Fond en dégradé vertical ou diagonal (`UIGradient`, 2–3 arrêts), pas un aplat
  terne.
- Liseré clair sur le bord supérieur pour l'effet « verre ».
- Écran assombri derrière la modale (`Frame` noir, `BackgroundTransparency`
  0,35–0,55), avec la scène visible autour.

### En-tête

- Barre plus claire que le panneau, séparée par un trait sombre.
- Titre à gauche en blanc, très gras (`GothamBlack`), contour sombre
  (`TextStrokeTransparency = 0`) et légère ombre.
- À droite : pastilles de monnaie (pilule sombre arrondie, icône + montant),
  puis bouton fermer carré rouge avec un « X » blanc.
- Les pastilles utilisent `AutomaticSize = X`, un `UIPadding` et un
  `UIListLayout` horizontal.

### Navigation

- Rail vertical à gauche avec de gros boutons arrondis, dégradé vertical,
  bordure sombre et texte blanc gras.
- Onglet actif : couleur cyan/verte lumineuse, contour clair, légèrement plus
  large ou surélevé. Onglets inactifs : bleu/gris sombre.
- Chaque bouton fait au moins 44 px de haut et reste lisible sans zoom.

### Cartes d'objets

- Grille de 3 ou 4 colonnes, gouttières régulières (`UIGridLayout`).
- Carte : fond dégradé saturé propre à la rareté, coins arrondis, contour
  sombre, ombre décalée.
- Badge de rareté en haut à gauche (`Rare`, `Epic`, `New`, `-30 %`) : petit
  ruban coloré avec texte blanc.
- Zone d'icône au centre : fond rayonnant ou gradient radial, image de l'objet
  bien centrée, échelle cohérente entre les cartes.
- Nom en bas, blanc, gras, contour sombre.
- Bouton de prix : pilule verte (ou couleur de la monnaie), icône + montant,
  contour sombre, effet enfoncé au clic.

### HUD et gamepasses

- Rail latéral d'icônes carrées colorées, avec état actif et badge de
  notification.
- Barres de progression segmentées, avec remplissage vif et fond sombre.
- Bannière de gamepasses : grand titre blanc avec contour, cartes horizontales
  avec image de fond, dégradé de couleur, badge `LIMITED` ou `SAVE 25 %`,
  prix en Robux vert.
- Pack de gemmes : carte bleu sombre, cristaux bleus, prix Robux, mention
  « BEST DEAL » ou remise.

### Palette de départ

| Rôle | Couleur |
| --- | --- |
| Fond profond | `#08131F`, `#0F2A44` |
| Panneau bleu | `#12718F`, `#1B9CC4`, `#35C7E8` |
| Cyan lumineux | `#4FE3FF` |
| Vert action | `#4CAF2E`, `#7ED321` |
| Or / monnaie | `#FFC93C`, `#F5A623` |
| Rouge fermer | `#E23B3B`, `#A61B1B` |
| Violet épique | `#8E44AD`, `#C039E0` |
| Rose event | `#E91E63`, `#FF4FA3` |
| Texte | `#FFFFFF` avec contour `#06101A` |

Les couleurs de rareté doivent rester cohérentes dans tout le jeu :
commun = gris/vert, rare = bleu, épique = violet, légendaire = or/orange.

### Typographie

- Titres : `Enum.Font.GothamBlack`, `LuckiestGuy`, `Bangers` ou `FredokaOne`
  selon le thème.
- Boutons et noms : `GothamBold`.
- Textes secondaires : `Gotham` ou `GothamMedium`.
- Thème Halloween : `Creepster` pour le titre uniquement.
- Jamais de police fine ou de texte de 10 px. Minimum lisible : 14 px sur
  desktop, 16–18 px sur mobile, 22–32 px pour les titres.
- Active `TextScaled` avec `UITextSizeConstraint` pour les libellés qui doivent
  suivre la taille de la carte.

## 3. Structure et code Luau

Construis par petits blocs avec `execute_luau` (`datamodel_type: "Edit"`).
Un helper réduit le bruit et garde des propriétés cohérentes :

```lua
local function make(className, props, parent)
    local instance = Instance.new(className)
    for key, value in pairs(props or {}) do
        instance[key] = value
    end
    if parent then
        instance.Parent = parent
    end
    return instance
end

local function corner(instance, radius)
    make("UICorner", { CornerRadius = UDim.new(0, radius) }, instance)
end

local function border(instance, color, thickness)
    make("UIStroke", {
        Color = color,
        Thickness = thickness or 3,
        ApplyStrokeMode = Enum.ApplyStrokeMode.Border,
    }, instance)
end

local function gradient(instance, topColor, bottomColor, rotation)
    make("UIGradient", {
        Color = ColorSequence.new({
            ColorSequenceKeypoint.new(0, topColor),
            ColorSequenceKeypoint.new(1, bottomColor),
        }),
        Rotation = rotation or 90,
    }, instance)
end
```

Structure de référence d'une boutique :

```lua
local starterGui = game:GetService("StarterGui")
local old = starterGui:FindFirstChild("ShopGui")
if old then old:Destroy() end

local screen = make("ScreenGui", {
    Name = "ShopGui",
    ResetOnSpawn = false,
    IgnoreGuiInset = true,
    ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
}, starterGui)

local shade = make("Frame", {
    Name = "Shade",
    Size = UDim2.fromScale(1, 1),
    BackgroundColor3 = Color3.fromHex("#02060C"),
    BackgroundTransparency = 0.45,
    BorderSizePixel = 0,
    ZIndex = 1,
}, screen)

local shadow = make("Frame", {
    Name = "PanelShadow",
    AnchorPoint = Vector2.new(0.5, 0.5),
    Position = UDim2.fromScale(0.5, 0.52),
    Size = UDim2.fromScale(0.78, 0.82),
    BackgroundColor3 = Color3.fromHex("#02060C"),
    BackgroundTransparency = 0.35,
    BorderSizePixel = 0,
    ZIndex = 2,
}, screen)
corner(shadow, 20)

local panel = make("Frame", {
    Name = "Panel",
    AnchorPoint = Vector2.new(0.5, 0.5),
    Position = UDim2.fromScale(0.5, 0.5),
    Size = UDim2.fromScale(0.76, 0.80),
    BackgroundColor3 = Color3.fromHex("#12718F"),
    BorderSizePixel = 0,
    ZIndex = 3,
}, screen)
corner(panel, 20)
border(panel, Color3.fromHex("#06101A"), 4)
gradient(panel, Color3.fromHex("#1B9CC4"), Color3.fromHex("#0B3E57"), 90)
make("UISizeConstraint", {
    MaxSize = Vector2.new(1600, 900),
    MinSize = Vector2.new(320, 240),
}, panel)
```

Ajoute ensuite, dans l'ordre :

1. l'en-tête (titre, pastilles de monnaie, bouton fermer) ;
2. le rail de navigation ;
3. la barre de recherche personnalisée ;
4. la grille de cartes ;
5. les interactions et animations.

Pour chaque carte, garde une fonction unique `createCard(parent, data)` qui prend
un nom, une rareté, une couleur, un prix et une icône. Toutes les cartes doivent
partager la même structure et les mêmes marges.

## 4. Responsive et tailles d'écran

- Le panneau utilise des tailles en `Scale`, avec `UISizeConstraint` pour éviter
  qu'il devienne énorme sur grand écran.
- Les cartes utilisent `UIGridLayout` + `UIAspectRatioConstraint` plutôt que des
  positions en pixels codées en dur.
- Ajoute un `UIScale` sur le `ScreenGui` et recalcule-le sur
  `workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize")` pour les
  petits écrans ; ne réduis jamais le texte sous 14 px.
- Teste au minimum : 1920×1080, 1366×768, 1280×720, 1024×768, 390×844
  (portrait téléphone) et 844×390 (paysage téléphone).
- Sur téléphone, la grille passe à 2 colonnes et le rail de navigation devient
  une rangée horizontale ou un bouton menu.
- Si le MCP Studio expose le skill `rbx-device-simulator-lua`, charge-le pour
  changer de device ; sinon utilise les presets de l'onglet Test de Studio.

## 5. Preuve visuelle obligatoire

Une interface n'est jamais terminée sans captures inspectées.

1. Vérifie `get_studio_state`. Si Studio est déjà en Play, arrête-le avant de
   modifier `StarterGui`.
2. Construis la structure dans `StarterGui` (`datamodel_type: "Edit"`).
3. Lance le jeu avec `start_stop_play` pour que la GUI apparaisse dans
   `PlayerGui`.
4. Prends une capture avec `screen_capture` (`capture_id` explicite), puis
   **regarde réellement l'image**.
5. Corrige dans `StarterGui` : arrête le jeu, applique la correction, relance.
6. Répète au moins à ces étapes :
   - structure et proportions du panneau ;
   - en-tête et navigation ;
   - grille de cartes et icônes ;
   - état ouvert/fermé et survol des boutons ;
   - taille téléphone paysage et portrait.
7. Contrôle sur chaque capture : aucun texte coupé, aucun chevauchement, aucun
   élément hors écran, contraste suffisant, icônes non déformées, boutons
   accessibles au doigt.
8. Si `screen_capture` échoue, si le jeu ne démarre pas ou si la vision n'est
   pas disponible, dis-le précisément. Ne prétends pas avoir vérifié une image
   que tu n'as pas vue.

## 6. Interactions et accessibilité

- `TextButton`/`ImageButton` avec `Selectable = true` et un `NextSelection`
  cohérent pour la manette et le clavier.
- Survol : éclaircir le bouton, épaissir le contour, déplacer légèrement vers le
  haut avec `TweenService`.
- Clic : enfoncement de 2 px, retour à la position au relâchement.
- Ouverture/fermeture de la boutique : `TweenService` sur `Position`/`Size` et
  `BackgroundTransparency`, jamais un changement brutal.
- Le bouton fermer et la touche `Escape` ferment la modale.
- Aucune action critique uniquement au survol : tout doit être cliquable au
  doigt et sélectionnable à la manette.
- Les textes destinés à la traduction restent dans des `TextLabel` séparés, sans
  concaténation qui casse la mise en page.

## 7. Checklist finale

- [ ] Aucun fichier HTML/CSS ni composant web.
- [ ] `ScreenGui` natif sous `StarterGui`, `ResetOnSpawn = false`.
- [ ] Panneau avec coins arrondis, contour sombre et ombre décalée.
- [ ] En-tête avec titre, monnaie et bouton fermer.
- [ ] Navigation lisible et onglet actif identifiable.
- [ ] Cartes avec badge de rareté, icône, nom et prix.
- [ ] Palette et polices cohérentes avec le style cartoon Roblox.
- [ ] Captures inspectées à chaque étape, sur desktop et téléphone.
- [ ] Aucun texte coupé, aucun chevauchement, aucun élément hors écran.
- [ ] Compte rendu : chemins des objets, tailles testées, captures, points
      restant à vérifier.
