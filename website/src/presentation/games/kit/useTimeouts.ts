import { onScopeDispose, watch } from 'vue'
import { useGamePaused } from './useGamePaused'

interface Job {
  fn: () => void
  left: number
  armedAt: number
  id?: ReturnType<typeof setTimeout>
}

/** 集中管理延遲回呼：retry 時呼叫 clearAll，避免上一局的回呼改到新局；遊戲暫停時剩餘時間凍結 */
export function useTimeouts() {
  const paused = useGamePaused()
  const jobs = new Set<Job>()

  function arm(job: Job) {
    job.armedAt = Date.now()
    job.id = setTimeout(() => {
      jobs.delete(job)
      job.fn()
    }, job.left)
  }

  function later(fn: () => void, ms: number) {
    const job: Job = { fn, left: ms, armedAt: 0 }
    jobs.add(job)
    if (!paused.value) arm(job)
  }

  function clearAll() {
    jobs.forEach((job) => clearTimeout(job.id))
    jobs.clear()
  }

  watch(
    paused,
    (isPaused) => {
      jobs.forEach((job) => {
        if (isPaused && job.id !== undefined) {
          clearTimeout(job.id)
          job.id = undefined
          job.left = Math.max(0, job.left - (Date.now() - job.armedAt))
        } else if (!isPaused && job.id === undefined) arm(job)
      })
    },
    { flush: 'sync' },
  )

  onScopeDispose(clearAll)
  return { later, clearAll }
}
