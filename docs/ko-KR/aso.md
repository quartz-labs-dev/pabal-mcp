# ASO 데이터 동기화 도구

로컬 캐시와 스토어 간 ASO(App Store Optimization) 데이터를 동기화하는 도구입니다.

## aso-pull

App Store/Google Play에서 ASO 데이터를 가져와 로컬 캐시에 저장합니다.

### 파라미터

| 파라미터      | 타입                                   | 필수   | 기본값   | 설명                           |
| ------------- | -------------------------------------- | ------ | -------- | ------------------------------ |
| `app`         | `string`                               | 조건부 | -        | 등록된 앱 slug                 |
| `bundleId`    | `string`                               | 조건부 | -        | App Store 번들 ID              |
| `packageName` | `string`                               | 조건부 | -        | Google Play 패키지명           |
| `store`       | `"appStore" \| "googlePlay" \| "both"` | 아니오 | `"both"` | 대상 스토어                    |
| `dryRun`      | `boolean`                              | 아니오 | `false`  | true이면 저장 없이 결과만 출력 |

> **참고:** `app`(권장) 또는 `bundleId`/`packageName`을 직접 제공하세요.

### 사용 예시

```json
// 등록된 앱으로 모든 스토어에서 가져오기
{ "app": "myapp" }

// App Store만 가져오기
{ "app": "myapp", "store": "appStore" }

// 직접 식별자 사용
{ "bundleId": "com.example.app", "packageName": "com.example.app" }

// 데이터 미리보기
{ "app": "myapp", "dryRun": true }
```

### 가져오는 데이터

**App Store:**

- 앱 이름, 부제목, 설명
- 키워드, 프로모션 텍스트
- 스크린샷 (iPhone 6.5", iPhone 6.1", iPad 13")
- 모든 지원 언어

**Google Play:**

- 제목, 짧은 설명, 전체 설명
- 스크린샷 (휴대폰, 태블릿)
- 대표 이미지
- 모든 지원 언어

### 데이터 저장 위치

설정의 `dataDir`에 지정된 경로에 저장됩니다:

```
{dataDir}/.aso/pull/{slug}/
├── app-store/
│   ├── data.json
│   └── screenshots/{locale}/
│       ├── iphone65-1.png
│       ├── iphone65-2.png
│       └── ...
└── google-play/
    ├── data.json
    └── screenshots/{language}/
        ├── phone-1.png
        ├── phone-2.png
        └── feature-graphic.png
```

### 응답

```
✅ ASO data pulled
   Google Play: ✓
   App Store: ✓
```

---

## aso-push

로컬 캐시의 ASO 데이터를 App Store/Google Play에 반영합니다.

### 파라미터

| 파라미터       | 타입                                   | 필수   | 기본값   | 설명                           |
| -------------- | -------------------------------------- | ------ | -------- | ------------------------------ |
| `app`          | `string`                               | 조건부 | -        | 등록된 앱 slug                 |
| `bundleId`     | `string`                               | 조건부 | -        | App Store 번들 ID              |
| `packageName`  | `string`                               | 조건부 | -        | Google Play 패키지명           |
| `store`        | `"appStore" \| "googlePlay" \| "both"` | 아니오 | `"both"` | 대상 스토어                    |
| `uploadImages` | `boolean`                              | 아니오 | `false`  | 이미지 업로드 여부             |
| `dryRun`       | `boolean`                              | 아니오 | `false`  | true이면 반영 없이 결과만 출력 |

### 사용 예시

```json
// 모든 스토어에 반영
{ "app": "myapp" }

// Google Play만 반영
{ "app": "myapp", "store": "googlePlay" }

// 이미지와 함께 반영
{ "app": "myapp", "uploadImages": true }

// 미리보기
{ "app": "myapp", "dryRun": true }
```

### 데이터 소스

push 디렉토리에서 데이터를 읽습니다:

```
{dataDir}/.aso/push/{slug}/
├── app-store/
│   └── data.json
└── google-play/
    └── data.json
```

### 응답

```
📤 ASO Push Results:
✅ Google Play: Updated 3 locales (en-US, ko, ja)
✅ App Store: Updated 3 locales (en-US, ko, ja)
```

**에러:**

```
📤 ASO Push Results:
❌ Google Play: Push failed: Permission denied
⏭️  Skipping App Store (not registered for App Store)
```

---

## 데이터 형식

### App Store 데이터 (`data.json`)

```json
{
  "defaultLocale": "en-US",
  "locales": {
    "en-US": {
      "name": "My App",
      "subtitle": "Your productivity companion",
      "description": "Full app description...",
      "keywords": "productivity,task,todo",
      "promotionalText": "Now with new features!",
      "screenshots": {
        "iphone65": ["url1", "url2"],
        "iphone61": ["url1", "url2"],
        "ipad13": ["url1"]
      }
    },
    "ko": {
      "name": "마이 앱",
      "subtitle": "생산성 도우미",
      "description": "전체 앱 설명...",
      "keywords": "생산성,작업,할일",
      "promotionalText": "새로운 기능 추가!",
      "screenshots": {
        "iphone65": ["url1", "url2"]
      }
    }
  }
}
```

### Google Play 데이터 (`data.json`)

```json
{
  "defaultLocale": "en-US",
  "locales": {
    "en-US": {
      "title": "My App",
      "shortDescription": "Your productivity companion",
      "fullDescription": "Full app description...",
      "screenshots": {
        "phone": ["url1", "url2"],
        "tablet": ["url1"]
      },
      "featureGraphic": "feature-url"
    },
    "ko": {
      "title": "마이 앱",
      "shortDescription": "생산성 도우미",
      "fullDescription": "전체 앱 설명...",
      "screenshots": {
        "phone": ["url1", "url2"]
      }
    }
  }
}
```

---

## 워크플로우 예시

1. **현재 데이터 가져오기:**

   ```json
   { "app": "myapp" }
   ```

2. **로컬에서 데이터 편집** (`{dataDir}/.aso/push/{slug}/`)

3. **변경사항 미리보기:**

   ```json
   { "app": "myapp", "dryRun": true }
   ```

4. **업데이트 반영:**
   ```json
   { "app": "myapp" }
   ```

## 참고

- [apps-add](./apps.md#apps-add) - ASO 도구 사용 전 앱 등록
- [release-update-notes](./release.md#release-update-notes) - 릴리스 노트만 별도 업데이트
