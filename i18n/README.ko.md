![Cover](../public/cover.gif)

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=pabal-mcp&config=eyJjb21tYW5kIjoiYmFzaCIsImFyZ3MiOlsiL0FCU09MVVRFL1BBVEgvVE8vcGFiYWwtbWNwL3J1bi1tY3Auc2giXSwiY3dkIjoiL0FCU09MVVRFL1BBVEgvVE8vcGFiYWwtbWNwIn0%3D)

[![English docs](https://img.shields.io/badge/docs-English-blue)](../README.md)

# pabal-mcp — App Store / Play Store ASO용 MCP 서버

앱스토어/플레이스토어 메타데이터, 릴리스, ASO 동기화를 MCP 도구로 제공합니다. Claude Code, Cursor, MCP Inspector 등 MCP 클라이언트에서 stdio 서버로 실행해 바로 사용할 수 있습니다.

> [!NOTE]
> 100% 로컬에서 실행되어 자격 증명과 캐시된 ASO 데이터가 외부로 전송되지 않습니다. 스토어 API 호출도 당신의 로컬 머신에서 직접 수행합니다.

## ❌ pabal-mcp 없이

- 스토어마다 클릭하며 업데이트
- 로캘·릴리스 노트 복붙 오류
- 프로젝트마다 반복 설정

## ✅ pabal-mcp와 함께

- 두 스토어 ASO 풀/푸시를 한 서버에서 처리
- 릴리스 노트 업데이트·버전 체크를 AI 클라이언트 안에서 수행
- 로컬 캐시/설정 기반의 재사용 가능한 워크플로

## 🛠️ 빠른 시작

1. Node.js 18+ 필요
2. 의존성 설치: `yarn install`
3. `secrets/`(gitignore) 아래 자격 증명 추가
   - App Store Connect: `secrets/app-store-key.p8` 저장, Issuer ID/Key ID 기록
   - Google Play Console: `secrets/google-play-service-account.json` 저장, 스토어 접근 권한 확인
4. `secrets/aso-config.json` 생성:

```json
{
  "dataDir": "/path/to/data/directory",
  "appStore": {
    "issuerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "keyId": "XXXXXXXXXX",
    "privateKeyPath": "./secrets/app-store-key.p8"
  },
  "googlePlay": {
    "serviceAccountKeyPath": "./secrets/google-play-service-account.json"
  }
}
```

데이터 디렉터리 기본값은 프로젝트 루트입니다. `secrets/aso-config.json`의 `dataDir`(절대/상대 경로)로 변경할 수 있습니다.

## 🛠️ 설치

### 요구 사항

- Node.js 18 이상
- MCP 클라이언트: Cursor, Claude Code, VS Code, Windsurf
- App Store / Google Play 자격 증명 + `secrets/aso-config.json`

> [!TIP]
> ASO/스토어 작업을 자주 한다면 MCP 규칙에 “항상 pabal-mcp 사용” 같은 자동 호출 규칙을 추가하세요.

> [!IMPORTANT]
> `/ABSOLUTE/PATH/TO/pabal-mcp` 플레이스홀더를 로컬 경로로 바꾸세요 (예: `/Users/you/path/to/pabal-mcp`). 원클릭 배지도 동일하므로 클릭 후 실제 경로로 수정해야 합니다.

### Cursor

- 원클릭: [![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=pabal-mcp&config=eyJjb21tYW5kIjoiYmFzaCIsImFyZ3MiOlsiL0FCU09MVVRFL1BBVEgvVE8vcGFiYWwtbWNwL3J1bi1tY3Auc2giXSwiY3dkIjoiL0FCU09MVVRFL1BBVEgvVE8vcGFiYWwtbWNwIn0%3D)
- 수동(`~/.cursor/mcp.json` 또는 프로젝트 `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "pabal-mcp": {
      "command": "bash",
      "args": ["/ABSOLUTE/PATH/TO/pabal-mcp/run-mcp.sh"],
      "cwd": "/ABSOLUTE/PATH/TO/pabal-mcp"
    }
  }
}
```

### VS Code

`settings.json` 예시(로컬 실행):

```json
"mcp": {
  "servers": {
    "pabal-mcp": {
      "type": "stdio",
      "command": "bash",
      "args": ["/ABSOLUTE/PATH/TO/pabal-mcp/run-mcp.sh"],
      "cwd": "/ABSOLUTE/PATH/TO/pabal-mcp"
    }
  }
}
```

패키지 실행을 원하면 `command`를 `npx`, `args`를 `["-y", "pabal-mcp@latest"]`로 변경하세요.

### Claude Code

```sh
claude mcp add pabal-mcp -- bash /ABSOLUTE/PATH/TO/pabal-mcp/run-mcp.sh
claude mcp add pabal-mcp -- npx -y pabal-mcp@latest
```

### Windsurf

```json
{
  "mcpServers": {
    "pabal-mcp": {
      "command": "bash",
      "args": ["/ABSOLUTE/PATH/TO/pabal-mcp/run-mcp.sh"],
      "cwd": "/ABSOLUTE/PATH/TO/pabal-mcp"
    }
  }
}
```

다른 MCP 클라이언트도 `run-mcp.sh` 또는 `npx -y pabal-mcp@latest`를 `command`/`args`로 지정해 유사하게 설정할 수 있습니다.

## 🚀 서버 실행

- 로컬 개발: `npm run dev:mcp` (프로젝트 루트에서 stdio MCP 서버 실행)
- MCP 클라이언트에서 `run-mcp.sh`를 호출하도록 설정하면 경로가 올바르게 잡힙니다. 예시:

```json
{
  "mcpServers": {
    "pabal-mcp": {
      "command": "bash",
      "args": ["/ABSOLUTE/PATH/TO/pabal-mcp/run-mcp.sh"],
      "cwd": "/ABSOLUTE/PATH/TO/pabal-mcp"
    }
  }
}
```

데이터 저장 위치는 `secrets/aso-config.json`의 `dataDir`로 지정하세요.

## 🔧 MCP 도구

- 인증
  - `auth-check`: App Store Connect / Google Play 인증 상태 확인 (`store`: appStore | googlePlay | both)
- 앱 관리
  - `apps-init`: 스토어 API에서 앱을 가져와 자동 등록 (Google Play는 `packageName` 필요)
  - `apps-add`: bundleId/packageName(`identifier`)로 단일 앱 등록, `slug`/`store` 옵션
  - `apps-search`: 앱 검색 (`query`, 선택적 `store`)
- ASO 동기화
  - `aso-pull`: ASO 데이터를 로컬 캐시에 가져오기 (`app`/`bundleId`/`packageName`, 선택적 `store`, `dryRun`)
  - `aso-push`: 캐시된 ASO를 스토어에 반영 (동일한 타겟 옵션, 선택적 `uploadImages`, `dryRun`)
- 릴리스 관리
  - `release-check-versions`: 앱별 최신 버전 조회
  - `release-create`: 새 버전 생성 (`version`, Google Play의 `versionCodes`, 표준 타겟 옵션)
  - `release-pull-notes`: 릴리스 노트를 로컬 캐시에 가져오기 (`dryRun` 지원)
  - `release-update-notes`: 릴리스 노트/What’s New 업데이트 (`whatsNew` 맵 또는 `text`+`sourceLocale`, 표준 타겟팅)

현재 도구 목록은 `npm run tools`로 확인할 수 있습니다.

## ✅ 테스트

- 전체 테스트 실행: `npm test`
