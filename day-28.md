# Day 28：三個小角色一次認識 ── 守樹鳥、信鴿、報時鳥

## 痛點

不是所有工作都長得像網站。有些要每台機器跑一份，有些跑完就該結束，有些要每天半夜自己醒來。

IMG: 一張三格並排的圖，左格一隻守樹鳥站在每棵巢樹上，中格一隻信鴿送完信落地，右格一隻報時鳥站在時鐘上 ｜ 出場角色：守樹鳥、信鴿、報時鳥、巢樹 ｜ 亮橘重點：三格之間的分隔線

到目前為止你學的隊長、貓頭鷹、有名字的鳥，管的都是**長時間活著的服務**。今天這三位管的是另外三種形狀的工作。

**守樹鳥（DaemonSet）── 每棵樹上固定一隻，不多不少。**

它不看你要幾顆，它看島上有幾棵樹。三棵樹就三隻，你加第四棵樹，它自動在新樹上補一隻；樹拔掉了，那隻也跟著消失。

用在什麼地方？**凡是「跟機器綁定」而不是「跟服務綁定」的工作。** 最常見的三種：日誌收集（要讀那台機器上所有容器的日誌）、監控代理（要量那台機器的 CPU 和硬碟）、網路元件。

其實你早就見過它了 ── Day 18 那隻每棵樹底下都有的郵差鼴鼠，就是用 DaemonSet 跑的。

**信鴿（Job）── 送完信就結束，而且要確認送到。**

Job 跟前面所有東西最大的差別：**它會結束，而且結束是正常的。** 泡泡跑完變成 `Completed`，沒有人會去重啟它。

這件事看起來平凡，但很重要 ── 如果你用 Deployment 跑一個一分鐘就跑完的腳本，隊長會以為它一直死掉，然後無限重啟，你會得到一個 `CrashLoopBackOff`（Day 12 那個狀態）。**跑完會結束的東西，一律用 Job。**

Job 還幫你處理兩件事：失敗會重試（`backoffLimit` 決定幾次），以及可以要求「總共要成功幾次」、「可以同時跑幾個」。資料遷移、批次匯入、一次性的修補腳本，都是它的守備範圍。

**報時鳥（CronJob）── 定時把信鴿放出來。**

CronJob 自己不做事，它只做一件事：**時間到了就生一個 Job。** 語法就是你熟悉的那五個欄位 `分 時 日 月 週`。

IMG: 一隻報時鳥站在時鐘上，時間一到就放出一隻信鴿 ｜ 出場角色：報時鳥、信鴿 ｜ 亮橘重點：報時鳥放出信鴿的那一刻

三者的關係很好記：**報時鳥生信鴿，信鴿生泡泡。** 跟隊長生貓頭鷹、貓頭鷹生泡泡是同一種三層結構。

備份、報表、清理過期資料、對帳 ── 這些以前你寫在 crontab 裡的東西，全部搬到這裡。搬過來的好處是：它跑在叢集上，不綁死在某一台機器；那台機器掛了，工作照跑。

## 動手 5 分鐘

前二十七天我們的島上只有長時間活著的服務。今天讓三種新形狀的工作各跑一次。

**守樹鳥。** 建立 `demo-daemonset.yaml`：

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: demo-agent
spec:
  selector:
    matchLabels:
      app: demo-agent
  template:
    metadata:
      labels:
        app: demo-agent
    spec:
      containers:
        - name: agent
          image: busybox:1.36
          command: ["sh", "-c", "while true; do echo \"agent alive on $NODE\"; sleep 30; done"]
          env:
            - name: NODE
              valueFrom:
                fieldRef:
                  fieldPath: spec.nodeName
```

**沒有 `replicas` 這個欄位** ── 這是 DaemonSet 最好認的特徵，數量不是你決定的。（`fieldRef` 是個實用小技巧：讓泡泡知道自己站在哪棵樹上。）

```bash
kubectl apply -f demo-daemonset.yaml
kubectl get daemonset
kubectl get pods -l app=demo-agent -o wide
```

DESIRED 是 1、CURRENT 是 1 ── 因為你的島上只有一棵樹。**這個數字是島上的樹數，不是你寫的。**

```bash
kubectl logs -l app=demo-agent --tail=2
```

印出 `agent alive on hello-control-plane`。

順便看看島上原本就有的守樹鳥：

```bash
kubectl get daemonset -n kube-system
```

`kube-proxy` 在裡面 ── 你的老朋友郵差鼴鼠。

**信鴿。** 建立 `demo-job.yaml`：

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: demo-migrate
spec:
  backoffLimit: 3
  template:
    spec:
      restartPolicy: OnFailure
      containers:
        - name: migrate
          image: busybox:1.36
          command: ["sh", "-c", "echo 'migrating...'; sleep 5; echo 'done'; exit 0"]
```

`apiVersion` 是 `batch/v1` ── 新的家族。`restartPolicy` **必填**，只能是 `OnFailure` 或 `Never`，不能是預設的 `Always`（那是「永遠活著」的意思，跟信鴿的本質衝突）。

```bash
kubectl apply -f demo-job.yaml
kubectl get pods -w
```

看著它 `Running` 五秒，然後變成 **`Completed`** ── 不是 `Error`，不是 `CrashLoopBackOff`，是**正常結束**。`Ctrl+C` 離開。

```bash
kubectl get job demo-migrate
kubectl logs job/demo-migrate
```

COMPLETIONS 是 `1/1`。日誌留著，泡泡不會被自動清掉，你隨時可以回來看它做了什麼。

**報時鳥。** 建立 `demo-cronjob.yaml`：

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: demo-report
spec:
  schedule: "*/1 * * * *"
  successfulJobsHistoryLimit: 3
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: report
              image: busybox:1.36
              command: ["sh", "-c", "date; echo 'daily report generated'"]
```

`*/1 * * * *` 是每分鐘一次（正式環境不會這樣設，這裡只是不想等）。注意結構是**三層巢狀**：CronJob 包 jobTemplate、jobTemplate 包 pod template ── 就是「報時鳥生信鴿、信鴿生泡泡」那句話的 YAML 版本。

```bash
kubectl apply -f demo-cronjob.yaml
kubectl get cronjob
```

等一分鐘：

```bash
kubectl get jobs
kubectl get pods
```

**憑空多出一個 Job 和一個 `Completed` 的泡泡。** 再等一分鐘，又多一組。`successfulJobsHistoryLimit: 3` 是說只留最近三次的紀錄，不然跑一個月你會有四萬個泡泡。

收工，三個一起清：

```bash
kubectl delete -f demo-daemonset.yaml -f demo-job.yaml -f demo-cronjob.yaml
```

最後補一個 CronJob 專屬的坑：**上一輪還沒跑完，下一輪時間就到了，會怎樣？**

預設是**兩個一起跑**。如果你的工作是「掃描整個資料表」這種不能重疊的東西，就會出事。要擋掉的話加一行 `spec.concurrencyPolicy: Forbid`，上一輪沒結束就跳過這一輪；設成 `Replace` 則是砍掉舊的換新的。這一行在你把 crontab 搬過來的時候，記得順手加上。

## 帶走一句話

**報時鳥生信鴿，信鴿生泡泡。**
