# Day 10：Deployment 怎麼滾動更新？部署管家的版本卷軸


## 痛點

貓頭鷹（ReplicaSet）會幫你維持三顆泡泡（Pod），但要換新版 image 的時候呢？
把三顆一起戳破再吹新的，中間那幾秒服務就會中斷。

![day-10-01](illustrations/day-10-01.png)
部署管家（Deployment）手持版本卷軸（Revision）站在中央，左邊舊版泡泡（Pod）一顆顆消失、右邊新版一顆顆吹出來，交界處那一格就是「滾動更新 Rolling Update」正在發生的地方，讓服務流量不歸零。


## 島上的三層指揮鏈

![day-10-diagram](illustrations/day-10-diagram.png)

島上的階層關係由上而下分別為：

**部署管家（Deployment）→ 貓頭鷹（ReplicaSet）→ 泡泡（Pod）**

① **部署管家（Deployment）**：負責描述版本與宣告副本需求。
② **貓頭鷹（ReplicaSet）**：負責對應單一版本並數清楚泡泡（Pod）的數量，一個版本對應一隻貓頭鷹。
③ **泡泡（Pod）**：實際執行容器服務的工作單元。


## 一個版本一隻貓頭鷹 ReplicaSet 

今天跑 v1，部署管家（Deployment）手下有一隻貓頭鷹（ReplicaSet），被交代「維持 3 顆 v1 泡泡（Pod）」。
明天換 v2，部署管家（Deployment）不會叫原本那隻改吹 v2，它**另外找一隻新貓頭鷹（ReplicaSet）** 來管 v2，然後同時對兩隻下指令：

新貓頭鷹（ReplicaSet），數字加一（吹出一顆 v2）。
舊貓頭鷹（ReplicaSet），數字減一（收掉一顆 v1）。
再加一。再減一。再加一。再減一。

直到新的變 3、舊的變 0，這就是**滾動更新 Rolling Update**。

整個過程中，在舊版仍健康、Readiness 設定正確，而且更新策略保留足夠舊副本時，能服務的泡泡（Pod）數量可以維持不掉到 0。

![day-10-02](illustrations/day-10-02.png)
部署管家（Deployment）左手邊那隻貓頭鷹（ReplicaSet）的計數器停在 0、右手邊另一隻停在 3，兩隻各自看著自己那一區的泡泡（Pod）

舊貓頭鷹（ReplicaSet）不會被刪掉，它會留著、數字停在 0。

這件事有個很實際的好處：後悔的時候，部署管家（Deployment）只要把數字倒著調回去就好，不必手動記住舊 tag。
但如果新 Pod 被排到沒有快取的 Node，仍可能重新拉 image。這就是明天要玩的 rollback。

那為什麼不直接用貓頭鷹（ReplicaSet）就好？
因為貓頭鷹（ReplicaSet）只認得一組設定。改了它的 image，它會把手上的泡泡（Pod）全部處理掉重來，中間沒有任何緩衝。

**貓頭鷹（ReplicaSet）管數量，部署管家（Deployment）管版本更替的節奏**，這是兩件事。

一般無狀態服務通常寫 Deployment，昨天的 ReplicaSet 只是為了讓你今天看得懂中間那一層。

## 動手 5 分鐘

昨天我們有一個 `hello-rs` 貓頭鷹（ReplicaSet）管著三顆泡泡（Pod）。今天把它換成部署管家（Deployment）來管。

先把光桿貓頭鷹（ReplicaSet）清掉：

```bash
kubectl delete rs hello-rs
```

建立 `hello-deployment.yaml`：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hello
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
          image: nginx:1.25-alpine
          ports:
            - containerPort: 80
```

`kind` 改成 `Deployment`。Deployment 會把這份 `template` 交給貓頭鷹（ReplicaSet）管理 Pod。

注意 image 這次寫死版本 `nginx:1.25-alpine`，不寫 `latest`。正式環境永遠釘死版本，不然你根本不知道現在跑的是什麼。

套用，然後看三層：

```bash
kubectl apply -f hello-deployment.yaml
kubectl get deploy,rs,pods
```

一個 Deployment、一個 ReplicaSet、三顆 Pod。
看名字：ReplicaSet 是 `hello-` 加一串雜湊，Pod 又是 `hello-<雜湊>-` 加一串亂碼 ── 名字直接把三層關係印給你看了。

現在換版本，這是今天的重點：

```bash
kubectl set image deployment/hello hello=nginx:1.27-alpine
```

立刻打這行看新舊並存：

```bash
kubectl get rs
```

會看到**兩個 ReplicaSet**：舊的那個 DESIRED 正在往下掉，新的那個往上爬。手腳夠快的話能看到 2/1、1/2 這種中間狀態。

過幾秒再看一次：

```bash
kubectl get rs
kubectl get pods
```

舊貓頭鷹（ReplicaSet）的數字停在 0，但它**還在清單上**。新貓頭鷹（ReplicaSet）是 3。泡泡（Pod）全部換成新名字了。

![day-10-shot-01](screenshots/day-10-shot-01.png)

中間那段是更新進行中：兩隻貓頭鷹（ReplicaSet）並存，一隻往上爬、一隻往下掉。

確認跑的真的是新版：

```bash
kubectl get deploy hello -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'
```

印出 `nginx:1.27-alpine`。


最後補一個好習慣。`kubectl set image` 改的是島上的現況，桌上那份 `hello-deployment.yaml` 還停在 1.25 ── 兩邊不一致了。記得把檔案裡的 image 也改成 1.27 存起來，不然下次 apply 會把版本降回去。今天用指令改是為了讓你看到滾動過程，正式流程一律改檔案再 apply。

順帶看一下舊貓頭鷹（ReplicaSet）留了幾隻：

```bash
kubectl get rs -l app=hello
```

兩隻貓頭鷹（ReplicaSet）並排，一隻 0、一隻 3。舊的那隻沒被清掉是刻意的，明天你就會知道它留著要做什麼。

最後補一個很多人不知道、但關鍵時刻能救命的指令：**更新到一半按暫停。**

```bash
kubectl rollout pause deployment/hello
```

暫停之後，部署管家（Deployment）會停在當下的狀態不再往前推。
假設它已經換了一顆新版泡泡（Pod），那就是「一顆新的、兩顆舊的」同時在服務。這只是暫停 rollout，不等於完整的**金絲雀測試**；若要讓少量流量先打到新版，還需要額外的流量切分策略：讓少量流量先打到新版上，你去看日誌、看錯誤率，確認沒問題再放行。

```bash
kubectl rollout resume deployment/hello
```

繼續把剩下的換完。覺得不對勁的話，明天可以學到怎麼一鍵倒回去。

順帶一提，部署管家（Deployment）預設保留最近 10 個版本的貓頭鷹（ReplicaSet），你可以在 YAML 裡調：

```yaml
spec:
  revisionHistoryLimit: 5
```

留太多會讓 `kubectl get rs` 一長串很難看，留太少則是你能回滾的步數變少。五個是很常見的折衷。

## 帶走一句話

**一個版本一隻貓頭鷹（ReplicaSet），部署管家（Deployment）宣告版本與副本需求；Deployment controller 負責實際調整。**

## 參考資源

- [Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Rolling Update Deployment](https://kubernetes.io/docs/tasks/run-application/run-stateless-application-deployment/)
