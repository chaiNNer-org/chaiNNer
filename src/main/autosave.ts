import { app } from 'electron/main';
import { existsSync } from 'fs';
import { readFile, unlink } from 'fs/promises';
import path from 'path';
import { log } from '../common/log';
import { getRootDir } from './platform';
import { SaveData, SaveFile } from './SaveFile';
import type { Version } from '../common/common-types';

const AUTOSAVE_FILENAME = 'autosave.chn';
const AUTOSAVE_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes default

/**
 * Gets the path to the autosave file.
 */
export const getAutosavePath = (): string => {
    return path.join(getRootDir(), AUTOSAVE_FILENAME);
};

/**
 * Checks if an autosave file exists (indicating a potential crash).
 */
export const hasAutosaveFile = (): boolean => {
    return existsSync(getAutosavePath());
};

/**
 * Reads the autosave file if it exists.
 */
export const readAutosaveFile = async (): Promise<SaveData | null> => {
    const autosavePath = getAutosavePath();
    if (!existsSync(autosavePath)) {
        return null;
    }

    try {
        const content = await readFile(autosavePath, { encoding: 'utf-8' });
        const parsed = SaveFile.parse(content);
        // Return the save data without the tamperedWith flag
        return {
            nodes: parsed.nodes,
            edges: parsed.edges,
            viewport: parsed.viewport,
        };
    } catch (error) {
        log.error('Failed to read autosave file', error);
        return null;
    }
};

/**
 * Deletes the autosave file.
 */
export const deleteAutosaveFile = async (): Promise<void> => {
    const autosavePath = getAutosavePath();
    if (existsSync(autosavePath)) {
        try {
            await unlink(autosavePath);
            log.info('Autosave file deleted');
        } catch (error) {
            log.error('Failed to delete autosave file', error);
        }
    }
};

/**
 * Writes current save data to the autosave file.
 */
export const writeAutosaveFile = async (saveData: SaveData, version: Version): Promise<void> => {
    const autosavePath = getAutosavePath();
    try {
        await SaveFile.write(autosavePath, saveData, version);
        log.debug('Autosave file written');
    } catch (error) {
        log.error('Failed to write autosave file', error);
    }
};

/**
 * Manages periodic autosaving and cleanup.
 */
export class AutosaveManager {
    private intervalId?: NodeJS.Timeout;

    private saveCallback?: () => Promise<void>;

    /**
     * Starts periodic autosaving.
     * @param callback Function to call to perform the autosave
     * @param intervalMs Interval in milliseconds (default: 3 minutes)
     */
    start(callback: () => Promise<void>, intervalMs: number = AUTOSAVE_INTERVAL_MS): void {
        if (this.intervalId) {
            this.stop();
        }

        this.saveCallback = callback;
        this.intervalId = setInterval(() => {
            callback().catch((error) => {
                log.error('Autosave callback failed', error);
            });
        }, intervalMs);

        log.info(`Autosave started with interval: ${intervalMs}ms`);
    }

    /**
     * Stops periodic autosaving.
     */
    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
            this.saveCallback = undefined;
            log.info('Autosave stopped');
        }
    }

    /**
     * Triggers an immediate autosave (e.g., on window blur).
     */
    async triggerImmediate(): Promise<void> {
        if (this.saveCallback) {
            try {
                await this.saveCallback();
            } catch (error) {
                log.error('Immediate autosave failed', error);
            }
        }
    }

    /**
     * Cleans up autosave file on normal exit.
     */
    async cleanup(): Promise<void> {
        this.stop();
        await deleteAutosaveFile();
    }
}

// Register cleanup on app quit
let autosaveManager: AutosaveManager | undefined;

export const getAutosaveManager = (): AutosaveManager => {
    if (!autosaveManager) {
        autosaveManager = new AutosaveManager();

        // Clean up autosave file on normal exit
        app.on('before-quit', () => {
            autosaveManager
                ?.cleanup()
                .catch((error) => log.error('Failed to cleanup autosave', error));
        });
    }
    return autosaveManager;
};
