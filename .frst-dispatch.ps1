$ErrorActionPreference = "Stop"
$repo = "leo51500/francestudents-code-Roblox"
$input = "protocol=https`nhost=github.com`n`n"
$cred = $input | git credential fill
$token = ($cred -split "`n" | Where-Object { $_ -like "password=*" }) -replace "^password=", ""
if (-not $token) { throw "Aucun jeton GitHub dans le gestionnaire d'identifiants." }
$headers = @{ Authorization = "Bearer $token"; "User-Agent" = "frst-publish"; Accept = "application/vnd.github+json" }
try {
    Invoke-RestMethod -Method Post -Uri "https://api.github.com/repos/$repo/actions/workflows/auto-release.yml/dispatches" -Headers $headers -Body '{"ref":"main"}' -ContentType "application/json" | Out-Null
    "dispatch envoye"
} catch {
    "ECHEC: $($_.Exception.Message) $($_.ErrorDetails.Message)"
}
