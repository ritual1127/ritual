<#
  성적계산기 안드로이드 앱 릴리스 빌드: Play 업로드용 app-release.aab + 폰에 직접 깔아 보는 app-release-signed.apk

  하는 일
   1) 업로드 키(upload-key.jks)가 없으면 새로 만든다. 키 파일과 비밀번호는 잃어버리거나 깃에 올리면 안 된다(.gitignore에 있음).
   2) 한글 경로에서는 안드로이드 빌드가 거부되므로 영문 경로(기본 C:\dev\seongjeok-android)에 복사해서 빌드한다.
   3) gradlew로 AAB·APK를 만들고 AAB는 jarsigner, APK는 zipalign + apksigner로 서명한다.
   4) 결과물을 이 폴더로 가져오고, 업로드 키 SHA-256 지문으로 ..\.well-known\assetlinks.json을 만든다.

  사용법 (PowerShell, 이 폴더에서)
    .\build-release.ps1
    .\build-release.ps1 -PlayFingerprint "AB:CD:..."   # Play Console '앱 서명 키 인증서 SHA-256'까지 assetlinks에 넣을 때

  비밀번호는 실행할 때 묻는다(화면에 안 보임). 자동화할 때만 환경 변수 SEONGJEOK_KS_PASS 를 미리 넣어 둔다.
  JDK·SDK 경로는 Bubblewrap 설정(%USERPROFILE%\.bubblewrap\config.json)에서 읽는다.
#>
param(
  [string]$PlayFingerprint = '',
  [string]$WorkDir = 'C:\dev\seongjeok-android'
)
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$cfg = Get-Content (Join-Path $HOME '.bubblewrap\config.json') -Raw | ConvertFrom-Json
$jdk = $cfg.jdkPath
$sdk = $cfg.androidSdkPath
$bt = Get-ChildItem (Join-Path $sdk 'build-tools') -Directory | Sort-Object { [version]($_.Name -replace '[^0-9.]', '') } | Select-Object -Last 1
$twa = Get-Content (Join-Path $here 'twa-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$ks = Join-Path $here 'upload-key.jks'
$alias = 'upload'

# 자바 도구들은 안내 문구도 오류 출력으로 내보낸다. PowerShell 5.1이 그걸 실패로 보지 않게, 성공 여부는 종료 코드로만 판단한다.
function Run([string]$exe, [string[]]$arguments) {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & $exe @arguments 2>&1 | ForEach-Object { "$_" } } finally { $ErrorActionPreference = $prev }
  if ($LASTEXITCODE -ne 0) { throw "실패: $exe (종료 코드 $LASTEXITCODE)" }
}

Write-Host "패키지: $($twa.packageId)  버전: $($twa.appVersionName) ($($twa.appVersionCode))"
Write-Host "JDK: $jdk"
Write-Host "SDK: $sdk  (build-tools $($bt.Name))"

# 1) 비밀번호
$madeEnv = $false
if (-not $env:SEONGJEOK_KS_PASS) {
  $secure = Read-Host '업로드 키 비밀번호 (처음이면 새로 정할 비밀번호, 6자 이상)' -AsSecureString
  $env:SEONGJEOK_KS_PASS = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
  $madeEnv = $true
}
try {
  # 2) 업로드 키
  if (-not (Test-Path $ks)) {
    Write-Host '업로드 키가 없어 새로 만듭니다: upload-key.jks (꼭 다른 곳에도 백업하세요)'
    Run (Join-Path $jdk 'bin\keytool.exe') @('-genkeypair', '-v', '-keystore', $ks, '-alias', $alias, '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
      '-dname', 'CN=Seongjeok Calculator, C=KR', '-storepass:env', 'SEONGJEOK_KS_PASS', '-keypass:env', 'SEONGJEOK_KS_PASS')
  }

  # 3) 영문 경로에 복사해서 빌드
  New-Item -ItemType Directory -Force $WorkDir | Out-Null
  robocopy $here $WorkDir /MIR /XD build .gradle /XF *.aab *.apk *.idsig *.jks *.keystore local.properties /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "복사 실패 (robocopy $LASTEXITCODE)" }
  Set-Content -Path (Join-Path $WorkDir 'local.properties') -Value ('sdk.dir=' + ($sdk -replace '\\', '/')) -Encoding ASCII
  $env:JAVA_HOME = $jdk
  Push-Location $WorkDir
  try { Run '.\gradlew.bat' @('--no-daemon', 'bundleRelease', 'assembleRelease') } finally { Pop-Location }

  # 4) 서명
  $aab = Join-Path $here 'app-release.aab'
  $apk = Join-Path $here 'app-release-signed.apk'
  $aligned = Join-Path $WorkDir 'app-release-aligned.apk'
  Copy-Item (Join-Path $WorkDir 'app\build\outputs\bundle\release\app-release.aab') $aab -Force
  Run (Join-Path $jdk 'bin\jarsigner.exe') @('-keystore', $ks, '-storepass:env', 'SEONGJEOK_KS_PASS', '-sigalg', 'SHA256withRSA', '-digestalg', 'SHA-256', $aab, $alias)
  Run (Join-Path $bt.FullName 'zipalign.exe') @('-f', '-p', '4', (Join-Path $WorkDir 'app\build\outputs\apk\release\app-release-unsigned.apk'), $aligned)
  Run (Join-Path $bt.FullName 'apksigner.bat') @('sign', '--ks', $ks, '--ks-key-alias', $alias, '--ks-pass', 'env:SEONGJEOK_KS_PASS', '--out', $apk, $aligned)

  # 5) assetlinks.json (업로드 키 + Play 앱 서명 키)
  $list = Run (Join-Path $jdk 'bin\keytool.exe') @('-list', '-v', '-keystore', $ks, '-alias', $alias, '-storepass:env', 'SEONGJEOK_KS_PASS')
  $match = [regex]::Match(($list -join "`n"), 'SHA256:\s*([0-9A-F:]{95})')
  if (-not $match.Success) { throw '업로드 키 SHA-256 지문을 읽지 못했어요.' }
  $prints = @($match.Groups[1].Value)
  if ($PlayFingerprint) { $prints += $PlayFingerprint.Trim().ToUpper() }
  $quoted = ($prints | ForEach-Object { '"' + $_ + '"' }) -join ",`n        "
  $json = "[{`n  ""relation"": [""delegate_permission/common.handle_all_urls""],`n  ""target"": {`n    ""namespace"": ""android_app"",`n    ""package_name"": ""$($twa.packageId)"",`n    ""sha256_cert_fingerprints"": [`n        $quoted`n    ]`n  }`n}]`n"
  $wellKnown = Join-Path (Split-Path $here -Parent) '.well-known'
  New-Item -ItemType Directory -Force $wellKnown | Out-Null
  [IO.File]::WriteAllText((Join-Path $wellKnown 'assetlinks.json'), $json, (New-Object Text.UTF8Encoding $false))

  Write-Host ''
  Write-Host "완료: $aab  (Play Console에 올리는 파일)"
  Write-Host "완료: $apk  (휴대폰에 직접 깔아 보는 파일)"
  Write-Host "업로드 키 SHA-256: $($prints[0])"
  if (-not $PlayFingerprint) { Write-Host '다음: Play Console > 앱 무결성 > 앱 서명 키 인증서 SHA-256을 복사해 -PlayFingerprint 로 다시 실행하세요.' }
  Write-Host '그다음: .well-known/assetlinks.json 을 사이트에 배포해야 앱 위쪽 주소창이 사라집니다.'
} finally {
  if ($madeEnv) { Remove-Item Env:SEONGJEOK_KS_PASS -ErrorAction SilentlyContinue }
}
