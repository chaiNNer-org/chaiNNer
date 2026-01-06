<template>
  <div class="flex h-full w-full flex-col bg-bg-0">
    <div class="flex h-16 items-center justify-between border-b border-bg-200 bg-bg-100 px-4">
      <h1 class="text-xl font-bold text-white">
        chaiNNer
      </h1>
      <div class="flex items-center gap-4">
        <span class="text-sm text-gray-400">
          Vue 3 + TypeScript + TailwindCSS
        </span>
      </div>
    </div>

    <div class="flex flex-1 overflow-hidden">
      <!-- Sidebar -->
      <div class="w-64 border-r border-bg-200 bg-bg-100">
        <div class="p-4">
          <h2 class="mb-4 text-lg font-semibold text-white">
            Node Selector
          </h2>
          <p class="text-sm text-gray-400">
            Nodes will appear here
          </p>
        </div>
      </div>

      <!-- Main canvas area -->
      <div class="flex flex-1 items-center justify-center bg-bg-0">
        <div class="text-center">
          <h2 class="mb-4 text-2xl font-bold text-white">
            Welcome to chaiNNer
          </h2>
          <p class="text-gray-400">
            Vue 3 + TypeScript + TailwindCSS conversion in progress
          </p>
          <p class="mt-2 text-sm text-gray-500">
            Node editor will be implemented with Vue Flow
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';

onMounted(() => {
  console.log('MainView mounted');
});
</script>
