# CLAUDE.md

接手開發前先讀進度檔：@docs/PROGRESS.md

## 開發規則

- 用繁體中文回覆使用者。
- 實作前先用一兩句話說明理解與假設。
- 零相依：不加套件與建置步驟，不要求安裝軟體。需能用 `file://` 開啟，所以用傳統 `<script>`，不用 ES modules。
- 模擬層 `js/sim/` 不依賴 DOM、不含顯示文字；錯誤回傳代碼。
- 玩家看得到的文字同時加進 `js/i18n/zh-TW.js` 與 `js/i18n/en.js`。
- 數值放 `js/data.js`；世界與螢幕座標轉換只放 `js/view/camera.js`。
- AI 只透過 `RTS.commands.issue` 操作遊戲。
- 檔案職責單一，建議低於 400 行。新增 script 時更新 `index.html` 與兩版 README 的檔案結構。
- 資源路徑一律相對路徑且大小寫相符（線上版放在子路徑下）。

## 驗證

```
node tests/run-tests.js
```

開發中用 `node tests/run-tests.js --quick`；改到 `js/ai/`、`js/sim/`、`js/data.js` 以及 commit 前跑完整版。
超過約 1.5 秒的測試用 `slowTest` 登記。

每項功能附測試，改到介面要在瀏覽器兩種語言實際操作並確認 console 無錯誤。

## Git

- 通過驗證的改動可以直接 commit，不需另外詢問。
- commit 訊息用英文，寫做了什麼與原因；不加任何 AI 署名。
- 已定案規格內的實作細節與數值可自行決定並回報；新增或改變玩法、操作方式、批次順序要先問。
- `git add` 列出具體檔案。
- **push 前要使用者明確同意**：push 到 `main` 會直接更新線上版。
- 本 repo 是公開的，不提交本機路徑、個資、token。

## 進度維護

每批功能完成或使用者定案新設計時，更新 `docs/PROGRESS.md`（狀態表、決定事項、尚未驗證），
並與功能一起提交。
