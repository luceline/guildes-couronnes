# deploy_files.ps1
param(
    [string]$SourceDir = "C:\Users\lucas\Downloads",
    [string]$ProjectDir = "C:\GuildesCouronnes\check_zip"
)

Write-Host ""
Write-Host "=== Deploiement Guildes et Couronnes ==="
Write-Host "Source  : $SourceDir"
Write-Host "Projet  : $ProjectDir"
Write-Host ""

$files = @{
    "craftingData.js"           = "src\lib\craftingData.js"
    "gameData.js"               = "src\lib\gameData.js"
    "objectiveGenerator.js"     = "src\lib\objectiveGenerator.js"
    "recipePatterns.js"         = "src\lib\recipePatterns.js"
    "questRewards.js"           = "src\lib\questRewards.js"
    "dailyReset.js"             = "src\lib\dailyReset.js"
    "MaireDashboard.jsx"        = "src\components\MaireDashboard.jsx"
    "MaireOffresPanel.jsx"      = "src\components\MaireOffresPanel.jsx"
    "MairieShop.jsx"            = "src\components\MairieShop.jsx"
    "MairieTab.jsx"             = "src\components\MairieTab.jsx"
    "PlayerStatusBar.jsx"       = "src\components\PlayerStatusBar.jsx"
    "WarehouseCraftedPanel.jsx" = "src\components\WarehouseCraftedPanel.jsx"
    "WarehouseDepositPanel.jsx" = "src\components\WarehouseDepositPanel.jsx"
    "WarehouseUnified.jsx"      = "src\components\WarehouseUnified.jsx"
    "GameLayout.jsx"            = "src\components\GameLayout.jsx"
    "DailyQuestsWidget.jsx"     = "src\components\DailyQuestsWidget.jsx"
    "CityView.jsx"              = "src\pages\CityView.jsx"
    "Dashboard.jsx"             = "src\pages\Dashboard.jsx"
    "Market.jsx"                = "src\pages\Market.jsx"
    "Production.jsx"            = "src\pages\Production.jsx"
    "Travel.jsx"                = "src\pages\Travel.jsx"
    "base44Client.js"           = "src\api\base44Client.js"
}

$copied = 0
$skipped = 0
$errors = 0

Write-Host "--- Copie des fichiers ---"
foreach ($filename in $files.Keys) {
    $src  = Join-Path $SourceDir $filename
    $dest = Join-Path $ProjectDir $files[$filename]

    if (Test-Path $src) {
        Copy-Item $src $dest -Force
        Write-Host "  OK : $filename"
        $copied++
    } else {
        Write-Host "  ignore : $filename"
        $skipped++
    }
}

Write-Host ""
Write-Host "--- Resume ---"
Write-Host "  $copied fichier(s) copie(s)"
Write-Host "  $skipped ignore(s)"

Write-Host ""
$confirm = Read-Host "Lancer npm run build et deployer ? (o/n)"
if ($confirm -ne "o") {
    Write-Host "Annule."
    exit 0
}

Write-Host ""
Write-Host "--- Build ---"
Set-Location $ProjectDir
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build echoue"
    exit 1
}
Write-Host "Build reussi"

Write-Host ""
Write-Host "--- Deploiement SCP ---"
scp -r dist/* root@178.104.201.139:/var/www/guildes/dist/
if ($LASTEXITCODE -ne 0) {
    Write-Host "SCP echoue"
    exit 1
}
Write-Host "Deploye avec succes !"
Write-Host ""
