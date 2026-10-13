<script setup lang="ts">
import { useRouter } from 'vue-router'
import { CHARACTERS } from '@/data/characters'
import { playSfx } from '@/infrastructure/sfx'
import CharacterSprite from '@/presentation/components/characters/CharacterSprite.vue'
import TopBar from '@/presentation/components/ui/TopBar.vue'

const router = useRouter()

const CORE_CAST = [
  { id: 'island', name: '雲之島', k8s: 'Cluster', desc: '整座島，K8s 管理的範圍' },
  { id: 'tree', name: '巢樹', k8s: 'Node', desc: '島上的樹，一台真的機器或虛擬機' },
  { id: 'bubble', name: '泡泡', k8s: 'Pod', desc: '掛在樹上，K8s 部署與排程的最小單位' },
  { id: 'bird', name: '小鳥', k8s: 'Container', desc: '住在泡泡裡，真正跑你程式的容器' },
  { id: 'whistle', name: '哨子', k8s: 'kubectl', desc: '你手上的工具，吹出去的指令都送到櫃台' },
  { id: 'lighthouse', name: '燈塔櫃台', k8s: 'API Server', desc: '島的唯一窗口，所有指令與決定都先經過它' },
]

const restCount = CHARACTERS.length - CORE_CAST.length

function goMap() {
  playSfx('tap')
  void router.push({ name: 'map' })
}
</script>

<template>
  <div class="prologue">
    <TopBar title="序章" back="/map" />

    <section class="page prologue__body">
      <header class="prologue__head">
        <p class="prologue__kicker">序章</p>
        <h2 class="prologue__title">雲之島是什麼？</h2>
      </header>

      <section class="block paper">
        <h3>雲之島是什麼</h3>
        <ul>
          <li>雲之島是一座會自己運轉的島，它就是一個 Kubernetes 叢集（Cluster）</li>
          <li>島上每個角色都對應一個真實的 K8s 元件，比喻只幫你記，正式名稱一定附在旁邊</li>
          <li>你不用告訴島「怎麼做」，只要說「我想要什麼」，角色們會分工把它變成真的</li>
        </ul>
      </section>

      <section class="block paper">
        <h3>三條世界規則</h3>
        <ol>
          <li><b>小鳥永遠住在泡泡裡</b>：K8s 排程的是 Pod，不是單一 Container</li>
          <li><b>泡泡會換，柱子不換</b>：Pod 隨時被替換，Service 給你固定入口</li>
          <li><b>要留下的資料放地面的倉庫</b>：靠借用單（PVC）接上倉庫（PV），資料才活得過 Pod</li>
        </ol>
      </section>

      <section class="block paper">
        <h3>先認識六位核心角色</h3>
        <ul class="cast">
          <li v-for="c in CORE_CAST" :key="c.id" class="cast__item">
            <CharacterSprite :id="c.id" :size="56" />
            <span>
              <strong>{{ c.name }}（{{ c.k8s }}）</strong>
              <small>{{ c.desc }}</small>
            </span>
          </li>
        </ul>
        <p class="block__note">其他 {{ restCount }} 位角色，會在各章開場登場</p>
      </section>

      <section class="block paper">
        <h3>這個網站怎麼玩</h3>
        <ul>
          <li>每天一關，對應一篇文章；先看任務簡報，再玩 1–3 分鐘小遊戲</li>
          <li>過關後收下「帶走一句話」，角色可到圖鑑猜猜看</li>
          <li>破完 30 關並在圖鑑答對全部角色，成為「K8s 雲之島統治大王」</li>
        </ul>
      </section>

      <button class="btn btn--primary prologue__go" data-test="prologue-go" @click="goMap">出發去地圖 ›</button>
    </section>
  </div>
</template>

<style scoped>
.prologue__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.prologue__head {
  text-align: center;
}

.prologue__kicker {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: 0.2em;
}

.prologue__title {
  font-size: 1.4rem;
}

.block {
  padding: 14px 16px;
}

.block h3 {
  margin: 0 0 8px;
  font-size: 1.1rem;
}

.block ul,
.block ol {
  margin: 0;
  padding-left: 1.3em;
  display: grid;
  gap: 6px;
  font-size: 0.92rem;
  line-height: 1.55;
}

.block__note {
  margin: 10px 0 0;
  font-size: 0.85rem;
  color: var(--ink-soft);
}

.block .cast {
  padding: 0;
  list-style: none;
  gap: 10px;
}

.cast__item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cast__item strong {
  display: block;
  font-family: var(--font-display);
}

.cast__item small {
  color: var(--ink-soft);
  font-size: 0.85rem;
}

.prologue__go {
  width: 100%;
}

@media (min-width: 768px) {
  .prologue__body {
    max-width: 720px;
    margin: 0 auto;
    gap: 18px;
    padding-top: 24px;
  }

  .prologue__title {
    font-size: clamp(1.5rem, 1rem + 1.2vw, 2.1rem);
  }

  .block {
    padding: 18px 24px;
  }

  .block ul,
  .block ol {
    font-size: 1rem;
  }

  .block .cast {
    grid-template-columns: 1fr 1fr;
  }

  .prologue__go {
    width: fit-content;
    min-width: 240px;
    margin: 0 auto;
  }
}
</style>
