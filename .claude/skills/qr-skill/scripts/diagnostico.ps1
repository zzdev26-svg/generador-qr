# Diagnostico para conectar-hostinger-mcp (Windows)
# Salida pensada para que la lea Claude, no el usuario final.

Write-Host "== Sistema =="
Write-Host (Get-ComputerInfo | Select-Object -ExpandProperty OsName)

Write-Host ""
Write-Host "== Node.js =="
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    $nodeVersion = node -v
    Write-Host "node: $nodeVersion"
    $major = [int]($nodeVersion -replace '^v','' -split '\.')[0]
    if ($major -ge 24) {
        Write-Host "node_ok: true"
    } else {
        Write-Host "node_ok: false (se necesita v24 o superior)"
    }
} else {
    Write-Host "node: NOT_FOUND"
    Write-Host "node_ok: false"
}

Write-Host ""
Write-Host "== npm =="
$npm = Get-Command npm -ErrorAction SilentlyContinue
if ($npm) {
    Write-Host "npm: $(npm -v)"
} else {
    Write-Host "npm: NOT_FOUND"
}

Write-Host ""
Write-Host "== winget =="
$winget = Get-Command winget -ErrorAction SilentlyContinue
if ($winget) {
    Write-Host "winget: disponible"
} else {
    Write-Host "winget: NOT_FOUND"
}

Write-Host ""
Write-Host "== nvm-windows =="
$nvm = Get-Command nvm -ErrorAction SilentlyContinue
if ($nvm) {
    Write-Host "nvm: instalado"
} else {
    Write-Host "nvm: NOT_FOUND"
}

Write-Host ""
Write-Host "== Claude Code CLI =="
$claude = Get-Command claude -ErrorAction SilentlyContinue
if ($claude) {
    Write-Host "claude: presente"
} else {
    Write-Host "claude: NOT_FOUND"
}

Write-Host ""
Write-Host "== hostinger-api-mcp =="
$hostinger = Get-Command hostinger-api-mcp -ErrorAction SilentlyContinue
if ($hostinger) {
    Write-Host "hostinger-api-mcp: instalado globalmente"
} else {
    Write-Host "hostinger-api-mcp: NOT_FOUND"
}

Write-Host ""
Write-Host "== Conectores de Hostinger ya registrados en Claude Code =="
if ($claude) {
    claude mcp list 2>$null | Select-String -Pattern "hostinger"
}
