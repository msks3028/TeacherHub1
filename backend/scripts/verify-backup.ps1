param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string] $BackupDirectory
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path -LiteralPath $BackupDirectory).Path
$checksumsPath = Join-Path $root "SHA256SUMS.txt"
if (-not (Test-Path -LiteralPath $checksumsPath -PathType Leaf)) { throw "SHA256SUMS.txt not found." }

$expectedFiles = @{}
foreach ($line in Get-Content -LiteralPath $checksumsPath) {
  if ($line -notmatch '^([0-9A-Fa-f]{64})\s{2}([A-Za-z0-9._-]+)$') { throw "Invalid checksum manifest entry." }
  $name = $Matches[2]
  if ($name -notin @("database.dump", "manifest.json", "uploads.tar.gz") -or $expectedFiles.ContainsKey($name)) { throw "Unexpected or duplicate file in checksum manifest." }
  $expectedFiles[$name] = $Matches[1].ToLowerInvariant()
}
if (-not $expectedFiles.ContainsKey("database.dump") -or -not $expectedFiles.ContainsKey("manifest.json")) { throw "The checksum manifest must include database.dump and manifest.json." }

foreach ($name in $expectedFiles.Keys) {
  $path = Join-Path $root $name
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Backup file is missing: $name" }
  $actual = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $expectedFiles[$name]) { throw "Checksum mismatch: $name" }
}

$manifest = Get-Content -LiteralPath (Join-Path $root "manifest.json") -Raw | ConvertFrom-Json
if ($manifest.databaseDump -ne "database.dump" -or -not $manifest.databaseVerified) { throw "Backup manifest is incomplete or does not identify a verified database dump." }
if (($manifest.storageMode -eq "local") -ne ($expectedFiles.ContainsKey("uploads.tar.gz"))) { throw "Storage archive does not match the backup manifest." }

$pgRestore = Get-Command pg_restore -ErrorAction SilentlyContinue
if (-not $pgRestore) { throw "PostgreSQL client tool pg_restore is required." }
& $pgRestore.Source --list (Join-Path $root "database.dump") | Out-Null
if ($LASTEXITCODE -ne 0) { throw "pg_restore could not read the database archive." }

if ($expectedFiles.ContainsKey("uploads.tar.gz")) {
  $tar = Get-Command tar.exe -ErrorAction SilentlyContinue
  if (-not $tar) { throw "tar.exe is required to verify the uploads archive." }
  & $tar.Source -tzf (Join-Path $root "uploads.tar.gz") | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "The uploads archive could not be read." }
}

Write-Output "Backup checksums and archive structure verified."
