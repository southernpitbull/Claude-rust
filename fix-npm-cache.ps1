# NPM Cache Fix Script for Windows
# Run this if you encounter: "EPERM: operation not permitted, rmdir"

Write-Host "AIrchitect CLI - NPM Cache & Permission Fix" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

# Check if running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if (-not $isAdmin) {
    Write-Host "WARNING: Not running as Administrator. Some operations may fail." -ForegroundColor Yellow
    Write-Host "Consider running PowerShell as Administrator for best results.`n" -ForegroundColor Yellow
}

# Step 1: Stop npm processes
Write-Host "Step 1: Stopping npm processes..." -ForegroundColor Green
Get-Process npm -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Step 2: Clear npm cache
Write-Host "Step 2: Clearing npm cache..." -ForegroundColor Green
npm cache clean --force 2>&1 | Out-Null
npm cache verify 2>&1 | Out-Null

# Step 3: Remove lock files
Write-Host "Step 3: Removing lock files..." -ForegroundColor Green
Remove-Item -Path "package-lock.json" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "yarn.lock" -Force -ErrorAction SilentlyContinue

# Step 4: Remove node_modules
Write-Host "Step 4: Removing node_modules directory..." -ForegroundColor Green
if (Test-Path "node_modules") {
    Remove-Item -Path "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
}

# Step 5: Clear temp directories
Write-Host "Step 5: Clearing temp directories..." -ForegroundColor Green
$tempDirs = @(
    "$env:USERPROFILE\AppData\Local\npm-cache",
    "$env:USERPROFILE\AppData\Local\npm",
    "$env:USERPROFILE\AppData\Roaming\npm-cache"
)

foreach ($dir in $tempDirs) {
    if (Test-Path $dir) {
        try {
            Remove-Item -Path $dir -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "  Cleared: $dir"
        }
        catch {
            Write-Host "  Failed to clear: $dir (may require reboot)" -ForegroundColor Yellow
        }
    }
}

# Step 6: Reinstall dependencies
Write-Host "Step 6: Reinstalling dependencies..." -ForegroundColor Green
npm install --legacy-peer-deps 2>&1 | Select-String -Pattern "added|removed|changed"

# Step 7: Verify installation
Write-Host "`nStep 7: Verifying installation..." -ForegroundColor Green
npm list --depth=0 2>&1 | Head -20

Write-Host "`nFix complete! " -ForegroundColor Green
Write-Host "If you still experience issues:" -ForegroundColor Yellow
Write-Host "  1. Restart your computer" -ForegroundColor White
Write-Host "  2. Run this script again as Administrator" -ForegroundColor White
Write-Host "  3. Check antivirus is not locking files" -ForegroundColor White
