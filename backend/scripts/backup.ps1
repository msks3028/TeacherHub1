$ErrorActionPreference = "Stop"

if (-not $env:DATABASE_URL) { throw "DATABASE_URL must be provided through the process environment." }
$retentionDays = 30
if ($env:BACKUP_RETENTION_DAYS) {
  if (-not [int]::TryParse($env:BACKUP_RETENTION_DAYS, [ref]$retentionDays) -or $retentionDays -lt 1 -or $retentionDays -gt 3650) { throw "BACKUP_RETENTION_DAYS must be an integer from 1 to 3650." }
}

$backupRootInput = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { Join-Path $PSScriptRoot "..\..\backups" }
$backupRoot = [System.IO.Path]::GetFullPath($backupRootInput)
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
$backupRoot = (Resolve-Path -LiteralPath $backupRoot).Path
$timestamp = [DateTime]::UtcNow.ToString("yyyyMMdd-HHmmss")
$runDir = Join-Path $backupRoot "teacherhub-backup-$timestamp"
New-Item -ItemType Directory -Path $runDir | Out-Null
$currentSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
try {
  $runAcl = Get-Acl -LiteralPath $runDir
  $runAcl.SetAccessRuleProtection($true, $false)
  foreach ($existingRule in @($runAcl.Access)) { [void]$runAcl.RemoveAccessRuleSpecific($existingRule) }
  $folderRule = New-Object System.Security.AccessControl.FileSystemAccessRule($currentSid, [System.Security.AccessControl.FileSystemRights]::FullControl, ([System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit), [System.Security.AccessControl.PropagationFlags]::None, [System.Security.AccessControl.AccessControlType]::Allow)
  $runAcl.AddAccessRule($folderRule)
  Set-Acl -LiteralPath $runDir -AclObject $runAcl
} catch {
  Remove-Item -LiteralPath $runDir -Recurse -Force -ErrorAction SilentlyContinue
  throw "Could not protect the backup directory with a user-only Windows ACL."
}

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
$pgRestore = Get-Command pg_restore -ErrorAction SilentlyContinue
$tar = Get-Command tar.exe -ErrorAction SilentlyContinue
if (-not $pgDump -or -not $pgRestore) { throw "PostgreSQL client tools pg_dump and pg_restore are required." }

$databaseFile = Join-Path $runDir "database.dump"
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw "Node.js is required to safely read the Prisma PostgreSQL connection URL." }
$passFilePath = Join-Path $runDir ".pgpass"
$previousPassFile = $env:PGPASSFILE
$previousDatabaseUrl = $env:DATABASE_URL
try {
  $connectionJson = & $node.Source (Join-Path $PSScriptRoot "prepare-db-connection.js") $passFilePath
  if ($LASTEXITCODE -ne 0) { throw "Could not prepare the PostgreSQL backup connection." }
  $connection = $connectionJson | ConvertFrom-Json
  # The temporary passfile is readable only by the current Windows account.
  $acl = Get-Acl -LiteralPath $passFilePath
  $acl.SetAccessRuleProtection($true, $false)
  foreach ($existingRule in @($acl.Access)) { [void]$acl.RemoveAccessRuleSpecific($existingRule) }
  $readRule = New-Object System.Security.AccessControl.FileSystemAccessRule($currentSid, [System.Security.AccessControl.FileSystemRights]::Read, [System.Security.AccessControl.AccessControlType]::Allow)
  $acl.AddAccessRule($readRule)
  Set-Acl -LiteralPath $passFilePath -AclObject $acl
  $env:PGPASSFILE = $passFilePath
  Remove-Item Env:DATABASE_URL
  & $pgDump.Source --no-password --dbname $connection.connectionString --username $connection.username --format custom --file $databaseFile
  if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE." }
}
finally {
  $env:DATABASE_URL = $previousDatabaseUrl
  if ($null -eq $previousPassFile) { Remove-Item Env:PGPASSFILE -ErrorAction SilentlyContinue } else { $env:PGPASSFILE = $previousPassFile }
  Remove-Item -LiteralPath $passFilePath -Force -ErrorAction SilentlyContinue
}
& $pgRestore.Source --list $databaseFile | Out-Null
if ($LASTEXITCODE -ne 0) { throw "pg_restore could not read the generated dump." }

$storageMode = if ($env:STORAGE_DRIVER -eq "s3") { "remote-s3" } else { "local" }
$uploadRootInput = if ($env:UPLOAD_DIR) { $env:UPLOAD_DIR } else { Join-Path $PSScriptRoot "..\uploads" }
if ($storageMode -eq "local") {
  if (-not $tar) { throw "tar.exe is required to archive local uploads." }
  $uploadRoot = [System.IO.Path]::GetFullPath($uploadRootInput)
  if (-not (Test-Path -LiteralPath $uploadRoot -PathType Container)) { throw "Local upload directory not found: $uploadRoot" }
  $uploadRoot = (Resolve-Path -LiteralPath $uploadRoot).Path
  $storageArchive = Join-Path $runDir "uploads.tar.gz"
  & $tar.Source -czf $storageArchive -C $uploadRoot .
  if ($LASTEXITCODE -ne 0) { throw "Upload archive failed with exit code $LASTEXITCODE." }
  & $tar.Source -tzf $storageArchive | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Upload archive verification failed." }
}

$manifest = @{
  createdAtUtc = [DateTime]::UtcNow.ToString("o")
  databaseDump = "database.dump"
  databaseVerified = $true
  storageMode = $storageMode
  uploadsArchive = if ($storageMode -eq "local") { "uploads.tar.gz" } else { $null }
  remoteStorageNote = if ($storageMode -eq "remote-s3") { "Protect the configured object bucket separately with versioning and a second-region/account copy." } else { $null }
}
$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $runDir "manifest.json") -Encoding utf8
Get-ChildItem -LiteralPath $runDir -File | Where-Object Name -ne "SHA256SUMS.txt" | Get-FileHash -Algorithm SHA256 | ForEach-Object { "$($_.Hash.ToLower())  $([System.IO.Path]::GetFileName($_.Path))" } | Set-Content -LiteralPath (Join-Path $runDir "SHA256SUMS.txt") -Encoding ascii

# Retention only removes direct child directories with the script's exact name
# prefix, after resolving and confirming every target stays beneath BACKUP_DIR.
$rootPrefix = $backupRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
foreach ($candidate in Get-ChildItem -LiteralPath $backupRoot -Directory -Filter "teacherhub-backup-*") {
  $candidatePath = [System.IO.Path]::GetFullPath($candidate.FullName)
  if (-not $candidatePath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Refusing to apply retention outside BACKUP_DIR." }
  if ($candidate.Name -notmatch '^teacherhub-backup-\d{8}-\d{6}$') { continue }
  if ($candidate.LastWriteTimeUtc -lt [DateTime]::UtcNow.AddDays(-$retentionDays)) {
    Remove-Item -LiteralPath $candidatePath -Recurse -Force
  }
}

Write-Output "Backup verified: $runDir"
