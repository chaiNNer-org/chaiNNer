import rpc, { Presence } from 'discord-rpc';
import log from 'electron-log';

const CLIENT_ID = '937839790169161728';
const client = new rpc.Client({ transport: 'ipc' });

const config: Presence = {
    details: 'Working on a chain', // Large text under application
    largeImageKey: 'chainner_icon', // Key to the large image
    largeImageText: 'chaiNNer', // Text when you hover over the large image (only needed if it's passed in setActivity)
    smallImageKey: 'chainner_icon', // Key to the small image in the corner (only needed if it's passed in setActivity)
    smallImageText: 'chaiNNer', // Text when you hover over the small image
};
const startTimestamp = new Date();
let registered = false;

export const registerDiscordRPC = async () => {
    try {
        rpc.register(CLIENT_ID);
        await client.login({ clientId: CLIENT_ID });
        registered = true;
    } catch (e) {
        log.warn('Failed to login to discord');
    }
};

let lastConfig = config;

export const updateDiscordRPC = async (updateConfig: Presence) => {
    try {
        if (!registered) {
            await registerDiscordRPC();
        }
        lastConfig = { ...config, ...updateConfig, startTimestamp };
        await client.setActivity(lastConfig);
    } catch (e) {
        log.warn('Failed to update discord RPC');
    }
};

export const hideDiscordRPC = async () => {
    try {
        await client.clearActivity();
    } catch (e) {
        log.warn('Failed to hide discord RPC');
    }
};

export const toggleDiscordRPC = async (enabled: boolean) => {
    if (enabled) {
        await updateDiscordRPC(lastConfig);
    } else {
        await hideDiscordRPC();
    }
};
