import { PackageSettings, SchemaId, WindowSize } from '../common-types';

export interface ChainnerSettings {
    useSystemPython: boolean;
    systemPythonLocation: string;

    // renderer
    theme: 'light' | 'dark' | 'system';
    realTheme: 'default' | 'charcoal';
    checkForUpdatesOnStartup: boolean;
    startupTemplate: string;
    animateChain: boolean;
    snapToGrid: boolean;
    snapToGridAmount: number;
    viewportExportPadding: number;
    showMinimap: boolean;

    experimentalFeatures: boolean;
    hardwareAcceleration: boolean;
    allowMultipleInstances: boolean;

    lastWindowSize: WindowSize;

    favoriteNodes: readonly SchemaId[];

    packageSettings: PackageSettings;

    storage: Readonly<Record<string, unknown>>;
}

export const defaultSettings: Readonly<ChainnerSettings> = {
    useSystemPython: false,
    systemPythonLocation: '',

    // renderer
    theme: 'dark',
    realTheme: 'default',
    checkForUpdatesOnStartup: true,
    startupTemplate: '',
    animateChain: true,
    snapToGrid: false,
    snapToGridAmount: 16,
    viewportExportPadding: 20,
    showMinimap: false,

    experimentalFeatures: false,
    hardwareAcceleration: false,
    allowMultipleInstances: false,

    lastWindowSize: {
        maximized: false,
        width: 1280,
        height: 720,
    },

    favoriteNodes: [],

    packageSettings: {},

    storage: {},
};
