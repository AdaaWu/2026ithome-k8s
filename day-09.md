# Day 9：泡泡破了誰來補？ ── 數泡泡的貓頭鷹 ReplicaSet

## 痛點

Day 7 你已經看過了：泡泡刪掉就是沒了，沒有人幫你補。正式環境不能這樣，機器半夜掛掉你不可能爬起來手動補。

IMG: 一隻貓頭鷹拿著計數器盯著樹枝，其中一顆泡泡正在破掉，旁邊立刻有一顆新泡泡被吹出來 ｜ 出場角色：數泡泡的貓頭鷹、泡泡、小鳥、巢樹 ｜ 亮橘重點：剛被吹出來的那顆新泡泡

貓頭鷹只做一件事，而且做一輩子：**數泡泡**。

它手上有兩個數字。一個是**期望數量**，你告訴它的，寫在 `replicas` 欄位；另一個是**實際數量**，它自己數出來的。兩個數字只要不一樣，它就動手把它們弄一樣 ── 少了就吹一顆，多了就戳破一顆。

它怎麼數？靠圍巾。你昨天繫的那條 `app: hello`，就是貓頭鷹的計數依據。它不看名字、不看是誰建的，只要身上有那條圍巾就算進去。

IMG: 貓頭鷹透過放大鏡只數繫紅圍巾的泡泡，旁邊一顆繫藍圍巾的泡泡沒被算進去 ｜ 出場角色：數泡泡的貓頭鷹、放大鏡、彩色圍巾、泡泡、小鳥 ｜ 亮橘重點：沒被算進去的那顆藍圍巾泡泡

這帶出一個很多人第一次會撞到的行為：**你手動建的泡泡，如果不小心繫了同一條圍巾，會被貓頭鷹算進去。** 數字超了，它就隨機戳破一顆 ── 有可能戳的是你手動建的，也有可能是它自己吹的。所以圍巾不要亂繫。

回頭看 Day 4 的宣告式：你對貓頭鷹說的是「我要三顆」這個**結果**，不是「去吹三顆」這個**動作**。動作做完就結束了，結果會被一直維持。這就是為什麼刪掉一顆它會自己長回來 ── 不是它記得你刪了什麼，是它數出來只剩兩顆。

最後講清楚一件事：實務上你**不會直接寫 ReplicaSet**。今天寫它只是為了看懂它在幹嘛，明天 Deployment 登場後，貓頭鷹就退到幕後由隊長指揮了。

## 動手 5 分鐘

昨天我們有一顆繫著 `app: hello` 圍巾、但沒人照顧的泡泡。今天把它交給貓頭鷹管。

先把單獨的泡泡刪掉，免得被算進去：

```bash
kubectl delete pod hello
```

建立 `hello-replicaset.yaml`：

```yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: hello-rs
spec:
  replicas: 3
  selector:
    matchLabels:
      app: hello
  template:
    metadata:
      labels:
        app: hello
    spec:
      containers:
        - name: hello
          image: nginx:alpine
          ports:
            - containerPort: 80
```

注意兩件事。第一，`apiVersion` 從 `v1` 變成 `apps/v1` ── 不同家族。第二，`selector.matchLabels` 是貓頭鷹拿的放大鏡，`template.metadata.labels` 是它吹出來的泡泡要繫什麼圍巾，**這兩處必須一模一樣**，不然它會吹出自己找不到的泡泡，然後無限吹下去。

`template` 底下那一整段，就是你昨天寫的 Pod YAML 去掉 `apiVersion` 和 `kind` 之後的樣子。

套用：

```bash
kubectl apply -f hello-replicaset.yaml
kubectl get rs
kubectl get pods
```

`get rs` 顯示 DESIRED 3、CURRENT 3、READY 3。`get pods` 出現三顆泡泡，名字是 `hello-rs-` 加一串亂碼 ── 貓頭鷹吹出來的泡泡名字是隨機的，因為它們可以互相替換。

現在做今天的重頭戲，挑一顆戳破：

```bash
kubectl delete pod $(kubectl get pods -l app=hello -o jsonpath='{.items[0].metadata.name}')
kubectl get pods
```

你會看到一顆處於 `Terminating`，同時**已經有一顆全新名字的泡泡在 `ContainerCreating`**。等兩秒再打一次，又是三顆 `Running`。

看貓頭鷹的說法：

```bash
kubectl describe rs hello-rs | grep -A5 Events
```

Events 裡一行 `Created pod: hello-rs-xxxxx`，時間就是你剛剛刪掉那一刻。

再玩一次，這次改數量。把檔案裡的 `replicas` 改成 5 再 apply：

```bash
kubectl apply -f hello-replicaset.yaml
kubectl get pods -l app=hello
```

多吹兩顆。改回 3 再 apply 一次，它會戳破兩顆 ── 戳哪兩顆你無法指定，因為對貓頭鷹來說每顆泡泡都一樣。

不改檔案也可以直接調整數量，臨時擴容很好用：

```bash
kubectl scale rs hello-rs --replicas=2
kubectl get rs
```

但記得跟昨天的圍巾一樣，這種現場改的數字下次 apply 就會被檔案蓋回去。

今天的 ReplicaSet 先留著，明天我們讓隊長接手它。

最後講一個很多人第一次刪東西會嚇到的行為：**刪掉貓頭鷹，泡泡會跟著全部消失。**

因為貓頭鷹吹出來的每一顆泡泡，身上都記著「我的主人是誰」。你可以親眼看到：

```bash
kubectl get pod -l app=hello -o jsonpath='{.items[0].metadata.ownerReferences}{"\n"}'
```

印出 `"kind":"ReplicaSet","name":"hello-rs"` 之類的內容。這叫 **ownerReference（歸屬紀錄）**，主人被刪掉，島上就會自動把它名下的東西一起清掉。

這是好事 ── 你不用一個一個追著刪。但如果你**只想換掉貓頭鷹、保留泡泡**，加這個參數：

```bash
kubectl delete rs hello-rs --cascade=orphan
kubectl get pods
```

貓頭鷹不見了，三顆泡泡還在，只是變成沒人管的孤兒。這招在正式環境臨時搶救時偶爾會用到，但平常不要這樣做 ── 沒人數的泡泡，破了就真的沒了。

（記得再 apply 一次把貓頭鷹建回來，明天要用。）

## 帶走一句話

**貓頭鷹只數數字，不認得哪顆是哪顆。**
