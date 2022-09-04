const rpc = require('discord-rpc');

const config = {
    // Joey pls upload the assets to (https://discord.com/developers/applications -> Rich Presence -> Art Assets)
    appId: '1015217737724874803', // ID
    details: 'ChaiNNing something cool!', // Large text under ChaiNNer
    largeImageKeyName: 'icon', // Key to the large image
    largeImageText: 'ChaiNNing something cool!', // Text when you hover over the large image (only needed if it's passed in setActivity)
    smallImageKeyName: 'small-image-key', // Key to the small image in the corner (only needed if it's passed in setActivity)
    smallImageText: 'ChaiNNer', // Text when you hover over the small image
};

const clientId = config.appId;
rpc.register(config.appId);
const client = new rpc.Client({ transport: 'ipc' });
const startTimestamp = new Date();

client.login({ clientId });

export const updateDiscordRPC = (detailsArg, largeImageKeyNameArg, startTimestampArg) => {
    // can be expanded with other params. Call this when you want to update the RPC.
    const detailsArgIn = detailsArg || config.details;
    const largeImageKeyNameArgIn = largeImageKeyNameArg || config.largeImageKeyName;
    const startTimestampArgIn = startTimestampArg || startTimestamp;
    client.setActivity({
        details: detailsArgIn,
        largeImageKey: largeImageKeyNameArgIn,
        startTimestamp: startTimestampArgIn,
    });
};

export const hideDiscordRPC = () => {
    client.clearActivity();
};

export const toggleRPC = (show) => {
    if (show === true) {
        updateDiscordRPC();
    } else {
        hideDiscordRPC();
    }
};
