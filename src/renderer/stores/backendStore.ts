import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useBackendStore = defineStore('backend', () => {
    const url = ref<string>('');
    const connected = ref(false);

    const isConnected = computed(() => connected.value);

    function setUrl(newUrl: string) {
        url.value = newUrl;
    }

    function setConnected(status: boolean) {
        connected.value = status;
    }

    return {
        url,
        connected,
        isConnected,
        setUrl,
        setConnected,
    };
});
