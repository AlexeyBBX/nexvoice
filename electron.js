const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

let mainWindow = null;

// Настройка автообновления
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// Проверка обновлений при запуске
autoUpdater.checkForUpdatesAndNotify();

// События автообновления
autoUpdater.on('checking-for-update', () => {
    console.log('Проверка обновлений...');
});

autoUpdater.on('update-available', (info) => {
    console.log('Доступно обновление:', info);
    dialog.showMessageBox({
        type: 'info',
        title: 'Доступно обновление',
        message: 'Доступна новая версия NexVoice!',
        detail: `Версия ${info.version} доступна для скачивания. Обновление будет загружено в фоновом режиме.`,
        buttons: ['OK']
    });
});

autoUpdater.on('update-not-available', () => {
    console.log('Установлена последняя версия');
});

autoUpdater.on('error', (err) => {
    console.error('Ошибка обновления:', err);
});

autoUpdater.on('download-progress', (progressObj) => {
    let logMessage = `Скачивание: ${progressObj.percent.toFixed(2)}%`;
    console.log(logMessage);
    if (mainWindow) {
        mainWindow.webContents.send('download-progress', progressObj);
    }
});

autoUpdater.on('update-downloaded', (info) => {
    console.log('Обновление загружено:', info);
    dialog.showMessageBox({
        type: 'info',
        title: 'Обновление готово',
        message: 'Обновление загружено. Перезапустить приложение для установки?',
        detail: `Версия ${info.version} будет установлена после перезапуска.`,
        buttons: ['Перезапустить', 'Позже']
    }).then((result) => {
        if (result.response === 0) {
            setImmediate(() => {
                autoUpdater.quitAndInstall();
            });
        }
    });
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 600,
        icon: path.join(__dirname, 'public/favicon.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false
        },
        titleBarStyle: 'default',
        backgroundColor: '#0a0c10',
        show: false
    });

    const template = [
        {
            label: 'Файл',
            submenu: [
                {
                    label: 'Проверить обновления',
                    click: () => {
                        autoUpdater.checkForUpdatesAndNotify();
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'Проверка обновлений',
                            message: 'Поиск обновлений...',
                            buttons: ['OK']
                        });
                    }
                },
                { type: 'separator' },
                {
                    label: 'Выход',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => app.quit()
                }
            ]
        },
        {
            label: 'Вид',
            submenu: [
                { role: 'reload', label: 'Перезагрузить' },
                { role: 'forcereload', label: 'Жесткая перезагрузка' },
                { type: 'separator' },
                { role: 'resetzoom', label: 'Сбросить масштаб' },
                { role: 'zoomin', label: 'Увеличить' },
                { role: 'zoomout', label: 'Уменьшить' },
                { type: 'separator' },
                { role: 'fullscreen', label: 'Полный экран' }
            ]
        },
        {
            label: 'Помощь',
            submenu: [
                {
                    label: 'Сайт',
                    click: () => shell.openExternal('https://nexvoice.ru')
                },
                {
                    label: 'О программе',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'О программе',
                            message: 'NexVoice',
                            detail: `Версия: ${app.getVersion()}\nСовременный мессенджер с голосовыми звонками\n\nДля работы требуется подключение к интернету.`,
                            buttons: ['OK']
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    // Загружаем сайт
    mainWindow.loadURL('https://nexvoice.ru');
    
    mainWindow.on('did-fail-load', () => {
        mainWindow.loadFile('splash.html');
    });
    
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.show();
    });
    
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}
