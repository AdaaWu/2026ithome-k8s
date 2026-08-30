# Day 21：泡泡（Pod）裡的共享食物桶（emptyDir） ── 為什麼重啟之後資料就不見了


## 痛點

你的服務寫了一整天的上傳檔案，泡泡（Pod）重啟一次，全部消失。你檢查了三遍程式，程式沒錯。

![day-21-01](illustrations/day-21-01.png)

```mermaid
%%{init: {"theme":"base","look":"handDrawn","handDrawnSeed":7,"themeVariables":{"background":"#DFF3FA","primaryColor":"#FFFDF7","primaryTextColor":"#4D4036","primaryBorderColor":"#7A6A5A","lineColor":"#8B7B6A","secondaryColor":"#FFDDB8","tertiaryColor":"#DDEFD9","fontFamily":"Hannotate SC, Klee One, Comic Sans MS, sans-serif","fontSize":"17px"},"flowchart":{"curve":"basis","htmlLabels":true,"padding":28,"nodeSpacing":48,"rankSpacing":64}}}%%
flowchart TD
    classDef default fill:#FFFDF7,stroke:#7A6A5A,stroke-width:2px,color:#4D4036
    classDef accent fill:#FFDDB8,stroke:#E58F65,stroke-width:2px,color:#5A3828
    classDef success fill:#DDEFD9,stroke:#78A66B,stroke-width:2px,color:#30452C
    P["Pod lifetime"] --> E["emptyDir volume"]
    E --> C1["Container A"]
    E --> C2["Container B"]
    P -->|deleted| X["emptyDir data deleted"]
```

![day-21-mermaid](illustrations/day-21-mermaid.png)
![day-21-diagram](illustrations/day-21-diagram.png)

IMG: 一顆泡泡（Pod）正在破掉，裡面的共享食物桶（emptyDir）與食盆跟著碎成一地 ｜ 出場角色：泡泡（Pod）、小鳥（Container）、共享食物桶（emptyDir）、食盆 ｜ 亮橘重點：碎掉消失的共享食物桶（emptyDir）

程式沒錯，是你對容器的檔案系統有誤解。

**容器的檔案系統是暫時的。** 這件事在 Docker 時代就成立，只是你可能一直沒被咬到，因為你的容器很少重啟。到了 K8s，泡泡（Pod）破掉是**日常**：滾動更新破、貓頭鷹補位破、節點資源不足被趕走也破。一天破幾十次都很正常。

每破一次，那隻小鳥（Container）寫在自己肚子裡的東西就全沒了。新的小鳥（Container）是從 image 重新長出來的，**image 是什麼樣，它就是什麼樣**。

所以想留住資料，得把資料放到「小鳥（Container）肚子外面」。圖上那個食盆更精確的正式名稱是 **Volume Mount**：它是 Pod 裡的掛載位置，實際來源可以是 `emptyDir`、ConfigMap、Secret、PVC 或其他 Volume。

今天先看的食盆來源是 **emptyDir**，直翻是「空目錄」。它的行為完全照字面：

**泡泡（Pod）建立時，K8s 開一個空目錄給它。泡泡（Pod）刪掉時，這個目錄跟著刪掉。**

看圖上食盆的位置和它碎掉的方式 ── 食盆的命運跟泡泡（Pod）綁在一起，不跟小鳥（Container）綁在一起。這個差別今天你會親眼驗證，而且它比你想的重要：

**小鳥（Container）重啟，食盆還在；泡泡（Pod）刪掉，食盆才消失。**

所以你的容器 crash 了一百次，只要是同一顆泡泡（Pod）在重啟容器，食盆裡的東西都活得好好的。這是很多人沒搞清楚的地方 ── **「重啟」有兩種**，一種是泡泡（Pod）裡的小鳥（Container）重啟（RESTARTS 加一），一種是整顆泡泡（Pod）被換掉（名字都變了）。前者不會掉資料，後者會。

那食盆有什麼用？既然反正會消失。

**用途一，同一顆泡泡（Pod）裡的小鳥（Container）共用資料。** Day 6 的 sidecar 情境：主容器把日誌寫進食盆，旁邊的收集器從食盆讀出來往外送。兩隻小鳥（Container）吃同一盆，這是 emptyDir 最經典的用法。

**用途二，暫存空間。** 處理中的檔案、解壓縮的中繼產物、快取。這些東西本來就不需要活過泡泡（Pod）。

![day-21-02](illustrations/day-21-02.png)

IMG: 一顆泡泡（Pod）裡兩隻小鳥（Container）共用中央一個共享食物桶（emptyDir），各自透過面前的食盆取用，左邊的小鳥（Container）往桶裡放東西、右邊的小鳥（Container）從盆裡拿走 ｜ 出場角色：泡泡（Pod）、小鳥（Container）、共享食物桶（emptyDir）、食盆 ｜ 亮橘重點：兩隻小鳥（Container）之間那個共享食物桶（emptyDir）

真正要「泡泡（Pod）破了資料還在」的東西，得放到泡泡（Pod）外面去 ── 那是明天的倉庫（PersistentVolume，PV）。

## 動手 5 分鐘

前二十天我們的資料全部靠 image 和便條本（ConfigMap）供應，沒有任何東西是泡泡（Pod）自己寫出來的。今天做一顆會寫東西的泡泡（Pod），然後看它怎麼弄丟資料。

建立 `demo-emptydir.yaml`，一顆泡泡（Pod）兩隻小鳥（Container）共用一個食盆：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: demo-vol
spec:
  containers:
    - name: writer
      image: busybox:1.36
      command: ["sh", "-c", "while true; do date >> /data/log.txt; sleep 5; done"]
      volumeMounts:
        - name: bowl
          mountPath: /data
    - name: reader
      image: busybox:1.36
      command: ["sh", "-c", "sleep 3600"]
      volumeMounts:
        - name: bowl
          mountPath: /shared
  volumes:
    - name: bowl
      emptyDir: {}
```

看清楚結構：`volumes` 宣告一個叫 `bowl` 的食盆（`emptyDir: {}` 就是「給我一個空的」），兩隻小鳥（Container）各自用 `volumeMounts` 把它掛到**不同的路徑**上。同一個食盆，兩個名字。

```bash
kubectl apply -f demo-emptydir.yaml
kubectl get pod demo-vol
```

READY 是 `2/2` ── 一顆泡泡（Pod），兩隻小鳥（Container）。

等十五秒，看 writer 寫了什麼：

```bash
kubectl exec demo-vol -c writer -- cat /data/log.txt
```

（`-c` 是指定哪隻小鳥（Container），一顆泡泡（Pod）多隻小鳥（Container）時必須加。）三行時間戳。

現在從**另一隻**小鳥（Container）去讀同一份資料：

```bash
kubectl exec demo-vol -c reader -- cat /shared/log.txt
```

**一模一樣的內容。** 它們吃的是同一盆。

**實驗一：小鳥（Container）重啟，食盆還在嗎？**

```bash
kubectl exec demo-vol -c reader -- wc -l /shared/log.txt
kubectl exec demo-vol -c writer -- kill 1
kubectl get pod demo-vol
```

RESTARTS 變成 1，writer 被重啟了。但泡泡（Pod）的名字沒變。等五秒再讀：

```bash
kubectl exec demo-vol -c reader -- wc -l /shared/log.txt
```

**行數比剛剛多，不是從零開始。** 舊資料還在，新的接在後面。食盆活過了容器重啟。

**實驗二：泡泡（Pod）破掉，食盆還在嗎？**

先記下現在的行數：

```bash
kubectl exec demo-vol -c reader -- wc -l /shared/log.txt
```

刪掉整顆泡泡（Pod）再建回來：

```bash
kubectl delete pod demo-vol
kubectl apply -f demo-emptydir.yaml
```

等十秒：

```bash
kubectl exec demo-vol -c reader -- cat /shared/log.txt
```

**只有一兩行，從頭開始。** 之前累積的全部消失了 ── 這就是圖上那個碎掉的食盆。

![day-21-shot-01](screenshots/day-21-shot-01.png)

小鳥（Container）重啟後行數繼續累加（7→10），泡泡（Pod）重建後直接歸零（10→2）。

收工清掉：

```bash
kubectl delete pod demo-vol
```

最後補兩個 emptyDir 的實用設定。第一，**它預設吃的是那棵樹的硬碟，而且沒有上限** ── 你的程式寫爆了，整棵樹的硬碟會被塞滿，樹上其他泡泡（Pod）跟著遭殃。所以正式環境要加水位線：

```yaml
    volumes:
      - name: bowl
        emptyDir:
          sizeLimit: 500Mi
```

超過就會被趕出去，至少不會拖累鄰居。

第二，食盆可以改放在記憶體裡：

```yaml
        emptyDir:
          medium: Memory
```

速度快很多，適合快取和暫存。但要記得它吃的是泡泡（Pod）的記憶體額度 ── 這個額度是什麼、超過會怎樣，Day 25 會講。

## 帶走一句話

**小鳥（Container）重啟食盆還在，泡泡（Pod）破了就沒了。**

## 參考資源

- [Volumes](https://kubernetes.io/docs/concepts/storage/volumes/)
- [emptyDir volume](https://kubernetes.io/docs/concepts/storage/volumes/#emptydir)
