<template>
  <div
    v-if="isLoading"
    class="flex h-full w-full items-center justify-center"
  >
    <div class="flex flex-col items-center gap-4">
      <div class="h-12 w-12 animate-spin rounded-full border-4 border-theme-500 border-t-transparent" />
      <p class="text-gray-400">
        Loading chaiNNer...
      </p>
    </div>
  </div>
  <MainView v-else />
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ipcRenderer } from './safeIpc';
import { useSettingsStore } from './stores/settingsStore';
import { useBackendStore } from './stores/backendStore';
import MainView from './views/MainView.vue';

const { locale } = useI18n();
const settingsStore = useSettingsStore();
const backendStore = useBackendStore();
const isLoading = ref(true);

onMounted(async () => {
  try {
    // Load settings from main process
    const settings = await ipcRenderer.invoke('get-settings');
    settingsStore.setSettings(settings);

    // Set locale from settings
    if (settings?.language) {
      locale.value = settings.language;
    }

    // Get backend URL (Node.js backend, not Python)
    const url = await ipcRenderer.invoke('get-backend-url');
    backendStore.setUrl(url);
    backendStore.setConnected(true);

    isLoading.value = false;
  } catch (error) {
    console.error('Failed to initialize application:', error);
    // Still show the app even if there's an error
    isLoading.value = false;
  }
});
</script>
