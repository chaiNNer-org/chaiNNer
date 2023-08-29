const AdmZip = require('adm-zip');
const fs = require('fs/promises');
const path = require('path');

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
        executableName: process.platform === 'linux' ? 'chainner' : 'chaiNNer',
        extraResource: ['./backend/src/', './src/public/icons/mac/file_chn.icns'],
        icon: './src/public/icons/cross_platform/icon',
        appBundleId: 'app.chainner',
        appCategoryType: 'public.app-category.graphics-design',
        extendInfo: './src/public/Info.plist',
        ...(process.argv.includes('--no-sign')
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
                    owner: 'chaiNNer-org',
                    name: 'chaiNNer',
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
                name: 'chainner',
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
                },
            },
        },
        {
            name: '@electron-forge/maker-deb',
            config: {
                name: 'chainner',
                options: {
                    icon: './src/public/icons/cross_platform/icon.png',
                },
            },
        },
        {
            name: '@electron-forge/maker-rpm',
            config: {
                name: 'chainner',
                options: {
                    icon: './src/public/icons/cross_platform/icon.png',
                },
            },
        },
    ],
    plugins: [
        {
            name: '@electron-forge/plugin-webpack',
            config: {
                mainConfig: './webpack.main.config.js',
                renderer: {
                    config: './webpack.renderer.config.js',
                    nodeIntegration: true,
                    contextIsolation: false,
                    entryPoints: [
                        {
                            html: './src/renderer/index.html',
                            js: './src/renderer/renderer.js',
                            name: 'main_window',
                        },
                        {
                            html: './src/renderer/splash.html',
                            js: './src/renderer/splash_renderer.js',
                            name: 'splash_screen',
                        },
                    ],
                },
                devContentSecurityPolicy: '',
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
