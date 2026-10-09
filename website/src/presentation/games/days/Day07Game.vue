<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { playSfx } from '@/infrastructure/sfx'
import { GameShell, HintBubble, KChar, TagChip, useHint, useTimeouts, type CharFx, type GameStatus } from '../kit'

// Day 7 YAML 縮排師：修好 Pod YAML 送櫃台，再親手刪掉它
const emit = defineEmits<{ complete: [] }>()

type IndentKey = 'name' | 'containers' | 'item' | 'image'
type ValueKey = 'apiVersion' | 'kind'
type Target = IndentKey | ValueKey

interface Line {
  text: string
  indent?: IndentKey
  value?: ValueKey
  part?: string
}

const LINES: Line[] = [
  { text: 'apiVersion:', value: 'apiVersion', part: '規格書' },
  { text: 'kind:', value: 'kind', part: '種類' },
  { text: 'metadata:', part: '名牌' },
  { text: 'name: hello', indent: 'name' },
  { text: 'spec:', part: '內容' },
  { text: 'containers:', indent: 'containers' },
  { text: '- name: web', indent: 'item' },
  { text: 'image: nginx:alpine', indent: 'image' },
]

const CHOICES: Record<ValueKey, [string, string]> = { apiVersion: ['apps/v1', 'v1'], kind: ['pod', 'Pod'] }
const AHA = 'YAML 四塊：apiVersion、kind、metadata、spec。縮進去就屬於上一層；這顆泡泡（Pod）刪了，沒人會把它補回來。'

const status = ref<GameStatus>('intro')
const step = ref<'edit' | 'created' | 'deleted'>('edit')
const hint = useHint(2600)
const indents = reactive<Record<IndentKey, number>>({ name: 0, containers: 0, item: 0, image: 0 })
const values = reactive<Record<ValueKey, string>>({ apiVersion: 'apps/v1', kind: 'pod' })
const error = ref<string[]>([])
const lastFault = ref<Target | null>(null)
const repeatCount = ref(0)
const podFx = ref<CharFx>('none')

let completed = false
const { later } = useTimeouts()

// 依真實順序檢查：YAML 解析 → 找得到 kind → 欄位位置
function validate(): { fault: Target; lines: string[] } | null {
  const { containers: c, item: d, image: i } = indents
  const yamlError = (line: number, why: string) => ['error converting YAML to JSON:', `yaml: line ${line}:`, why]
  // 清單項縮得比 containers 淺，對不到任何一層
  if (d < c) return { fault: 'item', lines: yamlError(7, 'did not find expected key') }
  // image 只能落在已開啟的層：根、spec 底下、清單項底下
  // 清單項縮到 6 格時 image 對不齊，要改的是清單項那行
  const imageFault: Target = d + 2 > 6 ? 'item' : 'image'
  if (i > d + 2) return { fault: imageFault, lines: yamlError(8, 'mapping values are not allowed') }
  if (i === d && d > c) return { fault: imageFault, lines: yamlError(8, "did not find expected '-'") }
  if (i !== d + 2 && i !== 0 && i !== c) return { fault: imageFault, lines: yamlError(8, 'did not find expected key') }

  const { apiVersion, kind } = values
  if (kind !== 'Pod' || apiVersion !== 'v1') {
    return { fault: kind !== 'Pod' ? 'kind' : 'apiVersion', lines: [`no matches for kind "${kind}"`, `in version "${apiVersion}"`] }
  }

  const unknown = (field: string) => ['strict decoding error:', `unknown field "${field}"`]
  if (indents.name === 0) return { fault: 'name', lines: unknown('name') }
  if (c === 0) return { fault: 'containers', lines: unknown('containers') }
  if (i !== d + 2) return { fault: imageFault, lines: unknown(i === 0 ? 'image' : 'spec.image') }
  return null
}

function cycleIndent(key: IndentKey) {
  if (step.value !== 'edit') return
  indents[key] = (indents[key] + 2) % 8
  playSfx('tap')
}

function toggleValue(key: ValueKey) {
  if (step.value !== 'edit') return
  const [a, b] = CHOICES[key]
  values[key] = values[key] === a ? b : a
  playSfx('tap')
}

function send() {
  if (status.value !== 'playing' || step.value !== 'edit') return
  const result = validate()
  if (result) {
    repeatCount.value = result.fault === lastFault.value ? repeatCount.value + 1 : 1
    lastFault.value = result.fault
    error.value = result.lines
    playSfx('wrong')
    hint.show('櫃台退件，看看錯誤訊息', 'bad')
    return
  }
  error.value = []
  lastFault.value = null
  step.value = 'created'
  playSfx('correct')
  hint.show('pod/hello created，點泡泡刪掉它', 'good', 4000)
}

// 刪掉後等一會兒，畫面不變：沒有控制器把它補回來
function deletePod() {
  if (status.value !== 'playing' || step.value !== 'created') return
  step.value = 'deleted'
  podFx.value = 'pop'
  playSfx('pop')
  hint.clear()
  later(() => {
    if (status.value !== 'playing') return
    hint.show('等了 3 秒，沒有人把它補回來', 'info', 3000)
    later(() => {
      if (status.value === 'playing') status.value = 'won'
    }, 1600)
  }, 3000)
}

// 同一個錯連送 2 次，出錯那一行閃黃
const flashing = (key: Target) => repeatCount.value >= 2 && lastFault.value === key
const shown = computed(() => step.value !== 'edit')

function finish() {
  if (completed) return
  completed = true
  emit('complete')
}
</script>

<template>
  <GameShell hint="點行調縮排，送櫃台驗收" :status="status" :aha="AHA" @start="status = 'playing'" @finish="finish">
    <HintBubble :text="hint.text.value" :tone="hint.tone.value" @close="hint.clear" />

    <ol class="yaml paper">
      <li v-for="line in LINES" :key="line.text" class="yaml__row" :class="{ 'is-part': shown && line.part }">
        <button
          v-if="line.indent"
          class="yaml__indent"
          :class="{ 'is-flash': flashing(line.indent) }"
          :data-indent="line.indent"
          :disabled="step !== 'edit'"
          @click="cycleIndent(line.indent)"
        >
          {{ indents[line.indent] }} 格
        </button>
        <span v-else class="yaml__indent is-fixed" />
        <code class="yaml__code" :style="{ paddingLeft: `${(line.indent ? indents[line.indent] : 0) * 9}px` }">
          {{ line.text }}
        </code>
        <TagChip
          v-if="line.value"
          :class="{ 'is-flash': flashing(line.value) }"
          :text="values[line.value]"
          :data-value="line.value"
          :disabled="step !== 'edit'"
          mono
          color="blue"
          @tap="toggleValue(line.value)"
        />
        <span v-if="shown && line.part" class="yaml__part pop-in">{{ line.part }}</span>
      </li>
    </ol>

    <div class="desk">
      <KChar id="lighthouse" :size="64" label="櫃台" disabled />
      <div v-if="step === 'edit'" class="desk__out paper" data-test="error">
        <code v-for="(text, n) in error" :key="n">{{ text }}</code>
        <small v-if="!error.length">改好後送去櫃台</small>
      </div>
      <div v-else class="desk__pod">
        <KChar id="bubble" :size="96" :fx="podFx" :label="step === 'created' ? 'hello' : undefined" data-test="pod" :disabled="step !== 'created'" @tap="deletePod" />
        <code v-if="step === 'deleted'" class="desk__gone">No resources found</code>
      </div>
    </div>

    <template #controls>
      <button class="btn btn--primary send" data-test="send" :disabled="step !== 'edit'" @click="send">送去櫃台</button>
    </template>
  </GameShell>
</template>

<style scoped>
.yaml {
  margin: 58px 10px 0;
  padding: 6px 8px;
  list-style: none;
}

.yaml__row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  border-radius: var(--radius-sm);
}

.yaml__row.is-part {
  background: color-mix(in srgb, var(--accent-soft) 55%, transparent);
}

.yaml__indent {
  flex: none;
  width: 52px;
  height: 44px;
  border: 2px dashed var(--ink-soft);
  border-radius: var(--radius-sm);
  background: var(--cloud);
  font-size: 0.8rem;
  font-weight: 700;
}

.yaml__indent.is-fixed {
  border-color: transparent;
  background: none;
}

.yaml__code {
  font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
  font-size: 0.85rem;
  white-space: pre;
  transition: padding-left 0.15s;
}

.yaml__part {
  margin-left: auto;
  font-size: 0.75rem;
  color: var(--accent);
  font-weight: 700;
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

.desk {
  margin: auto 10px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 110px;
}

.desk__out {
  flex: 1;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.72rem;
  color: var(--danger);
}

.desk__out small {
  color: var(--ink-soft);
  font-size: 0.85rem;
}

.desk__pod {
  position: relative;
  flex: 1;
  display: flex;
  justify-content: center;
}

.desk__gone {
  position: absolute;
  bottom: 0;
  font-size: 0.8rem;
  color: var(--ink-soft);
}

.send {
  width: 100%;
  min-height: 52px;
}
</style>
