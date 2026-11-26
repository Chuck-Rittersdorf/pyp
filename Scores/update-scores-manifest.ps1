$ErrorActionPreference = 'Stop'

$scoresDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$manifestPath = Join-Path $scoresDir 'scores-manifest.js'

$allowedExts = @('.mxl', '.xml', '.musicxml', '.mid', '.midi')
$manifestList = New-Object System.Collections.Generic.List[hashtable]

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  PYP - Updating Scores Catalog (scores-manifest.js)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Scanning folder: $scoresDir"
Write-Host ""

# 1. Root files in Scores/
foreach ($f in Get-ChildItem -LiteralPath $scoresDir -File | Sort-Object Name) {
    if ($allowedExts -contains $f.Extension.ToLowerInvariant()) {
        $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
        $b64 = [Convert]::ToBase64String($bytes)
        $ext = $f.Extension.TrimStart('.').ToLowerInvariant()
        $manifestList.Add(@{
            fileName = $f.Name
            folder   = ''
            path     = "Scores/$($f.Name)"
            format   = $ext
            base64   = $b64
        })
        Write-Host "  [Root]      $($f.Name)" -ForegroundColor Green
    }
}

# 2. Subfolder files in Scores/<Subfolder>/
foreach ($subDir in Get-ChildItem -LiteralPath $scoresDir -Directory | Sort-Object Name) {
    foreach ($f in Get-ChildItem -LiteralPath $subDir.FullName -File | Sort-Object Name) {
        if ($allowedExts -contains $f.Extension.ToLowerInvariant()) {
            $relKey = "$($subDir.Name)/$($f.Name)"
            $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
            $b64 = [Convert]::ToBase64String($bytes)
            $ext = $f.Extension.TrimStart('.').ToLowerInvariant()
            $manifestList.Add(@{
                fileName = $relKey
                folder   = $subDir.Name
                path     = "Scores/$relKey"
                format   = $ext
                base64   = $b64
            })
            Write-Host "  [$($subDir.Name)] $($f.Name)" -ForegroundColor Green
        }
    }
}

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("// Auto-generated offline score manifest for PYP (Prepare Your Part)")
[void]$sb.AppendLine("// Run update-scores.bat after renaming, adding, or removing files in Scores/")
[void]$sb.AppendLine("window.PYP_SCORES_MANIFEST = [")
foreach ($item in $manifestList) {
    $fn     = $item.fileName.Replace('\', '/').Replace('\', '\\').Replace('"', '\"')
    $folder = $item.folder.Replace('\', '/').Replace('\', '\\').Replace('"', '\"')
    $path   = $item.path.Replace('\', '/').Replace('\', '\\').Replace('"', '\"')
    $fmt    = $item.format
    $b64    = $item.base64
    [void]$sb.AppendLine("  {")
    [void]$sb.AppendLine("    `"fileName`": `"$fn`",")
    [void]$sb.AppendLine("    `"folder`": `"$folder`",")
    [void]$sb.AppendLine("    `"path`": `"$path`",")
    [void]$sb.AppendLine("    `"format`": `"$fmt`",")
    [void]$sb.AppendLine("    `"base64`": `"$b64`"")
    [void]$sb.AppendLine("  },")
}
[void]$sb.AppendLine("];")

[System.IO.File]::WriteAllText($manifestPath, $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))

Write-Host ""
Write-Host "Successfully bundled $($manifestList.Count) score(s) into:" -ForegroundColor Cyan
Write-Host "  $manifestPath"
Write-Host ""
