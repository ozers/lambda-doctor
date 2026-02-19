# Lambda Doctor — Implementation Guide

Bu projenin scaffold'u hazır. Aşağıdaki sırayla implement et.

## Implementation Order

### 1. `src/analyzers/bundle-size.ts`
- `fast-glob` ile `node_modules/` altındaki tüm dosyaları tara
- @scoped paketleri doğru grupla (`@aws-sdk/client-dynamodb` → `@aws-sdk/client-dynamodb`)
- `fs.stat` ile dosya boyutlarını topla
- Top 10 en büyük dependency'yi raporla
- Thresholds: >50MB critical, >10MB warning, single dep >5MB critical, >1MB warning

### 2. `src/analyzers/heavy-dependencies.ts`
- `package.json` oku, `dependencies` ve `devDependencies` ayrıştır
- Her dependency'yi `known-heavy-packages.ts` ile karşılaştır
- typescript, ts-node gibi dev tool'ların `dependencies`'de olmasını critical olarak flag'le
- Match olan her paket için alternative ve estimatedSavingsMs değerlerini diagnostic'e ekle

### 3. `src/analyzers/import-analysis.ts`
- `fast-glob` ile `.ts`, `.js`, `.mjs` dosyalarını bul (node_modules hariç)
- Regex ile import/require pattern'lerini çıkar:
  - ESM: `/^import\s+.*\s+from\s+['"](.+)['"]/gm`
  - CJS: `/^(?:const|let|var)\s+.*=\s*require\(['"](.+)['"]\)/gm`
- Top-level vs function-body tespiti: satır indentation'ı 0-1 ise top-level
- Heavy paket top-level import'ını flag'le
- `import * as` pattern'ini flag'le (tree-shaking engelliyor)

### 4. `src/analyzers/aws-sdk.ts`
- package.json'da `aws-sdk` (v2) varsa → critical
- `@aws-sdk/client-*` varsa → good, count et
- İkisi birden varsa → warning (incomplete migration)
- 5'ten fazla @aws-sdk client → info (çok fazla client)
- Source'da `@aws-sdk/client-sso` import'u → warning (Lambda'da gereksiz)

### 5. `src/analyzers/bundler-detection.ts`
- package.json devDependencies'de bundler var mı: esbuild, webpack, rollup, tsup, parcel
- Config dosyaları var mı: webpack.config.*, rollup.config.*, tsup.config.*, esbuild.config.*
- package.json scripts'te bundler keyword'leri var mı
- serverless.yml'de serverless-esbuild veya serverless-webpack var mı
- `"type": "module"` set mi (ESM check)
- Hiç bundler yoksa → critical (en büyük iyileştirme fırsatı)

### 6. `src/reporters/console.ts`
- chalk ile renkli output
- Severity icon mapping: critical=🔴, warning=⚠️, info=💡
- Bundle size breakdown (top dependencies tablosu)
- Diagnostics severity'ye göre sıralı
- Footer'da toplam estimated improvement

### 7. `src/bin/cli.ts`
- ora spinner göster analiz sırasında
- Error handling: path yoksa, package.json yoksa anlamlı hata mesajı
- JSON output formatı desteği
- Critical issue varsa exit code 1

## Quality Standards

- Her analyzer kendi AnalyzerResult'unu döner
- Tüm file I/O async olmalı (fs/promises)
- Her diagnostic'te mutlaka: title, description, recommendation, estimatedImpactMs
- Hiçbir analyzer crash etmemeli — hata durumunda boş result dön, console'a warning bas
- Test fixtures'daki unhealthy-lambda'da en az 8 issue bulunmalı
- Test fixtures'daki healthy-lambda'da 0 critical issue bulunmalı

## Run & Verify

```bash
npm install
npm run build
npm test

# Manual test with fixtures
node dist/bin/cli.js analyze test/fixtures/unhealthy-lambda
node dist/bin/cli.js analyze test/fixtures/healthy-lambda
node dist/bin/cli.js analyze test/fixtures/unhealthy-lambda --format json
```
