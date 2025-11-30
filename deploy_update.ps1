param (
    [string]$Message = "Update project"
)

$ErrorActionPreference = "Stop"

Write-Host "--- Starting Deployment Process ---" -ForegroundColor Cyan

# 1. Git Push Source
Write-Host "Git Push Source: Committing and pushing source code to 'main'..." -ForegroundColor Yellow
git add .
# Check if there are changes to commit
if ($(git status --porcelain)) {
    git commit -m "$Message"
    Write-Host "   - Changes committed." -ForegroundColor Gray
} else {
    Write-Host "   - No changes to commit." -ForegroundColor Gray
}

git push origin main

if ($?) {
    Write-Host "--- Source code pushed successfully." -ForegroundColor Green
} else {
    Write-Host "[Error] Git push failed." -ForegroundColor Red
    exit 1
}

# 2. Build & Deploy to GH-Pages (Manual Trigger)
# This runs locally to ensure the gh-pages branch is updated immediately,
# acting as a robust fallback/alternative to waiting for GitHub Actions.
Write-Host "Build & Deploy to GH-Pages: Building and deploying to GitHub Pages..." -ForegroundColor Yellow

try {
    # Ensure dependencies are installed (optional, but safe)
    if (-not (Test-Path "node_modules")) {
        Write-Host "   - Installing dependencies..." -ForegroundColor Gray
        npm ci
    }

    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Build failed" }
    
    npm run deploy
    if ($LASTEXITCODE -ne 0) { throw "Deploy failed" }

    Write-Host "--- Site deployed successfully!" -ForegroundColor Green
    Write-Host "   - Live URL: https://dmediontherise.github.io/medi-knockout/" -ForegroundColor Cyan
} catch {
    Write-Host "[Error] Deployment failed: " -ForegroundColor Red
    exit 1
}
