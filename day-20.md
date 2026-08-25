# Day 20：上鎖的小盒子 ── Secret 與它其實沒那麼安全的真相

## 痛點

資料庫密碼不能放便條本，那該放哪？你聽說 K8s 有個叫 Secret 的東西，名字聽起來很安全。

![day-20-01](illustrations/day-20-01.png)

IMG: 一個上鎖的小盒子，但鎖是玩具鎖，旁邊一隻小鳥用爪子輕輕一撥就打開了 ｜ 出場角色：上鎖小盒、小鳥 ｜ 亮橘重點：被輕鬆撥開的那把玩具鎖

今天最重要的一句話，先講：

**Secret 只是 base64 編碼，不是加密。**

base64 是**編碼**，不是**加密**。編碼的目的是讓資料能安全地在文字系統裡傳輸，任何人拿到都能還原，不需要密碼、不需要金鑰。`base64 -d` 一行就解開了，你等一下會親手做一次。

所以看圖上那把鎖 ── 它是**玩具鎖**。它讓你不會不小心一眼看到密碼，僅此而已。它擋不住任何一個真的想看的人。

這是新手對 K8s 最大的誤解，而且後果很嚴重：以為東西放進 Secret 就安全了，於是把 Secret 的 YAML 直接推上公開的 git repo。**那跟把密碼用明文推上去，實質上是同一件事。**

那 Secret 到底有什麼用？它跟便條本的差別在三個地方：

**第一，它不會被隨手印出來。** `kubectl describe` 一份 Secret，值的位置只會顯示 `8 bytes`。你 demo 時不會手滑把密碼投影到螢幕上。

**第二，它的權限可以獨立管理。** 島上可以設定「這個人讀得到 ConfigMap，但讀不到 Secret」。這是實務上 Secret 最大的價值 ── **它的安全性來自誰能拿到它，不是來自它本身。**

**第三，K8s 對它比較小心。** Secret volume 通常以記憶體型態掛載，但 Secret 仍會儲存在 API／etcd，應用程式、診斷與備份流程也可能把它暴露出來；Kubernetes 的一般狀態輸出不會直接顯示 value，但不能把它當成完整保護。

![day-20-02](illustrations/day-20-02.png)

IMG: 兩個並排的容器，左邊便條本內容全部攤開可見，右邊小盒的內容被一塊布蓋住只露出形狀 ｜ 出場角色：便條本、上鎖小盒 ｜ 亮橘重點：右邊那塊蓋住內容的布

用法上，Secret 跟 ConfigMap **幾乎一模一樣**：一樣可以當環境變數，一樣可以掛成檔案，YAML 結構只差 `kind` 和幾個欄位名。昨天學的東西今天全部能用，這是好消息。

那真正要安全該怎麼做？三個方向，這裡只列名不展開：叢集層級開啟 etcd 加密、用雲端業者的金鑰管理服務、或是把密文存在 git 用工具在叢集內解密。今天你只要記住**預設狀態下它不安全**這件事就夠了。

## 動手 5 分鐘

前十九天我們有一本明文的便條本。今天建一個小盒，然後親手把它撬開。

最快的建法是用指令，K8s 會自動幫你做 base64：

```bash
kubectl create secret generic hello-secret \
  --from-literal=DB_PASSWORD=super-secret-123
kubectl get secret
```

TYPE 是 `Opaque`（就是「一般用途」的意思），DATA 是 1。

先看看它「看起來」多安全：

```bash
kubectl describe secret hello-secret
```

```
Data
====
DB_PASSWORD:  16 bytes
```

**只有長度，沒有內容。** 看起來很專業對吧。

現在撬開它：

```bash
kubectl get secret hello-secret -o jsonpath='{.data.DB_PASSWORD}'
```

印出 `c3VwZXItc2VjcmV0LTEyMw==`。一串看不懂的東西。再一步：

```bash
kubectl get secret hello-secret -o jsonpath='{.data.DB_PASSWORD}' | base64 -d
```

```
super-secret-123
```

**兩行指令，密碼裸奔。** 沒有輸入任何金鑰，沒有任何驗證。這就是今天要你親眼看到的事實。

![day-20-shot-01](screenshots/day-20-shot-01.png)

`describe` 只給你長度，看起來很專業；下一行就把它還原成明文了。

反過來確認 base64 真的只是編碼：

```bash
echo -n "super-secret-123" | base64
```

跟上面那串一模一樣。任何人在任何地方都能算出來。

現在寫成 YAML 檔案。建立 `hello-secret.yaml`：

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: hello-secret
type: Opaque
stringData:
  DB_PASSWORD: super-secret-123
```

用 `stringData` 而不是 `data`，就可以直接寫明文，K8s 會幫你編碼。**但這也代表這個檔案絕對不能進 git。** 把它加進 `.gitignore`：

```bash
echo "hello-secret.yaml" >> .gitignore
```

套用（會覆蓋剛剛指令建的那個）：

```bash
kubectl apply -f hello-secret.yaml
```

接到泡泡上。改 `hello-deployment.yaml`，在 `envFrom` 底下多加兩行：

```yaml
          envFrom:
            - configMapRef:
                name: hello-config
            - secretRef:
                name: hello-secret
```

跟昨天的 `configMapRef` 排在一起，結構完全對稱。

```bash
kubectl apply -f hello-deployment.yaml
kubectl rollout status deployment/hello
kubectl exec deploy/hello -- env | grep DB_PASSWORD
```

`DB_PASSWORD=super-secret-123`。小鳥拿到密碼了。

最後看一個容易被忽略的地方 ── 密碼在泡泡裡也是明文：

```bash
kubectl exec deploy/hello -- printenv DB_PASSWORD
```

能 `exec` 進掛載 Secret 的 container 的人，通常就能讀取它；實際範圍還取決於掛載位置與權限。**所以真正該管的是「誰能 exec」，不是「有沒有用 Secret」。**

這個 Secret 留著，Day 23 我們的資料庫密碼就用它。

順帶認識一下小盒的型號。你剛剛建的是 `Opaque`，也就是「隨便你放什麼」。另外兩種你之後一定會遇到：

```bash
kubectl get secrets -A --field-selector type!=Opaque | head -5
```

`kubernetes.io/tls` 是放 HTTPS 憑證的，Day 16 提過的 `spec.tls` 就是指向這種小盒；`kubernetes.io/dockerconfigjson` 是放私有 registry 帳密的，你的 image 拉不下來、`describe` 顯示 `unauthorized` 的時候，缺的就是它。

型號的意義在於**它規定了裡面必須有哪些 key**。填錯 key，櫃台會直接退件，不會等到用的時候才爆炸。

還有一個和昨天共通的坑要提醒：**改了 Secret，跑著的泡泡一樣不會自動更新。** 以環境變數注入的值不會因為 Secret 改變而自動更新，掛成檔案的會延遲更新但程式不知道。所以換密碼之後，記得補一行昨天學的：

```bash
kubectl rollout restart deployment/hello
```

這也是為什麼很多團隊會刻意把 Secret 的名字帶上版本號 ── 改密碼就換一個新名字，Deployment 跟著改，滾動更新自然就發生了，不會有人忘記重啟。

## 帶走一句話

**Secret 是玩具鎖，安全靠的是誰拿得到鑰匙。**

## 參考資源

- [Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
- [Secret Good Practices](https://kubernetes.io/docs/concepts/security/secrets-good-practices/)
