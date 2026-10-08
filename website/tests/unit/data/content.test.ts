import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CHARACTERS } from '@/data/characters'
import { LEVELS } from '@/data/levels'
import { TOTAL_DAYS } from '@/domain/level'

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
