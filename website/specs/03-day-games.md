# 03 每日小遊戲規格：K8s 雲之島冒險

本文件定義 Day 1–30 每日小遊戲的玩法、共用積木（kit）介面與實作分工。
> 實作時請同時讀 [`05-product-review.md`](05-product-review.md)，兩者衝突時以 05 為準

每個遊戲對應 iThome 系列「不囉唆圖解 K8s」同一天的文章，角色名稱以文章為準。

---

## 一、設計原則

**每一局都走完同一條情緒曲線：好奇 → 動手 → 頓悟 → 成就。**

```
① 好奇
  ↓
② 動手
  ↓
③ 頓悟
  ↓
④ 成就
```

① 好奇：開場 3 秒內丟出一個「咦？」的畫面（泡泡破了、訪客卡在門口、指令被退件）
② 動手：只用 tap，玩家親手觸發 K8s 的真實行為，而不是讀說明
③ 頓悟：過關彈窗的 `aha` 一句話，把剛剛的操作翻回正式 K8s 術語
④ 成就：彩紙 + 「收下這一課」按鈕，按下後才 `emit('complete')`

**硬性規則**

- 手機直式，可玩舞台寬 360px、高約 520px；所有可點目標至少 44×44px
- 只用 tap，不用拖曳、長按、hover
- 單局 30–90 秒；超時或失敗一律可「再玩一次」，不扣任何存檔資料
- 忠實反映真實 K8s 行為：遊戲中的每個結果都要能對應到真實叢集會發生的事；文章為了排版做的簡化，在該天「忠實度備註」寫明
- 只用 `components/characters` 的角色 id 與 `games/kit` 的積木；文字標籤（IP、label、指令、YAML）一律用 `TagChip` 呈現，不畫新圖
- 角色狀態（變暗、搖晃、破掉、發光）全部用 kit 的 CSS 效果做，不依賴美術額外出圖
- 不寫入 localStorage；過關狀態由 `useGame()` 處理

**玩法分佈**

- 純問答類（ChoiceCards 為主）：Day 15、20、26、30，共 4 天（上限 5 天）
- 其餘 26 天分別為：pick & place、順序點擊、即時反應、模擬操作、偵錯探索、組裝指令、預測後驗證

---

## 二、共用 kit 積木

**原則：只做 12 個積木（第 12 個 `useTimeouts` 於驗收後新增，見 00），覆蓋 30 天所需；第二個遊戲用到才算共用，單一遊戲的特殊邏輯留在該天元件內。**

放置位置：`src/presentation/games/kit/`

### 型別

```ts
// kit/types.ts
import type { CharacterId } from '@/presentation/components/characters'

export type GameStatus = 'intro' | 'playing' | 'won' | 'lost'

export type CharFx =
  | 'none'    // 正常
  | 'dim'     // 變暗（失效、停電、未選）
  | 'shake'   // 左右晃（錯誤、重啟中）
  | 'pop'     // 破掉縮小淡出（Pod 被刪）
  | 'bounce'  // 彈出（新建立）
  | 'glow'    // 外光暈（被選中、正確）
  | 'ghost'   // 半透明虛線外框（尚未存在的位置、Pending）
  | 'gone'    // 不顯示但保留佔位
  | 'red'     // 紅色調（壞掉、Not Ready）
  | 'slow'    // 動畫放慢（CPU throttle）

export type ChipColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'gray'

export type Tone = 'info' | 'good' | 'bad'
```

### ① GameShell.vue：每天的外框

**負責 intro 畫面、頂部提示、計時條、回合點、勝敗彈窗與彩紙；Day 元件只管舞台內容。**

```ts
defineProps<{
  hint: string                                   // gameHint，intro 與頂部顯示
  status: GameStatus
  aha?: string                                   // 過關彈窗的頓悟句
  winTitle?: string                              // 預設「過關！」
  loseText?: string                              // 失敗彈窗說明
  timer?: { remaining: number; total: number }   // 有值才顯示計時條
  progress?: { current: number; total: number }  // 有值才顯示回合點
}>()
defineEmits<{
  start: []    // intro 按「開始」
  retry: []    // 失敗彈窗按「再玩一次」
  finish: []   // 過關彈窗按「收下這一課」
}>()
// slots: default（舞台 360×520）、controls（底部操作列，可選）
```

- `status === 'won'` 時顯示彩紙（使用 `components/ui` 的彩紙特效）與 `aha`
- Day 元件在收到 `finish` 時 `emit('complete')`，並以旗標確保只發一次

### ② useCountdown：倒數計時

```ts
function useCountdown(totalSec: number, opts?: { onExpire?: () => void }): {
  remaining: Readonly<Ref<number>>   // 秒，含小數，給計時條
  running: Readonly<Ref<boolean>>
  start(): void
  pause(): void
  reset(sec?: number): void
}
// 元件 unmount 自動清除
```

### ③ useTicker：固定節拍的模擬迴圈

```ts
function useTicker(intervalMs: number, onTick: (tickCount: number) => void): {
  running: Readonly<Ref<boolean>>
  start(): void
  stop(): void
}
// 用於泡泡自動補位、流量請求、事件出現；unmount 自動清除
```

### ④ useRounds：回合管理

```ts
function useRounds<T>(rounds: T[]): {
  index: Readonly<Ref<number>>
  current: ComputedRef<T>
  results: Readonly<Ref<Array<'ok' | 'miss' | null>>>
  isLast: ComputedRef<boolean>
  record(ok: boolean): void   // 記錄當回合結果
  next(): boolean             // 前進；已是最後一回合回傳 false
  reset(): void
}
```

### ⑤ KChar.vue：可點擊的角色

```ts
defineProps<{
  id: CharacterId
  size?: number             // px，預設 64
  fx?: CharFx               // 預設 'none'
  label?: string            // 角色下方小字，例如 Pod 名稱
  badge?: string | number   // 右上角圓形徽章，例如 replicas 數字、RESTARTS
  selected?: boolean        // 顯示選取外框
  disabled?: boolean
}>()
defineEmits<{ tap: [] }>()
```

- 點擊區域至少 44×44px，即使 `size` 較小也要外擴 hit area
- `fx` 變化時自動播一次對應動畫

### ⑥ TagChip.vue：文字標籤

```ts
defineProps<{
  text: string
  color?: ChipColor     // 預設 'gray'
  mono?: boolean        // 等寬字，用於 IP、指令、YAML
  selected?: boolean
  strike?: boolean      // 刪除線，用於被劃掉的 Endpoint
  disabled?: boolean
}>()
defineEmits<{ tap: [] }>()
```

### ⑦ usePickPlace：點選再點放

```ts
type PlaceResult<I, S> =
  | { ok: true; item: I; slot: S }
  | { ok: false; reason: string }

function usePickPlace<I extends string, S extends string>(opts?: {
  canPlace?: (item: I, slot: S) => true | string   // 回字串代表拒絕原因
}): {
  picked: Readonly<Ref<I | null>>
  pick(item: I): void              // 再點同一個 item 取消選取
  place(slot: S): PlaceResult<I, S> // 沒有 picked 時回 { ok:false, reason:'先選一個' }
  cancel(): void
}
```

### ⑧ useSequence：順序點擊

```ts
function useSequence<T extends string>(expected: T[]): {
  index: Readonly<Ref<number>>
  done: ComputedRef<boolean>
  tap(id: T): 'ok' | 'wrong' | 'done'   // 'wrong' 不前進
  reset(next?: T[]): void               // 可換下一回合的序列
}
```

### ⑨ HintBubble.vue + useHint：提示氣泡

```ts
// HintBubble.vue
defineProps<{ text: string | null; tone?: Tone }>()
defineEmits<{ close: [] }>()

// useHint.ts
function useHint(defaultMs?: number): {   // 預設 2200ms 自動消失
  text: Readonly<Ref<string | null>>
  tone: Readonly<Ref<Tone>>
  show(text: string, tone?: Tone, ms?: number): void
  clear(): void
}
```

- 氣泡固定在舞台頂部，不遮住底部操作列；點一下提早關閉

### ⑩ ChoiceCards.vue：選項卡

```ts
defineProps<{
  options: Array<{ id: string; label: string; sub?: string }>
  answer: string | string[]   // 多個代表任一皆正確
  columns?: 1 | 2             // 預設 1
}>()
defineEmits<{ choose: [id: string, correct: boolean] }>()
```

- 選錯的選項淡掉且不可再點（與圖鑑答題一致），答對後全部鎖定

### ⑪ Meter.vue：量表

```ts
defineProps<{
  value: number
  max: number
  label?: string
  unit?: string
  marks?: Array<{ at: number; label: string; color?: ChipColor }>  // 門檻線
  overlay?: number   // 第二條細線，例如「實際用量」疊在「Request 總和」上
}>()
```

**各積木使用天數**

- GameShell：30 天全部
- useCountdown：1、3、5、12、21、24、30
- useTicker：1、9、10、14、16、21、24
- useRounds：3、5、6、8、11、12、13、15、17、19、22、26、27、29、30
- KChar：30 天全部
- TagChip：2、5、7、8、9、10、11、12、13、14、16、17、18、19、20、22、23、27
- usePickPlace：1、6、16、20、22、23、28
- useSequence：2、4、18、27、29
- HintBubble／useHint：30 天全部
- ChoiceCards：11、12、15、20、22、25、26、27、29、30
- Meter：1、10、24、25、26

---

## 三、每日遊戲

> 舞台尺寸以 360×520 為準，「畫面配置」由上而下描述。
> 「頓悟時刻」是過關彈窗的 `aha` 文字，可直接貼進程式。

## Day 1：半夜救火員

- **K8s 概念**：為什麼需要 K8s、宣告式（Declarative）：宣告期望狀態，系統持續把現況拉向它
- **gameTitle**：半夜救火員
- **gameHint**：先手動救小鳥，再交給島自己補
- **單局時間**：約 50 秒（手動 25 秒 + 自動 20 秒）
- **畫面配置**
  - 頂部：Meter「在跑的服務 x / 6」
  - 中段：三棵 `tree` 橫排，每棵上方 3 個空位
  - 下段：地面列（掉落的小鳥會停在這裡）
  - 底部 controls：第一階段無按鈕；第二階段出現「寫下期望：6 個服務」按鈕（`whistle` 圖示）
- **初始狀態**：第一階段，每棵樹上 2 隻 `bird`，**沒有泡泡**（尚未進入 K8s 管理）
- **互動規則**
  - 第一階段（手動，25 秒）
    - 每 6 秒隨機一棵樹倒下（`fx: 'dim'` + 傾斜），樹上的小鳥掉到地面列，Meter 下降
    - 倒下的樹 8 秒後換新機器重新長回來（空的）
    - 玩家點地面的小鳥（pick），再點一棵站著且有空位的樹（place），小鳥回到樹上
    - 放到倒下的樹或滿的樹：HintBubble「這台倒了／滿了」
    - 25 秒到，顯示「你救回 N 隻。凌晨三點，你還醒著嗎？」並進入第二階段
  - 第二階段（宣告式，20 秒）
    - 玩家點「寫下期望：6 個服務」，6 隻小鳥都換成 `bubble` 包著 `bird`
    - 現在玩家的角色變成搗蛋鬼：點任何一棵站著的樹就把它推倒
    - 樹倒下 2 秒後，島自動在其他站著的樹上**吹出新泡泡**（`fx: 'bounce'`，新的 Pod 名稱），不是把舊的搬過去
    - 剩下的樹放不下時，多出來的泡泡以 `fx: 'ghost'` 浮在空中，標示 `Pending`；等倒下的樹 5 秒後長回來，Pending 的泡泡自動掛上去
- **勝利條件**：第二階段推倒 3 次樹，且每次 Meter 最後都回到 6 / 6
- **失敗／重試**：第一階段不會失敗；第二階段 20 秒內未推倒 3 次 → 提示「多推幾棵試試」並延長 10 秒
- **頓悟時刻**：「你宣告想要的結果，K8s 持續讓目前狀態向它靠近。補上來的是新吹的泡泡（Pod），不是把舊的搬過去；樹不夠時它會先 Pending，等有位置再掛。」
- **使用角色**：island, tree, bird, bubble, whistle
- **使用 kit**：GameShell, KChar, Meter, usePickPlace, useTicker, useCountdown, HintBubble
- **忠實度備註**：真實叢集要等 Node 被判定失聯後（預設約數分鐘）才會驅逐並重建 Pod；遊戲壓縮成 2 秒，彈窗下方小字註明

## Day 2：五分鐘登島

- **K8s 概念**：Kind 蓋島、kubectl 對島說話、第一顆 Pod、port-forward
- **gameTitle**：五分鐘登島
- **gameHint**：照順序吹出正確指令蓋好島
- **單局時間**：約 40 秒
- **畫面配置**
  - 上半：島的舞台（一開始只有海）
  - 下半：7 張指令 TagChip（mono），打散成兩欄
  - 底部：一行假終端機，顯示最後一次指令的輸出
- **初始狀態**：舞台空白；指令卡含 5 張正解與 2 張干擾卡
  - 正解：`kind create cluster --name hello`、`kubectl get nodes`、`kubectl run hello --image=nginx:alpine`、`kubectl get pods`、`kubectl port-forward pod/hello 8080:80`
  - 干擾：`kubectl create cluster`、`docker run nginx`
- **互動規則**（useSequence）
  - 點對：卡片變綠鎖定，舞台長出對應東西
    - `kind create cluster` → `island` + 一棵 `tree` 彈出
    - `kubectl get nodes` → 樹下出現 TagChip `Ready`
    - `kubectl run` → 樹上吹出 `bubble` 內含 `bird`，標 `ContainerCreating`
    - `kubectl get pods` → 標籤變 `Running`
    - `port-forward` → 舞台角落出現瀏覽器 TagChip `localhost:8080 → Welcome to nginx!`
  - 點錯順序：終端機顯示真實錯誤，例如島還沒蓋就 `kubectl get nodes` → `The connection to the server localhost:8080 was refused`
  - 點干擾卡 `kubectl create cluster` → HintBubble「蓋島是 Kind 的工作，kubectl 只負責對島說話」
  - 點干擾卡 `docker run nginx` → HintBubble「這樣跑起來的容器不歸島管，沒有泡泡包著」
- **勝利條件**：5 張正解依序完成
- **失敗／重試**：無失敗，錯誤只顯示提示
- **頓悟時刻**：「島是 Kind 蓋的，之後都靠哨子（kubectl）說話。Kind 只負責蓋島和拆島，日常操作全部走 kubectl。」
- **使用角色**：island, tree, bubble, bird, whistle
- **使用 kit**：GameShell, KChar, TagChip, useSequence, HintBubble

## Day 3：島嶼點點名

- **K8s 概念**：Cluster ⊃ Node ⊃ Pod ⊃ Container 四層，以及 Pod 是排程最小單位
- **gameTitle**：島嶼點點名
- **gameHint**：看指令，點出它查的那一層
- **單局時間**：約 50 秒（8 題 × 6 秒）
- **畫面配置**
  - 頂部：題目卡（TagChip mono 或一句描述）+ 回合點
  - 中段：一座 `island`，上面 2 棵 `tree`，共 3 顆 `bubble`，其中一顆內含 2 隻 `bird`、另兩顆各 1 隻
  - hit area 分層：島的地面帶、樹幹、泡泡外圈、小鳥本體（小鳥 hit area 在泡泡中心 40px 內），四者不重疊
- **初始狀態**：3 條命（HintBubble 角落顯示）
- **互動規則**（useRounds，題序打亂）
  - 題庫：
    - `kubectl cluster-info` → 島
    - `kubectl get nodes` → 樹
    - `kubectl get pods -o wide` → 泡泡
    - `kubectl get pod hello -o jsonpath='{.spec.containers[*].name}'` → 小鳥
    - 「K8s 排程的最小單位」→ 泡泡
    - 「可以是實體機，也可以是虛擬機」→ 樹
    - 「副本數在數的是誰」→ 泡泡
    - 「壽命最長的一層」→ 島
  - 點對任一個該層角色：該層全部 `fx: 'glow'`，下一題
  - 點錯或 6 秒沒點：扣一命，HintBubble 顯示正確層
  - 8 題答完後的彩蛋：提示「點一顆泡泡」，點下去泡泡 `pop`，1 秒後原位 `bounce` 一顆新名字的泡泡，島和樹完全不動
- **勝利條件**：8 題結束且至少剩 1 命，並完成彩蛋那一下
- **失敗／重試**：命用完 → 失敗彈窗「從外到內：島 → 樹 → 泡泡 → 小鳥」→ 再玩一次
- **頓悟時刻**：「島包樹、樹掛泡泡（Pod）、泡泡（Pod）裝小鳥（Container）。K8s 排程的是整顆泡泡，泡泡破了重吹，島和樹不受影響。」
- **使用角色**：island, tree, bubble, bird
- **使用 kit**：GameShell, KChar, TagChip, useRounds, useCountdown, HintBubble

## Day 4：燈塔村接力

- **K8s 概念**：API Server、etcd、Scheduler、Controller Manager、kubelet 的分工；所有元件都透過 API Server 溝通
- **gameTitle**：燈塔村接力
- **gameHint**：依序點角色，把需求傳到樹上
- **單局時間**：約 45 秒（2 回合）
- **畫面配置**
  - 上半：燈塔村，`lighthouse` 置中，`memory-tree`、`tree-picker`、`patrol-captain` 圍在三角
  - 左下：玩家的 `whistle`
  - 右下：一棵 `tree`，樹下 `squirrel`
  - 底部：任務卡「我要 3 顆泡泡」與目前步驟提示
- **初始狀態**：樹上 0 顆泡泡
- **互動規則**（useSequence）
  - 回合 1「建立」：`whistle → lighthouse → patrol-captain → lighthouse → tree-picker → lighthouse → squirrel`
    - 每次點 `lighthouse`，`memory-tree` 自動跟著亮一下（每筆寫入都落在 etcd）
    - 第一次點 `lighthouse` 後，whistle 旁跳出 TagChip `deployment created`（櫃台寫完就回話，樹上還沒東西）
    - 點到 `squirrel` → 樹上依序 `bounce` 3 顆泡泡
  - 回合 2「泡泡破了」：開場一顆泡泡 `pop`；序列為 `patrol-captain → lighthouse → tree-picker → lighthouse → squirrel`
  - 點錯：
    - 跳過櫃台直接點 `tree-picker` 或 `squirrel` → HintBubble「沒有任何一條線繞過櫃台」
    - 點 `memory-tree` → HintBubble「記憶樹只跟櫃台說話，櫃台會自己去寫」
- **勝利條件**：兩回合序列都完成
- **失敗／重試**：無失敗；錯誤僅提示
- **頓悟時刻**：「你只描述結果，巡邏隊長（Controller Manager）負責把現實調整成你的期望。所有人都透過燈塔櫃台（API Server）交談，真正把泡泡吹出來的是樹上的管家松鼠（kubelet）。」
- **使用角色**：whistle, lighthouse, memory-tree, tree-picker, patrol-captain, squirrel, tree, bubble
- **使用 kit**：GameShell, KChar, TagChip, useSequence, HintBubble
- **忠實度備註**：「巡邏隊長」實際上是 Controller Manager 裡的 Deployment／ReplicaSet controller，透過櫃台建立 Pod 物件

## Day 5：哨子點唱機

- **K8s 概念**：kubectl 八個常用指令（get、describe、logs、apply、delete、exec、port-forward、get -o yaml）與 `-n`、`-A`
- **gameTitle**：哨子點唱機
- **gameHint**：組出指令，完成每張任務單
- **單局時間**：75 秒內完成 8 張任務單
- **畫面配置**
  - 頂部：計時條 + 任務單卡片（一句白話需求）
  - 中段：`whistle` + 指令列 TagChip（mono），顯示 `kubectl ___ ___`
  - 下半：動詞按鈕 7 個（get、describe、logs、apply、delete、exec、port-forward），旗標按鈕 3 個（`-n dev`、`-A`、`-o yaml`），以及「吹！」大按鈕
- **初始狀態**：任務池 10 張，隨機抽 8 張
  - 看 default 區有哪些泡泡 → `get pods`
  - 看 dev 區的泡泡 → `get pods -n dev`
  - 看所有區的泡泡 → `get pods -A`
  - 看這顆泡泡的事件 → `describe pod hello`
  - 看程式自己印了什麼 → `logs hello`
  - 把 YAML 交給島 → `apply -f hello.yaml`
  - 從筆電連進泡泡 → `port-forward pod/hello 8080:80`
  - 看這顆泡泡的完整設定 → `get pod hello -o yaml`
  - 進到小鳥裡下指令 → `exec -it hello -- sh`
  - 把泡泡刪掉 → `delete pod hello`
- **互動規則**
  - 點動詞：指令列填入動詞與預設對象；再點同一個動詞清空
  - 點旗標：附加到指令列，最多一個
  - 點「吹！」：`whistle` 吹出聲波到右上角小小的 `lighthouse`
    - 正確：任務單蓋章，下一張
    - 錯誤：終端機行顯示貼近真實的回應，例如需要 `-n dev` 卻沒加 → `No resources found in default namespace.`
- **勝利條件**：時間內完成 8 張
- **失敗／重試**：時間到 → 失敗彈窗「先看、再查、再讀、再改、再刪」→ 再玩一次
- **頓悟時刻**：「先看（get）、再查（describe）、再讀（logs）、再改（apply）、再刪（delete）。哨子吹出的每一句，都先抵達燈塔櫃台（API Server）。」
- **使用角色**：whistle, lighthouse
- **使用 kit**：GameShell, KChar, TagChip, useRounds, useCountdown, HintBubble

## Day 6：泡泡室友配對

- **K8s 概念**：同一 Pod 的 Container 共用 IP 與埠號空間、共用 Volume；sidecar；「一起生、一起死、一起搬家」判準
- **gameTitle**：泡泡室友配對
- **gameHint**：把小鳥放進對的泡泡
- **單局時間**：約 60 秒（4 回合）
- **畫面配置**
  - 上半：兩顆空 `bubble`（左 A、右 B）
  - 中段：本回合兩隻 `bird`，各帶 TagChip（角色 + 埠號）
  - 底部：「吹泡泡」按鈕
- **初始狀態**：每回合兩隻小鳥待放
  - 回合 1：`Nginx :80` + `日誌收集器（讀 Nginx 日誌檔）` → 應放同一顆
  - 回合 2：`網站 :80` + `Postgres :5432` → 應分開
  - 回合 3：`Nginx :80` + `Nginx :80`（兩個副本）→ 應分開
  - 回合 4：`App :8080` + `本機代理 :15001（用 localhost 轉送）` → 應放同一顆
- **互動規則**（usePickPlace）
  - 點小鳥再點泡泡放入；點已放入的小鳥可取回
  - 兩隻都放好後點「吹泡泡」驗證：
    - 同一顆：泡泡外壁出現**唯一一塊**門牌 TagChip `10.244.0.12`，兩鳥之間顯示 `localhost`，中間出現 `food-bucket`
    - 兩個 :80 放同一顆：第二隻 `fx: 'shake'` + `red`，HintBubble「同一顆泡泡共用網路，80 埠撞號，第二隻綁不到」
    - 網站和資料庫放同一顆：HintBubble「網站更新時資料庫要跟著一起重建嗎？不該一起死就拆開」
    - 日誌收集器分開放：HintBubble「拆開就讀不到 Nginx 寫在本機的日誌檔」
- **勝利條件**：4 回合全部正確（錯了可在同回合重放）
- **失敗／重試**：無失敗
- **頓悟時刻**：「同一顆泡泡（Pod）的小鳥（Container），共用一塊門牌（IP）。要一起生、一起死、一起搬家的才放同一顆，這就是 sidecar。」
- **使用角色**：bubble, bird, food-bucket
- **使用 kit**：GameShell, KChar, TagChip, usePickPlace, useRounds, HintBubble

## Day 7：YAML 縮排師

- **K8s 概念**：Pod YAML 四塊（apiVersion、kind、metadata、spec）、大小寫敏感、縮排代表從屬；裸 Pod 刪了不會回來
- **gameTitle**：YAML 縮排師
- **gameHint**：點行調縮排，送櫃台驗收
- **單局時間**：約 60 秒
- **畫面配置**
  - 上半：8 行 YAML，每行一列：左側「縮排鈕」（顯示 `··` 點點表示空格數），右側文字；部分行的值是可點 TagChip
  - 下半：`lighthouse` + 「送去櫃台」按鈕；過關後右側出現 `bubble` 內含 `bird`
- **初始狀態**（全部縮排為 0，兩個值是錯的）

```yaml
apiVersion: apps/v1     # 值可點：apps/v1 ↔ v1
kind: pod               # 值可點：pod ↔ Pod
metadata:
name: hello
spec:
containers:
- name: web
image: nginx:alpine
```

- **互動規則**
  - 點縮排鈕：該行縮排循環 0 → 2 → 4 → 6 → 0
  - 點值 TagChip：在選項間切換
  - 點「送去櫃台」：依序檢查，回報**第一個**錯誤（貼近真實訊息）
    - kind 小寫 → `no matches for kind "pod" in version "apps/v1"`
    - apiVersion 錯 → `no matches for kind "Pod" in version "apps/v1"`
    - `name` 不在 metadata 下 → `unknown field "name"`，且 `metadata.name: Required value`
    - `containers` 不在 spec 下 → `unknown field "containers"`
    - `image` 沒對齊 `name: web` 底下 → `error converting YAML to JSON`
  - 正確縮排：`name` 2、`containers` 2、`- name: web` 2 或 4、`image` = `- name` 那行 + 2
- **勝利條件**：送出通過 → 四條對照線把四塊連到泡泡；接著提示「點泡泡刪掉它」，點後泡泡 `pop`，3 秒後畫面不變，顯示「沒有人把它補回來」，彈出過關
- **失敗／重試**：無失敗，錯誤可無限修改
- **頓悟時刻**：「YAML 只有四塊：規格書（apiVersion）、種類（kind）、名牌（metadata）、內容（spec）。縮進去就是屬於上一層；這顆泡泡刪了不會回來，因為沒有人在維持它。」
- **使用角色**：lighthouse, bubble, bird
- **使用 kit**：GameShell, KChar, TagChip, HintBubble

## Day 8：放大鏡尋寶

- **K8s 概念**：Label（key: value）與 equality-based Selector；多條件為 AND；大小寫敏感；K8s 靠 Label 不靠名字
- **gameTitle**：放大鏡尋寶
- **gameHint**：點出所有符合條件的泡泡
- **單局時間**：約 60 秒（3 回合）
- **畫面配置**
  - 頂部：`magnifier` + 本回合 Selector TagChip（mono），例如 `app=hello,env=prod`
  - 中段：10 顆 `bubble` 以 2×5 排列，每顆下方 `label` 小字是 Pod 名稱，旁邊 1–2 個 `sticker` 搭配 TagChip 顯示 label（顏色依 key 固定）
  - 底部：「照！」按鈕
- **初始狀態**：10 顆泡泡的 label（固定資料）
  - `hello-a1`：app=hello, env=prod
  - `hello-b2`：app=hello, env=dev
  - `hello-c3`：app=hello, env=prod, tier=frontend
  - `api-d4`：app=api, env=prod
  - `hello-e5`：app=Hello, env=prod（大小寫陷阱）
  - `hello-f6`：app=api, env=prod（名字陷阱）
  - `hello-g7`：app=hello, env=staging
  - `db-h8`：app=db, env=prod, tier=backend
  - `web-i9`：app=hello, env=prod（名字不像，但 label 對）
  - `db-j0`：app=db, env=dev, tier=backend
- **互動規則**（useRounds）
  - 回合 1：`app=hello` → hello-a1、hello-b2、hello-c3、hello-g7、web-i9
  - 回合 2：`app=hello,env=prod` → hello-a1、hello-c3、web-i9
  - 回合 3：`tier=backend,env=prod` → db-h8
  - 點泡泡切換選取（`selected`）
  - 點「照！」：放大鏡光圈落在正解上（`glow`），漏選的閃黃、多選的 `shake`
    - 多選 hello-e5 → HintBubble「Hello 和 hello 是兩個字串」
    - 多選 hello-f6 → HintBubble「名字叫 hello 沒用，貼紙寫的是 api」
  - 每回合兩次機會
- **勝利條件**：3 回合皆在兩次內答對
- **失敗／重試**：某回合兩次都錯 → 失敗彈窗 → 再玩一次
- **頓悟時刻**：「K8s 靠貼紙（Label）找人，不靠名字。多個條件要全部符合，差一個大小寫就找不到。」
- **使用角色**：bubble, sticker, magnifier
- **使用 kit**：GameShell, KChar, TagChip, useRounds, HintBubble

## Day 9：戳不完的泡泡

- **K8s 概念**：ReplicaSet 只維持數量；用 selector 數泡泡；手動 Pod 貼同一張 label 會被算進去並可能被刪
- **gameTitle**：戳不完的泡泡
- **gameHint**：讓 app:hello 泡泡歸零
- **單局時間**：約 45 秒
- **畫面配置**
  - 頂部：`owl`，`badge` 顯示 `replicas: 3`，旁邊「−」「＋」兩顆小按鈕；Meter 不需要，改用 TagChip「數到：3」
  - 中段：樹枝上的 `bubble`，每顆帶紅色 TagChip `app: hello` 與隨機 Pod 名稱
- **初始狀態**：3 顆 app:hello 泡泡
- **互動規則**（useTicker 200ms）
  - 點泡泡：`pop`；0.8 秒後貓頭鷹補一顆新名字的泡泡（`bounce`）
  - 開局 8 秒後若玩家還沒碰過「−」：HintBubble「戳不贏的。試試貓頭鷹手上的數字？」
  - 第 10 秒事件：一顆標 `你手吹的` 的泡泡飄進來，也貼 `app: hello`
    - 若當下數量 > replicas：貓頭鷹立刻挑一顆刪掉（隨機，可能是你手吹的那顆），HintBubble「貼了同一張貼紙就會被算進去」
  - 第 15 秒事件：一顆貼藍色 `app: api` 的泡泡出現；點破它不會被補，貓頭鷹也不數它
  - 點「−」：replicas 減 1，貓頭鷹刪掉一顆；點「＋」：增 1，補一顆
- **勝利條件**：app:hello 泡泡數為 0 並維持 3 秒
- **失敗／重試**：45 秒未達成 → 失敗彈窗「改期望數字，而不是跟它比手速」→ 再玩一次
- **頓悟時刻**：「貓頭鷹（ReplicaSet）只數數字，不認得哪顆是哪顆。你戳破的它會補回來；想讓泡泡變少，要改的是期望數量。」
- **使用角色**：owl, bubble, sticker, tree
- **使用 kit**：GameShell, KChar, TagChip, useTicker, HintBubble

## Day 10：滾動換裝秀

- **K8s 概念**：Deployment 滾動更新；一個版本一個 ReplicaSet；maxSurge、maxUnavailable；舊 ReplicaSet 保留為 0
- **gameTitle**：滾動換裝秀
- **gameHint**：加新減舊，可用數不能掉
- **單局時間**：約 40 秒
- **畫面配置**
  - 頂部：`steward` 手持版本卷軸，TagChip `maxSurge: 1`、`maxUnavailable: 0`
  - 中段左：舊 `owl`（badge 數字）+ v1 泡泡區；中段右：新 `owl`（badge）+ v2 泡泡區
  - 下段：兩個 Meter
    - 「可接客（Ready）」0–4，門檻線 3（紅）
    - 「泡泡總數」0–5，門檻線 4（上限）
  - 底部 controls：「新貓頭鷹 +1」「舊貓頭鷹 −1」
- **初始狀態**：舊 owl = 3（3 顆 v1 皆 Ready，`ready-flag` 升起）；新 owl = 0
- **互動規則**（useTicker 100ms）
  - 「新貓頭鷹 +1」：總數已達 4 → 拒絕，HintBubble「maxSurge 1：最多只能多一顆」；否則 v2 泡泡 `bounce` 出現，旗子降著，1.5 秒後升旗變 Ready
  - 「舊貓頭鷹 −1」：v1 泡泡 `pop`；若之後 Ready 數 < 3 → Meter 變紅、流量中斷動畫 → 失敗
  - 流量小點持續從左上流向 Ready 的泡泡
- **勝利條件**：新 owl = 3 且全部 Ready、舊 owl = 0，全程 Ready 數 ≥ 3
- **失敗／重試**：Ready 數掉到 3 以下 → 失敗彈窗「新的還沒升旗，就先收舊的了」→ 再玩一次
- **頓悟時刻**：「一個版本一隻貓頭鷹（ReplicaSet）。部署管家（Deployment）加一顆新的、等它就緒、再收一顆舊的。舊貓頭鷹沒被刪，數字停在 0，明天後悔時就靠它。」
- **使用角色**：steward, owl, bubble, bird, ready-flag
- **使用 kit**：GameShell, KChar, TagChip, Meter, useTicker, HintBubble
- **忠實度備註**：真實環境由 Deployment controller 自動做加減，玩家在此扮演 controller；新 Pod 沒 Ready 時 controller 不會繼續收舊的

## Day 11：後悔捲軸

- **K8s 概念**：壞版本會卡在滾動更新中途；revision 只記 Pod template（改 image 新增一行、改 replicas 不會）；`rollout undo`
- **gameTitle**：後悔捲軸
- **gameHint**：卡住了就捲回上一版
- **單局時間**：約 60 秒
- **畫面配置**
  - 頂部：`steward` 與卷軸區，卷軸每行一個 TagChip（mono），例如 `rev1  nginx:1.25`
  - 中段：owl 們（每個版本一隻，badge 數字）與對應泡泡
  - 底部：本步驟的「變更卡」+ 預測按鈕「卷軸會多一行」「不會」
- **初始狀態**：replicas 2，rev1 = `nginx:1.25`，一隻 owl = 2
- **互動規則**（useRounds，3 步預測 + 1 步回滾）
  - 步驟 1 變更卡「replicas 2 → 3」：玩家先預測，再播放 → owl 變 3，卷軸**不變**
  - 步驟 2 變更卡「image → nginx:1.26」：預測後播放 → 新增 `rev2`，新 owl 滾動到 3、舊 owl 留在 0
  - 步驟 3 變更卡「image → nginx:1.27-typo」：預測後播放 → 新增 `rev3`，新 owl 吹出 1 顆泡泡 `fx: 'red'`（`ImagePullBackOff`），更新停住；3 顆 v1.26 照常接客
  - 預測錯誤：HintBubble 說明「卷軸只記泡泡長什麼樣，不記有幾顆」，不扣分
  - 步驟 4：提示「點卷軸上你要回去的那一行」
    - 點 `rev2`：rev3 的 owl 歸 0、紅泡泡 `pop`；卷軸上 `rev2` 消失，頂端新增 `rev4  nginx:1.26`
    - 點 `rev1`：HintBubble「也能救，但你會丟掉 1.26 的更新；上一個好版本是 rev2」，可重選
    - 點 `rev3`：HintBubble「就是它壞的」
- **勝利條件**：完成步驟 4 回到 rev2 的內容
- **失敗／重試**：無失敗
- **頓悟時刻**：「舊副本還健康時，壞版本會卡在半路，不會把服務推垮。rollback 就是把卷軸往回捲；回滾後的版本會拿到新的編號，舊貓頭鷹的數字被調回來。」
- **使用角色**：steward, owl, bubble, bird
- **使用 kit**：GameShell, KChar, TagChip, ChoiceCards, useRounds, HintBubble
- **忠實度備註**：預設 maxSurge 25%、maxUnavailable 25%，在 3 副本時分別為 1 與 0，因此正好卡住 1 顆新的；若舊 image 不在 Node 快取中，回滾仍需重新拉取

## Day 12：泡泡急診室

- **K8s 概念**：排查順序 get → describe（Events）→ logs；ImagePullBackOff、CrashLoopBackOff、Pending；`logs --previous`；RESTARTS 欄位
- **gameTitle**：泡泡急診室
- **gameHint**：用對工具，找出泡泡病因
- **單局時間**：約 80 秒（3 位病患）
- **畫面配置**
  - 頂部：病患 `bubble` + 一行 `kubectl get pods` 輸出（NAME、READY、STATUS、RESTARTS）
  - 中段：「檢查報告」區，顯示最近一次工具輸出（mono）
  - 下段：工具按鈕 `describe`、`logs`、`logs --previous`
  - 診斷後：ChoiceCards 3 選 1
- **初始狀態**（病患順序打亂）
  - A：`0/1  ImagePullBackOff  0`
    - describe：`Failed to pull image "nginx:1.277": not found`
    - logs：`container "web" is waiting to start: trying and failing to pull image`
    - 診斷：image tag 打錯
  - B：`0/1  CrashLoopBackOff  5`
    - describe：`Back-off restarting failed container web`
    - logs：只有一行 `starting server...`（剛重啟的這一輪）
    - logs --previous：`Error: DATABASE_URL is not set`
    - 診斷：程式啟動時缺設定
  - C：`0/1  Pending  0`
    - describe：`FailedScheduling 0/3 nodes are available: 3 Insufficient memory.`
    - logs：空白，並提示泡泡還沒掛上樹
    - 診斷：沒有樹放得下
- **互動規則**
  - 每點一個工具，報告區顯示輸出，並記一次「檢查」
  - 至少點過一次工具後才出現 ChoiceCards
  - 診斷錯：HintBubble 指出該看的線索；可重選
  - 對 A、C 先點 logs：HintBubble「容器沒起來就沒有 logs，先看 Events」
- **勝利條件**：3 位病患全部診斷正確，總檢查次數 ≤ 7
- **失敗／重試**：檢查次數超過 7 → 失敗彈窗「先 get 看狀態、再 describe 看 Events、最後才 logs」→ 再玩一次
- **頓悟時刻**：「Events 是 K8s 說的，logs 是程式說的。容器沒起來就沒有 logs；CrashLoopBackOff 要加 --previous 才看得到上一輪怎麼死的。」
- **使用角色**：bubble, bird, magnifier
- **使用 kit**：GameShell, KChar, TagChip, ChoiceCards, useRounds, HintBubble

## Day 13：跨籬喊話

- **K8s 概念**：Namespace 隔開名字、隔不開網路；同名資源可在不同 Namespace；Node、PV 不屬於 Namespace；跨區 DNS `<svc>.<ns>.svc.cluster.local`
- **gameTitle**：跨籬喊話
- **gameHint**：拼出地址，喊到對的柱子
- **單局時間**：約 70 秒（4 回合）
- **畫面配置**
  - 中央一道 `fence` 把島分成左 `dev`、右 `prod`
  - 兩區各有一根 `totem`，名牌都叫 `hello`（dev 的標 v2、prod 的標 v1）
  - 兩棵 `tree` 跨在圍籬兩側（樹不屬於任何一區）
  - 右區有一顆玩家所在的 `bubble`（標「你在 prod」）
  - 底部：地址組裝列 + 詞塊 TagChip：`hello`、`.dev`、`.prod`、`.svc.cluster.local`，以及「喊！」「清除」
- **互動規則**（useRounds）
  - 回合 1：「呼叫 prod 的 hello」→ `hello`、`hello.prod`、完整 FQDN 都算對；只打 `hello` 時加稱讚「同區叫名字就好」
  - 回合 2：「呼叫 dev 的 hello」→ `hello.dev` 或 `hello.dev.svc.cluster.local`
    - 只打 `hello`：聲波飛到 prod 的柱子，回應 `v1`，HintBubble「同區優先，跨區要帶區名」
  - 回合 3：「再建一個叫 hello 的 Deployment」，按鈕改為「建在 dev」「建在 prod」「建在 staging（新圍籬）」
    - dev／prod → 終端機 `Error: deployments.apps "hello" already exists`
    - staging → 出現新圍籬區與新柱子，成功
  - 回合 4：「dev 的泡泡直接打 prod 泡泡的 IP，會被圍籬擋下嗎？」ChoiceCards「擋下」「通過」→ 播放封包穿過圍籬；答完再提示「點一棵樹看它屬於哪區」→ HintBubble「Node 不屬於任何 Namespace」
- **勝利條件**：4 回合完成
- **失敗／重試**：無失敗
- **頓悟時刻**：「圍籬（Namespace）隔開名字，隔不開網路。同名可以共存，跨區喊話要帶區名：hello.dev.svc.cluster.local。」
- **使用角色**：fence, totem, tree, bubble, island
- **使用 kit**：GameShell, KChar, TagChip, ChoiceCards, useRounds, HintBubble
- **忠實度備註**：預設沒有 NetworkPolicy 時跨 Namespace 封包可通；要隔離封包需另設網路政策

## Day 14：名單偵探

- **K8s 概念**：Service 的穩定 ClusterIP、selector 決定 Endpoints、只收 Ready 的 Pod、Pod IP 會換、負載分散
- **gameTitle**：名單偵探
- **gameHint**：修好柱子名單，讓流量通
- **單局時間**：約 60 秒
- **畫面配置**
  - 頂部左：客戶端 `bubble`（標 `frontend`），持續送請求到 `http://hello`
  - 頂部右：成功／失敗計數 TagChip
  - 中段：`totem` 標 `hello  10.96.0.10`，下方 selector TagChip（可點），旁邊 Endpoints 名單（TagChip 清單，mono）
  - 下段：3 顆後端 `bubble`，各帶 `app: hello` 與 Pod IP；其中一顆 `ready-flag` 降著（啟動中）
  - 底部 controls：「滾動更新」按鈕（修好 selector 後才亮）
- **初始狀態**：selector 是 `app: helo`（打錯），Endpoints 為空，請求全部失敗
- **互動規則**（useTicker 1000ms 送請求）
  - 點 `magnifier` 或後端泡泡：顯示 HintBubble 比對結果（「柱子在找 helo，泡泡貼的是 hello」）
  - 點 selector TagChip → ChoiceCards：`app: hello`、`app: Hello`、`name: hello-7d4b`
    - 選 `app: hello`：名單出現 2 個 IP（旗子降著的那顆**不進名單**），請求開始成功，小點隨機分散到 2 顆
    - 3 秒後那顆升旗，自動加入名單
    - 選其他：名單仍空，HintBubble 說明
  - 修好後第 5 秒事件：一顆泡泡 `pop`，名單上它的 IP `strike`，新泡泡帶新 IP 補進名單；柱子 IP 不變
  - 點「滾動更新」：三顆依序換新，三個 IP 全換，柱子 IP 從頭到尾不變
- **勝利條件**：累積 15 次成功請求，且已做過一次滾動更新
- **失敗／重試**：無失敗
- **頓悟時刻**：「Pod IP 會隨 Pod 替換；Service 提供穩定入口。名單（Endpoints）由 selector 和 Ready 自動維護，柱子打不通，先查名單。」
- **使用角色**：totem, bubble, bird, magnifier, sticker, ready-flag
- **使用 kit**：GameShell, KChar, TagChip, ChoiceCards, useTicker, HintBubble
- **忠實度備註**：名單空的那段時間請求就是會失敗；Service 提供穩定入口，不保證後端永遠可用

## Day 15：入口開幾層

- **K8s 概念**：ClusterIP、NodePort、LoadBalancer 層層包含；最小暴露原則；Kind 上 LoadBalancer 會 Pending
- **gameTitle**：入口開幾層
- **gameHint**：選最小夠用的柱子型號
- **單局時間**：約 50 秒（4 回合）
- **畫面配置**
  - 上半：島的剖面，由外而內：海邊碼頭（`totem-dock` 位置）、樹幹小門（`totem-gate` 位置）、島內路標（`totem-inner` 位置）
  - 三個訪客 TagChip：`島內泡泡`、`連得到節點的同事`、`海上的網友`
  - 下半：需求卡 + ChoiceCards
- **互動規則**（useRounds）
  - 回合 1「資料庫只給島內前端用」→ ClusterIP
  - 回合 2「辦公室同事要從筆電連測試服務，他連得到節點 IP」→ NodePort
  - 回合 3「正式網站要給全世界，在雲端」→ LoadBalancer
  - 回合 4「在 Kind 筆電上，想用瀏覽器打開」→ 選項多一個 `kubectl port-forward`，正解為它
  - 每次選擇後播放：
    - 對應的柱子亮起，**內層也一起亮**（選 NodePort 時 ClusterIP 一起出現）
    - 可到達的訪客打勾
    - 開太多層：HintBubble「每多開一層，就多一個對外的攻擊面」，本回合判錯
    - 開太少層：需要的訪客打叉
    - 回合 4 選 LoadBalancer：碼頭出現 `EXTERNAL-IP <pending>` 一直轉，HintBubble「筆電上沒有雲端負載平衡器接這張單」
- **勝利條件**：4 回合中至少答對 3 回合
- **失敗／重試**：錯 2 回合以上 → 失敗彈窗 → 再玩一次
- **頓悟時刻**：「ClusterIP 提供島內入口，NodePort 增加巢樹（Node）入口，LoadBalancer 再接上外部負載平衡器。外層包著內層，能用內層就別開外層。」
- **使用角色**：totem-inner, totem-gate, totem-dock, island, tree
- **使用 kit**：GameShell, KChar, TagChip, ChoiceCards, useRounds, HintBubble

## Day 16：大門看板

- **K8s 概念**：Ingress 是規則表、需要 Ingress Controller 才會動；host 與 path 規則；標準 Ingress 只管 HTTP/HTTPS
- **gameTitle**：大門看板
- **gameHint**：請守門員、排規則，分流訪客
- **單局時間**：約 70 秒
- **畫面配置**
  - 頂部：島的大門，左側 `gate-map`（3 列規則槽），右側守門員位置（一開始是 `gatekeeper` 的 `ghost`）
  - 大門外：訪客佇列（TagChip mono），一次露出 3 位
  - 下半：三根 `totem`，名牌 `shop`、`blog`、`api`
  - 底部：規則卡區（第二階段才出現）
- **初始狀態**：看板第 1 列已有規則 `host: shop.example.com → shop`；沒有守門員
- **互動規則**
  - 第一階段：訪客 `shop.example.com/` 到門口後停住、頭上出現 `timeout`；5 秒後 HintBubble「規則寫好了，怎麼沒人動？」
    - 點守門員的 ghost 位置 → TagChip `安裝 ingress-nginx`，`gatekeeper` 出現，卡住的訪客被送到 shop 柱子
  - 第二階段（usePickPlace）：規則卡 `host: blog.example.com → blog`、`path: /api → api`（host 為 shop）放進空的規則槽
  - 訪客流（useTicker）：`blog.example.com/`、`shop.example.com/api`、`shop.example.com/cart`、`unknown.example.com/`、`psql 5432（TCP）`
    - 規則命中 → 守門員讀看板、送到對的柱子，訪客打勾
    - 沒有對應規則 → 回 `404`（看板沒有這條規則，不是服務壞了）
    - TCP 訪客 → 守門員搖頭，HintBubble「看板只管 HTTP/HTTPS」，自動改走旁邊的 Service 小路
- **勝利條件**：所有 HTTP 訪客都得到正確結果（命中的送達、沒規則的 404），共 8 位
- **失敗／重試**：規則放錯槽 → 訪客被送到錯的柱子，柱子 `shake`；點規則槽可取回重放，不會失敗
- **頓悟時刻**：「看板（Ingress）只是規則表，得有守門員（Ingress Controller）讀它才會動。柱子只認埠號，看板才認網址。」
- **使用角色**：gate-map, gatekeeper, totem, island
- **使用 kit**：GameShell, KChar, TagChip, usePickPlace, useTicker, HintBubble

## Day 17：狀態碼分診

- **K8s 概念**：Ingress → Service → Endpoints → Pod 的檢查路徑；404、503、timeout 各指向哪一站
- **gameTitle**：狀態碼分診
- **gameHint**：看狀態碼，最少檢查找斷點
- **單局時間**：約 70 秒（4 回合）
- **畫面配置**
  - 頂部：瀏覽器 TagChip `curl http://localhost/hello` 與回傳狀態碼（大字）
  - 中段：五站橫向縮小排列（手機寬度內兩列）：`gatekeeper`（Controller）、`gate-map`（Ingress 規則）、`totem`（Service）、名單（`magnifier` + TagChip `Endpoints`）、`bubble`（Pod）
  - 底部：檢查輸出區（mono）+ 本局檢查次數
- **互動規則**（useRounds，順序打亂）
  - 每點一站 = 執行該站檢查指令，顯示輸出並標綠勾或紅叉；檢查次數 +1
  - 回合 A：`503`，斷在名單 → `kubectl get endpointslices -l kubernetes.io/service-name=hello` 回空
  - 回合 B：`503`，斷在看板 → `kubectl describe ingress hello` 顯示 `<error: services "hello-typo" not found>`
  - 回合 C：`404`（打 `/nothing`），斷在看板 → 規則表沒有 `/nothing`
  - 回合 D：連不上（timeout），斷在守門員 → `kubectl get pods -n ingress-nginx` 顯示 `0/1`
  - 點到紅叉那站即過回合；回合 A、B 兩個 503 長得一樣，要靠看板那一站的輸出區分
- **勝利條件**：4 回合總檢查次數 ≤ 10
- **失敗／重試**：超過 10 次 → 失敗彈窗附分診表「404 看板沒規則、503 規則有了但後面沒人、timeout 守門員沒起來」→ 再玩一次
- **頓悟時刻**：「先看 HTTP 狀態碼分診，再一站一站問。404 是看板沒有這條規則，503 是規則有了但後面沒人，連不上是守門員本身沒起來。」
- **使用角色**：gatekeeper, gate-map, totem, magnifier, bubble
- **使用 kit**：GameShell, KChar, TagChip, useRounds, HintBubble

## Day 18：封包旅行團

- **K8s 概念**：請求七站旅程；Service IP 是虛擬 IP；kube-proxy 在每個 Node 維護轉送規則；流量可跨 Node；資料面不經過控制面
- **gameTitle**：封包旅行團
- **gameHint**：依序點出封包經過的站
- **單局時間**：約 60 秒（2 回合）
- **畫面配置**
  - 島地圖：左上燈塔村（`lighthouse`、`memory-tree`、`tree-picker`，作為干擾）
  - 中央兩棵 `tree`（A、B），每棵樹下一位 `road-keeper`
  - 樹 A 上：`gatekeeper` 的 Pod、`bubble` P1（`10.244.1.5`）
  - 樹 B 上：`bubble` P2（`10.244.2.7`）、P3（`10.244.2.8`）
  - 右上：`gate-map`；中段：`totem`（`hello 10.96.0.10`）
  - 頂部：封包 TagChip，顯示目前目的地，例如 `dst 10.96.0.10:80`
- **互動規則**（useSequence，每回合一條）
  - 回合 1「訪客打 http://你的網域/hello」：`gate-map → gatekeeper → totem → road-keeper(A) → 選一個 Endpoint → 對應的樹 → bubble → bird`
    - 到 `road-keeper` 時跳出 Endpoints 名單（3 個 IP）讓玩家點一個；封包目的地從 `10.96.0.10` 變成那顆 Pod 的 IP
    - 下一步必須點**那顆 Pod 所在的樹**；選 P2／P3 要點樹 B，HintBubble「這棵樹不一定是收到請求的那棵」
  - 回合 2「P1 用名字呼叫 http://hello」：`bubble(P1) → road-keeper(A) → 選 Endpoint → 對應的樹 → bubble → bird`
    - 起點旁自動顯示 `DNS：hello → 10.96.0.10`
    - 點 `totem`：HintBubble「柱子沒有網卡，它只是一組規則；改寫發生在發送端那棵樹的道路管理員」，不前進也不扣分
  - 點燈塔村任何角色：HintBubble「請求流量不經過燈塔村」
  - 點錯樹下的道路管理員（B）：HintBubble「封包在出發那棵樹就被改寫」
- **勝利條件**：兩回合完成
- **失敗／重試**：無失敗
- **頓悟時刻**：「Service IP 是虛擬入口，流量會依規則轉到 Pod。道路管理員（kube-proxy）在每棵樹上刻好路標，封包在出發的那棵樹就被改成真實的 Pod IP。」
- **使用角色**：gate-map, gatekeeper, totem, road-keeper, tree, bubble, bird, lighthouse, memory-tree, tree-picker
- **使用 kit**：GameShell, KChar, TagChip, useSequence, HintBubble
- **忠實度備註**：回合 1 依文章採「經過柱子」的簡化路徑；實務上不少 Ingress Controller 會直接讀名單把連線送往 Pod，彈窗小字註明

## Day 19：便條本改了沒

- **K8s 概念**：ConfigMap 的兩種用法；環境變數要重啟才更新；掛載檔案會在 kubelet 同步後更新，但程式要自己重讀
- **gameTitle**：便條本改了沒
- **gameHint**：用最少重啟讓設定生效
- **單局時間**：約 60 秒（3 回合）
- **畫面配置**
  - 頂部：`notepad`（ConfigMap）顯示三個 key：`LOG_LEVEL`、`index.html`、`nginx.conf`
  - 中段左：Pod A（`bubble` + `bird`），標「環境變數注入 LOG_LEVEL」
  - 中段右：Pod B（`bubble` + `bird` + `food-bowl`），標「掛成檔案：index.html、nginx.conf」
  - 每顆泡泡下方兩行狀態 TagChip：「磁碟上」「程式在用」
  - 底部 controls：「等 kubelet 同步（快轉 60 秒）」「重啟 Pod A」「重啟 Pod B」
- **互動規則**（useRounds，每回合便條本改一個 key，舊值灰、新值橘）
  - 回合 1：改 `index.html` 內容
    - 等同步：Pod B 磁碟上與程式在用都變新（Nginx 每次請求都讀檔）→ 過回合，0 次重啟
    - 直接重啟 B：也過，但標「多花一次重啟」
  - 回合 2：改 `LOG_LEVEL`
    - 等同步：Pod A 兩行都沒變，HintBubble「環境變數在容器啟動那一刻就決定了」
    - 重啟 A → 變新，過回合
  - 回合 3：改 `nginx.conf`
    - 等同步：Pod B「磁碟上」變新，「程式在用」仍舊，HintBubble「Nginx 只在啟動時讀一次設定」
    - 重啟 B → 兩行都新，過回合
  - 重啟動畫：舊泡泡 `pop`、新泡泡 `bounce`（新 Pod 名稱）
- **勝利條件**：3 回合完成，總重啟次數 ≤ 3
- **失敗／重試**：重啟超過 3 次 → 失敗彈窗「先想清楚：環境變數還是掛檔？程式會不會重讀？」→ 再玩一次
- **頓悟時刻**：「改 ConfigMap 後，依注入方式決定是否重啟 Pod。環境變數一定要重啟；掛成檔案會同步，但程式有沒有重讀是另一回事。」
- **使用角色**：notepad, bubble, bird, food-bowl
- **使用 kit**：GameShell, KChar, TagChip, useRounds, HintBubble
- **忠實度備註**：以 subPath 掛載的 ConfigMap 不會自動更新，本遊戲不涉及 subPath

## Day 20：玩具鎖鑑定

- **K8s 概念**：Secret 的 data 只是 base64 編碼不是加密；真正的保護來自 RBAC、etcd 加密與外部金鑰管理
- **gameTitle**：玩具鎖鑑定
- **gameHint**：分辨真保護與假安全
- **單局時間**：約 50 秒
- **畫面配置**
  - 第一段：`lockbox` + Secret YAML 片段 `password: cDRzc3cwcmQ=`，下方按鈕「base64 -d」
  - 第二段：上方兩個收納區（「真的有保護」「沒有保護」），下方 6 張卡片 TagChip
- **互動規則**
  - 第一段：點「base64 -d」→ `lockbox` 彈開，逐字顯示 `p4ssw0rd`，旁邊小字「耗時 0.01 秒，不需要任何金鑰」
  - 第二段（usePickPlace）：點卡片再點收納區
    - 真的有保護：`RBAC：前端工程師讀不到 Secret`、`開啟 etcd 靜態加密`、`外部金鑰管理（KMS、Sealed Secrets）`
    - 沒有保護：`base64 編碼`、`describe 只顯示 8 bytes`、`把 Secret YAML 推上公開 git`
  - 放錯：卡片彈回並顯示原因，例如 `describe 只顯示 8 bytes` → 「這只是防手滑投影到螢幕，資料本身沒變」
- **勝利條件**：6 張全部歸位，錯誤 ≤ 2 次
- **失敗／重試**：錯誤超過 2 次 → 失敗彈窗 → 再玩一次
- **頓悟時刻**：「Secret 的保護力來自存取權限與加密設定。base64 是編碼不是加密，把 Secret YAML 推上 git，就等於把密碼明文推上去。」
- **使用角色**：lockbox, notepad, memory-tree
- **使用 kit**：GameShell, KChar, TagChip, usePickPlace, HintBubble

## Day 21：存檔大作戰

- **K8s 概念**：容器檔案系統是暫時的；emptyDir 的壽命跟 Pod 綁在一起；Container 重啟資料還在、Pod 被替換資料消失；sidecar 共用
- **gameTitle**：存檔大作戰
- **gameHint**：把資料搬進食物桶保住它
- **單局時間**：約 35 秒
- **畫面配置**
  - 一顆大 `bubble`（Pod 名稱 `upload-7f9c-abcde`，`badge` 顯示 RESTARTS）
  - 泡泡內：左邊主 `bird`（上傳服務），旁邊「肚子」區（容器自己的檔案系統）
  - 泡泡中央：`food-bucket`（emptyDir），兩隻鳥面前各一個 `food-bowl`
  - 泡泡內右邊：第二隻 `bird`（sidecar），上方顯示「我讀到 N 份」
  - 頂部：TagChip「食物桶存了 N / 5 份」
- **互動規則**（useTicker）
  - 每 1.5 秒，主小鳥的肚子區冒出一個檔案 TagChip（`file-01`…）
  - 點肚子區的檔案：它移進食物桶；sidecar 的「我讀到」同步 +1
  - 第 8、16、24 秒：主小鳥 crash 重啟（`shake`，RESTARTS +1），**肚子區清空，食物桶不動**
  - 第 26 秒：若食物桶 ≥ 5 → 播放結局：「滾動更新：這顆泡泡被替換」→ 泡泡 `pop`，食物桶與食盆一起碎掉，新泡泡（新名稱）裡食物桶是空的 → 過關彈窗
- **勝利條件**：撐過 3 次容器重啟時，食物桶有 ≥ 5 份
- **失敗／重試**：第 26 秒食物桶 < 5 → 失敗彈窗「留在肚子裡的，每次重啟都會清空」→ 再玩一次
- **頓悟時刻**：「小鳥（Container）重啟，食盆（Volume Mount）還在；泡泡（Pod）破了就沒了。要撐過泡泡替換的資料，得放到泡泡外面的倉庫（PV）。」
- **使用角色**：bubble, bird, food-bucket, food-bowl
- **使用 kit**：GameShell, KChar, TagChip, useTicker, useCountdown, HintBubble

## Day 22：借用單配對

- **K8s 概念**：PV 是叢集級儲存、PVC 是 Namespace 內的申請單；綁定一對一；控制器挑最小夠用的 PV；Pod 指向 PVC 不指向 PV；回收策略 Retain／Delete
- **gameTitle**：借用單配對
- **gameHint**：幫借用單找最剛好的倉庫
- **單局時間**：約 60 秒
- **畫面配置**
  - 上半：3 張 `borrow-slip`，各帶 TagChip 需求：`db 要 2Gi`、`log 要 4Gi`、`cache 要 1Gi`
  - 下半：4 座 `warehouse`，各帶容量與回收策略：`PV-a 1Gi Delete`、`PV-b 5Gi Retain`、`PV-c 10Gi Delete`、`PV-d 2Gi Retain`
  - 頂部：一顆 `bubble`（第二段才出現）
- **互動規則**
  - 第一段（usePickPlace）：點借用單再點倉庫綁定
    - 容量不夠 → 拒絕，HintBubble「倉庫比需求小」
    - 已綁定的倉庫 → 拒絕，門上 TagChip `Bound`，HintBubble「一對一，借走就不能再借」
    - 夠但不是最小夠用的 → 拒絕，HintBubble「控制器會挑最小但夠用的那座」
    - 正解：db → PV-d、log → PV-b、cache → PV-a；綁好的借用單與倉庫之間連一條線
  - 第二段：db 的 `bubble` 出現，提示「這顆泡泡要接儲存，它的 YAML 要寫誰？」點 `borrow-slip`（db）正確；點 `warehouse` → HintBubble「泡泡指的是借用單，不是倉庫」
  - 第三段：ChoiceCards「刪掉 db 的借用單後，PV-d（Retain）會？」→ 「留著資料，狀態變 Released」；選後播放 PV-d 門牌改 `Released`
- **勝利條件**：三段完成
- **失敗／重試**：無失敗
- **頓悟時刻**：「泡泡（Pod）指的是借用單（PVC），不是倉庫（PV）。借用單綁上倉庫是一對一；刪了借用單，倉庫留不留看回收策略。」
- **使用角色**：borrow-slip, warehouse, bubble, bird, food-bowl
- **使用 kit**：GameShell, KChar, TagChip, usePickPlace, ChoiceCards, HintBubble
- **忠實度備註**：靜態供應時控制器會在容量、存取模式、StorageClass 都符合的 PV 中挑最小的；本遊戲只比容量

## Day 23：雙層島混沌測試

- **K8s 概念**：前端用 Service 名稱找資料庫、密碼用 secretKeyRef、資料用 PVC；前端無狀態可隨便換
- **gameTitle**：雙層島混沌測試
- **gameHint**：接好設定，撐過三場意外
- **單局時間**：約 70 秒
- **畫面配置**
  - 上：3 顆前端 `bubble`
  - 中：`totem` 名牌 `hello-db`
  - 下：資料庫 `bubble`（Postgres），下方地面 `warehouse` 位置
  - 右側：設定面板 3 個槽：`DB_HOST`、`DB_PASSWORD`、`資料放哪`
  - 底部：設定卡 6 張 TagChip：`10.244.1.5`、`hello-db`、`value: "p4ssw0rd"`、`secretKeyRef: db-secret`、`emptyDir`、`PVC: db-data`；以及「開始混沌測試」按鈕
- **互動規則**
  - 組裝（usePickPlace）：點卡再點槽，可覆蓋；三槽填滿才能按測試
  - 混沌測試依序播放三場，每場顯示通過／失敗：
    - ① 資料庫泡泡被刪除重建（新 IP `10.244.2.9`）
      - DB_HOST 填 IP → 前端連線失敗
      - DB_HOST 填 `hello-db` → 短暫斷線後自動恢復
      - 資料放 `emptyDir` → 資料表全空；放 PVC → 資料還在（`borrow-slip` 連到 `warehouse` 亮起）
    - ② 把 Deployment YAML 推上 git
      - 密碼填 `value:` → 「密碼外洩」
      - 填 `secretKeyRef` → 通過（YAML 裡只有引用）
    - ③ 前端滾動更新：三顆前端全部換新 → 一定通過，HintBubble「前端不存東西，死一百次都無所謂」
  - 有任何失敗：該槽閃紅，可直接改卡重測
- **勝利條件**：三場混沌測試全部通過
- **失敗／重試**：不失敗，改設定重測即可
- **頓悟時刻**：「前端隨便死，資料庫的倉庫（PV）不能死。用名字找柱子、密碼從小盒拿、資料放倉庫，泡泡怎麼換都不怕。」
- **使用角色**：bubble, bird, totem, lockbox, borrow-slip, warehouse
- **使用 kit**：GameShell, KChar, TagChip, usePickPlace, HintBubble
- **忠實度備註**：Secret 物件本身的 YAML 不應推上 git；資料庫重建期間仍會短暫中斷

## Day 24：鈴與旗

- **K8s 概念**：Liveness 失敗重啟 Container、Readiness 失敗移出 Endpoints 不重啟、Startup 延後其他探針；Liveness 太敏感會連鎖重啟
- **gameTitle**：鈴與旗
- **gameHint**：判斷該降旗還是搖鈴
- **單局時間**：60 秒
- **畫面配置**
  - 頂部：`totem` 與流量小點，只流向旗子升起的泡泡；`squirrel` 站在旁邊（玩家扮演它）
  - 中段：3 顆 `bubble`，每顆上方 `ready-flag`、側邊 `alive-bell`、`badge` 顯示 RESTARTS
  - 每顆泡泡下方 3 個按鈕：「降旗」「搖鈴重啟」「等它開機」
- **互動規則**（useTicker，每 3–4 秒隨機一顆泡泡出現症狀 TagChip）
  - 症狀與正解：
    - `回應變慢（GC 中）` → 降旗
    - `資料庫連不上` → 降旗
    - `死結：程序在，但永遠不回應` → 搖鈴重啟
    - `開機中：載入模型` → 等它開機
  - 正解：該泡泡依規則處理，3 秒後恢復並自動升旗
    - 降旗：泡泡完好，柱子跳過它，RESTARTS 不變
    - 搖鈴：小鳥 `shake` 重啟，RESTARTS +1，泡泡名稱不變
  - 錯誤：
    - 對「變慢」或「資料庫連不上」搖鈴 → 該泡泡重啟 3 秒，流量壓到其他泡泡，其中一顆跟著出現「變慢」（連鎖）
    - 對「死結」降旗 → 泡泡永遠不恢復，HintBubble「降旗不會重啟，死結解不開」
    - 對「開機中」搖鈴 → 重啟後又從頭開機，HintBubble「這就是 Startup 存在的理由」
  - 5 秒沒處理：算一次失誤
- **勝利條件**：60 秒內正確處理 ≥ 8 個症狀，失誤 ≤ 2
- **失敗／重試**：失誤 3 次 → 失敗彈窗「Liveness 決定生死，Readiness 決定流量」→ 再玩一次
- **頓悟時刻**：「管家松鼠（kubelet）用 Readiness 管流量資格、用 Liveness 判斷是否重啟。慢的時候先降旗，別搖鈴；資料庫的檢查放 Readiness。」
- **使用角色**：bubble, bird, alive-bell, ready-flag, totem, squirrel
- **使用 kit**：GameShell, KChar, TagChip, Meter, useTicker, useCountdown, HintBubble
- **忠實度備註**：真實環境由 kubelet 依探針設定自動判斷；玩家在此替 kubelet 做「設定探針時就要預先決定」的判斷

## Day 25：選樹官塞泡泡

- **K8s 概念**：Scheduler 依 Request 總和與 Allocatable 判斷能否放入，不看實際用量；放不下就 Pending；CPU 超 Limit 被限速、記憶體超 Limit 被 OOMKilled
- **gameTitle**：選樹官塞泡泡
- **gameHint**：依 Request 把泡泡掛上樹
- **單局時間**：約 70 秒
- **畫面配置**
  - 頂部：`tree-picker`（玩家）+ 待排程泡泡卡：`bubble` 與 `request-tag` TagChip，例如 `CPU 500m / 記憶體 1Gi`
  - 中段：3 棵 `tree`，每棵下方兩個 Meter（CPU 0–2000m、記憶體 0–4Gi），主條是 Request 總和，`overlay` 細線是實際用量（刻意很低，約 10%）
  - 底部 controls：「沒有樹放得下（Pending）」按鈕
- **初始狀態**：佇列 6 顆泡泡（固定資料）
  - `500m / 1Gi`、`1000m / 2Gi`、`500m / 512Mi`、`1000m / 1Gi`、`1500m / 1Gi`、`2500m / 1Gi`
- **互動規則**
  - 第一段：點樹放入當前泡泡
    - 放得下（Request 加總 ≤ Allocatable）→ 泡泡掛上，Meter 增加
    - 放不下 → 樹 `shake`，HintBubble 顯示 `Insufficient cpu`（或 memory），並補一句「實際用量只有 10% 也沒用，選樹官看的是 Request」
    - 真的沒有任何一棵放得下時點「Pending」→ 正確；還有樹放得下卻點 Pending → 錯
    - 最後一顆 `2500m` 一定放不下，必須判 Pending
  - 第二段：一顆已掛上的泡泡出現 `limit-line`，兩題 ChoiceCards
    - 「CPU 用量衝過 Limit」→ 「被限速（throttle），變慢但還在」；播放小鳥 `fx: 'slow'`
    - 「記憶體用量衝過 Limit」→ 「被砍掉重啟（OOMKilled）」；播放小鳥 `pop` 再 `bounce`，RESTARTS +1
- **勝利條件**：6 顆都判斷正確（錯誤 ≤ 2 次）且第二段兩題答對
- **失敗／重試**：錯誤超過 2 次 → 失敗彈窗 → 再玩一次
- **頓悟時刻**：「選樹官（Scheduler）只看 Request 加總，不看實際用量。CPU 超標會變慢，記憶體超標會被砍。」
- **使用角色**：tree-picker, tree, bubble, bird, request-tag, limit-line
- **使用 kit**：GameShell, KChar, TagChip, Meter, ChoiceCards, HintBubble
- **忠實度備註**：真實排程還會考慮 affinity、taint、topology 等條件；本遊戲只模擬資源 fit

## Day 26：旋鈕心算王

- **K8s 概念**：HPA 使用率 = 用量 ÷ Request；期望副本 = ceil(現有 × 目前 ÷ 目標)；10% 容忍度；上下限；縮容穩定窗口 5 分鐘；沒 Request 或沒 metrics-server 顯示 `<unknown>`；HPA 只改 replicas，Pod 由控制器建立
- **gameTitle**：旋鈕心算王
- **gameHint**：算出 HPA 要調到幾顆
- **單局時間**：約 60 秒（5 回合）
- **畫面配置**
  - 頂部：`hpa-knob` 與指針，旁邊數據卡（現有幾顆、平均使用率、目標、上下限）
  - 中段：`steward` 手上的 `replicas` 牌 + `owl` + 泡泡列
  - 底部：答案按鈕，數字 2–10 兩排，另有「維持不變」「<unknown>」
- **互動規則**（useRounds，ChoiceCards 風格的數字鍵）
  - 回合 1：3 顆、90%、目標 50% → 6（3 × 1.8 = 5.4，無條件進位）
  - 回合 2：2 顆、100%、目標 50%、上限 3 → 3（算出 4 但被上限擋住）
  - 回合 3：4 顆、52%、目標 50% → 維持不變（比值 1.04，在 10% 容忍度內）
  - 回合 4：Pod 沒設 CPU Request → `<unknown>`（分母是零）
  - 回合 5：6 顆、使用率 1 分鐘前降到 20% → 維持不變（縮容要等 5 分鐘穩定窗口）
  - 答對後播放：旋鈕轉動 → replicas 牌數字改變 → 0.5 秒後 `owl` 才吹出新泡泡（新泡泡先降旗，再升旗）
  - 答錯：HintBubble 顯示算式
- **勝利條件**：5 回合答對 ≥ 4
- **失敗／重試**：答錯 2 回合以上 → 失敗彈窗附公式 → 再玩一次
- **頓悟時刻**：「HPA 看的是用量除以 Request，調整的是期望副本數；真正增減 Pod 的是工作負載控制器。擴容要時間，縮容刻意更慢。」
- **使用角色**：hpa-knob, steward, owl, bubble, ready-flag
- **使用 kit**：GameShell, KChar, Meter, ChoiceCards, useRounds, HintBubble

## Day 27：編號點名

- **K8s 概念**：StatefulSet 固定名稱、OrderedReady 依序建立、每個編號專屬 PVC、刪掉後同名重建接回原倉庫、縮容從最大編號開始、Headless Service 帶編號的 DNS
- **gameTitle**：編號點名
- **gameHint**：照順序建泡泡，接回專屬倉庫
- **單局時間**：約 60 秒（4 段）
- **畫面配置**
  - 頂部：`numbered-keeper`（玩家扮演 StatefulSet 控制器）
  - 中段：3 個泡泡位置（`ghost`），名牌 `hello-db-0`、`-1`、`-2`
  - 下段：3 座 `warehouse`，各帶 `borrow-slip` 名牌 `data-hello-db-0/1/2`
  - 底部：本段任務卡
- **互動規則**（useRounds）
  - 第 1 段「依序建立」：點泡泡位置建立
    - 只能點下一個編號，且前一顆 `ready-flag` 升起後才行（每顆 1.5 秒）
    - 跳號或太早點 → HintBubble「OrderedReady：前一顆 Ready 才建下一顆」
  - 第 2 段「1 號被刪了」：`hello-db-1` `pop`，原位出現同名 ghost；玩家點它重建，再點它要接的倉庫
    - 點 `data-hello-db-1` → 正確，資料原封不動
    - 點其他 → HintBubble「每個編號只接自己那座」
  - 第 3 段「連主節點 0 號」：地址 TagChip 三選一：`hello-db`、`hello-db-0.hello-db`、`10.244.1.9` → 正解 `hello-db-0.hello-db`
    - 選 `hello-db`：HintBubble「Headless Service 沒有虛擬 IP，這個名字會回傳全部 Pod 的位址」
    - 選 IP：HintBubble「Pod 重建後 IP 會換」
  - 第 4 段「縮成 2 顆，誰先走？」：點泡泡 → 正解 `hello-db-2`；它 `pop` 後，`data-hello-db-2` 倉庫仍留著
- **勝利條件**：4 段完成
- **失敗／重試**：無失敗
- **頓悟時刻**：「號碼牌配專屬倉庫（PV），這才是 StatefulSet。刪掉 1 號，回來的還是 1 號，接回的還是它自己那座倉庫。」
- **使用角色**：numbered-keeper, bubble, bird, ready-flag, warehouse, borrow-slip, totem
- **使用 kit**：GameShell, KChar, TagChip, ChoiceCards, useRounds, useSequence, HintBubble
- **忠實度備註**：縮容時預設不刪 PVC；Headless Service 的 Service 名稱查詢會回傳所有就緒 Pod 的位址

## Day 28：管理者派工

- **K8s 概念**：DaemonSet 每個 Node 一份；Job 跑完 Completed、失敗重試；CronJob 建 Job、Job 建 Pod；用 Deployment 跑一次性腳本會 CrashLoopBackOff
- **gameTitle**：管理者派工
- **gameHint**：把工作交給對的管理者
- **單局時間**：約 60 秒
- **畫面配置**
  - 上半：4 張工作卡 TagChip：`每台機器收日誌`、`一次性資料遷移`、`每天凌晨 3 點備份`、`網站前端常駐`
  - 中段：4 位管理者 `tree-guard-captain`、`job-ticket`、`cron-clock`、`steward`，每位下方一個槽
  - 下半：3 棵 `tree`，用來播放派工結果
  - 底部：「上工！」按鈕
- **互動規則**
  - 派工（usePickPlace）：點工作卡再點管理者
  - 點「上工！」依序播放每張卡的結果：
    - 日誌 → 守樹隊長：每棵樹各一顆泡泡 → 通過
    - 日誌 → 部署管家（3 副本）：兩顆擠在同一棵樹，一棵樹沒人收 → 失敗
    - 遷移 → 委託單：泡泡跑完變 `Completed` 靜止 → 通過
    - 遷移 → 部署管家：跑完被重啟、再跑完再重啟 → `CrashLoopBackOff` → 失敗
    - 備份 → 定時任務鐘：時鐘轉到 03:00 → 吐出一張委託單 → 委託單吹出泡泡 → `Completed` → 通過
    - 前端 → 部署管家：3 顆常駐 → 通過
  - 失敗的卡退回卡區，可重新派
  - 全部通過後的彩蛋：提示「點空地種一棵新樹」→ 新樹長出，守樹隊長自動派一顆泡泡上去
- **勝利條件**：4 張卡全部通過並完成彩蛋
- **失敗／重試**：無失敗，派錯即重派
- **頓悟時刻**：「CronJob 建立 Job，Job 再建立 Pod；守樹隊長（DaemonSet）不看你要幾顆，看島上有幾棵樹。會結束的工作交給 Job，結束是正常的。」
- **使用角色**：tree-guard-captain, job-ticket, cron-clock, steward, tree, bubble, bird
- **使用 kit**：GameShell, KChar, TagChip, usePickPlace, HintBubble

## Day 29：全島五條線

- **K8s 概念**：五條協作線：下指令、控制面決定、Node 執行、流量進來、資料落地；API Server 寫完就回應；控制面掛掉時既有工作負載照跑
- **gameTitle**：全島五條線
- **gameHint**：依序點角色，接通五條線
- **單局時間**：約 80 秒
- **畫面配置**
  - 全島縮圖：左上燈塔村（`lighthouse`、`memory-tree`、`tree-picker`、`patrol-captain`）、中央 `tree` 與 `squirrel`、`steward`、`owl`、`bubble`、`bird`、右側 `gate-map`、`totem`、樹下 `road-keeper`、地面 `warehouse`、`borrow-slip`、干擾用 `food-bucket`
  - 頂部：目前線條名稱 + 動詞（說、想、做、送、留）+ 回合點
- **互動規則**（useSequence × 5 + 最後一題 ChoiceCards）
  - 線 1「說」：`whistle → lighthouse → memory-tree`，完成時哨子旁跳 `created`，HintBubble「這時島上可能什麼都還沒發生」
  - 線 2「想」：`patrol-captain → steward → owl → tree-picker → lighthouse`
  - 線 3「做」：`squirrel → bubble → bird → ready-flag`
  - 線 4「送」：`gate-map → totem → road-keeper → bubble → bird`
  - 線 5「留」：`bird → borrow-slip → warehouse`
    - 點 `food-bucket` → HintBubble「食物桶（emptyDir）跟著泡泡一起消失」
  - 每條線完成時，該線以顏色連起來留在地圖上
  - 最後：燈塔村變暗（`dim`），ChoiceCards 多選題「燈塔村停電時，哪些還會繼續？」
    - 正解：`已在跑的泡泡繼續接客`、`柱子照常轉送到現有泡泡`
    - 錯誤：`刪掉的泡泡自己長回來`、`新的 kubectl apply 生效`
- **勝利條件**：五條線完成且停電題答對
- **失敗／重試**：無失敗，錯誤僅提示
- **頓悟時刻**：「你說、村裡想、樹上做、道路管理員（kube-proxy）送、倉庫（PV）留。決定和執行分開，所以燈塔村停電時，樹上的服務還在跑。」
- **使用角色**：whistle, lighthouse, memory-tree, tree-picker, patrol-captain, steward, owl, squirrel, tree, bubble, bird, ready-flag, gate-map, totem, road-keeper, borrow-slip, warehouse, food-bucket
- **使用 kit**：GameShell, KChar, TagChip, useSequence, ChoiceCards, useRounds, HintBubble
- **忠實度備註**：停電期間自癒與新的排程都會停止；既有 kube-proxy 規則仍在，所以現有 Service 轉送照常

## Day 30：雲之島值班夜

- **K8s 概念**：五個核心問題總複習：Pod 起不來怎麼查、Service 三型、零停機與回滾、PV／PVC、三種探針
- **gameTitle**：雲之島值班夜
- **gameHint**：連續處理五個島嶼事故
- **單局時間**：約 75 秒（5 題 × 15 秒）
- **畫面配置**
  - 上半：事故畫面（重用角色組成小場景）+ 計時條 + 剩餘命數
  - 下半：ChoiceCards 3 選 1
  - 背景：空的合照台；每解決一個事故，對應角色跳上合照台
- **互動規則**（useRounds）
  - 事故 1：泡泡 `CrashLoopBackOff`，RESTARTS 8 → 正解 `kubectl logs --previous`；干擾 `kubectl delete pod`、`重建整座島`
    - 上台：`bubble`、`magnifier`
  - 事故 2：資料庫只該給島內用，卻開了 LoadBalancer → 正解「改成 ClusterIP」；干擾「改成 NodePort」「維持現狀」
    - 上台：`totem-inner`、`totem-dock`
  - 事故 3：新版推一半卡住，一顆紅泡泡 → 正解 `kubectl rollout undo`；干擾「把舊的 ReplicaSet 刪掉」「等它自己好」
    - 上台：`steward`、`owl`
  - 事故 4：資料庫泡泡重建後資料要還在 → 正解「掛 PVC，資料放倉庫」；干擾「放 emptyDir」「寫在容器裡」
    - 上台：`borrow-slip`、`warehouse`
  - 事故 5：尖峰時服務變慢，前端被一直重啟 → 正解「把資料庫檢查從 Liveness 移到 Readiness，Liveness 放寬」；干擾「Liveness 再調嚴格」「關掉所有探針」
    - 上台：`alive-bell`、`ready-flag`
  - 答錯或超時：扣一命，顯示正解與一句理由，仍進下一題
  - 全部結束：`lighthouse`、`memory-tree`、`tree-picker`、`patrol-captain`、`gatekeeper`、`hpa-knob`、`numbered-keeper`、`whistle`、`island` 一起跳上，組成全員合照
- **勝利條件**：5 題結束時至少剩 1 命（共 3 命）
- **失敗／重試**：命用完 → 失敗彈窗 → 再玩一次
- **頓悟時刻**：「你不再記哪台跑什麼，島替你記。提交期望狀態、控制器持續調和、再從觀測結果修正設定，這就是 Kubernetes。」
- **使用角色**：bubble, magnifier, totem-inner, totem-dock, steward, owl, borrow-slip, warehouse, alive-bell, ready-flag, lighthouse, memory-tree, tree-picker, patrol-captain, gatekeeper, hpa-knob, numbered-keeper, whistle, island
- **使用 kit**：GameShell, KChar, ChoiceCards, useRounds, useCountdown, HintBubble

---

## 四、實作分配

**原則：先由一人完成 kit（11 個積木 + 單元測試），再由 5 位程式 agent 平行實作；每組 6 天、難度分數 12–13，並按主題分組讓同組共用場景邏輯。**

難度分數：1 = 簡單（純序列或選擇）、2 = 中等（多段或 pick & place）、3 = 困難（即時模擬、多狀態連動）

```
① kit 積木
  ↓
② 5 組平行實作
  ↓
③ 交叉試玩驗收
```

① kit 先行：`GameShell`、`KChar`、`TagChip`、`Meter`、`ChoiceCards`、`HintBubble` 與 6 個 composable，附單元測試；`KChar` 依賴美術的角色元件索引，美術未完成前先用佔位方塊
② 各組只新增 `games/days/DayNNGame.vue`，不改 kit；需要新積木時回報，不自己在 kit 加
③ 每組完成後由另一組試玩，依本文件的勝利條件與頓悟時刻驗收

**A 組：控制面、指令與排程（12 分）**
- Day 1 半夜救火員（3）
- Day 2 五分鐘登島（1）
- Day 4 燈塔村接力（1）
- Day 5 哨子點唱機（2）
- Day 25 選樹官塞泡泡（3）
- Day 29 全島五條線（2）

**B 組：工作負載與擴縮（12 分）**
- Day 3 島嶼點點名（1）
- Day 9 戳不完的泡泡（2）
- Day 10 滾動換裝秀（3）
- Day 11 後悔捲軸（3）
- Day 26 旋鈕心算王（1）
- Day 27 編號點名（2）

**C 組：網路與健康檢查（13 分）**
- Day 14 名單偵探（2）
- Day 15 入口開幾層（1）
- Day 16 大門看板（3）
- Day 17 狀態碼分診（2）
- Day 18 封包旅行團（2）
- Day 24 鈴與旗（3）

**D 組：Pod 結構、設定與儲存（12 分）**
- Day 6 泡泡室友配對（2）
- Day 7 YAML 縮排師（2）
- Day 19 便條本改了沒（2）
- Day 20 玩具鎖鑑定（1）
- Day 21 存檔大作戰（3）
- Day 22 借用單配對（2）

**E 組：查錯、隔離與綜合（13 分）**
- Day 8 放大鏡尋寶（2）
- Day 12 泡泡急診室（2）
- Day 13 跨籬喊話（2）
- Day 23 雙層島混沌測試（3）
- Day 28 管理者派工（2）
- Day 30 雲之島值班夜（2）
