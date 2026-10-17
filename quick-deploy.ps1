#!/usr/bin/env pwsh
# Quick Deploy Script - Vercel & Railway with Login
# This script deploys both frontend and backend with interactive login

param(
  [switch]$FrontendOnly,
  [switch]$BackendOnly
)

$ErrorActionPreference = 'Stop'

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Restaurant Platform - Quick Deploy" -ForegroundColor Cyan
Write-Host "Frontend: Vercel | Backend: Railway" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendPath = Join-Path $repoRoot 'frontend'
$backendPath = Join-Path $repoRoot 'backend'

# ==================== FRONTEND DEPLOYMENT ====================
if (-not $BackendOnly) {
  Write-Host "`nFRONTEND DEPLOYMENT (Vercel)" -ForegroundColor Green
  Write-Host "========================================" -ForegroundColor Gray
  
  Push-Location $frontendPath
  try {
    Write-Host "`nBuilding frontend..." -ForegroundColor Yellow
    npm run build
    
    Write-Host "`nLogging in to Vercel..." -ForegroundColor Yellow
    npx vercel@latest login
    
    Write-Host "`nDeploying to Vercel..." -ForegroundColor Yellow
    $vercelOutput = npx vercel@latest --prod --yes
    
    $frontendUrl = ($vercelOutput | Select-String -Pattern 'https://.*\.vercel\.app' | ForEach-Object { $_.Matches.Value } | Select-Object -Last 1)
    
    if ($frontendUrl) {
      Write-Host "`nFrontend deployed successfully!" -ForegroundColor Green
      Write-Host "URL: $frontendUrl`n" -ForegroundColor Cyan
    } else {
      Write-Host "`nCould not extract URL from deployment output" -ForegroundColor Yellow
    }
  }
  catch {
    Write-Host "`nFrontend deployment failed: $_" -ForegroundColor Red
  }
  finally {
    Pop-Location
  }
}

# ==================== BACKEND DEPLOYMENT ====================
if (-not $FrontendOnly) {
  Write-Host "`nBACKEND DEPLOYMENT (Railway)" -ForegroundColor Green
  Write-Host "========================================" -ForegroundColor Gray
  
  Push-Location $backendPath
  try {
    Write-Host "`nBuilding backend..." -ForegroundColor Yellow
    npm run build
    
    Write-Host "`nLogging in to Railway..." -ForegroundColor Yellow
    npx @railway/cli@latest login
    
    Write-Host "`nLinking to Railway project..." -ForegroundColor Yellow
    npx @railway/cli@latest link
    
    Write-Host "`nDeploying to Railway..." -ForegroundColor Yellow
    npx @railway/cli@latest up --detach
    
    Write-Host "`nGetting deployment URL..." -ForegroundColor Yellow
    $backendUrl = npx @railway/cli@latest domain
    
    if ($backendUrl) {
      Write-Host "`nBackend deployed successfully!" -ForegroundColor Green
      Write-Host "URL: $backendUrl`n" -ForegroundColor Cyan
    }
  }
  catch {
    Write-Host "`nBackend deployment failed: $_" -ForegroundColor Red
  }
  finally {
    Pop-Location
  }
}

Write-Host "`n======================================================" -ForegroundColor Green
Write-Host "|             Deployment Complete!                   |" -ForegroundColor Green
Write-Host "======================================================`n" -ForegroundColor Green
