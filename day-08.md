# Day 8：彩色圍巾 Label，K8s 到底怎麼認出誰是誰？

## 痛點

島上很快就會有幾十顆泡泡。K8s 沒有資料夾、沒有目錄結構，那它到底怎麼分辨哪幾顆是你的服務？

![day-08-01](illustrations/day-08-01.png)

```mermaid
%%{init: {"theme":"base","look":"handDrawn","handDrawnSeed":7,"themeVariables":{"background":"#DFF3FA","primaryColor":"#FFFDF7","primaryTextColor":"#4D4036","primaryBorderColor":"#7A6A5A","lineColor":"#8B7B6A","secondaryColor":"#FFDDB8","tertiaryColor":"#DDEFD9","fontFamily":"Hannotate SC, Klee One, Comic Sans MS, sans-serif","fontSize":"17px"},"flowchart":{"curve":"basis","htmlLabels":true,"padding":28,"nodeSpacing":48,"rankSpacing":64}}}%%
flowchart LR
    classDef default fill:#FFFDF7,stroke:#7A6A5A,stroke-width:2px,color:#4D4036
    classDef accent fill:#FFDDB8,stroke:#E58F65,stroke-width:2px,color:#5A3828
    classDef success fill:#DDEFD9,stroke:#78A66B,stroke-width:2px,color:#30452C
    L["Pod labels\napp=hello"] --> S["Selector\napp=hello"]
    S --> R["Matched Pods"]
    R --> SV["Service / ReplicaSet"]
```

![day-08-mermaid](illustrations/day-08-mermaid.png)
![day-08-diagram](illustrations/day-08-diagram.png)

IMG: 一群繫著不同顏色圍巾的泡泡散在樹上，一支放大鏡照出來的光圈裡只有繫紅圍巾的那三顆 ｜ 出場角色：泡泡、小鳥、彩色圍巾、放大鏡、巢樹 ｜ 亮橘重點：放大鏡的光圈範圍

答案是圍巾。在 Service、Deployment、ReplicaSet 這些 selector 場景，K8s 主要靠**每顆泡泡身上繫的圍巾**找目標；Namespace、名字和 owner reference 也各自有用途。

圍巾就是 Label，格式是 `key: value`，例如 `app: hello`。一顆泡泡可以繫很多條：`app: hello`、`env: dev`、`tier: frontend`，各代表一個分類角度。

拿著放大鏡去找特定圍巾的動作叫 **Selector**。「幫我找出所有繫著 `app: hello` 的泡泡」── 就這麼一句話，回傳一組泡泡。

看圖上那個光圈：光圈主要由 selector 與圍巾決定，但 Namespace 和 selector 的種類也會影響搜尋範圍。

今天這件事看起來平凡，但它是後面所有東西的地基：

- 貓頭鷹（ReplicaSet）靠圍巾數泡泡夠不夠（Day 9）
- 隊長（Deployment）靠圍巾知道哪些泡泡歸它管（Day 10）
- 圖騰柱（Service）靠圍巾決定流量要送給誰（Day 14）

![day-08-02](illustrations/day-08-02.png)

IMG: 同一顆泡泡身上同時繫著三條不同顏色的圍巾，三支放大鏡各自照出其中一條 ｜ 出場角色：泡泡、小鳥、彩色圍巾、放大鏡 ｜ 亮橘重點：三條圍巾同時繫在同一顆泡泡上

圍巾要怎麼取名？沒有硬規定，但有一組大家都在用的慣例，照抄就好：`app` 放服務名稱、`env` 放環境（dev/staging/prod）、`tier` 放層級（frontend/backend）、`version` 放版本。重點不是名字多漂亮，是**整個團隊用同一套**，因為放大鏡照的是字串，大小寫差一個字都算不同條圍巾。

這三個角色沒有一個是靠名字找目標的，全部靠圍巾。所以圍巾標錯 = 找不到人 = 服務掛掉，而且掛得無聲無息 ── 這是新手最常踩、也最難查的坑，今天我們就故意踩一次。

## 動手 5 分鐘

昨天我們有一份 `hello-pod.yaml` 建出來的泡泡，但它身上沒繫圍巾。今天幫它繫上，然後用放大鏡找它。

先看現在有沒有圍巾：

```bash
kubectl get pods --show-labels
```

LABELS 那欄是空的（或只有 `<none>`）。這顆泡泡目前誰都找不到它。

改 `hello-pod.yaml`，在 `metadata` 底下加兩行：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: hello
  labels:
    app: hello
spec:
  containers:
    - name: hello
      image: nginx:alpine
      ports:
        - containerPort: 80
```

套用並確認：

```bash
kubectl apply -f hello-pod.yaml
kubectl get pods --show-labels
```

LABELS 欄變成 `app=hello`。圍巾繫上去了。

現在拿放大鏡照它，`-l` 就是 Selector：

```bash
kubectl get pods -l app=hello
```

hello 出現在清單裡。

故意照一條不存在的圍巾：

```bash
kubectl get pods -l app=world
```

`No resources found in default namespace.` 泡泡明明還在跑，只是不在光圈裡。**記住這個畫面**，之後你的 Service 沒流量、Deployment 數字對不上，這是很常見、值得先檢查的原因之一。

![day-08-shot-01](screenshots/day-08-shot-01.png)

泡泡好好地跑著，放大鏡卻照不到 ── 而且沒有任何錯誤訊息。

再多建一顆繫不同圍巾的泡泡，感受一下分類：

```bash
kubectl run other --image=nginx:alpine --labels="app=other"
kubectl get pods --show-labels
```

兩顆泡泡、兩條不同圍巾。分別照照看：

```bash
kubectl get pods -l app=hello
kubectl get pods -l 'app in (hello,other)'
```

第一行只出現 hello，第二行兩顆都出現。Selector 除了 `=`，還吃 `in`、`!=`、`!key`（沒繫這條圍巾的）這幾種條件。

也可以不改檔案，直接在跑著的泡泡上加圍巾：

```bash
kubectl label pod hello env=dev
kubectl get pods -l env=dev --show-labels
```

臨時查東西很好用，但正式的圍巾一定要寫回 YAML。因為 apply 是照著檔案內容對齊現況的，這個欄位如果由目前這份 apply 設定管理，檔案裡拿掉後，下次 apply 可能會把它移除 ── 而且不會有任何警告。

最後一個實用招式，把圍巾拉出來當表格欄位看：

```bash
kubectl get pods -L app,env
```

`-L`（大寫）跟 `-l`（小寫）不一樣：小寫是拿放大鏡篩選，大寫是把指定的圍巾多印成一欄。泡泡一多的時候，這行比 `--show-labels` 好讀很多。

收工前把測試用的泡泡清掉：

```bash
kubectl delete pod other
```

最後把圍巾跟另一個長得很像的東西分清楚：**Annotation（附註）**。

兩者格式一模一樣，都是掛在 `metadata` 底下的 `key: value`。差別只有一個，但很關鍵：

**圍巾是拿來被找的，附註是拿來被讀的。**

Selector 不會使用 Annotation 來篩選。所以任何你需要用來篩選、分組、被 Service 或 Deployment 選中的資訊，一律放 Label；那些「給人看」或「給工具看」但沒人需要拿它來搜尋的東西，放 Annotation。

你 Day 11 會用到的 `kubernetes.io/change-cause`、Day 16 會用到的 Ingress 設定，全部都是 Annotation。

也因為 Label 要能被快速搜尋，它有格式限制：長度上限 63 字元、只能用英數與 `-_.`，不能有空格和中文。Annotation 沒有這些限制，塞一整段說明文字都可以。

```bash
kubectl annotate pod hello owner="platform-team"
kubectl get pod hello -o jsonpath='{.metadata.annotations}{"\n"}'
```

再補一個圍巾的實際用途，它比你想的更常用到：**批次操作。**

放大鏡不只能用來查，也能用來**一次對一群泡泡下手**：

```bash
kubectl delete pods -l app=other
kubectl logs -l app=hello --tail=5
```

第一行刪掉所有繫 `app=other` 圍巾的泡泡，不管它們叫什麼名字、有幾顆。第二行一次撈出一整組泡泡的日誌。

這在正式環境非常實用 ── 你不會想在三十顆泡泡的環境裡，一個一個複製貼上那串亂碼名字。**圍巾標好，整組操作就是一行的事；圍巾沒標好，你只能一顆一顆手動處理。**

## 帶走一句話

**K8s 靠圍巾找人，不靠名字。**

## 參考資源

- [Labels and Selectors](https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/)
- [Annotations](https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations/)
