/* eslint-disable @typescript-eslint/no-misused-promises */
import { Menu, MenuItemConstructorOptions, app, dialog, shell } from 'electron';
import os from 'os';
import path from 'path';
import { isMac } from '../../common/env';
import { links } from '../../common/links';
import { BrowserWindowWithSafeIpc } from '../../common/safeIpc';
import { openSaveFile } from '../../common/SaveFile';
import { getLogsFolder } from '../platform';
import { getCpuInfo, getGpuInfo } from '../systemInfo';

export interface MenuData {
    openRecentRev: readonly string[];
}

export interface MainMenuArgs {
    mainWindow: BrowserWindowWithSafeIpc;
    menuData: Readonly<MenuData>;
    enabled?: boolean;
}

export const setMainMenu = ({ mainWindow, menuData, enabled = false }: MainMenuArgs) => {
    const openRecent = [...menuData.openRecentRev].reverse();
    const defaultPath = openRecent[0] ? path.dirname(openRecent[0]) : undefined;

    const showAboutDialog = async () => {
        const response = await dialog.showMessageBox(mainWindow, {
            title: 'About chaiNNer',
            message: `chaiNNer ${app.getVersion()}`,
            detail: `chaiNNer is an open source (GPLv3 licensed) tool created by @joeyballentine, with support from other community members. Support the project by donating to my Ko-Fi via the button below. Also, many thanks to these members specifically: @RunDevelopment and @theflyingzamboni for ongoing development, and @Kim2091 for testing.`,
            buttons: ['Open Ko-Fi', 'Close'],
            defaultId: 0,
            cancelId: 1,
        });

        if (response.response === 0) {
            await shell.openExternal(links.kofi);
        }
    };

    const createOpenRecentSubmenu = (
        recentFiles: readonly string[],
        window: BrowserWindowWithSafeIpc,
        isMacPlatform: boolean,
        isEnabled: boolean
    ) => {
        const submenu: MenuItemConstructorOptions[] =
            recentFiles.length === 0
                ? [
                      {
                          label: isMacPlatform ? 'Clear Menu' : 'No entries',
                          enabled: false,
                      },
                  ]
                : recentFiles.map((filepath, i) => ({
                      label: filepath,
                      accelerator: i <= 9 ? `CmdOrCtrl+${i + 1}` : undefined,
                      click: async () => {
                          if (!window.isFocused()) window.show();
                          window.webContents.send('file-open', await openSaveFile(filepath));
                      },
                      enabled: isEnabled,
                  }));

        if (recentFiles.length !== 0) {
            submenu.push(
                { type: 'separator' },
                {
                    label: isMacPlatform ? 'Clear Menu' : 'Clear Recently Opened',
                    click: () => {
                        window.webContents.send('clear-open-recent');
                    },
                    enabled: isEnabled,
                }
            );
        }

        return submenu;
    };
    // Usage

    const openRecentSubmenu = createOpenRecentSubmenu(openRecent, mainWindow, isMac, enabled);

    const template = [
        ...(isMac
            ? [
                  {
                      role: 'appMenu',
                      submenu: [
                          { label: 'About chaiNNer', click: showAboutDialog },
                          { type: 'separator' },
                          { role: 'services', submenu: [] },
                          { type: 'separator' },
                          { role: 'hide' },
                          { role: 'hideOthers' },
                          { role: 'unhide' },
                          { type: 'separator' },
                          { role: 'quit' },
                      ],
                  },
              ]
            : []),
        {
            label: 'File',
            submenu: [
                {
                    label: 'New',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        if (!mainWindow.isFocused()) mainWindow.show();
                        mainWindow.webContents.send('file-new');
                    },
                    enabled,
                },
                {
                    label: 'Open...',
                    accelerator: 'CmdOrCtrl+O',
                    click: async () => {
                        const {
                            canceled,
                            filePaths: [filepath],
                        } = await dialog.showOpenDialog(mainWindow, {
                            title: 'Open Chain File',
                            defaultPath,
                            filters: [{ name: 'Chain', extensions: ['chn'] }],
                            properties: ['openFile'],
                        });
                        if (canceled) return;

                        mainWindow.webContents.send('file-open', await openSaveFile(filepath));
                    },
                    enabled,
                },
                {
                    label: 'Open Recent',
                    submenu: openRecentSubmenu,
                    enabled,
                },
                { type: 'separator' },
                {
                    label: 'Save',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => {
                        mainWindow.webContents.send('file-save');
                    },
                    enabled,
                },
                {
                    label: 'Save As...',
                    accelerator: 'CmdOrCtrl+Shift+S',
                    click: () => {
                        mainWindow.webContents.send('file-save-as');
                    },
                    enabled,
                },
                {
                    label: 'Export for Sharing',
                    accelerator: 'CmdOrCtrl+Shift+E',
                    click: () => {
                        mainWindow.webContents.send('file-export-template');
                    },
                    enabled,
                },
                { type: 'separator' },
                {
                    label: 'Export viewport as PNG',
                    accelerator: 'CmdOrCtrl+P',
                    registerAccelerator: false,
                    click: () => {
                        mainWindow.webContents.send('export-viewport', 'file');
                    },
                    enabled,
                },
                {
                    label: 'Export viewport to clipboard',
                    accelerator: 'CmdOrCtrl+Shift+P',
                    registerAccelerator: false,
                    click: () => {
                        mainWindow.webContents.send('export-viewport', 'clipboard');
                    },
                    enabled,
                },
                ...(!isMac ? [{ type: 'separator' }, { role: 'quit', enabled }] : []),
            ],
        },
        ...(isMac
            ? [
                  { role: 'editMenu' },
                  {
                      label: 'View',
                      submenu: [
                          { role: 'reload', enabled },
                          { role: 'forceReload', enabled },
                          { type: 'separator' },
                          { role: 'resetZoom', enabled },
                          { role: 'zoomIn', enabled },
                          { role: 'zoomOut', enabled },
                          { type: 'separator' },
                          { role: 'togglefullscreen' },
                          ...(!app.isPackaged
                              ? [{ type: 'separator' }, { role: 'toggleDevTools' }]
                              : []),
                      ],
                  },
                  {
                      label: 'Nodes',
                      submenu: [
                          {
                              label: 'Undo',
                              click: () => {
                                  mainWindow.webContents.send('history-undo');
                              },
                              enabled,
                          },
                          {
                              label: 'Redo',
                              click: () => {
                                  mainWindow.webContents.send('history-redo');
                              },
                              enabled,
                          },
                          { type: 'separator' },
                          {
                              label: 'Cut',
                              click: () => {
                                  mainWindow.webContents.send('cut');
                              },
                              enabled,
                          },
                          {
                              label: 'Copy',
                              click: () => {
                                  mainWindow.webContents.send('copy');
                              },
                              enabled,
                          },
                          {
                              label: 'Paste',
                              click: () => {
                                  mainWindow.webContents.send('paste');
                              },
                              enabled,
                          },
                          {
                              label: 'Delete',
                              click: () => {
                                  mainWindow.webContents.sendInputEvent({
                                      type: 'keyDown',
                                      keyCode: 'Backspace',
                                      modifiers: ['cmd'],
                                  });
                                  mainWindow.webContents.sendInputEvent({
                                      type: 'keyUp',
                                      keyCode: 'Backspace',
                                      modifiers: ['cmd'],
                                  });
                              },
                          },
                          {
                              label: 'Select All',
                              click: () => {
                                  mainWindow.webContents.sendInputEvent({
                                      type: 'keyDown',
                                      keyCode: 'a',
                                      modifiers: ['cmd'],
                                  });
                                  mainWindow.webContents.sendInputEvent({
                                      type: 'keyUp',
                                      keyCode: 'a',
                                      modifiers: ['cmd'],
                                  });
                              },
                          },
                          { type: 'separator' },
                          {
                              label: 'Duplicate',
                              accelerator: 'CmdOrCtrl+D',
                              click: () => {
                                  mainWindow.webContents.send('duplicate');
                              },
                              enabled,
                          },
                          {
                              label: 'Duplicate with Connections',
                              accelerator: 'CmdOrCtrl+Shift+D',
                              click: () => {
                                  mainWindow.webContents.send('duplicate-with-input-edges');
                              },
                              enabled,
                          },
                          { type: 'separator' },
                          {
                              label: 'Format Chain',
                              accelerator: 'CmdOrCtrl+Shift+F',
                              click: () => {
                                  mainWindow.webContents.send('format-chain');
                              },
                              enabled,
                          },
                      ],
                  },
                  { role: 'windowMenu' },
              ]
            : [
                  {
                      label: 'Edit',
                      submenu: [
                          {
                              label: 'Undo',
                              accelerator: 'CmdOrCtrl+Z',
                              registerAccelerator: false,
                              click: () => {
                                  mainWindow.webContents.send('history-undo');
                              },
                              enabled,
                          },
                          {
                              label: 'Redo',
                              accelerator: 'CmdOrCtrl+Y',
                              registerAccelerator: false,
                              click: () => {
                                  mainWindow.webContents.send('history-redo');
                              },
                              enabled,
                          },
                          { type: 'separator' },
                          {
                              label: 'Cut',
                              accelerator: 'CmdOrCtrl+X',
                              registerAccelerator: false,
                              click: () => {
                                  mainWindow.webContents.send('cut');
                              },
                              enabled,
                          },
                          {
                              label: 'Copy',
                              accelerator: 'CmdOrCtrl+C',
                              registerAccelerator: false,
                              click: () => {
                                  mainWindow.webContents.send('copy');
                              },
                              enabled,
                          },
                          {
                              label: 'Paste',
                              accelerator: 'CmdOrCtrl+V',
                              registerAccelerator: false,
                              click: () => {
                                  mainWindow.webContents.send('paste');
                              },
                              enabled,
                          },
                          { type: 'separator' },
                          {
                              label: 'Duplicate',
                              accelerator: 'CmdOrCtrl+D',
                              registerAccelerator: false,
                              click: () => {
                                  mainWindow.webContents.send('duplicate');
                              },
                              enabled,
                          },
                          {
                              label: 'Duplicate with Connections',
                              accelerator: 'CmdOrCtrl+Shift+D',
                              registerAccelerator: false,
                              click: () => {
                                  mainWindow.webContents.send('duplicate-with-input-edges');
                              },
                              enabled,
                          },
                          { type: 'separator' },
                          {
                              label: 'Format Chain',
                              accelerator: 'CmdOrCtrl+Shift+F',
                              registerAccelerator: false,
                              click: () => {
                                  mainWindow.webContents.send('format-chain');
                              },
                              enabled,
                          },
                      ],
                  },
                  {
                      label: 'View',
                      submenu: [
                          { role: 'reload', enabled },
                          { role: 'forceReload', enabled },
                          { type: 'separator' },
                          { role: 'resetZoom', enabled },
                          { role: 'zoomIn', enabled },
                          { role: 'zoomOut', enabled },
                          { type: 'separator' },
                          { role: 'togglefullscreen' },
                          ...(!app.isPackaged
                              ? [{ type: 'separator' }, { role: 'toggleDevTools' }]
                              : []),
                      ],
                  },
              ]),
        {
            role: 'help',
            submenu: [
                {
                    label: "Open chaiNNer's Homepage",
                    click: async () => {
                        await shell.openExternal('https://chainner.app');
                    },
                },
                {
                    label: "Open chaiNNer's GitHub page",
                    click: async () => {
                        await shell.openExternal(
                            'https://github.com/chaiNNer-org/chaiNNer/blob/main/README.md'
                        );
                    },
                },
                {
                    label: "Join chaiNNer's Discord server",
                    click: async () => {
                        await shell.openExternal('https://discord.com/invite/pzvAKPKyHM');
                    },
                },
                { type: 'separator' },
                ...(!isMac ? [{ label: 'About chaiNNer', click: showAboutDialog }] : []),
                {
                    label: 'Release Notes',
                    click: async () => {
                        await shell.openExternal(
                            `https://github.com/chaiNNer-org/chaiNNer/releases/tag/v${app.getVersion()}`
                        );
                    },
                },

                { type: 'separator' },
                {
                    label: 'Collect system information',
                    click: async () => {
                        const [cpuInfo, gpuInfo] = await Promise.all([getCpuInfo(), getGpuInfo()]);

                        const information: Record<string, unknown> = {
                            app: {
                                version: app.getVersion(),
                                packaged: app.isPackaged,
                                path: app.getAppPath(),
                            },
                            process: {
                                cwd: process.cwd(),
                                argv: process.argv,
                            },
                            os: {
                                version: os.version(),
                                release: os.release(),
                                arch: os.arch(),
                                endianness: os.endianness(),
                            },
                            cpu: { ...cpuInfo },
                            gpus: gpuInfo.controllers.map((c) => ({ ...c })),
                        };

                        mainWindow.webContents.send('show-collected-information', information);
                    },
                    enabled,
                },
                {
                    label: 'Open logs folder',
                    click: async () => {
                        await shell.openPath(getLogsFolder());
                    },
                },
                { type: 'separator' },
                {
                    label: 'Report a Bug or Feature Request',
                    click: async () => {
                        await shell.openExternal(
                            'https://github.com/chaiNNer-org/chaiNNer/issues/new/choose'
                        );
                    },
                },
            ],
        },
    ] as MenuItemConstructorOptions[];

    const dockMenuTemplate: MenuItemConstructorOptions[] = isMac
        ? [
              {
                  label: 'New Chain',
                  click: () => {
                      if (!mainWindow.isFocused()) mainWindow.show();
                      mainWindow.webContents.send('file-new');
                  },
                  enabled,
              },
              {
                  label: 'Open Recent',
                  submenu: openRecentSubmenu,
                  enabled,
              },
          ]
        : [];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    if (isMac) {
        const dockMenu = Menu.buildFromTemplate(dockMenuTemplate);
        app.dock.setMenu(dockMenu);
    }
};
