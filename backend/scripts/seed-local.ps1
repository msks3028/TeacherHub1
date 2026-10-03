$ErrorActionPreference = "Stop"
$dbPtr = [IntPtr]::Zero
$teacherPtr = [IntPtr]::Zero
$exitCode = 1

try {
    $dbSecure = Read-Host "Password for teacherhub_local_app (local teacherhub)" -AsSecureString
    $teacherSecure = Read-Host "New teacher password (at least 10 characters)" -AsSecureString
    if (-not $dbSecure -or $dbSecure.Length -eq 0) {
        throw "A local database password is required."
    }
    if (-not $teacherSecure -or $teacherSecure.Length -lt 10) {
        throw "The teacher password must be at least 10 characters."
    }

    $email = Read-Host "Teacher email [teacher@teacherhub.local]"
    if ([string]::IsNullOrWhiteSpace($email)) { $email = "teacher@teacherhub.local" }
    $name = Read-Host "Teacher name [Teacher]"
    if ([string]::IsNullOrWhiteSpace($name)) { $name = "Teacher" }

    $dbPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbSecure)
    $teacherPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($teacherSecure)
    $dbPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($dbPtr)
    $teacherPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($teacherPtr)
    $dbEncoded = [uri]::EscapeDataString($dbPlain)

    $env:DATABASE_URL = "postgresql://teacherhub_local_app:$dbEncoded@localhost:5432/teacherhub?schema=public"
    $env:SEED_TEACHER_EMAIL = $email
    $env:SEED_TEACHER_NAME = $name
    $env:SEED_TEACHER_PASSWORD = $teacherPlain

    Write-Host "Seeding only the local teacher account and default platform settings."
    & node prisma/seed.js
    $exitCode = $LASTEXITCODE
}
catch {
    Write-Error $_
    $exitCode = 1
}
finally {
    if ($dbPtr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($dbPtr)
    }
    if ($teacherPtr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($teacherPtr)
    }
    $dbPlain = $null
    $teacherPlain = $null
    $dbEncoded = $null
    $dbSecure = $null
    $teacherSecure = $null
    $email = $null
    $name = $null
    Remove-Item Env:\DATABASE_URL,Env:\SEED_TEACHER_EMAIL,Env:\SEED_TEACHER_NAME,Env:\SEED_TEACHER_PASSWORD -ErrorAction SilentlyContinue
}

exit $exitCode
