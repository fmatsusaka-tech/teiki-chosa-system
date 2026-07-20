param(
  [switch]$CheckOnly,
  [ValidateRange(1, 65535)]
  [int]$Port = 3002
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonPath = Join-Path $projectRoot ".venv-paddleocr\Scripts\python.exe"
$sidecarDirectory = Join-Path $projectRoot "sidecars\paddleocr"
$nodeModulesPath = Join-Path $projectRoot "node_modules"

if (-not (Test-Path -LiteralPath $pythonPath)) {
  throw "PaddleOCR environment is missing. Follow docs/ocr-provider-settings.md to create .venv-paddleocr."
}

if (-not (Test-Path -LiteralPath $nodeModulesPath)) {
  throw "Node.js dependencies are missing. Run npm install first."
}

if ($CheckOnly) {
  Write-Host "Local startup dependencies are ready."
  exit 0
}

$sidecar = Start-Process `
  -FilePath $pythonPath `
  -ArgumentList @("-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", "8765") `
  -WorkingDirectory $sidecarDirectory `
  -WindowStyle Hidden `
  -PassThru

try {
  $available = $false
  for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
    try {
      $health = Invoke-RestMethod -Uri "http://127.0.0.1:8765/health" -TimeoutSec 2
      if ($health.status -eq "ok") {
        $available = $true
        break
      }
    } catch {
      Start-Sleep -Seconds 1
    }
  }

  if (-not $available) {
    throw "PaddleOCR sidecar did not become ready."
  }

  Write-Host "Opening the app at http://localhost:$Port/"
  & npm.cmd run dev -- -p $Port
} finally {
  if (-not $sidecar.HasExited) {
    Stop-Process -Id $sidecar.Id
  }
}
