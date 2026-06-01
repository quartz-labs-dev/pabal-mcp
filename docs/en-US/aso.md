# ASO Data Sync Tools

Tools for syncing App Store Optimization (ASO) data between local cache and stores.

## aso-pull

Fetch ASO data from App Store/Google Play and save to local cache.

### Parameters

| Parameter     | Type                                   | Required    | Default  | Description                                 |
| ------------- | -------------------------------------- | ----------- | -------- | ------------------------------------------- |
| `app`         | `string`                               | Conditional | -        | Registered app slug                         |
| `bundleId`    | `string`                               | Conditional | -        | App Store bundle ID                         |
| `packageName` | `string`                               | Conditional | -        | Google Play package name                    |
| `store`       | `"appStore" \| "googlePlay" \| "both"` | No          | `"both"` | Target store                                |
| `dryRun`      | `boolean`                              | No          | `false`  | If true, only outputs result without saving |

> **Note:** Provide either `app` (recommended) or `bundleId`/`packageName` directly.

### Usage Examples

```json
// Pull from both stores using registered app
{ "app": "myapp" }

// Pull from App Store only
{ "app": "myapp", "store": "appStore" }

// Pull using direct identifiers
{ "bundleId": "com.example.app", "packageName": "com.example.app" }

// Dry run to preview data
{ "app": "myapp", "dryRun": true }
```

### What Gets Pulled

**App Store:**

- App name, subtitle, description
- Keywords, promotional text
- Screenshots (iPhone 6.5", iPhone 6.1", iPad 13")
- All supported locales

**Google Play:**

- Title, short description, full description
- Screenshots (phone, tablet)
- Feature graphic
- All supported languages

### Data Storage

Data is saved to the `dataDir` specified in your config:

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

### Response

```
✅ ASO data pulled
   Google Play: ✓
   App Store: ✓
```

---

## aso-push

Push ASO data from local cache to App Store/Google Play.

### Parameters

| Parameter      | Type                                   | Required    | Default  | Description                                  |
| -------------- | -------------------------------------- | ----------- | -------- | -------------------------------------------- |
| `app`          | `string`                               | Conditional | -        | Registered app slug                          |
| `bundleId`     | `string`                               | Conditional | -        | App Store bundle ID                          |
| `packageName`  | `string`                               | Conditional | -        | Google Play package name                     |
| `store`        | `"appStore" \| "googlePlay" \| "both"` | No          | `"both"` | Target store                                 |
| `uploadImages` | `boolean`                              | No          | `false`  | Whether to upload images                     |
| `dryRun`       | `boolean`                              | No          | `false`  | If true, only outputs result without pushing |

### Usage Examples

```json
// Push to both stores
{ "app": "myapp" }

// Push to Google Play only
{ "app": "myapp", "store": "googlePlay" }

// Push with images
{ "app": "myapp", "uploadImages": true }

// Dry run to preview
{ "app": "myapp", "dryRun": true }
```

### Data Source

Data is read from the push directory:

```
{dataDir}/.aso/push/{slug}/
├── app-store/
│   └── data.json
└── google-play/
    └── data.json
```

### Response

```
📤 ASO Push Results:
✅ Google Play: Updated 3 locales (en-US, ko, ja)
✅ App Store: Updated 3 locales (en-US, ko, ja)
```

**Errors:**

```
📤 ASO Push Results:
❌ Google Play: Push failed: Permission denied
⏭️  Skipping App Store (not registered for App Store)
```

---

## Data Format

### App Store Data (`data.json`)

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

### Google Play Data (`data.json`)

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

## Workflow Example

1. **Pull current data:**

   ```json
   { "app": "myapp" }
   ```

2. **Edit data locally** in `{dataDir}/.aso/push/{slug}/`

3. **Preview changes:**

   ```json
   { "app": "myapp", "dryRun": true }
   ```

4. **Push updates:**
   ```json
   { "app": "myapp" }
   ```

## See Also

- [apps-add](./apps.md#apps-add) - Register apps before using ASO tools
- [release-update-notes](./release.md#release-update-notes) - Update release notes separately
