# 觀象／易經研究工具

## 內容資料管線

384 筆爻資料位於 `src/data/iching/line-records.json`，目前為來源初稿，全部標示為 `待校訂`。

從 UTF-8 文字抽取稿重新產生資料：

```bash
npm run content:import -- --input /path/to/hexagrams.txt --input-label "DOCX 文字抽取稿" --output src/data/iching/line-records.json
```

驗證資料完整性：

```bash
npm run content:validate
```

比對 DOCX／PDF 文字抽取稿：

```bash
npm run content:compare -- --docx /path/to/hexagrams-docx.txt --pdf /path/to/hexagrams-pdf.txt
```

`npm run build` 會自動先執行內容驗證。來源重新匯入時會自動套用 `src/data/iching/line-overrides.json`，以保留已確認的人工修訂；這個覆寫檔不取代來源初稿。

E2E 預設使用 macOS 的系統 Chrome；其他環境請設定 `E2E_CHROME_PATH`。

網站中的「資料校訂」頁可分別編輯逐爻的爻辭與小象，並設定校訂狀態與備註。草稿保存在瀏覽器 `localStorage`，可匯出 `iching-line-review-draft.json`，不會直接改寫來源資料。

完成人工確認後，將匯出的草稿合併成新的資料檔（預設不覆蓋來源檔）：

```bash
npm run content:apply-review -- \
  --draft /path/to/iching-line-review-draft.json \
  --output src/data/iching/line-records.reviewed.json
npm run content:validate -- src/data/iching/line-records.reviewed.json
```

確認 diff 無誤後，才由人工決定是否將 `line-records.reviewed.json` 替換為正式資料檔。這個步驟才算完成最後校正；單純把 JSON 存在某個位置，不會自動成為網站正式資料。

## 開發指令

```bash
npm run dev
npm test
npm run test:e2e
npm run lint
npm run build
```

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
