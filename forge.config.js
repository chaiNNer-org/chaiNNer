// eslint-disable-next-line import/no-extraneous-dependencies
const AdmZip = require('adm-zip');
const fs = require('fs/promises');
const path = require('path');
const packageJson = require('./package.json');

const makerOptions = {
    categories: ['Graphics'],
    genericName: 'Image Processing GUI',
    homepage: 'https://chainner.app',
    icon: './src/public/icons/cross_platform/icon.png',
    mimeType: ['application/json'],
    productDescription:
        'A node-based image processing GUI aimed at making chaining image processing tasks easy and customizable. Born as an AI upscaling application, chaiNNer has grown into an extremely flexible and powerful programmatic image processing application.\n\nChaiNNer gives you a level of customization of your image processing workflow that very few others do. Not only do you have full control over your processing pipeline, you can do incredibly complex tasks just by connecting a few nodes together.',
};

const deletePycFiles = async (directory) => {
    try {
        const files = await fs.readdir(directory, { withFileTypes: true });
        await Promise.all(
            files.map(async (file) => {
                const fullPath = path.join(directory, file.name);

                if (file.isDirectory()) {
                    if (file.name === '__pycache__') {
                        await fs.rm(fullPath, { recursive: true, force: true });
                    } else {
                        await deletePycFiles(fullPath);
                    }
                } else if (file.isFile() && path.extname(file.name) === '.pyc') {
                    await fs.unlink(fullPath);
                }
            })
        );
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
    }
};

/** @type {import("@electron-forge/shared-types").ForgeConfig} */
const config = {
    packagerConfig: {
        asar: false,
        executableName: process.platform === 'linux' ? packageJson.name : packageJson.productName,
        extraResource: ['./backend/src/', './src/public/icons/mac/file_chn.icns'],
        icon: makerOptions.icon,
        appBundleId: packageJson.appId,
        appCategoryType: 'public.app-category.graphics-design',
        extendInfo: './src/public/Info.plist',
        ...(process.argv.includes('--dry-run') || process.argv.includes('--no-sign')
            ? {}
            : {
                  osxSign: {},
                  osxNotarize: {
                      tool: 'notarytool',
                      appleId: process.env.APPLE_ID,
                      appleIdPassword: process.env.APPLE_PASSWORD,
                      teamId: process.env.APPLE_TEAM_ID,
                  },
              }),
    },
    publishers: [
        {
            name: '@electron-forge/publisher-github',
            config: {
                repository: {
                    owner: packageJson.author.name,
                    name: packageJson.productName,
                },
            },
            draft: true,
            prerelease: true,
        },
    ],
    makers: [
        {
            name: '@electron-forge/maker-squirrel',
            config: {
                name: packageJson.productName,
                iconUrl:
                    'https://github.com/chaiNNer-org/chaiNNer/blob/main/src/public/icons/win/icon.ico',
                setupIcon: './src/public/icons/win/icon.ico',
                loadingGif: './src/public/icons/win/installing_loop.gif',
            },
        },
        {
            name: '@electron-forge/maker-zip',
            platforms: ['linux', 'win32'],
        },
        {
            name: '@electron-forge/maker-dmg',
            config: {
                format: 'ULMO',
                background: './src/public/dmg-background.png',
                icon: './src/public/icons/mac/icon.icns',
                additionalDMGOptions: {
                    window: { size: { width: 660, height: 500 } },
                    filesystem: 'APFS',
                    ...(process.argv.includes('--dry-run') || process.argv.includes('--no-sign')
                        ? {}
                        : {
                              'code-sign': {
                                  'signing-identity': process.env.APPLE_SIGNING_ID,
                                  identifier: packageJson.appId,
                              },
                          }),
                },
            },
        },
        {
            name: '@electron-forge/maker-deb',
            config: {
                options: {
                    ...makerOptions,
                    section: 'graphics',
                },
            },
        },
        {
            name: '@electron-forge/maker-rpm',
            config: {
                options: { ...makerOptions, compressionLevel: 9 },
            },
        },
    ],
    plugins: [
        {
            name: '@electron-forge/plugin-vite',
            config: {
                // `build` can specify multiple entry builds, which can be
                // Main process, Preload scripts, Worker process, etc.
                build: [
                    {
                        // `entry` is an alias for `build.lib.entry`
                        // in the corresponding file of `config`.
                        entry: 'src/main/main.ts',
                        config: 'vite/main.config.ts',
                    },
                    {
                        entry: 'src/main/preload.ts',
                        config: 'vite/preload.config.ts',
                    },
                ],
                renderer: [
                    {
                        name: 'main_window',
                        config: 'vite/renderer.config.ts',
                    },
                ],
            },
        },
    ],
    hooks: {
        prePackage: async () => {
            // delete all .pyc files from backend folder, recursively
            const backendPath = path.join(__dirname, 'backend/src');
            await deletePycFiles(backendPath);
        },
        postMake: async (forgeConfig, makeResults) => {
            const justArtifacts = makeResults.map((m) => m.artifacts).reduce((a, b) => a.concat(b));
            const zipArtifact = justArtifacts.find((a) => a.endsWith('.zip'));
            if (zipArtifact) {
                // Add an empty `portable` file to the zip
                const zip = new AdmZip(zipArtifact);
                switch (process.platform) {
                    case 'win32':
                        zip.addFile('portable', Buffer.alloc(0));
                        break;
                    case 'linux':
                        zip.addFile('chaiNNer-linux-x64/portable', Buffer.alloc(0));
                        break;
                    default:
                        break;
                }
                zip.writeZip(zipArtifact);
            }
        },
    },
};

module.exports = config;
