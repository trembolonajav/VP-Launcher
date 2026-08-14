$ErrorActionPreference = "Stop"

$chromeCandidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)

$chrome = $chromeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $chrome) {
  throw "Google Chrome nao encontrado."
}

$target = "https://pokewg.com/play"
if ($args.Count -gt 0 -and $args[0] -eq "--test") {
  $target = "https://test.pokewg.com/play"
}

Write-Host "Abrindo Chrome normal em $target"
Write-Host "O launcher nao controla nem tenta resolver o Cloudflare."
Write-Host "Use o perfil que ja possui Proton e VP Client instalados."

Start-Process -FilePath $chrome -ArgumentList @($target)
