param(
  [switch]$FrontendOnly,
  [switch]$BackendOnly
)

$ErrorActionPreference = 'Stop'

$frontendUrl = $null
$backendLogsUrl = $null
$backendUrl = $null

function Run-Step {
  param(
    [string]$Name,
    [scriptblock]$Action
  )

  Write-Host "`n=== $Name ===" -ForegroundColor Cyan
  & $Action
}

function Invoke-CmdCapture {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command,
    [int]$TimeoutSec = 420
  )

  $stdoutFile = [System.IO.Path]::GetTempFileName()
  $stderrFile = [System.IO.Path]::GetTempFileName()

  try {
    $process = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', $Command) -NoNewWindow -PassThru -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile

    if (-not $process.WaitForExit($TimeoutSec * 1000)) {
      try {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
      }
      catch {
        # Ignore kill errors and fail with timeout below.
      }
      throw "Command timed out after $TimeoutSec seconds: $Command"
    }

    $stdoutLines = @()
    $stderrLines = @()

    if (Test-Path $stdoutFile) {
      $stdoutLines = Get-Content -Path $stdoutFile -ErrorAction SilentlyContinue
    }
    if (Test-Path $stderrFile) {
      $stderrLines = Get-Content -Path $stderrFile -ErrorAction SilentlyContinue
    }

    $combined = @($stdoutLines + $stderrLines) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    $combined | ForEach-Object { Write-Host $_ }

    if ($process.ExitCode -ne 0) {
      throw "Command failed (exit $($process.ExitCode)): $Command"
    }

    return $combined
  }
  finally {
    if (Test-Path $stdoutFile) { Remove-Item $stdoutFile -Force -ErrorAction SilentlyContinue }
    if (Test-Path $stderrFile) { Remove-Item $stderrFile -Force -ErrorAction SilentlyContinue }
  }
}

function Invoke-HealthCheck {
  param(
    [string]$Name,
    [string]$Url
  )

  if (-not $Url) {
    Write-Host "Skipping $Name health check: no URL available" -ForegroundColor Yellow
    return
  }

  Write-Host "Checking ${Name}: $Url" -ForegroundColor DarkCyan
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -MaximumRedirection 5 -TimeoutSec 30
    Write-Host "$Name OK ($($response.StatusCode))" -ForegroundColor Green
  }
  catch {
    Write-Host "$Name health check failed: $($_.Exception.Message)" -ForegroundColor Yellow
  }
}

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendPath = Join-Path $repoRoot 'frontend'
$backendPath = Join-Path $repoRoot 'backend'

if (-not (Test-Path $frontendPath)) {
  throw "Frontend folder not found: $frontendPath"
}
if (-not (Test-Path $backendPath)) {
  throw "Backend folder not found: $backendPath"
}

if (-not $BackendOnly -and -not $env:VERCEL_TOKEN) {
  Write-Host 'Warning: VERCEL_TOKEN is not set. Vercel CLI may require interactive auth and can timeout.' -ForegroundColor Yellow
}
if (-not $FrontendOnly -and -not $env:RAILWAY_TOKEN) {
  Write-Host 'Warning: RAILWAY_TOKEN is not set. Railway CLI may require interactive auth and can timeout.' -ForegroundColor Yellow
}

if (-not $BackendOnly) {
  Run-Step -Name 'Deploy Frontend (Vercel Production)' -Action {
    Push-Location $frontendPath
    try {
      $vercelOutput = if ($env:VERCEL_TOKEN) {
        Invoke-CmdCapture "npx -y vercel@latest --prod --yes --token %VERCEL_TOKEN%"
      } else {
        Invoke-CmdCapture "npx -y vercel@latest --prod --yes"
      }

      $frontendUrl = ($vercelOutput | Select-String -Pattern 'https://[^ ]+\.vercel\.app' -AllMatches | ForEach-Object { $_.Matches.Value } | Select-Object -Last 1)
      if ($frontendUrl) {
        Write-Host "Detected frontend URL: $frontendUrl" -ForegroundColor Green
      }
    }
    finally {
      Pop-Location
    }
  }
}

if (-not $FrontendOnly) {
  Run-Step -Name 'Deploy Backend (Railway)' -Action {
    Push-Location $backendPath
    try {
      $railwayOutput = if ($env:RAILWAY_TOKEN) {
        Invoke-CmdCapture "npx -y @railway/cli@latest up --detach --ci"
      } else {
        Invoke-CmdCapture "npx -y @railway/cli@latest up --detach"
      }

      $backendLogsUrl = ($railwayOutput | Select-String -Pattern 'https://railway\.com/[^ ]+' -AllMatches | ForEach-Object { $_.Matches.Value } | Select-Object -Last 1)
      if ($backendLogsUrl) {
        Write-Host "Detected backend logs URL: $backendLogsUrl" -ForegroundColor Green
      }

      try {
        $domainOutput = Invoke-CmdCapture "npx -y @railway/cli@latest domain"
        $backendUrl = ($domainOutput | Select-String -Pattern 'https://[^ ]+' -AllMatches | ForEach-Object { $_.Matches.Value } | Select-Object -Last 1)
      }
      catch {
        $backendUrl = $null
      }
    }
    finally {
      Pop-Location
    }
  }
}

Run-Step -Name 'Post-Deploy Health Checks' -Action {
  if (-not $BackendOnly) {
    Invoke-HealthCheck -Name 'Frontend' -Url $frontendUrl
  }

  if (-not $FrontendOnly) {
    if ($backendUrl) {
      Invoke-HealthCheck -Name 'Backend' -Url $backendUrl
    } else {
      Write-Host "Backend URL auto-detection unavailable. Check logs: $backendLogsUrl" -ForegroundColor Yellow
    }
  }
}

Write-Host "`nDeployment flow complete." -ForegroundColor Green
Write-Host "Frontend target: Vercel project linked in frontend/.vercel/project.json"
Write-Host "Backend target: Railway project linked in your CLI context"
if ($frontendUrl) { Write-Host "Frontend URL: $frontendUrl" }
if ($backendUrl) { Write-Host "Backend URL: $backendUrl" }
elseif ($backendLogsUrl) { Write-Host "Backend logs: $backendLogsUrl" }
