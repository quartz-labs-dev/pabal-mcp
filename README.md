# pabal-mcp

App Store / Play Store ASO 작업을 MCP 툴로 제공하기 위한 프로젝트입니다. 현재는 MCP 핸드셰이크 확인용 최소 `ping` 툴만 들어있으며, 이후 스토어별 클라이언트와 `aso:*` 워크플로우를 추가합니다.

## 빠른 시작 (MCP 최소 서버)

- 요구 사항: Node.js 18+.
- 설치: `npm install`
- 실행: `npm run dev:mcp`
  - MCP 클라이언트(예: Claude Desktop, MCP Inspector)에서 stdio 서버로 연결한 뒤 `ping`을 호출해 `pong` 응답이 나오면 기본 동작 확인 완료.

## 자격 증명 설정 (secrets/는 gitignore)

- `secrets/` 디렉터리 아래에 키/설정 파일을 둡니다. 레포에 커밋하지 마세요.

### Google Play Console

1. Google Cloud Console → 서비스 계정 생성 → JSON 키 다운로드 → `secrets/google-play-service-account.json` 저장.
2. Play Console → Users and permissions → 서비스 계정 이메일 초대 후 권한 부여:
   - ✅ View app information
   - ✅ Manage production releases
   - ✅ Manage store listing

### App Store Connect

1. Users and Access → Integrations → App Store Connect API → 키 생성.
2. Issuer ID, Key ID 기록. 키 파일(`.p8`)은 `secrets/app-store-key.p8`에 저장.

### 공통 설정 파일 (`secrets/aso-config.json`)

이 파일에 App Store와 Play Store 인증 정보를 설정합니다. 프로젝트는 이 파일을 읽어서 인증 정보를 사용합니다.

```json
{
  "googlePlay": {
    "serviceAccountKeyPath": "./secrets/google-play-service-account.json"
  },
  "appStore": {
    "issuerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "keyId": "XXXXXXXXXX",
    "privateKeyPath": "./secrets/app-store-key.p8"
  }
}
```

## 예정된 구조

- `packages/core`: 공통 타입/에러/설정 로더.
- `packages/app-store`: App Store Connect 클라이언트.
- `packages/play-store`: Play Developer API 클라이언트.
- `packages/use-cases`: `pull/push/prepare/create-version` 등 공통 유즈케이스.
- `servers/mcp`: MCP 서버 엔트리(`ping` 포함, 추후 ASO 툴 추가).
- `scripts/aso`: CLI 스크립트(`aso:*`)가 유즈케이스를 호출하도록 얇게 유지.

## 스토어별 구현 시 유의사항

- App Store Connect (공식 문서 기준)
  - JWT: `kid`(Key ID), `iss`(Issuer ID), `aud`는 항상 `appstoreconnect-v1`. 토큰 유효기간 최대 20분, 시간 동기화 필수.
  - 권한: 최소 `App Manager` 또는 작업에 맞는 역할이 필요. 팀/벤더 ID 정확히 사용.
  - 앱 버전 상태: `prepare`/`push` 시 `appStoreVersions` 상태(예: `PREPARE_FOR_SUBMISSION`, `READY_FOR_SALE`)에 따라 허용/차단되는 필드가 있음.
  - 로케일: 현지화 필드(`name`, `subtitle`, `description`, `releaseNotes`)는 로케일별로 관리. 누락 로케일이 있을 경우 제출 차단.
  - 미디어 자산: 스크린샷/아이콘은 디바이스 패밀리별 규격이 엄격. 업로드 전 규격 검증 필요.
  - 레이트 리밋: 429가 발생하면 `Retry-After` 준수, 지수 백오프 필요.
- Google Play Developer API (공식 문서 기준)
  - 인증: 서비스 계정 JSON(`client_email`, `private_key`) 사용. 플레이 콘솔에서 앱별 권한 부여 필수(Release Manager 이상 권장).
  - Edits 워크플로우: 대부분의 메타데이터/트랙 변경은 `edits.insert -> edits.* -> edits.commit` 순서를 따라야 함. `commit` 누락 시 변경 미반영.
  - 트랙/릴리스: `production`/`beta`/`alpha`/`internal` 트랙 이름을 정확히 사용. 단계적 출시 시 `userFraction` 관리.
  - 로케일: 스토어 리스팅 필드는 로케일 키(`en-US`, `ko-KR` 등)별로 제출. 요구 길이 제한(예: 제목 50자) 준수.
  - 앱 ID: 패키지명(`com.example.app`)으로 식별. 새 앱 생성은 콘솔에서 먼저 수행해야 API로 조작 가능.

## 다음 단계

1. 공통 `StoreClient` 인터페이스/타입 정의.
2. App Store/Play Store 클라이언트 최소 호출(인증/헬스체크) 구현.
3. MCP 툴로 `aso:pull/prepare/push/create-version/pull-release-notes/extract-app-id` 추가.
4. `scripts/aso/*.ts`가 동일 유즈케이스를 호출하도록 연결.
