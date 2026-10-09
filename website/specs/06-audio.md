# 06 音樂與音效規格

## 需求

- 背景音樂用 WebAudio 即時合成，不放任何音檔
- 聽感目標：水彩繪本的溫暖感，柔和、慢、有空氣感，不要 8-bit 或電子味
- 音樂與音效各有一顆開關，各自存在瀏覽器
  - 音效：沿用 key `k8s-cloud-island-muted`（`'1'` 代表關閉）
  - 音樂：key `k8s-cloud-island-music-muted`（`'1'` 代表關閉），預設開啟
- 手機必須等使用者第一次點擊後才能出聲；音樂在第一次點擊任何地方時就開始，起始畫面按「登島出發」或「繼續冒險」也算
- 依頁面切換曲子，換曲時淡出淡入，不突然切斷
- 切到別的 App 或分頁隱藏時，音樂暫停；回來時接著播
- 音效與音樂共用同一個 AudioContext

## 場景與曲子

- `title` 起始畫面
- `map` 雲之島地圖
- `day` 關卡（開場、遊戲中、過關頁共用）
- `codex` 角色圖鑑
- `ruler` 統治大王證書

## 樂譜資料契約

型別定義在 `src/infrastructure/audio/score.ts`，曲子資料放 `src/infrastructure/audio/scores.ts`，播放引擎只讀資料、不寫死旋律。

## 開關介面

- 有頂部列的頁面：頂部列右側兩顆按鈕，🎵 音樂、🔊 音效，各 44px
- 起始畫面：右上角同樣兩顆按鈕
- 關掉音樂時立即淡出；打開時從目前場景的曲子開始播

## 曲目設計

共通原則：五聲音階與級進為主，每 4 小節一句並留白；pad 長音鋪底，bass 只落在第一或第三拍；最後一小節停在屬和弦或 sus 和弦，自然接回第一小節。

### title 起始畫面
- 調性／速度：F 大調，72 bpm，16 小節
- 和弦：Fmaj7 B♭add9 Dm7 Csus2 ｜ Fmaj7 B♭maj7 Gm7 Csus2 ｜ B♭add9 F/A Gm7 Fmaj7 ｜ B♭maj7 Am7 Gm7 Csus2
- 情緒：最溫暖的開場，主題 A–C–D 向上展開，第 9 小節爬到 G6 像張開翅膀
- 配器：音樂盒主旋律、毛氈鋼琴開放五度分解和弦、pad、bass 一三拍、風鈴在句尾點綴

### map 雲之島地圖
- 調性／速度：B♭ 大調，84 bpm，swing 0.15，32 小節（A A' B A''）
- 和弦：
  - A 段：B♭maj7 E♭add9 B♭maj7 Fsus2 ｜ Gm7 E♭maj7 Cm7 Fsus4
  - A' 段：B♭maj7 E♭add9 B♭maj7 Fsus2 ｜ Gm7 Cm7 Fsus4 B♭add9
  - B 段：E♭maj7 F Dm7 Gm7 ｜ E♭maj7 F Gm7 Fsus4
  - A'' 段：B♭maj7 E♭add9 B♭maj7 Fsus2 ｜ Gm7 Cm7 E♭maj7 Fsus4
- 情緒：輕快散步、探險，仍保持柔和
- 配器：A 段音樂盒旋律＋毛氈鋼琴二、四拍輕點雙音；B 段改由毛氈鋼琴在中音域唱旋律，音樂盒休息；風鈴在 A' 與 B 段的句尾各往下刷一次

### day 關卡
- 調性／速度：D 大調，66 bpm，16 小節，兩小節換一個和弦
- 和弦：Dmaj7 Gadd9 Bm7 Asus2 ｜ Dadd9 Gmaj7 Em7 Asus4
- 情緒：最低調、最稀疏，每兩小節只有一兩個零星的音，不形成可哼唱的旋律，久聽不累
- 配器：pad 為主、毛氈鋼琴零星單音、bass 每兩小節一次、風鈴整輪只出現兩次

### codex 角色圖鑑
- 調性／速度：E♭ 大調帶 Lydian 色彩（還原 A），76 bpm，16 小節
- 和弦：E♭maj7 F/E♭ E♭maj7 F/E♭ ｜ A♭maj7 Gm7 Fm9 B♭sus4 ｜ E♭maj7 F/E♭ Cm9 A♭maj7 ｜ A♭maj7#11 Gm7 Fsus2 B♭sus4
- 情緒：翻圖鑑、猜影子的好奇與一點神秘，旋律用斷奏和休止做出踮腳尖的感覺
- 配器：音樂盒斷奏旋律、毛氈鋼琴低音域滴答式分解和弦、pad、bass 每小節第一拍、風鈴落在 Lydian 和弦上

### ruler 統治大王證書
- 調性／速度：F 大調，80 bpm，16 小節
- 和弦：Fadd9 B♭maj7 C/E Fmaj7 ｜ B♭add9 Gm7 Csus4 C ｜ Dm7 B♭maj7 F/A B♭maj7 ｜ Gm7 Am7 B♭maj7 Csus2
- 情緒：溫暖的凱旋，用附點節奏重述 title 主題，第 10 小節攀到最高音 A6，Csus4 到 C 的解決帶出成就感
- 配器：音樂盒主旋律、毛氈鋼琴讚美詩式二分音符和弦（取代號角）、pad、bass 一三拍、風鈴在兩個終止處往上刷

## 實作細節

- 音效出聲時把音樂短暫壓低約 -6dB、0.4 秒回復，`tap` 太頻繁不壓低
- 音效音色改為溫暖版：正弦為主、柔和起音，與音樂共用同一顆殘響；名稱與觸發時機不變
- 每個音的時間隨機微調 ±10ms、力度 ±10%，增加人味
- 分頁卡頓後落後太久的音符直接略過，不擠在同一刻補播
- 任何頁面的第一次點擊或按鍵就解鎖音樂；iOS 來電等中斷後，回到前景或下一次手勢時恢復
- 作曲工具 `src/infrastructure/audio/notation.ts`：用音名字串寫旋律、和弦進行、分解和弦與低音線
- 開關按鈕抽成共用元件 `AudioToggles.vue`，頂部列與起始畫面共用
