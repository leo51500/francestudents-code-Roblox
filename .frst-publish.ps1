$ErrorActionPreference = "Stop"
$repo = "leo51500/francestudents-code-Roblox"
$tag = "v1.5.45"
$input = "protocol=https`nhost=github.com`n`n"
$cred = $input | git credential fill
$token = ($cred -split "`n" | Where-Object { $_ -like "password=*" }) -replace "^password=", ""
if (-not $token) { throw "Aucun jeton GitHub dans le gestionnaire d'identifiants." }
$headers = @{ Authorization = "Bearer $token"; "User-Agent" = "frst-publish"; Accept = "application/vnd.github+json" }

$body = @{
    tag_name = $tag
    name = "FranceStudent Code Roblox 1.5.45"
    draft = $true
    prerelease = $false
    target_commitish = "main"
    body = "Recherche de fichiers approximative, memoire de projet, jeu complet roblox_game, fin de tache verifiee avec retest, silhouette Blender et banc Roblox. Installateur Windows 64 bits joint par la construction automatique."
} | ConvertTo-Json

try {
    $release = Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/$repo/releases" -Headers $headers -Body $body -ContentType "application/json"
    "cree: id=$($release.id) draft=$($release.isDraft) tag=$($release.tag_name)"
} catch {
    $detail = $_.ErrorDetails.Message
    "ECHEC: $($_.Exception.Message) $detail"
}
