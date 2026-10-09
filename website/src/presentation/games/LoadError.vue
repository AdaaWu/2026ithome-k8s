<script setup lang="ts">
// 網站改版後舊的關卡檔案可能載不到，請玩家重新整理
const reload = () => location.reload()
</script>

<template>
  <div class="load-error paper">
    <p>這一關的地圖被風吹走了，重新整理一下就回來</p>
    <button class="btn btn--primary" @click="reload">重新整理</button>
  </div>
</template>

<style scoped>
.load-error {
  padding: 20px 16px;
  text-align: center;
}
</style>
