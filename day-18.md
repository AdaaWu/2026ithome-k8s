# Day 18：中場總覽 ── 一張圖追完封包從大門到小鳥的旅程

## 痛點

十七天下來你認識了一堆角色，但如果有人現在問你「一個請求進來到底經過哪些人」，你大概還是講不順。

![day-18-01](illustrations/day-18-01.png)

```mermaid
%%{init: {"theme":"base","look":"handDrawn","handDrawnSeed":7,"themeVariables":{"background":"#DFF3FA","primaryColor":"#FFFDF7","primaryTextColor":"#4D4036","primaryBorderColor":"#7A6A5A","lineColor":"#8B7B6A","secondaryColor":"#FFDDB8","tertiaryColor":"#DDEFD9","fontFamily":"Hannotate SC, Klee One, Comic Sans MS, sans-serif","fontSize":"17px"},"flowchart":{"curve":"basis","htmlLabels":true,"padding":28,"nodeSpacing":48,"rankSpacing":64}}}%%
flowchart LR
    classDef default fill:#FFFDF7,stroke:#7A6A5A,stroke-width:2px,color:#4D4036
    classDef accent fill:#FFDDB8,stroke:#E58F65,stroke-width:2px,color:#5A3828
    classDef success fill:#DDEFD9,stroke:#78A66B,stroke-width:2px,color:#30452C
    I["Ingress"] --> S["Service VIP"]
    S --> K["kube-proxy / data plane"]
    K --> P["Pod IP"]
    P --> C["Container"]
```

![day-18-mermaid](illustrations/day-18-mermaid.png)
![day-18-diagram](illustrations/day-18-diagram.png)

IMG: 一條橫向長條旅程圖，七個站點由左到右依序排開，一位道路管理員站在中段的地底通道口 ｜ 出場角色：大門與地圖看板、圖騰柱、道路管理員、巢樹、泡泡、小鳥、雲之島 ｜ 亮橘重點：中段的道路管理員

今天不學新東西，把已經學過的排成一條線。看圖上由左到右七站：

**第一站，訪客。** 瀏覽器發出一個請求，打的是 `http://你的網域/hello`。它對島上的一切一無所知，它只知道一個網址。

**第二站，大門地圖看板（Ingress）。** 在今天這張示意圖裡，它是島的主要入口；實際叢集可能同時有多個入口。看板讀網址、對規則表，決定這個請求歸哪根柱子管。看板不認識任何一顆泡泡，它只認識柱子的名字。

**第三站，圖騰柱（Service）。** 柱子通常有穩定的虛擬位址與一份隨時更新的 endpoint 名單；實際封包轉送由 kube-proxy、eBPF 或其他資料平面實作完成。**柱子描述的是入口，不是一個搬運中的程序。**

**第四站，道路管理員（kube-proxy）── 今天第一次登場。** 這位負責維護封包轉送規則。

停下來想一個你可能一直沒想過的問題：柱子那個 `10.96.x.x` 的 IP，一般 Node 的網卡不會直接擁有它。它不對應任何一張網卡。那封包打過去，為什麼會通？

因為每一棵巢樹底下都有道路管理員。它一直盯著燈塔櫃台看，只要柱子的名單有變動，就回到自己那棵樹底下**重新整理地道規則**：凡是要去 `10.96.x.x` 的封包，會依節點上的 Service 規則轉向符合條件的泡泡 IP；實際機制可能是 iptables、IPVS 或 eBPF。

所以柱子的 IP 是**虛擬的**。它不是一個地址，它是一條規則。看圖上鼴鼠站的位置 ── 它在地底，你平常看不到這些規則；封包會依節點上的資料平面規則被轉向。這也是為什麼 Day 15 說 ClusterIP 在島外打不通：島外的機器底下沒有鼴鼠，沒有地道。

**第五站，巢樹（Node）。** 封包現在有了一個真實的泡泡 IP，透過島上的網路送到那顆泡泡所在的樹。**這棵樹不一定是收到請求的那棵。** 流量在島內橫向跨樹是很正常的事。

**第六站，泡泡（Pod）。** 封包抵達泡泡的門牌。Day 6 講過，門牌是整顆泡泡共用的。

**第七站，小鳥（Container）。** 泡泡把封包依埠號交給對應的那隻小鳥。你的 Nginx 終於收到請求，回一頁 HTML，然後原路退回去。

![day-18-02](illustrations/day-18-02.png)

IMG: 一根圖騰柱下方連著一條地道，地道另一端分岔通往三顆泡泡，道路管理員站在地道旁維護轉送規則 ｜ 出場角色：圖騰柱、道路管理員、泡泡、小鳥 ｜ 亮橘重點：地道分岔出去的那三個出口

整條路記住這個分工就好：**看板挑柱子、柱子挑泡泡、鼴鼠負責真的把封包送過去。** Day 29 我們會把這條線和其他四條線畫進同一張大圖。

## 動手 5 分鐘

前十七天我們有完整的看板、柱子、泡泡。今天把七站在終端機裡走一遍，順便把鼴鼠挖的地道挖出來看。

**第一、二站，看板。**

```bash
kubectl get ingress hello
kubectl describe ingress hello | grep -A4 Rules
```

規則表上 `/hello` 指向 `hello:80`。看板的工作到此為止。

**第三站，柱子。**

```bash
kubectl get svc hello
kubectl get endpointslices -l kubernetes.io/service-name=hello
```

一個固定 IP，加一份三筆的名單。

**第四站，鼴鼠。先確認每棵樹底下都有一隻：**

```bash
kubectl get pods -n kube-system -l k8s-app=kube-proxy -o wide
```

一棵樹一隻。正式環境有十棵樹就有十隻，**它是每棵樹都跑一份的東西** ── Day 28 你會知道這種東西叫什麼。

現在把地道挖出來。這是今天最有意思的一行：

```bash
docker exec hello-control-plane iptables-save -t nat | grep "default/hello"
```

你會看到幾行規則，裡面有你柱子的 `10.96.x.x`，也有泡泡的 `10.244.x.x`。**這就是鼴鼠寫下的地道。** 柱子的 IP 在這裡從一個「地址」變成一條「轉向指令」。

看仔細一點，會看到類似 `statistic mode random probability 0.33333` 的字樣 ── 三顆泡泡各三分之一，這是這次環境中 iptables 規則呈現的近似分配方式；實際流量不保證平均，還會受連線、session affinity 和資料平面實作影響。

![day-18-shot-01](screenshots/day-18-shot-01.png)

三顆泡泡時是 1/3、1/2、剩下全給 ── 機率是接力算下來的。擴成五顆之後規則從 11 行變 17 行，鼴鼠自己重挖的。

驗證它會自己更新。把泡泡擴成五顆：

```bash
kubectl scale deployment hello --replicas=5
kubectl get endpointslices -l kubernetes.io/service-name=hello
docker exec hello-control-plane iptables-save -t nat | grep -c "default/hello"
```

名單變五筆，地道的規則行數跟著變多。你什麼都沒做，鼴鼠自己跑去重挖了。

**第五、六、七站，一路走到底。**

```bash
kubectl get pods -l app=hello -o wide
```

看 NODE 欄（第五站）、IP 欄（第六站）。最後一站：

```bash
kubectl exec deploy/hello -- ls /usr/share/nginx/html
```

`index.html` ── 你從瀏覽器要的那頁 HTML，就躺在這裡。七站走完。

縮回三顆收工：

```bash
kubectl scale deployment hello --replicas=3
```

## 帶走一句話

**柱子的 IP 不是地址，是鼴鼠挖的地道。**

## 參考資源

- [Virtual IPs and Service Proxies](https://kubernetes.io/docs/reference/networking/virtual-ips/)
- [Service](https://kubernetes.io/docs/concepts/services-networking/service/)
