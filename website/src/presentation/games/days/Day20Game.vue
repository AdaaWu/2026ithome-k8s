<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { playSfx } from '@/infrastructure/sfx'
import { GameShell, HintBubble, KChar, TagChip, useHint, usePickPlace, useTimeouts, type CharFx, type GameStatus } from '../kit'

// Day 20 玩具鎖鑑定：親手解開 base64，再分辨真保護與假安全
const emit = defineEmits<{ complete: [] }>()

type Bin = 'safe' | 'unsafe'
type CardId = 'rbac' | 'etcd' | 'kms' | 'base64' | 'describe' | 'git'

interface Card {
  id: CardId
  text: string
  bin: Bin
  why: string
}

const CARDS: Card[] = [
  { id: 'base64', text: 'base64 編碼', bin: 'unsafe', why: '一行 base64 -d 就解開了' },
  { id: 'rbac', text: 'RBAC：前端讀不到 Secret', bin: 'safe', why: 'RBAC 擋住沒權限的人' },
  { id: 'describe', text: 'describe 只顯示 8 bytes', bin: 'unsafe', why: '只是防手滑投影到螢幕，資料沒變' },
  { id: 'etcd', text: '開啟 etcd 靜態加密', bin: 'safe', why: '開了之後 etcd 存的是密文' },
  { id: 'git', text: 'Secret YAML 推上公開 git', bin: 'unsafe', why: '等於把密碼明文公開' },
  { id: 'kms', text: '外部金鑰管理（KMS）', bin: 'safe', why: '金鑰在外面，拿到資料也解不開' },
]
const BINS: Array<{ id: Bin; name: string }> = [
  { id: 'safe', name: '真的有保護' },
  { id: 'unsafe', name: '沒有保護' },
]
const SECRET = 'p4ssw0rd'
const MAX_MISS = 2
const AHA = 'Secret 的保護力來自存取權限與加密設定。base64 是編碼不是加密，Secret YAML 推上 git 就等於公開密碼。'

const status = ref<GameStatus>('intro')
const step = ref<'lock' | 'decoded' | 'sort'>('lock')
const hint = useHint(2600)
const revealed = ref('')
const boxFx = ref<CharFx>('none')
const placed = reactive<Partial<Record<CardId, Bin>>>({})
const misses = ref(0)
const streak = ref(0)
const shaking = ref<CardId | null>(null)

const pp = usePickPlace<CardId, Bin>({
  canPlace: (card, bin) => {
    const info = CARDS.find((c) => c.id === card)
    return info?.bin === bin || (info?.why ?? '放錯了')
  },
})

const { later, clearAll } = useTimeouts()

let completed = false

const waiting = computed(() => CARDS.filter((c) => !placed[c.id]))
const inBin = (bin: Bin) => CARDS.filter((c) => placed[c.id] === bin)
const correctBin = computed(() => CARDS.find((c) => c.id === pp.picked.value)?.bin)

// 逐字還原，表現「不需要任何金鑰」
function decode() {
  if (status.value !== 'playing' || step.value !== 'lock') return
  step.value = 'decoded'
  boxFx.value = 'bounce'
  playSfx('unlock')
  SECRET.split('').forEach((ch, i) => later(() => (revealed.value += ch), 120 * (i + 1)))
}

function pickCard(card: CardId) {
  pp.pick(card)
  playSfx('tap')
}

function drop(bin: Bin) {
  if (status.value !== 'playing') return
  const card = pp.picked.value
  const result = pp.place(bin)
  if (result.ok) {
    placed[result.item] = bin
    streak.value = 0
    playSfx('correct')
    if (waiting.value.length === 0) {
      later(() => {
        if (status.value === 'playing') status.value = 'won'
      }, 800)
    }
    return
  }
  if (!card) return hint.show('先點一張卡片', 'info')
  misses.value++
  streak.value++
  pp.cancel()
  playSfx('wrong')
  hint.show(result.reason, 'bad')
  shaking.value = card
  later(() => (shaking.value = null), 400)
  if (misses.value > MAX_MISS) status.value = 'lost'
}

function retry() {
  clearAll()
  shaking.value = null
  CARDS.forEach((c) => delete placed[c.id])
  misses.value = 0
  streak.value = 0
  pp.cancel()
  hint.clear()
  status.value = 'playing'
}

function finish() {
  if (completed) return
  completed = true
  emit('complete')
}
</script>

<template>
  <GameShell
    hint="分辨真保護與假安全"
    :status="status"
    :aha="AHA"
    lose-text="base64 只是編碼。再想想：誰擋得住偷看的人？"
    @start="status = 'playing'"
    @retry="retry"
    @finish="finish"
  >
    <HintBubble :text="hint.text.value" :tone="hint.tone.value" @close="hint.clear" />

    <section v-if="step !== 'sort'" class="lock">
      <div class="lock__scene">
        <KChar id="lockbox" :size="110" :fx="boxFx" label="Secret" disabled />
        <KChar id="memory-tree" :size="72" label="etcd" disabled />
      </div>
      <TagChip class="static" text="password: cDRzc3cwcmQ=" mono color="purple" />
      <small class="lock__note">etcd 預設不加密，存的是解開後的原值</small>
      <div v-if="step === 'decoded'" class="lock__out paper">
        <code class="lock__plain">{{ revealed }}</code>
        <small v-if="revealed === SECRET">耗時 0.01 秒，不需要任何金鑰</small>
      </div>
    </section>

    <section v-else class="sort">
      <div class="bins">
        <button
          v-for="bin in BINS"
          :key="bin.id"
          class="bin paper"
          :class="{ 'is-flash': streak >= 2 && correctBin === bin.id }"
          :data-bin="bin.id"
          @click="drop(bin.id)"
        >
          <strong>{{ bin.name }}</strong>
          <span v-for="c in inBin(bin.id)" :key="c.id" class="bin__card pop-in">{{ c.text }}</span>
        </button>
      </div>
      <p class="sort__tip">點卡片，再點收納區（錯 {{ misses }} / {{ MAX_MISS }}）</p>
      <div class="cards">
        <TagChip
          v-for="c in waiting"
          :key="c.id"
          :class="{ shake: shaking === c.id }"
          :text="c.text"
          :data-card="c.id"
          :selected="pp.picked.value === c.id"
          color="blue"
          @tap="pickCard(c.id)"
        />
      </div>
    </section>

    <template #controls>
      <button v-if="step === 'lock'" class="btn btn--primary wide" data-test="decode" @click="decode">base64 -d</button>
      <button v-else-if="step === 'decoded'" class="btn btn--primary wide" data-test="next" :disabled="revealed !== SECRET" @click="step = 'sort'">
        那什麼才是真的保護？
      </button>
    </template>
  </GameShell>
</template>

<style scoped>
.static {
  pointer-events: none;
}

.lock {
  margin-top: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.lock__scene {
  display: flex;
  align-items: flex-end;
  gap: 24px;
}

.lock__note {
  color: var(--ink-soft);
}

.lock__out {
  padding: 10px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.lock__plain {
  font-size: 1.6rem;
  color: var(--danger);
  min-height: 2rem;
}

.sort {
  margin-top: 58px;
  padding: 0 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bins {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.bin {
  min-height: 150px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  gap: 4px;
  border: 2px dashed var(--ink-soft);
  font-size: 0.8rem;
}

.bin__card {
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: var(--cloud);
}

.sort__tip {
  margin: 0;
  text-align: center;
  font-size: 0.8rem;
  color: var(--ink-soft);
}

.cards {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px 8px;
}

.is-flash {
  animation: flash 0.8s ease-in-out infinite;
}

@keyframes flash {
  50% {
    background: var(--gold);
    border-color: var(--accent);
  }
}

.wide {
  width: 100%;
  min-height: 52px;
}
</style>
