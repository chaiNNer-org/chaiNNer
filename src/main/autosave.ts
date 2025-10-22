import { app } from 'electron/main';
import { existsSync } from 'fs';
import { readFile, unlink } from 'fs/promises';
import path from 'path';
import { log } from '../common/log';
import { getRootDir } from './platform';
import { SaveData, SaveFile } from './SaveFile';
import type { Version } from '../common/common-types';

const AUTOSAVE_FILENAME = 'autosave.chn';

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

// Clean up autosave file on normal exit
app.on('before-quit', () => {
    deleteAutosaveFile().catch((error) => log.error('Failed to cleanup autosave on quit', error));
});
