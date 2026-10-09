import { defineAsyncComponent, type Component } from 'vue'
import FallbackGame from './FallbackGame.vue'
import LoadError from './LoadError.vue'

// 每日小遊戲自動註冊：days/Day03Game.vue → 3
const loaders = import.meta.glob<{ default: Component }>('./days/Day*Game.vue')

const byDay = new Map<number, () => Promise<{ default: Component }>>()
for (const [path, loader] of Object.entries(loaders)) {
  const match = path.match(/Day(\d+)Game\.vue$/)
  if (match) byDay.set(Number(match[1]), loader)
}

export function hasCustomGame(day: number): boolean {
  return byDay.has(day)
}

export function resolveDayGame(day: number): Component {
  const loader = byDay.get(day)
  return loader ? defineAsyncComponent({ loader, errorComponent: LoadError }) : FallbackGame
}
