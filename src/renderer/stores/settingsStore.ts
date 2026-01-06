import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ChainnerSettings } from '../../common/settings/settings';

export const useSettingsStore = defineStore('settings', () => {
    const settings = ref<ChainnerSettings | null>(null);

    function setSettings(newSettings: ChainnerSettings) {
        settings.value = newSettings;
    }

    function updateSetting<K extends keyof ChainnerSettings>(
        key: K,
        value: ChainnerSettings[K]
    ) {
        if (settings.value) {
            settings.value[key] = value;
        }
    }

    return {
        settings,
        setSettings,
        updateSetting,
    };
});
