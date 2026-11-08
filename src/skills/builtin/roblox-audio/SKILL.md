---
name: roblox-audio
description: Trouver ou fabriquer les sons d'un jeu Roblox (épée, impacts, portes, pas, ambiance, musique), vérifier les licences, préparer les fichiers, guider l'upload Roblox et câbler les Sound dans Studio.
---

# Sons et ambiance Roblox

À utiliser dès qu'une demande parle de **son, bruit, musique, ambiance, effet
sonore, épée, impact, pas, porte, pluie, vent, cri, UI sonore**. Les sons se
préparent hors de Studio : un jeu Roblox ne lit que des assets audio uploadés
(`rbxassetid://…`), jamais un fichier local.

## 1. Chercher avant de fabriquer

C'est à l'agent de trouver les sons, pas à l'utilisateur. Ordre de préférence :

1. **Banques libres de droits** : Freesound (filtre CC0), Pixabay Audio,
   Kenney (CC0), Mixkit, OpenGameArt, ZapSplat, Sonniss GDC.
2. **Fabrication procédurale** si le son est simple ou si le réseau manque
   (voir § 5) : whoosh, impact, vent, pluie, bourdonnement.
3. **Jamais** d'extrait de jeu existant, de musique commerciale, de vidéo
   YouTube ou d'un pack dont la licence n'est pas explicite.

Pour chaque son, note dans `assets/audio/LICENCES.md` :

```markdown
| Fichier | Source (URL) | Auteur | Licence | Attribution requise |
| --- | --- | --- | --- | --- |
| sword_swing_01.ogg | https://freesound.org/s/… | pseudo | CC0 | non |
```

Une licence CC-BY impose de créditer l'auteur : ajoute le crédit dans
`assets/audio/LICENCES.md` et dans les crédits du jeu. Dans le doute, choisis
un autre son.

## 2. Télécharger et vérifier

Utilise `run_command` avec un chemin **relatif au projet** (jamais un chemin
absolu hors projet) :

```powershell
New-Item -ItemType Directory -Force assets/audio | Out-Null
Invoke-WebRequest -Uri "<URL directe>" -OutFile "assets/audio/sword_swing_01.ogg"
```

Vérifie ensuite :

- la taille du fichier (> 1 Ko, pas une page HTML d'erreur) ;
- la durée et le format (`ffprobe` si disponible, sinon la taille) ;
- l'écoute réelle : **tu ne peux pas écouter**. Contrôle la forme d'onde, le
  niveau et la durée, puis demande à l'utilisateur de valider le rendu.

Nommage : `<objet>_<action>_<variante>.<ext>` —
`sword_swing_01.ogg`, `sword_impact_01.ogg`, `ambience_island_loop.ogg`.

## 3. Préparer pour Roblox

- **Effets 3D** (épée, pas, impact) : mono, 44,1 kHz, 0,3 à 1,5 s, crête vers
  −3 dBFS, pas de silence au début.
- **Ambiance** : boucle propre (le début et la fin se raccordent), 20 à 60 s,
  niveau bas, pas de transitoire au point de bouclage.
- **UI** : court, mono, niveau constant.
- Évite les fichiers de plus de quelques Mo et les formats exotiques ; OGG ou
  WAV sont les plus sûrs.
- Conserve les originaux et une version normalisée : `assets/audio/source/`
  et `assets/audio/` (version prête).

## 4. Upload Roblox : étape obligatoire

Roblox n'accepte que des assets audio déposés sur la plateforme. L'agent ne
peut pas le faire seul sans accès au compte :

1. Creator Dashboard → **Assets** → **Audio** → téléverser le fichier préparé.
2. Attendre la modération, copier l'**ID** de l'asset.
3. Respecter les règles Roblox : audio **privé par défaut**, permissions à
   accorder, vérification du compte, limites de durée et de taille.
4. Une fois l'ID obtenu, l'agent câble le `Sound` dans Studio.

Tiens le tableau à jour dans `assets/audio/README.md` :

```markdown
| Fichier | Asset ID | Usage | SoundGroup |
| --- | --- | --- | --- |
| sword_swing_01.ogg | rbxassetid://123… | épée, Activated | SFX_Jeu |
```

Ne prétends jamais qu'un son est en jeu sans **ID réel** et **instance Sound
vérifiée**. Si l'ID manque, livre les fichiers prêts et la liste à téléverser.

## 5. Fabriquer un son simple (repli procédural)

Pour un whoosh d'épée, un impact métallique ou une ambiance, un script Python
suffit. Écris-le dans le projet et exécute-le avec `run_command`.

```python
import math, random, struct, wave

RATE = 44100

def write(path, samples):
    peak = max(1e-9, max(abs(s) for s in samples))
    gain = 0.7 / peak  # crête ≈ −3 dBFS
    with wave.open(path, "wb") as out:
        out.setnchannels(1); out.setsampwidth(2); out.setframerate(RATE)
        out.writeframes(b"".join(struct.pack("<h", int(s * gain * 32767)) for s in samples))

def whoosh(seconds=0.55):
    n = int(RATE * seconds); out = []
    for i in range(n):
        t = i / RATE
        env = math.sin(math.pi * min(1.0, t / seconds)) ** 2
        noise = random.uniform(-1, 1)
        tone = math.sin(2 * math.pi * (900 - 600 * t / seconds) * t)
        out.append((noise * 0.7 + tone * 0.3) * env)
    return out

write("assets/audio/sword_swing_01.wav", whoosh())
```

Pour un impact : bruit très court (30 ms) + deux sinus désaccordés qui
décroissent. Pour une ambiance : bruit filtré passe-bas, boucle de 30 s,
variation lente du niveau. Reste honnête : ces sons sont fonctionnels et
stylisés, pas équivalents à une banque professionnelle.

## 6. Câbler dans Studio

Crée un `SoundGroup` par famille (SFX, Ambiance, Musique) pour régler les
volumes globalement, puis les `Sound`.

Effet 3D sur une arme (script serveur) :

```lua
local tool = script.Parent
local swing = tool:FindFirstChild("Swing") or Instance.new("Sound")
swing.Name = "Swing"
swing.SoundId = "rbxassetid://REMPLACER"
swing.Volume = 0.6
swing.SoundGroup = game:GetService("SoundService"):FindFirstChild("SFX_Jeu")
swing.Parent = tool

tool.Activated:Connect(function()
    swing.PlaybackSpeed = 0.95 + math.random() * 0.1
    swing:Play()
end)
```

Ambiance 2D (boucle pour toute la map) :

```lua
local ambience = Instance.new("Sound")
ambience.Name = "AmbianceIle"
ambience.SoundId = "rbxassetid://REMPLACER"
ambience.Looped = true
ambience.Volume = 0.25
ambience.SoundGroup = game:GetService("SoundService"):FindFirstChild("Ambiance")
ambience.Parent = game:GetService("SoundService")
ambience:Play()
```

Ambiance 3D localisée : place le `Sound` dans une `Part` ou une `Attachment`,
active `RollOffMode = Enum.RollOffMode.InverseTapered`, règle
`RollOffMaxDistance`. Pour un son qui doit suivre le joueur, mets-le dans son
`HumanoidRootPart`.

## 7. Vérifier et livrer

- Relis les propriétés avec `inspect_instance` : `SoundId` non vide, `Looped`,
  `Volume`, `SoundGroup`, parent correct.
- Teste en playtest : le son démarre au bon moment, sans doublon ni coupure.
- **Tu ne peux pas entendre** : dis-le, demande une validation à l'oreille et
  corrige le volume ou la variante selon le retour.
- Livre : fichiers + licences + tableau des IDs + scripts + ce qui reste à
  téléverser manuellement.
