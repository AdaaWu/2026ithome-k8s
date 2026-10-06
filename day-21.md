# Day 21：泡泡 Pod 裡的 emptyDir，為什麼重啟之後資料就不見了


## 痛點

服務寫了一整天的上傳檔案，泡泡（Pod）重啟一次，全部消失。
程式檢查了三遍，程式沒錯。

![day-21-01](illustrations/day-21-01.png)
一顆泡泡（Pod）正在破掉，裡面的共享食物桶（emptyDir）與食盆（Volume Mount）跟著碎成一地。


## 容器的檔案系統是暫時的

![day-21-diagram](illustrations/day-21-diagram.png)

程式沒錯，是對容器的檔案系統有誤解。

**容器的檔案系統是暫時的。**
這件事在 Docker 時代就成立，只是很少被咬到，因為容器很少重啟。
到了 K8s，泡泡（Pod）破掉是**日常**：滾動更新破、貓頭鷹（ReplicaSet）補位破、節點資源不足被趕走也破。
一天破幾十次都很正常。

每破一次，那隻小鳥（Container）寫在自己肚子裡的東西就全沒了。
新的小鳥（Container）是從 image 重新長出來的，**image 是什麼樣，它就是什麼樣**。

所以想留住資料，得把資料放到「小鳥（Container）肚子外面」。
圖上那個食盆更精確的正式名稱是 **Volume Mount**：它是 Pod 裡的掛載位置，實際來源可以是 `emptyDir`、ConfigMap、Secret、PVC 或其他 Volume。


## emptyDir 的行為

今天先看的食盆（Volume Mount）來源是 **emptyDir**，直翻是「空目錄」。
它的行為完全照字面：

**泡泡（Pod）建立時，K8s 開一個空目錄給它。泡泡（Pod）刪掉時，這個目錄跟著刪掉。**

看圖上食盆（Volume Mount）的位置和它碎掉的方式，食盆的命運跟泡泡（Pod）綁在一起，不跟小鳥（Container）綁在一起。
這個差別今天會親眼驗證，而且它比想像中重要：

**小鳥（Container）重啟，食盆（Volume Mount）還在；泡泡（Pod）刪掉，食盆才消失。**

所以容器 crash 了一百次，只要是同一顆泡泡（Pod）在重啟容器，食盆（Volume Mount）裡的東西都活得好好的。

這是很多人沒搞清楚的地方：**「重啟」有兩種**，一種是泡泡（Pod）裡的小鳥（Container）重啟（RESTARTS 加一），一種是整顆泡泡（Pod）被換掉（名字都變了）。
前者不會掉資料，後者會。


## 既然反正會消失，食盆有什麼用

**用途一，同一顆泡泡（Pod）裡的小鳥（Container）共用資料**
Day 6 的 sidecar 情境：主容器把日誌寫進食盆（Volume Mount），旁邊的收集器從食盆讀出來往外送。
兩隻小鳥（Container）吃同一盆，這是 emptyDir 最經典的用法。

**用途二，暫存空間**
處理中的檔案、解壓縮的中繼產物、快取。
這些東西本來就不需要活過泡泡（Pod）。

![day-21-02](illustrations/day-21-02.png)
一顆泡泡（Pod）裡兩隻小鳥（Container）共用中央的共享食物桶（emptyDir），各自透過面前的食盆（Volume Mount）取用，一邊往桶裡放東西、一邊從盆裡拿走。

真正要「泡泡（Pod）破了資料還在」的東西，得放到泡泡（Pod）外面去，那是明天的倉庫（PersistentVolume，PV）。

## 動手 5 分鐘

前二十天我們的資料全部靠 image 和便條本（ConfigMap）供應，沒有任何東西是泡泡（Pod）自己寫出來的。今天做一顆會寫東西的泡泡（Pod），然後看它怎麼弄丟資料。

建立 `demo-emptydir.yaml`，一顆泡泡（Pod）兩隻小鳥（Container）共用一個食盆（Volume Mount）：

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

看清楚結構：`volumes` 宣告一個叫 `bowl` 的食盆（`emptyDir: {}` 就是「給我一個空的」），兩隻小鳥（Container）各自用 `volumeMounts` 把它掛到**不同的路徑**上。同一個食盆（Volume Mount），兩個名字。

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

**實驗一：小鳥（Container）重啟，食盆（Volume Mount）還在嗎？**

```bash
kubectl exec demo-vol -c reader -- wc -l /shared/log.txt
kubectl exec demo-vol -c writer -- kill 1
kubectl get pod demo-vol
```

RESTARTS 變成 1，writer 被重啟了。但泡泡（Pod）的名字沒變。等五秒再讀：

```bash
kubectl exec demo-vol -c reader -- wc -l /shared/log.txt
```

**行數比剛剛多，不是從零開始。** 舊資料還在，新的接在後面。食盆（Volume Mount）活過了容器重啟。

**實驗二：泡泡（Pod）破掉，食盆（Volume Mount）還在嗎？**

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

**只有一兩行，從頭開始。** 之前累積的全部消失了 ── 這就是圖上那個碎掉的食盆（Volume Mount）。

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

第二，食盆（Volume Mount）可以改放在記憶體裡：

```yaml
        emptyDir:
          medium: Memory
```

速度快很多，適合快取和暫存。但要記得它吃的是泡泡（Pod）的記憶體額度 ── 這個額度是什麼、超過會怎樣，Day 25 會講。

## 帶走一句話

**小鳥（Container）重啟食盆（Volume Mount）還在，泡泡（Pod）破了就沒了。**

## 參考資源

- [Volumes](https://kubernetes.io/docs/concepts/storage/volumes/)
- [emptyDir volume](https://kubernetes.io/docs/concepts/storage/volumes/#emptydir)
