$ErrorActionPreference = "Stop"
$repo = "leo51500/francestudents-code-Roblox"
$tag = "v1.5.46"
$input = "protocol=https`nhost=github.com`n`n"
$cred = $input | git credential fill
$token = ($cred -split "`n" | Where-Object { $_ -like "password=*" }) -replace "^password=", ""
if (-not $token) { throw "Aucun jeton GitHub dans le gestionnaire d'identifiants." }
$headers = @{ Authorization = "Bearer $token"; "User-Agent" = "frst-publish"; Accept = "application/vnd.github+json" }

$body = @{
    tag_name = $tag
    name = "FranceStudent Code Roblox 1.5.46"
    draft = $true
    prerelease = $false
    target_commitish = "main"
    body = "Une longue demande n'est plus confondue avec la question « Projet actuel » : le routage exige une question courte sur le dossier, et le message part a l'agent. Installateur Windows 64 bits joint par la construction automatique."
} | ConvertTo-Json

try {
    $release = Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/$repo/releases" -Headers $headers -Body $body -ContentType "application/json"
    "cree: id=$($release.id) draft=$($release.isDraft) tag=$($release.tag_name)"
} catch {
    $detail = $_.ErrorDetails.Message
    "ECHEC: $($_.Exception.Message) $detail"
}
