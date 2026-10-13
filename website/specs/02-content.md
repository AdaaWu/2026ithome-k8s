# 02 內容資料規格

內容資料由企劃產出，放在 `src/data/`，型別以 `src/domain/character.ts` 與 `src/domain/level.ts` 為準。

## 資料來源

- 文章：專案根目錄 `day-01.md` ~ `day-30.md`
- 角色表：`k8s-series-spec.md` 第 5 節
- 主圖：`public/art/day-NN-01.webp`
- 角色名與文章衝突時，**以文章實際用法為準**

## 角色（`characters.ts`）

- id 為固定 37 個，美術元件共用同一份 id，不可增刪改
- `name`：文章裡的角色名；`k8sName`：英文正式名；`zhTerm`：有慣用中文才填
- `riddle`：30–60 字，俏皮有畫面，不可出現角色名與 K8s 名稱
- `options`：恰好 4 個不重複，格式「英文名（中文）」或只有英文名
- 干擾選項取同類、易混淆的 K8s 概念
- `answer`：逐字等於某個選項，正解位置要分散
- `description`：40–80 字，講真實 K8s 行為
- `debutDay`：正式登場日；順帶提及與預告不算（例：kube-proxy 依 Day 18「今天第一次登場」）
- 共享食物桶（`food-bucket`）：圖鑑答案為 Volume；謎題與說明註明島上這款是最簡單的 emptyDir，對齊 Day 6、21、29

## 關卡（`levels.ts`）

- Day 1–30 各一筆，依 day 遞增
- `title`：文章第一行 `# Day N：` 之後，去除多餘空白
- `intro`：2–3 句，第二人稱「你」，雲之島口吻
- `takeaway`：取自「帶走一句話」的粗體句；沒有或過長時濃縮
  - 例外：與玩法或技術正確性衝突時改寫，文章不動
  - Day 10：改講換版順序「先加新、等 Ready、再收舊」，對齊小遊戲
  - Day 21：文章寫「食盆（Volume Mount）還在」，改為「食物桶（emptyDir）還在；泡泡（Pod）被換掉就沒了」
  - Day 24：補上 Startup Probe
  - Day 29：五個動作各附 K8s 名稱
- `image`：`art/day-NN-01.webp`，不加開頭斜線
- `characters`：2–6 個，只能用已存在的角色 id，且不早於該角色 `debutDay`
- `gameTitle`、`gameHint`：暫定值，由小遊戲設計回填
- `briefing`：任務簡報六欄，內容與撰寫規則見 `08-onboarding.md` 第 1、5 節；`steps` 2–4 點，角色名用網站現用名稱

## 六幕（`domain/level.ts` 的 `ACTS`）

- `goal`：本章目標；`result`：蓋完你會有；內容見 `08-onboarding.md` 第 4 節
- 章節「會遇到」不另存，由角色 `debutDay` 落在幕的天數區間推導

## 驗證

- `tests/unit/data/content.test.ts` 檢查 id 齊全、選項與答案、Day 1–30、角色參照、主圖存在、簡報六欄非空、六幕目標非空
