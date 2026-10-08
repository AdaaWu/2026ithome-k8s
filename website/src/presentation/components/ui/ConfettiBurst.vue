<script setup lang="ts">
// 過關時的彩紙，純 CSS 動畫
const COLORS = ['#f08a24', '#7cc4e8', '#8cc66d', '#f6c945', '#f28fb1', '#ffffff']
const pieces = Array.from({ length: 36 }, (_, i) => ({
  left: Math.random() * 100,
  delay: Math.random() * 0.4,
  duration: 1.6 + Math.random() * 1.2,
  color: COLORS[i % COLORS.length],
  rotate: Math.random() * 360,
  round: i % 3 === 0,
}))
</script>

<template>
  <div class="confetti" aria-hidden="true">
    <i
      v-for="(p, i) in pieces"
      :key="i"
      :style="{
        left: `${p.left}%`,
        background: p.color,
        animationDelay: `${p.delay}s`,
        animationDuration: `${p.duration}s`,
        transform: `rotate(${p.rotate}deg)`,
        borderRadius: p.round ? '50%' : '2px',
      }"
    />
  </div>
</template>

<style scoped>
.confetti {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 50;
}

i {
  position: absolute;
  top: -12px;
  width: 9px;
  height: 14px;
  animation: fall linear forwards;
}

@keyframes fall {
  to {
    transform: translateY(110vh) rotate(720deg);
    opacity: 0.6;
  }
}
</style>
