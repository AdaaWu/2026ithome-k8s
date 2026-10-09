# 00 架構規格：K8s 雲之島冒險

本專案採 **SDD → BDD → TDD** 三層開發流程：

```
① specs/ 規格
  ↓
② features/ 行為情境
  ↓
③ tests/ 單元測試
  ↓
④ src/ 實作
```

① `specs/*.md`：SDD（Spec-Driven Development，規格驅動開發），先寫「要做什麼、規則是什麼」
② `features/*.feature`：BDD（Behavior-Driven Development，行為驅動開發），用 Gherkin 的 Given／When／Then 描述玩家視角的行為
③ `tests/unit/**`：TDD（Test-Driven Development，測試驅動開發），先寫失敗的測試再寫實作
④ `src/**`：讓上面全部變綠燈的程式碼

## 分層

依賴方向只能由外往內：`presentation → application → domain`。`infrastructure` 放跟瀏覽器打交道的東西（localStorage 存檔、WebAudio 音效），由 application 呼叫存檔、presentation 呼叫音效；domain 不碰瀏覽器。

```
src/
  domain/           純 TypeScript 規則，不 import Vue、不碰瀏覽器
    character.ts      圖鑑角色型別與答題判斷
    level.ts          每日關卡型別、六幕定義
    progress.ts       存檔資料型別與純函式狀態轉換
    achievement.ts    稱號計算（含「K8s 雲之島統治大王」）
  data/             內容資料（企劃產出）
    characters.ts     圖鑑角色清單
    levels.ts         Day 1–30 關卡資料
  infrastructure/   外部世界轉接
    progressStorage.ts  localStorage 存檔
    sfx.ts              WebAudio 合成音效
  application/      用例層，把 domain 規則包成 Vue 可用的狀態
    useGame.ts        全域遊戲狀態與動作
  presentation/     畫面
    styles/           設計 token 與全域樣式
    components/
      characters/     角色 SVG 元件（美術產出，每日小遊戲共用）
      ui/             通用 UI（按鈕、彈窗、彩紙特效）
    games/
      kit/            小遊戲共用積木
      days/           DayNNGame.vue，每天一個小遊戲
    views/            路由頁面
  router/
```

## 每日小遊戲契約

- 檔案：`src/presentation/games/days/DayNNGame.vue`（NN 兩位數，如 `Day03Game.vue`）
- 由 `import.meta.glob` 自動註冊，不需要改任何共用檔
- Props：無必要 props，可用 `useGame()` 讀暱稱
- Emits：`complete`，玩家過關時發出一次
- 沒有對應檔案的 Day 會退回 `FallbackGame.vue`（點遍今日角色即過關）
- 只能使用 `components/characters` 的角色元件與 `games/kit` 的積木，不自己畫新角色
- 手機優先：可玩區寬度以 360px 為基準，互動一律用 tap，不依賴 hover 與拖曳
- 外框一律包 `GameShell`（`import { GameShell } from '../kit'`），Day 元件自己持有 `status`，從 `'intro'` 開始
- `GameShell` 的 intro 只是「準備好了嗎？」覆蓋層：收到 `start` 才把 `status` 設為 `'playing'` 並啟動計時；劇情開場與過關頁由 `DayView` 負責
- 過關時把 `status` 設為 `'won'`，GameShell 顯示 `aha` 與彩紙；玩家按「收下這一課」觸發 `finish`，Day 元件此時才 `emit('complete')`，並以旗標確保只發一次
- 失敗時把 `status` 設為 `'lost'`，收到 `retry` 就地重置狀態回 `'playing'`，不重新掛載元件
- 延遲回呼一律用 kit 的 `useTimeouts`，retry 時先 `clearAll()`，回呼開頭確認仍是 `'playing'`
- 範本：`games/days/Day03Game.vue`

## 路由

- `/` 起始畫面：輸入暱稱
- `/map` 島嶼目錄：Day 1–30 + Day 31 圖鑑
- `/day/:n` 每日關卡
- `/codex` 角色圖鑑（Day 31）
- `/ruler` 統治大王證書

使用 hash history，方便部署到任何靜態主機。
