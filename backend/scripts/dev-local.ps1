$ErrorActionPreference = "Stop"
$ptr = [IntPtr]::Zero
$exitCode = 1

try {
    $secure = Read-Host "Password for teacherhub_local_app (local teacherhub)" -AsSecureString
    if (-not $secure -or $secure.Length -eq 0) {
        throw "A database password is required to start the local development server."
    }

    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    $encoded = [uri]::EscapeDataString($plain)
    $env:DATABASE_URL = "postgresql://teacherhub_local_app:$encoded@localhost:5432/teacherhub?schema=public"
    $env:PORT = "5000"

    Write-Host "Using local database teacherhub on localhost:5432"
    & npm run dev:watch
    $exitCode = $LASTEXITCODE
}
catch {
    Write-Error $_
    $exitCode = 1
}
finally {
    if ($ptr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
    $plain = $null
    $encoded = $null
    $secure = $null
    Remove-Item Env:\DATABASE_URL,Env:\PORT -ErrorAction SilentlyContinue
}

exit $exitCode
