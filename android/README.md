# 성적계산기 안드로이드 앱 (TWA)

naver1.cloud 웹사이트를 그대로 감싸는 안드로이드 앱이다. 구글 공식 방식인 Trusted Web Activity(크롬이 화면을 그림)를 쓰고, 프로젝트는 Bubblewrap 1.25로 만들었다.
웹을 고치면 앱도 바로 바뀌므로, 앱을 다시 빌드할 일은 아이콘·이름·버전·targetSdk가 바뀔 때뿐이다.

| 항목 | 값 |
|---|---|
| 패키지 이름 | `io.github.ritual1127.seongjeok` (Play에 한 번 올리면 못 바꿈) |
| 앱 이름(아이콘 아래) | 성적계산기 |
| 시작 주소 | https://naver1.cloud/ |
| targetSdk / compileSdk | 36 (2026-08-31부터 신규 앱 필수 기준) |
| 알림 | 켜짐(웹 푸시를 안드로이드 알림으로 넘김, 급식 알림용) |
| 바로가기(아이콘 길게 누르기) | 목표점수 · 내신등급 · 학점 · 급식 |

## 파일

| 파일 | 설명 |
|---|---|
| `twa-manifest.json` | 앱 설정 원본. 이걸 고친 뒤 `bubblewrap update`로 프로젝트를 다시 만든다 |
| `build-release.ps1` | 업로드 키 만들기 → 빌드 → 서명 → assetlinks.json 생성까지 한 번에 |
| `app/`, `build.gradle`, `gradlew*`, `settings.gradle` | Bubblewrap이 만든 안드로이드 프로젝트 |
| `upload-key.jks` | (처음 빌드할 때 생김) 업로드 서명 키. **깃에 안 올라감. 따로 백업 필수** |
| `app-release.aab` | (빌드 결과) Play Console에 올리는 파일 |
| `app-release-signed.apk` | (빌드 결과) 휴대폰에 직접 깔아 보는 파일 |

## 빌드

PowerShell에서:

```powershell
cd android
.\build-release.ps1
```

- 처음이면 업로드 키를 새로 만든다. 비밀번호는 비밀번호 관리자에 저장하고, `upload-key.jks`는 USB·클라우드 비공개 폴더 등 다른 곳에도 백업한다.
- 업로드 키를 잃어버려도 Play Console에서 재설정을 요청할 수 있지만(Play 앱 서명 사용 시) 며칠 걸린다.
- 끝나면 `../.well-known/assetlinks.json`이 생긴다. Play Console의 앱 서명 키 지문을 받은 뒤에는 이렇게 한 번 더 돌린다:

```powershell
.\build-release.ps1 -PlayFingerprint "Play Console > 테스트 및 출시 > 설정 > 앱 무결성 > 앱 서명 키 인증서 SHA-256"
```

그다음 사이트를 배포해야 앱 위쪽 주소창이 사라진다(아래 '주소창이 보여요' 참고).

### 이 PC에서 `bubblewrap build`가 안 되는 이유와 이 스크립트가 피하는 방법

1. **한글 경로**: 안드로이드 빌드 도구는 경로에 한글이 있으면 멈춘다(`프로젝트`, `성적계산기`). 스크립트는 `C:\dev\seongjeok-android`로 복사해서 빌드한다.
2. **SDK 경로 검사**: Bubblewrap은 SDK 폴더에 `tools`나 `bin`이 있어야 통과시키는데, 안드로이드 스튜디오로 설치한 SDK에는 없다. 스크립트는 Bubblewrap 대신 gradlew + jarsigner + apksigner로 직접 빌드·서명한다(Bubblewrap이 안에서 하는 것과 같음).
3. **local.properties**: `sdk.dir`에 역슬래시를 쓰면 경로가 깨진다. 스크립트는 슬래시(`/`)로 쓴다.

## 버전 올리기(업데이트 낼 때)

`twa-manifest.json`의 `appVersionCode`를 1씩 올리고(`appVersionName`도 1.0.1처럼), 프로젝트를 다시 만든 뒤 빌드한다.

```powershell
bubblewrap update --skipVersionUpgrade --manifest ./twa-manifest.json   # 아이콘·이름·바로가기를 사이트에서 다시 받아 프로젝트 갱신
.\build-release.ps1
```

`bubblewrap update`도 한글 경로에서 실행해도 된다(빌드만 안 됨). 단, 사이트에 아이콘이 배포되어 있어야 한다.

## 주소창이 보여요(크롬 맞춤 탭으로 열림)

앱이 사이트 주인인지 확인(Digital Asset Links)에 실패한 것이다.

1. `https://naver1.cloud/.well-known/assetlinks.json`이 열리는지 확인(`_config.yml`의 `include: .well-known`이 이걸 위해 있다).
2. 파일의 `sha256_cert_fingerprints`에 **Play 앱 서명 키** 지문이 있는지 확인. Play에서 받은 앱은 구글 키로 다시 서명되므로 업로드 키 지문만으로는 안 된다.
3. 확인 도구: https://developers.google.com/digital-asset-links/tools/generator
4. 폰에서 앱 데이터를 지우거나 다시 설치하면 재확인한다.

## 해마다 할 일

구글은 매년 8월 말쯤 '목표 API 수준'을 올린다(2027년에는 Android 17 예상). 그때 Bubblewrap을 최신으로 올리고(`npm i -g @bubblewrap/cli`) `bubblewrap update` → 빌드 → 업로드한다.
