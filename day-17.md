# Day 17：網路實戰 ── 從瀏覽器打到你的 hello service

## 痛點

分開看你每個資源都懂，但中間任何一段斷掉，你還是只會看到瀏覽器上冷冰冰的一行 404。

![day-17-01](illustrations/day-17-01.png)

IMG: 一條由左到右的完整路徑，從瀏覽器出發，經過大門地圖看板、圖騰柱，最後抵達泡泡裡的小鳥 ｜ 出場角色：大門與地圖看板、圖騰柱、泡泡、小鳥 ｜ 亮橘重點：整條路徑由左到右的貫穿線

今天觀念只有三句話。

第一，**這條路有四站**：看板 → 柱子 → 名單 → 泡泡。第二，**每一站的連接方式都不一樣** ── 看板靠服務名稱找柱子，柱子靠圍巾找泡泡。第三，**斷在哪一站，症狀就不一樣**，所以你根本不需要猜，一站一站問下去就好。

剩下的全部用手做。今天結束時你會有一套可以背下來的檢查流程。

## 動手 5 分鐘

昨天我們已經有完整的四站了。今天先整組砍掉重建一次，再一站一站驗證，最後故意弄斷它。

先把你的東西全部清掉（Controller 留著）：

```bash
kubectl delete -f hello-ingress.yaml -f hello-service.yaml -f hello-deployment.yaml
kubectl get all
```

只剩下一個 `kubernetes` 柱子，那是島本身的。

現在三行從零重建：

```bash
kubectl apply -f hello-deployment.yaml
kubectl apply -f hello-service.yaml
kubectl apply -f hello-ingress.yaml
```

（如果昨天最後你把 Ingress 改成了 host 規則，先把 `hello-ingress.yaml` 改回 `/hello(/|$)(.*)` 那版，今天用 path 規則。）

等三十秒讓泡泡起來，然後打開瀏覽器輸入 `http://localhost/hello`。Welcome 頁出現，整條路通了。

**接下來是重點：由內而外，一站一站驗證。** 從離小鳥最近的地方開始查，才不會白費力氣。

**第一站，小鳥自己活著嗎？**

```bash
kubectl get pods -l app=hello
```

三顆 `Running`、READY 是 `1/1`。READY 不是 `1/1` 就別往下查了，先回頭看 Day 12。

**第二站，泡泡的門牌打得通嗎？**

```bash
kubectl get pods -l app=hello -o wide
kubectl run probe --rm -it --image=busybox:1.36 -- sh
```

進去之後，直接打其中一顆泡泡的 IP：

```bash
wget -qO- http://10.244.0.x
```

HTML 吐出來 ── 泡泡本身沒問題。**先別離開這個 shell。**

**第三站，柱子轉得到嗎？**

在同一個 shell 裡打柱子的名字：

```bash
wget -qO- http://hello
```

通了，代表柱子的名單是對的。順便看看 DNS 是怎麼解的：

```bash
nslookup hello
```

印出 `hello.default.svc.cluster.local` 和柱子的 IP ── Day 13 講的完整地址，在這裡現形。打 `exit` 離開。

**第四站，柱子的名單裡真的有人嗎？**

```bash
kubectl get endpoints hello
```

三個 `IP:80`。這一站是最容易出事的，Day 14 你已經看過空名單長什麼樣。

**第五站，看板讀到規則了嗎？**

```bash
kubectl describe ingress hello
```

看 `Rules` 區塊，`/hello` 對應到 `hello:80`，後面括號裡會列出三個泡泡的 IP ── **看板已經穿透到最底層了**。如果括號裡是空的或寫 `<error: endpoints "hello" not found>`，問題出在第四站。

五站都綠燈，這條路就是通的。

**現在故意弄斷它，看三種症狀。**

第一種，把柱子的放大鏡改錯：

```bash
kubectl patch svc hello -p '{"spec":{"selector":{"app":"nope"}}}'
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/hello
```

回 **503**。這是 Day 14 那個空名單造成的 ── **看板找到柱子了，但柱子後面沒人**。看到 503 就直接去查 endpoints。

修回來：

```bash
kubectl apply -f hello-service.yaml
```

第二種，把看板指向一根不存在的柱子。編輯 `hello-ingress.yaml`，把 `name: hello` 暫時改成 `name: hello-typo`，然後：

```bash
kubectl apply -f hello-ingress.yaml
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/hello
```

還是 **503**，但這次原因不同：

```bash
kubectl describe ingress hello | grep -A5 Rules
```

括號裡寫著 `<error: endpoints "hello-typo" not found>` ── **柱子根本不存在**。改回 `hello` 再 apply。

第三種，打一個看板沒有的路徑：

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/nothing
```

回 **404**。這是看板在說「這個網址不在我的規則表上」，跟你的服務一點關係都沒有。

**把這三個狀態碼記起來，它們就是分診表：404 是看板沒收到你要的規則，503 是規則有了但後面沒人，連不上（timeout）是 Controller 本身沒起來。**

最後確認一切正常：

```bash
kubectl apply -f hello-ingress.yaml
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/hello
```

回 **200**。收工。

![day-17-02](illustrations/day-17-02.png)

IMG: 同一條路徑上三個不同位置各有一個斷點，每個斷點旁標著不同的數字牌 ｜ 出場角色：大門與地圖看板、圖騰柱、泡泡、小鳥 ｜ 亮橘重點：三個斷點上那三塊數字牌

最後給你看一個東西，看完你對看板就不會有任何神祕感了。昨天說看板背後住著一位居民，那位居民其實就是一台 Nginx。它把你寫的 Ingress YAML 翻譯成一份 `nginx.conf`：

```bash
kubectl exec -n ingress-nginx deploy/ingress-nginx-controller -- cat /etc/nginx/nginx.conf | grep -B2 -A8 "hello"
```

你會看到熟悉的 `upstream`、`location`、`proxy_pass` ── **就是你以前手寫過的那種設定檔**。差別只在於：以前泡泡一換 IP 你就得手動改這個檔案然後 reload，現在有人幫你二十四小時盯著名單，改完自動 reload。

這就是整個第三幕的價值。K8s 沒有發明新的網路魔法，它只是把你原本手動做的那件事，變成一直有人在做。

把今天的分診表存進你的筆記本：**先看 HTTP 狀態碼分診 → 再由內而外五站驗證 → 卡在哪站就用那站的指令。** 這套流程你之後每次上線出事都會用到。

## 帶走一句話

**由內而外一站一站問，不要猜。**
