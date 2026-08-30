# Day 29：雲之島（Cluster）全圖 ── 一張圖看完 K8s 怎麼運作


## 痛點

二十八天下來你認識了三十幾個角色。現在把它們全部放進同一座島，你講得出誰在哪一站嗎？

![day-29-01](illustrations/day-29-01.png)

```mermaid
%%{init: {"theme":"base","look":"handDrawn","handDrawnSeed":7,"themeVariables":{"background":"#DFF3FA","primaryColor":"#FFFDF7","primaryTextColor":"#4D4036","primaryBorderColor":"#7A6A5A","lineColor":"#8B7B6A","secondaryColor":"#FFDDB8","tertiaryColor":"#DDEFD9","fontFamily":"Hannotate SC, Klee One, Comic Sans MS, sans-serif","fontSize":"17px"},"flowchart":{"curve":"basis","htmlLabels":true,"padding":28,"nodeSpacing":48,"rankSpacing":64}}}%%
flowchart TD
    classDef default fill:#FFFDF7,stroke:#7A6A5A,stroke-width:2px,color:#4D4036
    classDef accent fill:#FFDDB8,stroke:#E58F65,stroke-width:2px,color:#5A3828
    classDef success fill:#DDEFD9,stroke:#78A66B,stroke-width:2px,color:#30452C
    U["User / kubectl"] --> A["API Server"]
    A --> E["etcd"]
    A --> C["Controllers / Scheduler"]
    C --> N["Node + kubelet"]
    N --> P["Pods / Containers"]
    U --> I["Ingress"]
    I --> S["Service"]
    S --> P
    P --> V["PVC → PV → Storage"]
```

![day-29-mermaid](illustrations/day-29-mermaid.png)
![day-29-diagram](illustrations/day-29-diagram.png)

IMG: 雲之島（Cluster）的全景大圖，所有角色各就各位：左上燈塔村（燈塔櫃台（API Server）、記憶樹（etcd）、選樹官（Scheduler）、巡邏隊長（Controller Manager））、島中央的巢樹（Node）與泡泡（Pod）、右側的大門地圖看板與圖騰柱（Service）、地面上的倉庫（PersistentVolume，PV）、樹底下的道路管理員，五條路線串起全島 ｜ 出場角色：雲之島（Cluster）、巢樹（Node）、泡泡（Pod）、小鳥（Container）、燈塔櫃台（API Server）、記憶樹（etcd）、選樹官（Scheduler）、巡邏隊長（Controller Manager）、管家松鼠（kubelet）、哨子（kubectl）、圖騰柱（Service）、大門與地圖看板、道路管理員、島上的倉庫（PersistentVolume，PV）、借用單（PersistentVolumeClaim，PVC）、部署管家（Deployment）、數泡泡（Pod）的貓頭鷹 ｜ 亮橘重點：貫穿全島的整體流向

今天話少一點，讓圖說話。全島只有五條線，每條線你都親手做過。

**第一條線：你下指令。**

你吹哨子（kubectl），話送到燈塔櫃台（API Server）。櫃台驗完就把你要的樣子寫進記憶樹（etcd），然後回你一句「收到」。**注意這裡就結束了** ── 櫃台不會等泡泡（Pod）真的建好才回你。你看到 `created` 的那一刻，島上可能什麼都還沒發生。這就是 Day 4 那個宣告式：你只負責描述結果，剩下的交給島。

**第二條線：燈塔村做決定。**

巡邏隊長（Controller Manager）一直在比對「記憶樹（etcd）上寫的」跟「島上實際有的」。發現你要三顆但只有零顆，它就交代部署管家（Deployment）；部署管家（Deployment）交代貓頭鷹；貓頭鷹登記三顆泡泡（Pod）。這三顆泡泡（Pod）此時還沒有家，選樹官（Scheduler）看每棵樹剩多少資源（就是你在 Day 25 畫的那條 Request 線），挑一棵，把答案寫回櫃台。**控制面這條線主要是在協調與更新狀態；真正建立容器、掛載儲存和處理封包，則由 kubelet、Runtime、CSI、CNI 與資料平面元件執行。**

**第三條線：巢樹（Node）執行。**

每棵樹上的管家松鼠（kubelet）盯著櫃台看有沒有自己這棵樹的活。看到了就真的去拉 image、真的把泡泡（Pod）吹出來、真的把小鳥（Container）放進去。啄木鳥開始敲、旗子升起來。**這是全島唯一真的動手的地方。** 決定和執行分開，所以燈塔村掛掉時，樹上跑著的服務不會跟著死。

**第四條線：流量進來。**

訪客敲島的大門，地圖看板讀網址、挑一根圖騰柱（Service）。柱子拿著圍巾去對名單，挑一顆旗子升著的泡泡（Pod）。真正維護轉送規則的是樹底下的道路管理員 ── 它讓柱子那個虛擬 IP 的封包前往真實的泡泡（Pod） IP。封包穿過泡泡（Pod）的門牌，交給裡面的小鳥（Container）。Day 18 那七站，就是這條線。

**第五條線：資料落地。**

小鳥（Container）要寫東西。寫在自己肚子裡，泡泡（Pod）一破就沒了；寫進泡泡（Pod）裡的共享食物桶（emptyDir），泡泡（Pod）一破也沒了。所以真正要留的東西，順著借用單（PersistentVolumeClaim，PVC）寫到地面上的倉庫（PersistentVolume，PV） ── **看圖上倉庫（PersistentVolume，PV）的位置，它蓋在地上，不在樹上，這就是為什麼泡泡（Pod）破了它還在。**

五條線的分工，一句話各記一個動詞：**你說、村裡想、樹上做、鼴鼠送、倉庫（PersistentVolume，PV）留。**

最後看整張圖的節奏。**這座島不是一條由單一角色串起來的中央流水線。** 不同角色各自跑 reconciliation loop，但它們仍會依賴 API Server、etcd、kubelet、Runtime、CNI 或 CSI 等元件。 每一位都只做同一件事：看櫃台、比對、動作、再看櫃台。沒有中央的排程表、沒有誰指揮誰的呼叫鏈，只有一群各自盯著同一份紀錄的角色。

這就是 K8s 最核心、也最反直覺的設計：**它不是一條由中央指揮到底的流水線，而是一群彼此有依賴的 reconciliation loop。** 某個角色掛掉時，其他部分可能暫時繼續，但影響範圍取決於掛掉的是誰。

你二十八天來每一次「刪掉泡泡（Pod）它自己長回來」的體驗，都是這個設計的副產品。

## 動手 5 分鐘

今天不加東西，用一個指令把整張圖印出來。

```bash
kubectl get all -A -o wide
```

畫面很長，但現在每一行你都認得。對照著圖找找看：`kube-system` 裡的櫃台、記憶樹（etcd）、選樹官（Scheduler）、巡邏隊長（第二條線）、每棵樹一位的道路管理員（第四條線）、你的 hello 部署管家（Deployment）跟貓頭鷹跟三顆泡泡（第三條線）。

再把你自己蓋的那部分單獨看一遍：

```bash
kubectl get deploy,rs,pod,svc,ingress,pvc,hpa
```

**這幾行就是你二十九天的成果**：前端部署管家（Deployment）帶著泡泡（Pod）、一根柱子、一塊看板、一個自動調節旋鈕（HPA）、資料庫和它的倉庫（PersistentVolume，PV）。

![day-29-shot-02](screenshots/day-29-shot-02.png)

兩個部署管家（Deployment）、三根柱子、一塊看板、兩座倉庫（PersistentVolume，PV）、一台吹泡機 ── 全部是你自己蓋的。

最後跑一次完整的驗收，五條線各測一站：

```bash
kubectl get --raw='/readyz' && echo
kubectl get nodes
curl -s -o /dev/null -w "外部入口 %{http_code}\n" http://localhost/hello
kubectl get endpointslices -l kubernetes.io/service-name=hello
kubectl get pvc
```

櫃台 `ok`、樹 `Ready`、大門 `200`、名單有人、倉庫（PersistentVolume，PV） `Bound`。**五條線全綠。**

![day-29-shot-01](screenshots/day-29-shot-01.png)

一條線一個指令，五行就把整座島從頭到尾檢查完。

## 帶走一句話

**K8s 不是流水線，是一群獨立的迴圈。**

## 參考資源

- [Kubernetes Components](https://kubernetes.io/docs/concepts/architecture/components/)
- [Service Networking](https://kubernetes.io/docs/concepts/services-networking/)
