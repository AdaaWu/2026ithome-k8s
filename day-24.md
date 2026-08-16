# Day 24：醫生啄木鳥與小旗子 ── 三種探針

## 痛點

泡泡的狀態是 `Running`，但服務其實已經死了。K8s 顯示一切正常，使用者卻在對你尖叫。

![day-24-01](illustrations/day-24-01.png)

IMG: 一隻啄木鳥敲著泡泡的外壁，泡泡頂上插著一面旗子 ｜ 出場角色：醫生啄木鳥、小旗子、泡泡、小鳥 ｜ 亮橘重點：泡泡頂上那面旗子是升起還是垂下

`Running` 這個狀態只代表一件事：**容器的主程序還在。**

程序還在，不等於服務還能用。連線池滿了、死結卡住了、記憶體漏光在做無效的 GC ── 程序都還活著，但它已經不會回應任何請求了。K8s 看不出這種死法，除非你教它怎麼看。

教它的方式就是**探針**。三種，各管一件事：

**Liveness（醫生啄木鳥）── 你還活著嗎？沒回應就重啟。**

啄木鳥固定去敲泡泡，敲不出聲就判定這隻小鳥死了，直接砍掉重來。它管的是「**救不救**」。

**Readiness（小旗子）── 你準備好了嗎？沒好就不給流量。**

看圖上那面旗子。旗子升起來，柱子才把它加進名單；旗子降下來，柱子立刻把它從名單移除 ── **但不會重啟它**。它管的是「**給不給客人**」。

**Startup（啟動緩衝）── 你還在開機嗎？開機期間其他兩隻先別吵。**

有些服務啟動要花兩分鐘（載模型、跑 migration）。Startup 探針成功之前，另外兩種探針完全不作用。它管的是「**什麼時候開始檢查**」。

三者的分工用一句話講死：**Liveness 決定生死，Readiness 決定流量，Startup 決定何時開始問。**

![day-24-02](illustrations/day-24-02.png)

IMG: 三顆泡泡並排，第一顆被啄木鳥敲到破掉重生，第二顆旗子降下但泡泡完好、旁邊的圖騰柱把它跳過，第三顆掛著一個沙漏 ｜ 出場角色：醫生啄木鳥、小旗子、泡泡、小鳥、圖騰柱 ｜ 亮橘重點：第二顆泡泡完好但被柱子跳過

接下來是**最常見、也最貴的設定錯誤**：

**Liveness 設太敏感，造成無限重啟。**

想像你的服務只是暫時變慢（尖峰、GC、下游卡住），啄木鳥敲三下沒回應就重啟它。重啟要三十秒，這三十秒的流量壓到其他泡泡上，其他泡泡也變慢，也被重啟 ── **整組服務被自己的探針殺光。** 明明只是慢，結果變成全滅。

所以記住兩條保命原則：

**第一，Liveness 要設得比 Readiness 寬鬆很多。** 慢的時候先把旗子降下來（不給流量、讓它喘口氣），而不是直接砍掉。

**第二，Liveness 只檢查「這個程序自己」。** 千萬不要在 Liveness 裡去 ping 資料庫 ── 資料庫抖一下，你的整組前端會被啄木鳥敲光，而重啟一百次也救不了資料庫。**那種檢查放 Readiness。**

三種探針的檢查方式都一樣有三種：`httpGet`（打一個網址看狀態碼）、`tcpSocket`（連得上就算活）、`exec`（在容器裡跑指令看回傳值）。網頁服務用第一種就好。

## 動手 5 分鐘

前二十三天我們的前端泡泡沒有任何健康檢查，K8s 只知道程序還在。今天幫它裝上探針，再故意弄壞給你看。

改 `hello-deployment.yaml`，在 `ports` 底下加這兩段：

```yaml
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 2
            periodSeconds: 3
            failureThreshold: 2
          livenessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 10
            periodSeconds: 10
            failureThreshold: 5
```

**注意兩組數字的差距。** Readiness 三秒問一次、錯兩次就降旗（六秒內反應）；Liveness 十秒問一次、錯五次才動手（五十秒才重啟）。這就是「寬鬆很多」的實際樣子。

```bash
kubectl apply -f hello-deployment.yaml
kubectl rollout status deployment/hello
kubectl get pods
```

三顆 `1/1`。**那個 `1/1` 的第一個數字，就是「旗子升起來的容器數」** ── 你看了二十三天的欄位，今天才知道它的意思。

看探針的設定生效了沒：

```bash
kubectl describe pod -l app=hello | grep -E "Liveness|Readiness"
```

會印出 `http-get http://:80/ delay=10s timeout=1s period=10s #success=1 #failure=5` 這種摘要。

**現在弄壞它。** 把首頁改名，讓 Nginx 對 `/` 回 404：

```bash
POD=$(kubectl get pods -l app=hello -o jsonpath='{.items[0].metadata.name}')
kubectl exec $POD -- mv /usr/share/nginx/html/index.html /tmp/
```

（如果你的 index.html 是 Day 19 掛載進來的唯讀檔案，改用這行製造 404：`kubectl exec $POD -- sh -c "nginx -s stop"`。）

立刻盯著看：

```bash
kubectl get pods -w
```

**先看到的是 READY 從 `1/1` 變成 `0/1`，但 STATUS 還是 `Running`。** 這就是小旗子降下來了 ── 泡泡活著，只是不接客。

同時去看柱子的名單：

```bash
kubectl get endpoints hello
```

**名單從三筆變成兩筆。** 柱子已經自動把它跳過了，使用者完全不受影響。這是 Readiness 的價值。

繼續等。五十秒後回到 `-w` 那個畫面：

```
hello-xxx   0/1   Running   1 (3s ago)
```

**RESTARTS 變成 1** ── 啄木鳥終於出手了。重啟後容器從 image 重新長出來，index.html 回來了，READY 變回 `1/1`，名單也變回三筆。`Ctrl+C` 離開。

看啄木鳥的說法：

```bash
kubectl describe pod $POD | grep -A3 "Liveness probe failed"
```

Events 裡明明白白寫著 `Liveness probe failed: HTTP probe failed with statuscode: 404`，接著 `Container hello failed liveness probe, will be restarted`。

**整個過程你什麼都沒做，服務也沒有中斷。** 這就是今天要換到的東西。

## 帶走一句話

**旗子管流量，啄木鳥管生死，別搞反。**
