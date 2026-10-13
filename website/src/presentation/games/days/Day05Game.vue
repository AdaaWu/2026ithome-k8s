<script setup lang="ts">
import { computed, ref } from 'vue'
import { playSfx } from '@/infrastructure/sfx'
import { GameShell, HintBubble, KChar, TagChip, useCountdown, useHint, useTimeouts, type GameStatus } from '../kit'

// Day 5 哨子點唱機：任務單帶入對象，玩家選動詞（get 時可加旗標）組出指令再吹
const emit = defineEmits<{ complete: [] }>()

type Verb = 'get' | 'describe' | 'logs' | 'apply' | 'delete' | 'exec' | 'port-forward'
type Flag = '-n dev' | '-A' | '-o yaml'

interface Task {
  id: string
  text: string
  verb: Verb
  target: string
  flag?: Flag
}

const TASKS: Task[] = [
  { id: 'list-dev', text: '看 dev 區的泡泡', verb: 'get', target: 'pods', flag: '-n dev' },
  { id: 'list-default', text: '看 default 區有哪些泡泡', verb: 'get', target: 'pods' },
  { id: 'list-all', text: '看所有區的泡泡', verb: 'get', target: 'pods', flag: '-A' },
  { id: 'events', text: '看這顆泡泡的事件', verb: 'describe', target: 'pod hello' },
  { id: 'logs', text: '看程式自己印了什麼', verb: 'logs', target: 'hello' },
  { id: 'apply', text: '把 YAML 交給島', verb: 'apply', target: '-f hello-pod.yaml' },
  { id: 'forward', text: '從筆電連進泡泡', verb: 'port-forward', target: 'pod/hello 8080:80' },
  { id: 'yaml', text: '看這顆泡泡的完整設定', verb: 'get', target: 'pod hello', flag: '-o yaml' },
  { id: 'exec', text: '進到小鳥裡下指令', verb: 'exec', target: '-it hello -- sh' },
  { id: 'delete', text: '把泡泡刪掉', verb: 'delete', target: 'pod hello' },
]

const VERBS: Array<{ id: Verb; meaning: string }> = [
  { id: 'get', meaning: '列清單' },
  { id: 'describe', meaning: '查細節與事件' },
  { id: 'logs', meaning: '讀程式輸出' },
  { id: 'apply', meaning: '交出 YAML' },
  { id: 'delete', meaning: '刪除' },
  { id: 'exec', meaning: '進容器下指令' },
  { id: 'port-forward', meaning: '開一條連線' },
]
const MEANING = Object.fromEntries(VERBS.map((v) => [v.id, v.meaning])) as Record<Verb, string>
const FLAGS: Flag[] = ['-n dev', '-A', '-o yaml']

const ROUNDS = 8
const TOTAL_SEC = 75
const BONUS_SEC = 20
const TERMINAL_MAX = 32
const AHA = '先看（get）、再查（describe）、再讀（logs）、再改（apply）、再刪（delete）。哨子吹出的每一句，都先抵達燈塔櫃台。'

function shuffle<T>(list: T[]): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j] as T, copy[i] as T]
  }
  return copy
}

const clip = (s: string) => (s.length > TERMINAL_MAX ? `${s.slice(0, TERMINAL_MAX - 1)}…` : s)

// get 加上不同旗標時的真實輸出；hello 在 default 區、api 在 dev 區
function getOutput(target: string, flag: Flag | null): string {
  if (flag === '-o yaml') return 'apiVersion: v1'
  if (target === 'pods') {
    if (flag === '-n dev') return 'api-7d9f   1/1   Running'
    if (flag === '-A') return 'dev   api-7d9f   Running'
    return 'hello   1/1   Running'
  }
  if (flag === '-n dev') return 'Error from server (NotFound): pods "hello" not found'
  if (flag === '-A') return 'error: a resource cannot be retrieved by name across all namespaces'
  return 'hello   1/1   Running'
}

const OK_OUTPUT: Record<Verb, string> = {
  get: '',
  describe: 'Events: Scheduled  Pulled  Started',
  logs: '"GET / HTTP/1.1" 200 615',
  apply: 'pod/hello configured',
  delete: 'pod "hello" deleted',
  exec: '/ # _',
  'port-forward': 'Forwarding from 127.0.0.1:8080',
}

const FLAG_HINT: Record<Flag, string> = {
  '-n dev': '這是 default 區，dev 要加 -n dev',
  '-A': '要看所有區，加 -A',
  '-o yaml': '完整設定要加 -o yaml',
}

const status = ref<GameStatus>('intro')
const tasks = ref(shuffle(TASKS).slice(0, ROUNDS))
const index = ref(0)
const verb = ref<Verb | null>(null)
const flag = ref<Flag | null>(null)
const terminal = ref('$ _')
const blowing = ref(false)
const stamped = ref(false)
const missCount = ref(0)
const extended = ref(false)
const hint = useHint(2600)
const countdown = useCountdown(TOTAL_SEC, { onExpire })

let completed = false
const { later, clearAll } = useTimeouts()

const task = computed(() => tasks.value[index.value]!)
const command = computed(() => ['kubectl', verb.value ?? '___', task.value.target, flag.value].filter(Boolean).join(' '))
const progress = computed(() => ({ current: index.value + (stamped.value ? 1 : 0), total: ROUNDS }))
const timer = computed(() => ({ remaining: countdown.remaining.value, total: extended.value ? BONUS_SEC : TOTAL_SEC }))

function onExpire() {
  if (!extended.value) {
    extended.value = true
    hint.show('再給你 20 秒！', 'info')
    countdown.reset(BONUS_SEC)
    countdown.start()
    return
  }
  status.value = 'lost'
}

function start() {
  status.value = 'playing'
  countdown.start()
}

function pickVerb(next: Verb) {
  if (stamped.value) return
  playSfx('tap')
  verb.value = verb.value === next ? null : next
  if (verb.value !== 'get') flag.value = null
}

function pickFlag(next: Flag) {
  if (stamped.value) return
  playSfx('tap')
  flag.value = flag.value === next ? null : next
}

function blow() {
  if (status.value !== 'playing' || stamped.value) return
  if (!verb.value) return hint.show('先選一個動詞', 'info')

  blowing.value = true
  later(() => (blowing.value = false), 500)
  const want = task.value
  const ok = verb.value === want.verb && flag.value === (want.flag ?? null)

  if (ok) {
    playSfx('correct')
    terminal.value = clip(verb.value === 'get' ? getOutput(want.target, flag.value) : OK_OUTPUT[verb.value])
    stamped.value = true
    missCount.value = 0
    // 蓋章到換下一張之間不扣時間
    countdown.pause()
    later(nextTask, 700)
    return
  }

  playSfx('wrong')
  missCount.value++
  if (verb.value === want.verb) {
    // 動詞對、旗標錯：印出這個旗標真正會看到的結果
    terminal.value = clip(getOutput(want.target, flag.value))
    hint.show(want.flag ? FLAG_HINT[want.flag] : '這題不用加旗標', 'bad')
  } else {
    terminal.value = '$ _'
    hint.show(`${verb.value}：${MEANING[verb.value]}，不是這題`, 'bad')
    // 動詞錯就清掉，預覽不拼出這題不存在的指令
    verb.value = null
    flag.value = null
  }
}

function nextTask() {
  if (status.value !== 'playing') return
  if (index.value === ROUNDS - 1) {
    status.value = 'won'
    return
  }
  stamped.value = false
  verb.value = null
  flag.value = null
  terminal.value = '$ _'
  index.value++
  countdown.start()
}

function retry() {
  clearAll()
  hint.clear()
  blowing.value = false
  tasks.value = shuffle(TASKS).slice(0, ROUNDS)
  index.value = 0
  verb.value = null
  flag.value = null
  stamped.value = false
  missCount.value = 0
  extended.value = false
  terminal.value = '$ _'
  countdown.reset(TOTAL_SEC)
  start()
}

function finish() {
  if (completed) return
  completed = true
  emit('complete')
}
</script>

<template>
  <GameShell
    hint="組出指令，完成每張任務單"
    :status="status"
    :aha="AHA"
    lose-text="先看、再查、再讀、再改、再刪。對著任務單的動詞再試一次！"
    :timer="timer"
    :progress="progress"
    @start="start"
    @retry="retry"
    @finish="finish"
  >
    <HintBubble :text="hint.text.value" :tone="hint.tone.value" @close="hint.clear" />

    <div class="task paper" :class="{ 'is-stamped': stamped }" :data-task="task.id">
      <small class="task__label">任務單 {{ index + 1 }} / {{ ROUNDS }}</small>
      <p class="task__text">{{ task.text }}</p>
      <span v-if="stamped" class="task__stamp pop-in">完成</span>
    </div>

    <div class="horn">
      <KChar id="whistle" :size="52" disabled />
      <span class="horn__wave" :class="{ 'is-on': blowing }" />
      <KChar id="lighthouse" :size="44" :fx="blowing ? 'glow' : 'none'" disabled />
    </div>

    <TagChip :text="command" mono color="blue" disabled class="cmd" />
    <div class="terminal" data-test="terminal">{{ terminal }}</div>

    <div class="pad">
      <div class="pad__verbs">
        <button
          v-for="v in VERBS"
          :key="v.id"
          class="btn pad__btn"
          :class="{ 'is-on': verb === v.id, 'is-flash': missCount >= 2 && v.id === task.verb && verb !== v.id }"
          :data-verb="v.id"
          @click="pickVerb(v.id)"
        >
          {{ v.id }}
          <small class="pad__meaning">{{ v.meaning }}</small>
        </button>
      </div>
      <div v-if="verb === 'get'" class="pad__flags">
        <button
          v-for="f in FLAGS"
          :key="f"
          class="btn pad__btn"
          :class="{ 'is-on': flag === f, 'is-flash': missCount >= 2 && f === task.flag && flag !== f }"
          :data-flag="f"
          @click="pickFlag(f)"
        >
          {{ f }}
        </button>
      </div>
      <button class="btn btn--primary pad__blow" data-test="blow" @click="blow">吹！</button>
    </div>
  </GameShell>
</template>

<style scoped>
.task {
  position: relative;
  margin: 56px 12px 0;
  padding: 8px 12px;
  text-align: center;
}

.task__label {
  color: var(--ink-soft);
}

.task__text {
  margin: 2px 0 0;
  font-family: var(--font-display);
  font-size: 1.15rem;
}

.task__stamp {
  position: absolute;
  right: -4px;
  top: -10px;
  padding: 0 8px;
  background: var(--cloud);
  border: 3px solid var(--danger);
  border-radius: var(--radius-sm);
  color: var(--danger);
  font-weight: 700;
  transform: rotate(-12deg);
}

.horn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 6px;
}

.horn__wave {
  width: 120px;
  height: 4px;
  border-radius: 999px;
  background: repeating-linear-gradient(90deg, var(--accent) 0 8px, transparent 8px 16px);
  opacity: 0.25;
}

.horn__wave.is-on {
  opacity: 1;
  animation: wave 0.5s linear;
}

@keyframes wave {
  from {
    background-position: 0 0;
  }
  to {
    background-position: 64px 0;
  }
}

.cmd {
  align-self: center;
  margin: 6px 12px 0;
}

.horn + .cmd:disabled {
  opacity: 1;
}

.terminal {
  margin: 6px 12px 0;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  background: #3b2f27;
  color: #c9f2b5;
  font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
  font-size: 0.78rem;
  white-space: pre;
  overflow: hidden;
}

.pad {
  margin: auto 12px 12px;
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pad__verbs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.pad__verbs .pad__btn:last-child {
  grid-column: span 2;
}

.pad__flags {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.pad__btn {
  min-height: 44px;
  padding: 4px 2px;
  font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
  font-size: 0.78rem;
}

.pad__verbs .pad__btn {
  flex-direction: column;
  gap: 0;
  line-height: 1.2;
}

.pad__meaning {
  font-family: var(--font-body);
  font-size: 0.62rem;
  color: var(--ink-soft);
}

.pad__btn.is-on {
  background: var(--accent-soft);
  border-color: var(--accent);
}

.pad__btn.is-flash {
  animation: flash 0.8s ease-in-out infinite;
}

.pad__blow {
  min-height: 48px;
}

@keyframes flash {
  50% {
    background: var(--accent-soft);
    border-color: var(--accent);
  }
}
</style>
