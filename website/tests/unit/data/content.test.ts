import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CHARACTERS } from '@/data/characters'
import { LEVELS } from '@/data/levels'
import { ACTS, TOTAL_DAYS } from '@/domain/level'

const EXPECTED_IDS = [
  'island', 'tree', 'bubble', 'bird', 'fence', 'lighthouse', 'memory-tree', 'tree-picker',
  'patrol-captain', 'whistle', 'squirrel', 'road-keeper', 'sticker', 'magnifier', 'owl', 'steward',
  'numbered-keeper', 'tree-guard-captain', 'job-ticket', 'cron-clock', 'totem', 'totem-inner',
  'totem-gate', 'totem-dock', 'gate-map', 'gatekeeper', 'notepad', 'lockbox', 'food-bucket',
  'food-bowl', 'warehouse', 'borrow-slip', 'alive-bell', 'ready-flag', 'request-tag', 'limit-line',
  'hpa-knob',
]

// vitest 從 website 目錄執行
const publicDir = resolve(process.cwd(), 'public')

describe('CHARACTERS', () => {
  it('角色 id 與約定清單完全一致且不重複', () => {
    const ids = CHARACTERS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual([...EXPECTED_IDS].sort())
  })

  it.each(CHARACTERS.map((c) => [c.id, c] as const))('%s 有 4 個不重複選項且答案在其中', (_, c) => {
    expect(c.options).toHaveLength(4)
    expect(new Set(c.options).size).toBe(4)
    expect(c.options).toContain(c.answer)
  })
})

describe('LEVELS', () => {
  it('剛好是 Day 1 到 Day 30', () => {
    expect(LEVELS.map((l) => l.day)).toEqual(Array.from({ length: TOTAL_DAYS }, (_, i) => i + 1))
  })

  it.each(LEVELS.map((l) => [l.day, l] as const))('Day %i 的角色都存在於圖鑑', (_, level) => {
    const ids = new Set(CHARACTERS.map((c) => c.id))
    for (const id of level.characters) expect(ids.has(id), id).toBe(true)
  })

  it.each(LEVELS.map((l) => [l.day, l] as const))('Day %i 的主圖檔案存在', (_, level) => {
    expect(existsSync(resolve(publicDir, level.image)), level.image).toBe(true)
  })
})

describe('任務簡報', () => {
  it.each(LEVELS.map((l) => [l.day, l] as const))('Day %i 的簡報六欄都有內容', (_, level) => {
    const { pain, conceptPlain, goal, steps, winCondition, insight } = level.briefing
    for (const text of [pain, conceptPlain, goal, winCondition, insight]) expect(text.trim()).not.toBe('')
    expect(steps.length).toBeGreaterThanOrEqual(2)
    expect(steps.length).toBeLessThanOrEqual(4)
    for (const step of steps) expect(step.trim()).not.toBe('')
  })

  it.each(LEVELS.map((l) => [l.day, l] as const))('Day %i 的簡報六欄不超過 180 字', (_, level) => {
    const { pain, conceptPlain, goal, steps, winCondition, insight } = level.briefing
    expect([pain, conceptPlain, goal, ...steps, winCondition, insight].join('').length).toBeLessThanOrEqual(180)
  })
})

const gameSource = (day: number) => readFileSync(resolve(process.cwd(), `src/presentation/games/days/Day${String(day).padStart(2, '0')}Game.vue`), 'utf8')

describe('小遊戲與關卡資料一致', () => {
  it.each(LEVELS.map((l) => [l.day, l] as const))('Day %i 的 gameHint 與遊戲提示相同', (_, level) => {
    expect(gameSource(level.day).match(/<GameShell[\s\S]*?\shint="([^"]+)"/)?.[1]).toBe(level.gameHint)
  })

  it.each(LEVELS.map((l) => [l.day, l] as const))('Day %i 的遊戲與簡報不提前用到還沒登場的角色', (_, level) => {
    const source = gameSource(level.day)
    const texts = [level.gameHint, ...Object.values(level.briefing).flat()].join('\n')
    const early = CHARACTERS.filter((c) => c.debutDay > level.day)
    for (const c of early) {
      expect(source.includes(`'${c.id}'`) || source.includes(`"${c.id}"`), c.id).toBe(false)
      expect(level.characters, c.id).not.toContain(c.id)
      expect(texts.includes(c.name), c.name).toBe(false)
    }
  })
})

describe('ACTS', () => {
  it('六幕首尾相接涵蓋 Day 1 到 Day 30', () => {
    expect(ACTS[0].days[0]).toBe(1)
    expect(ACTS.at(-1)?.days[1]).toBe(TOTAL_DAYS)
    ACTS.slice(1).forEach((act, i) => expect(act.days[0]).toBe(ACTS[i].days[1] + 1))
  })

  it.each(ACTS.map((a) => [a.name, a] as const))('%s 有本章目標與蓋完你會有', (_, act) => {
    expect(act.goal.trim()).not.toBe('')
    expect(act.result.trim()).not.toBe('')
  })
})
