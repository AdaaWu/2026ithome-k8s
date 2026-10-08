# K8s 雲之島冒險

「不囉唆圖解 K8s」的互動遊戲網站：30 天關卡 + Day 31 角色圖鑑，全部破完並答對圖鑑，就能成為 **K8s 雲之島統治大王**。

## 啟動

```bash
bun install
bun run dev        # 開發模式，手機可用同網段 IP 連線
bun run test       # 單元測試 + BDD 情境
bun run test:e2e   # Playwright 手機視窗端對端測試
bun run build      # 產出靜態網站到 dist/
```

## 開發流程

```
① specs/
  ↓
② features/
  ↓
③ tests/
  ↓
④ src/
```

① SDD：先在 `specs/` 寫規格
② BDD：在 `features/` 用 Gherkin 寫玩家行為情境，`tests/bdd/` 綁定步驟
③ TDD：在 `tests/unit/` 先寫失敗的測試
④ 實作到全部綠燈

分層與檔案位置見 [`specs/00-architecture.md`](specs/00-architecture.md)。

## 新增一天的小遊戲

① 在 `specs/03-day-games.md` 寫好玩法
② 新增 `src/presentation/games/days/DayNNGame.vue`，過關時 `emit('complete')`
③ 新增 `tests/unit/games/DayNNGame.test.ts`

不用改任何註冊檔，`import.meta.glob` 會自動接上。
