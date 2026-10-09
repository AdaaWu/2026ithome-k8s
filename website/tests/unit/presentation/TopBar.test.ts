import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

async function mountTopBar() {
  vi.resetModules()
  const TopBar = (await import('@/presentation/components/ui/TopBar.vue')).default
  const wrapper = mount(TopBar, { props: { title: '雲之島' } })
  return {
    wrapper,
    music: () => wrapper.get('[data-test=toggle-music]'),
    sfx: () => wrapper.get('[data-test=toggle-sfx]'),
  }
}

describe('TopBar 音樂與音效開關', () => {
  beforeEach(() => localStorage.clear())

  it('右側有兩顆開關，預設都開啟', async () => {
    const { music, sfx } = await mountTopBar()
    expect(music().attributes('aria-label')).toBe('背景音樂')
    expect(music().attributes('aria-pressed')).toBe('true')
    expect(sfx().attributes('aria-label')).toBe('音效')
    expect(sfx().attributes('aria-pressed')).toBe('true')
    expect(sfx().text()).toBe('🔊')
  })

  it('點音樂只切換音樂', async () => {
    const { music, sfx } = await mountTopBar()
    await music().trigger('click')
    expect(music().attributes('aria-pressed')).toBe('false')
    expect(music().classes()).toContain('is-off')
    expect(sfx().attributes('aria-pressed')).toBe('true')
    expect(localStorage.getItem('k8s-cloud-island-music-muted')).toBe('1')
    expect(localStorage.getItem('k8s-cloud-island-muted')).toBeNull()
  })

  it('點音效只切換音效', async () => {
    const { music, sfx } = await mountTopBar()
    await sfx().trigger('click')
    expect(sfx().attributes('aria-pressed')).toBe('false')
    expect(sfx().text()).toBe('🔇')
    expect(music().attributes('aria-pressed')).toBe('true')
    expect(localStorage.getItem('k8s-cloud-island-muted')).toBe('1')
    expect(localStorage.getItem('k8s-cloud-island-music-muted')).toBeNull()
  })
})
