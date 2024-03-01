import { ChainnerSettings, defaultSettings } from './settings';

export interface ReadonlyStorage {
    keys: readonly string[];
    getItem(key: string): string | null;
}

export const migrateOldStorageSettings = (settings: ReadonlyStorage): ChainnerSettings => {
    const get = <T>(key: string, defaultValue: T): T => {
        const stored = settings.getItem(key);
        if (stored === null) {
            return defaultValue;
        }
        return JSON.parse(stored) as T;
    };

    const lastDirectories: Record<string, string | undefined> = {};
    for (const key of settings.keys) {
        const prefix = 'use-last-directory-';
        if (
            key.startsWith(prefix) &&
            // old (now unused) keys end with <space><number>
            !/ \d+$/.test(key)
        ) {
            lastDirectories[key.slice(prefix.length)] = settings.getItem(key) || undefined;
        }
    }

    return {
        useSystemPython: get('use-system-python', false),
        systemPythonLocation: get<string | null>('use-system-python', null) || '',

        theme: get('theme', 'dark'),
        checkForUpdatesOnStartup: get('check-upd-on-strtup-2', true),
        startupTemplate: get<string>('startup-template', '') || '',
        animateChain: get('animate-chain', true),
        snapToGrid: get('snap-to-grid', false),
        snapToGridAmount: get('snap-to-grid-amount', 16),
        viewportExportPadding: get('viewport-export-padding', 20),

        experimentalFeatures: get('experimental-features', false),
        hardwareAcceleration: get('enable-hardware-acceleration', false),
        allowMultipleInstances: get('allow-multiple-instances', false),

        lastWindowSize: get('use-last-window-size', defaultSettings.lastWindowSize),

        favoriteNodes: get('node-favorites', []),

        packageSettings: get('backend-settings', {}),

        storage: {
            nodeSelectorCollapsed: get('node-selector-collapsed', undefined),
            recent: get('use-recently-open', undefined),
            lastDirectories,
        },
    };
};
