<script setup lang="ts">
import { computed, ref } from 'vue'
import { playSfx } from '@/infrastructure/sfx'
import { ChoiceCards, GameShell, HintBubble, KChar, TagChip, useHint, useRounds, useTimeouts, type CharFx, type GameStatus } from '../kit'

// Day 13 跨籬喊話：Namespace 隔開名字、隔不開網路；跨區喊話要帶區名
const emit = defineEmits<{ complete: [] }>()

type Zone = 'dev' | 'prod'
type Word = 'hello' | 'dev' | 'prod' | 'svc'
type Round = { kind: 'call'; target: Zone; prompt: string } | { kind: 'build'; prompt: string } | { kind: 'packet'; prompt: string }

const ROUNDS: Round[] = [
  { kind: 'call', target: 'prod', prompt: '呼叫 prod 的 hello' },
  { kind: 'call', target: 'dev', prompt: '呼叫 dev 的 hello' },
  { kind: 'build', prompt: '再建一個叫 hello 的 Service' },
  { kind: 'packet', prompt: 'dev 泡泡直接打 prod 泡泡的 IP，會被圍籬擋下嗎？' },
]

const WORDS: Array<{ id: Word; text: string }> = [
  { id: 'hello', text: 'hello' },
  { id: 'dev', text: '.dev' },
  { id: 'prod', text: '.prod' },
  { id: 'svc', text: '.svc.cluster.local' },
]
const WORD_TEXT = Object.fromEntries(WORDS.map((w) => [w.id, w.text])) as Record<Word, string>

// 舞台座標（中心點），基準 340×240；橫向依舞台寬度等比換算，窄螢幕不用縮放
const POS = { dev: { x: 70, y: 70 }, prod: { x: 270, y: 70 }, devPod: { x: 45, y: 190 }, me: { x: 295, y: 190 } }
// 樹壓在圍籬線上，不偏向任何一區
const TREES = [
  { key: 'tree-a', x: 170, y: 118 },
  { key: 'tree-b', x: 170, y: 192 },
]
const pctX = (x: number) => `${((x / 340) * 100).toFixed(2)}%`
const place = (p: { x: number; y: number }, size: number) => ({ left: `calc(${pctX(p.x)} - ${size / 2}px)`, top: `${p.y - size / 2}px` })

const PACKET_OPTIONS = [
  { id: 'block', label: '擋下' },
  { id: 'pass', label: '通過' },
]

const AHA = '圍籬（Namespace）隔開名字，隔不開網路。同名可以共存，跨區喊話要帶區名：hello.dev.svc.cluster.local。'

// 玩家站在 prod：只喊名字會解析成同區
function resolve(words: Word[]): Zone | null {
  const [name, ns, suffix, ...rest] = words
  if (name !== 'hello' || rest.length > 0) return null
  if (ns === undefined) return 'prod'
  if (ns !== 'dev' && ns !== 'prod') return null
  if (suffix !== undefined && suffix !== 'svc') return null
  return ns
}

// 終端機單行 32 字元
const clip = (line: string) => (line.length > 32 ? `${line.slice(0, 31)}…` : line)

const status = ref<GameStatus>('intro')
const rounds = useRounds(ROUNDS)
const hint = useHint(2600)

const address = ref<Word[]>([])
const terminal = ref<string[]>([])
const flight = ref<{ key: number; from: { x: number; y: number }; to: { x: number; y: number } } | null>(null)
const lit = ref<string | null>(null)
const shaking = ref<string | null>(null)
const misses = ref(0)
const locked = ref(false)
const stagingBuilt = ref(false)
const step = ref<'ask' | 'tree' | 'done'>('ask')

let completed = false
let flightKey = 0
const { later } = useTimeouts()

const round = computed(() => rounds.current.value)
const progress = computed(() => ({
  current: rounds.results.value.filter((r) => r !== null).length,
  total: ROUNDS.length,
}))
const addressText = computed(() => address.value.map((w) => WORD_TEXT[w]).join(''))
const flashWords = computed<Word[]>(() => {
  const r = round.value
  if (misses.value < 2 || r.kind !== 'call') return []
  return r.target === 'prod' ? ['hello'] : ['hello', 'dev']
})
const flightStyle = computed(() => {
  const f = flight.value
  if (!f) return {}
  return { '--fx': pctX(f.from.x), '--fy': `${f.from.y}px`, '--tx': pctX(f.to.x), '--ty': `${f.to.y}px` }
})

const fxOf = (key: string): CharFx => (shaking.value === key ? 'shake' : lit.value === key ? 'glow' : 'none')

function fly(from: { x: number; y: number }, to: { x: number; y: number }) {
  const key = ++flightKey
  flight.value = { key, from, to }
  // 飛到後收起聲波
  later(() => {
    if (flight.value?.key === key) flight.value = null
  }, 800)
}

function addWord(word: Word) {
  if (locked.value || address.value.length >= 4) return
  playSfx('tap')
  address.value = [...address.value, word]
}

function miss(text: string) {
  misses.value++
  playSfx('wrong')
  hint.show(text, 'bad')
  address.value = []
}

function shout() {
  const r = round.value
  if (locked.value || r.kind !== 'call' || address.value.length === 0) return
  const zone = resolve(address.value)
  terminal.value = [clip(`$ curl ${addressText.value}`)]

  if (!zone) {
    terminal.value.push('NXDOMAIN（找不到這個地址）')
    miss('順序是：名字 → 區名 → .svc…')
    return
  }

  fly(POS.me, POS[zone])
  terminal.value.push(`hello ${zone === 'dev' ? 'v2' : 'v1'}（${zone}）`)
  if (zone !== r.target) {
    shaking.value = zone
    later(() => (shaking.value = null), 450)
    miss(address.value.length === 1 ? '同區優先，跨區要帶區名' : `喊到 ${zone} 了，題目要 ${r.target}`)
    return
  }

  lit.value = zone
  hint.show(address.value.length === 1 ? '同區叫名字就好' : '跨區要帶區名，喊到了！', 'good')
  playSfx('correct')
  pass()
}

function build(zone: 'dev' | 'prod' | 'staging') {
  if (locked.value) return
  if (zone !== 'staging') {
    // create 遇到同名才會回 AlreadyExists；apply 只會更新既有的
    terminal.value = ['$ kubectl create svc clusterip \\', `  hello --tcp=80:80 -n ${zone}`, 'Error from server (AlreadyExists):', 'services "hello" already exists']
    shaking.value = zone
    later(() => (shaking.value = null), 450)
    misses.value++
    playSfx('wrong')
    hint.show(`${zone} 已經有一個 hello 了`, 'bad')
    return
  }
  terminal.value = [
    '$ kubectl create ns staging',
    'namespace/staging created',
    '$ kubectl create svc clusterip \\',
    '  hello --tcp=80:80 -n staging',
    'service/hello created',
  ]
  stagingBuilt.value = true
  playSfx('correct')
  hint.show('新圍籬裡又能用 hello 了', 'good')
  pass(1600)
}

function answerPacket(_id: string, correct: boolean) {
  if (status.value !== 'playing') return
  if (!correct) {
    hint.show('預設沒有 NetworkPolicy，封包會通', 'bad')
    return
  }
  fly(POS.devPod, POS.me)
  terminal.value = ['$ curl 10.244.2.7', 'hello v1（封包穿過圍籬）']
  locked.value = true
  later(() => {
    if (status.value !== 'playing') return
    step.value = 'tree'
    hint.show('點一棵樹，看它屬於哪區', 'info', 6000)
  }, 1000)
}

function tapTree(key: string) {
  if (step.value !== 'tree') return
  step.value = 'done'
  lit.value = key
  playSfx('correct')
  hint.show('Node 不屬於任何 Namespace', 'good', 3000)
  rounds.record(true)
  later(() => {
    if (status.value === 'playing') status.value = 'won'
  }, 1500)
}

function pass(delay = 1400) {
  rounds.record(misses.value === 0)
  locked.value = true
  later(() => {
    if (status.value !== 'playing') return
    rounds.next()
    address.value = []
    terminal.value = []
    lit.value = null
    misses.value = 0
    locked.value = false
  }, delay)
}

function finish() {
  if (completed) return
  completed = true
  emit('complete')
}
</script>

<template>
  <GameShell
    hint="拼出地址，喊到對區的 hello"
    :status="status"
    :aha="AHA"
    :progress="progress"
    @start="status = 'playing'"
    @finish="finish"
  >
    <HintBubble :text="hint.text.value" :tone="hint.tone.value" @close="hint.clear" />

    <div class="scene">
      <span class="zone zone--dev">dev</span>
      <span class="zone zone--prod">prod</span>
      <i class="scene__line" />
      <KChar id="fence" :size="56" class="scene__item" :style="place({ x: 170, y: 36 }, 56)" disabled />
      <!-- 喊話對象只用名稱牌，hello 是明天登場的 Service 名稱 -->
      <span
        v-for="zone in (['dev', 'prod'] as const)"
        :key="zone"
        class="scene__item nameplate paper"
        :class="`nameplate--${fxOf(zone)}`"
        :style="place(POS[zone], 64)"
        :data-target="zone"
      >
        <b>hello</b>
        <small>{{ zone === 'dev' ? 'v2' : 'v1' }}</small>
      </span>
      <KChar
        v-for="tree in TREES"
        :key="tree.key"
        id="tree"
        :size="70"
        class="scene__item"
        :class="{ 'is-tappable': step === 'tree' }"
        :fx="fxOf(tree.key)"
        :style="place(tree, 70)"
        :disabled="step !== 'tree'"
        :data-tree="tree.key"
        @tap="tapTree(tree.key)"
      />
      <KChar id="bubble" :size="48" label="dev 泡泡" class="scene__item" :style="place(POS.devPod, 48)" disabled />
      <KChar id="bubble" :size="48" label="你在 prod" class="scene__item" :style="place(POS.me, 48)" disabled />
      <i v-if="flight" :key="flight.key" class="scene__wave" :style="flightStyle" />
    </div>

    <div v-if="stagingBuilt" class="staging pop-in">
      <span class="zone">staging</span>
      <b class="staging__plate paper">hello</b>
    </div>

    <div class="panel">
      <p class="panel__prompt paper" data-test="prompt">{{ round.prompt }}</p>

      <template v-if="round.kind === 'call'">
        <div class="address">{{ addressText || '點下面的詞塊組地址' }}</div>
        <div class="words">
          <TagChip
            v-for="w in WORDS"
            :key="w.id"
            :text="w.text"
            mono
            color="blue"
            :class="{ 'is-flash': flashWords.includes(w.id) }"
            :data-word="w.id"
            @tap="addWord(w.id)"
          />
        </div>
      </template>

      <div v-else-if="round.kind === 'build'" class="builds">
        <button class="btn" :class="{ shake: shaking === 'dev' }" data-build="dev" @click="build('dev')">建在 dev</button>
        <button class="btn" :class="{ shake: shaking === 'prod' }" data-build="prod" @click="build('prod')">建在 prod</button>
        <button class="btn" :class="{ 'is-flash': misses >= 2 }" data-build="staging" @click="build('staging')">先建 staging 圍籬再建</button>
      </div>

      <ChoiceCards v-else :options="PACKET_OPTIONS" answer="pass" :columns="2" @choose="answerPacket" />

      <pre v-if="terminal.length" class="terminal" data-test="terminal">{{ terminal.join('\n') }}</pre>
    </div>

    <template v-if="round.kind === 'call'" #controls>
      <div class="actions">
        <button class="btn" data-test="clear-addr" @click="address = []">清除</button>
        <button class="btn btn--primary" data-test="shout" :disabled="locked" @click="shout">喊！</button>
      </div>
    </template>
  </GameShell>
</template>

<style scoped>
.scene {
  position: relative;
  flex: none;
  width: 100%;
  max-width: 340px;
  height: 240px;
  margin: 52px auto 0;
}

.scene__item {
  position: absolute;
}

.scene__item.is-tappable :deep(.kchar__body) {
  animation: bob 1.4s ease-in-out infinite;
}

.scene__line {
  position: absolute;
  left: calc(50% - 1px);
  top: 30px;
  bottom: 0;
  border-left: 3px dashed var(--bark);
}

.zone {
  position: absolute;
  top: 6px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--cloud);
  font-family: ui-monospace, Menlo, monospace;
  font-size: 0.75rem;
}

.zone--dev {
  left: 10px;
}

.zone--prod {
  right: 10px;
}

.nameplate {
  width: 64px;
  height: 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  transition: filter 0.25s;
}

.nameplate b {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 0.9rem;
}

.nameplate small {
  font-size: 0.72rem;
  color: var(--ink-soft);
}

.nameplate--glow {
  filter: drop-shadow(0 0 4px var(--gold)) drop-shadow(0 0 10px var(--accent));
}

.nameplate--shake {
  animation: shake 0.4s;
}

/* 聲波／封包從起點飛到終點 */
.scene__wave {
  position: absolute;
  width: 16px;
  height: 16px;
  margin: -8px 0 0 -8px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 10px var(--accent);
  animation: fly 0.7s ease-in-out forwards;
}

@keyframes fly {
  from {
    left: var(--fx);
    top: var(--fy);
  }
  to {
    left: var(--tx);
    top: var(--ty);
  }
}

.staging {
  margin: 0 12px;
  padding: 2px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 2px dashed var(--bark);
  border-radius: var(--radius-md);
}

.staging__plate {
  padding: 4px 10px;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 0.85rem;
}

.staging .zone {
  position: static;
}

.panel {
  margin: auto 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.panel__prompt {
  margin: 0;
  padding: 8px 10px;
  font-family: var(--font-display);
  text-align: center;
}

.address {
  min-height: 36px;
  padding: 6px 10px;
  border: 2px dashed var(--ink-soft);
  border-radius: var(--radius-sm);
  background: var(--cloud);
  font-family: ui-monospace, Menlo, monospace;
  font-size: 0.85rem;
  overflow-wrap: anywhere;
}

.words {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 8px;
}

.words .is-flash,
.builds .is-flash {
  animation: flash 0.8s ease-in-out infinite;
}

@keyframes flash {
  50% {
    box-shadow: 0 0 0 4px var(--gold);
  }
}

.builds {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.builds [data-build='staging'] {
  grid-column: span 2;
}

.terminal {
  margin: 0;
  padding: 8px;
  border-radius: var(--radius-sm);
  background: #3d2f25;
  color: #f6efe2;
  font-size: 0.72rem;
  font-variant-ligatures: none;
  line-height: 1.4;
  white-space: pre-wrap;
}

.actions {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 10px;
}
</style>
