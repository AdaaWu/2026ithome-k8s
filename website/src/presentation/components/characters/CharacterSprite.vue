<script setup lang="ts">
import { computed, type Component } from 'vue'

const props = withDefaults(
  defineProps<{
    id: string
    size?: number | string
    /** 影子模式：圖鑑未解鎖時使用 */
    silhouette?: boolean
    /** 待機時上下浮動 */
    bob?: boolean
  }>(),
  { size: 72, silhouette: false, bob: false },
)

const modules = import.meta.glob<{ default: Component }>('./art/*.vue', { eager: true })
const ART: Record<string, Component> = Object.fromEntries(
  Object.entries(modules).map(([path, mod]) => [path.replace('./art/', '').replace('.vue', ''), mod.default]),
)

const art = computed(() => ART[props.id])
const cssSize = computed(() => (typeof props.size === 'number' ? `${props.size}px` : props.size))
</script>

<template>
  <span
    class="sprite"
    :class="{ 'sprite--shadow': silhouette, 'sprite--bob': bob }"
    :style="{ width: cssSize, height: cssSize }"
    :data-character="id"
  >
    <component :is="art" v-if="art" />
    <span v-else class="sprite__missing">?</span>
  </span>
</template>

<style scoped>
.sprite {
  display: inline-block;
  position: relative;
  flex: none;
  transition: filter 0.6s ease;
}

.sprite :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
}

.sprite--shadow {
  filter: brightness(0) opacity(0.78);
}

.sprite--bob {
  animation: bob 2.6s ease-in-out infinite;
}

.sprite__missing {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: var(--cloud);
  font-family: var(--font-display);
  font-size: 1.5rem;
}
</style>
