# Day 19：掛在泡泡（Pod）外的便條本（ConfigMap） ── ConfigMap


## 痛點

改一個資料庫位址、換一個功能開關，你就得重 build 一次 image、重推一次 registry、重跑一次部署。

![day-19-01](illustrations/day-19-01.png)

```mermaid
%%{init: {"theme":"base","look":"handDrawn","handDrawnSeed":7,"themeVariables":{"background":"#DFF3FA","primaryColor":"#FFFDF7","primaryTextColor":"#4D4036","primaryBorderColor":"#7A6A5A","lineColor":"#8B7B6A","secondaryColor":"#FFDDB8","tertiaryColor":"#DDEFD9","fontFamily":"Hannotate SC, Klee One, Comic Sans MS, sans-serif","fontSize":"17px"},"flowchart":{"curve":"basis","htmlLabels":true,"padding":28,"nodeSpacing":48,"rankSpacing":64}}}%%
flowchart TD
    classDef default fill:#FFFDF7,stroke:#7A6A5A,stroke-width:2px,color:#4D4036
    classDef accent fill:#FFDDB8,stroke:#E58F65,stroke-width:2px,color:#5A3828
    classDef success fill:#DDEFD9,stroke:#78A66B,stroke-width:2px,color:#30452C
    CM["ConfigMap"] --> E["envFrom → environment snapshot"]
    CM --> V["volume → projected files"]
    E --> C["Container"]
    V --> C
    CM -. "change does not restart Pod" .-> C
```

![day-19-mermaid](illustrations/day-19-mermaid.png)
![day-19-diagram](illustrations/day-19-diagram.png)

IMG: 一顆泡泡（Pod）外面掛著一本便條本（ConfigMap），泡泡（Pod）裡的小鳥（Container）探頭出來讀上面的字 ｜ 出場角色：便條本（ConfigMap）、泡泡（Pod）、小鳥（Container） ｜ 亮橘重點：掛在泡泡（Pod）外的那本便條本（ConfigMap）

先講清楚為什麼設定不能寫死在 image 裡。

**因為那會讓 dev 和 prod 變成兩個不同的 image。** 而兩個不同的 image 就是兩份不同的程式，你在 dev 測過的東西，嚴格來說沒有在 prod 上測過。這是所有部署事故的溫床。

正確的做法是：**同一個 image 跑在所有環境，環境的差異從外面餵進去。** 看圖上便條本（ConfigMap）的位置 ── 它掛在泡泡（Pod）外面，不在 image 裡。同一隻小鳥（Container），換一本便條本（ConfigMap）就變成另一個環境。

便條本（ConfigMap）的內容就是一堆 `key: value`，用法有兩種：

**用法一，變成環境變數。** 適合單一的值：資料庫位址、功能開關、log 等級。小鳥（Container）啟動時讀 `process.env.XXX` 就拿到了。

**用法二，掛成檔案。** 適合整份設定檔：`nginx.conf`、`application.yml`。便條本（ConfigMap）的每一個 key 會變成一個檔名，value 變成檔案內容，整包掛進泡泡（Pod）裡的某個目錄。

兩種都很常用，判準很簡單：**單一的值用環境變數，整份檔案用掛載。**

接下來是今天最重要的一段，**這個坑幾乎每個人都踩過一次**：

**改了 ConfigMap，正在跑的泡泡（Pod）不會自動重啟。**

這代表你改完設定、apply 完、看起來一切正常，但服務其實還在用舊設定。而且兩種用法的行為還不一樣，更容易混淆：

- **以環境變數注入的值，不會因為 ConfigMap 改變而自動更新。** 環境變數是容器啟動那一刻決定的，之後改便條本（ConfigMap）一點用都沒有，非重啟不可。
- **掛成檔案的，內容通常會在 kubelet 的同步週期後更新，但不是即時保證。** 另外，掛載的 ConfigMap 會以投影檔案的方式更新；每次請求才讀磁碟的（例如 Nginx 提供的靜態檔）會跟著變，只在啟動時讀一次設定的（例如 `nginx.conf` 本身）則不會自動套用。

所以規則是：**改完 ConfigMap，就要讓泡泡（Pod）重新來過。**

![day-19-02](illustrations/day-19-02.png)

IMG: 一本便條本（ConfigMap）上的字被換掉，旁邊的泡泡（Pod）卻毫無反應、小鳥（Container）還在看著舊的內容 ｜ 出場角色：便條本（ConfigMap）、泡泡（Pod）、小鳥（Container） ｜ 亮橘重點：小鳥（Container）眼前那份舊內容

最後一個實務提醒：**便條本（ConfigMap）是明文的。** 任何看得到這道圍籬的人都讀得到裡面每一個字。所以密碼、金鑰、token 一律不能放這裡 ── 那是明天的主題。

## 動手 5 分鐘

前十八天我們的 Nginx 一直跑預設設定，回一頁罐頭 Welcome 頁。今天把它的首頁抽成便條本（ConfigMap），做出一個真正屬於你的 hello 頁面。

建立 `hello-configmap.yaml`：

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: hello-config
data:
  APP_ENV: "dev"
  index.html: |
    <!DOCTYPE html>
    <html>
    <body>
      <h1>Hello from Kubernetes</h1>
      <p>served by pod</p>
    </body>
    </html>
```

一本便條本（ConfigMap）裡放了兩則。`APP_ENV` 是單一的值，等一下當環境變數；`index.html` 用 `|` 寫多行，等一下掛成檔案。

```bash
kubectl apply -f hello-configmap.yaml
kubectl get cm
kubectl describe cm hello-config
```

`describe` 會把內容整份印出來 ── **記住這個畫面，明天你會看到 Secret 不是這樣的。**

現在改 `hello-deployment.yaml`，把便條本（ConfigMap）兩種用法都接上去。在 `spec.template.spec` 底下改成：

```yaml
    spec:
      containers:
        - name: hello
          image: nginx:1.27-alpine
          ports:
            - containerPort: 80
          envFrom:
            - configMapRef:
                name: hello-config
          volumeMounts:
            - name: web
              mountPath: /usr/share/nginx/html
      volumes:
        - name: web
          configMap:
            name: hello-config
            items:
              - key: index.html
                path: index.html
```

三個新東西：`envFrom` 把便條本（ConfigMap）整本變成環境變數；`volumes` 宣告「有一本便條本（ConfigMap）要用」；`volumeMounts` 說「掛到泡泡（Pod）裡的哪個路徑」。`items` 是在挑「只掛 index.html 這一則」，不然 `APP_ENV` 也會變成一個檔案。

```bash
kubectl apply -f hello-deployment.yaml
kubectl rollout status deployment/hello
```

驗收。打開瀏覽器 `http://localhost/hello`：

**Hello from Kubernetes 出現了。** 你沒有 build 任何 image。

![day-19-shot-01](screenshots/day-19-shot-01.png)

首頁的內容來自便條本（ConfigMap），不在 image 裡。

看環境變數進去了沒：

```bash
kubectl exec deploy/hello -- env | grep APP_ENV
```

`APP_ENV=dev`。

看檔案掛進去了沒：

```bash
kubectl exec deploy/hello -- cat /usr/share/nginx/html/index.html
```

就是你寫的那段 HTML。

**現在踩那個坑。** 改 `hello-configmap.yaml`，把 `APP_ENV` 從 `dev` 改成 `prod`，然後：

```bash
kubectl apply -f hello-configmap.yaml
kubectl get cm hello-config -o jsonpath='{.data.APP_ENV}'
kubectl exec deploy/hello -- printenv APP_ENV
```

**兩行印出來的值不一樣。** 便條本（ConfigMap）上寫的是 `prod`，泡泡（Pod）裡拿到的還是 `dev`。

等一分鐘再打一次。還是 `dev`。等十分鐘、一小時 ── 永遠都是 `dev`。**環境變數是容器啟動那一刻拍下來的快照，之後便條本（ConfigMap）怎麼改都跟它無關。**

正確做法，逼泡泡（Pod）重來一次：

```bash
kubectl rollout restart deployment/hello
kubectl rollout status deployment/hello
kubectl exec deploy/hello -- printenv APP_ENV
```

`prod`。`rollout restart` 會走一次滾動更新，把泡泡（Pod）一顆顆換掉，零停機。**把這個指令記起來，改完 ConfigMap 就打它。**

![day-19-shot-02](screenshots/day-19-shot-02.png)

便條本（ConfigMap）上是 `prod`、泡泡（Pod）裡是 `dev`，兩邊不一致而且不會自己好。

順便把掛成檔案的那種也試一次，因為它的行為不一樣。改 `index.html` 那段的 `<h1>` 成 `Hello v2` 再 apply，立刻打：

```bash
kubectl exec deploy/hello -- cat /usr/share/nginx/html/index.html | grep h1
```

還是舊的 ── 檔案的同步有延遲。**等約一分鐘**再打一次，就變成 `Hello v2` 了。

這裡要講清楚一件常被誤傳的事：**檔案更新之後，Nginx 提供的首頁會跟著變**，因為它每次請求都重新讀磁碟。所以「掛成檔案」不是永遠不會更新，它只是**慢**。

真正會咬你的是**程式只在啟動時讀一次設定**的那種 ── Nginx 自己的 `nginx.conf`、Spring 的 `application.yml`、大部分框架的設定檔都是。那種你等到天荒地老檔案都同步好了，程式還是用著記憶體裡的舊值。

所以規則簡化成一句：**除非你很確定程式會自己監看檔案，否則改完就 `rollout restart`。**

最後補兩個你之後會用到的東西。第一，便條本（ConfigMap）可以直接從現有檔案建，不用手抄進 YAML：

```bash
kubectl create configmap nginx-conf --from-file=./nginx.conf --dry-run=client -o yaml
```

`--dry-run=client -o yaml` 是把它印出來而不是真的建立，你可以直接把輸出存成檔案再修。整份設定檔用這招轉最快。

第二，便條本（ConfigMap）有大小上限，大約 1 MB，因為它是存在記憶樹（etcd）裡的。**它是拿來放設定的，不是拿來放資料的。** 想塞整包靜態網站進去，會被櫃台擋下來。

## 帶走一句話

**改完便條本（ConfigMap），一定要叫泡泡（Pod）重來一次。**

## 參考資源

- [ConfigMaps](https://kubernetes.io/docs/concepts/configuration/configmap/)
- [Use a ConfigMap](https://kubernetes.io/docs/tasks/configure-pod-container/configure-pod-configmap/)
