const { app, BrowserWindow, ipcMain } = require('electron')
require('electron-reload')(__dirname);
const path = require('path');
const proto = require("./proto.js")

function createWindow () {
    const win = new BrowserWindow({
        width: 450,
        height: 730,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    })
    win.removeMenu()
    win.setResizable(false)
    win.loadFile('src/index.html')
}

app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

ipcMain.handle('start', async (event, params) => {
    console.log(JSON.stringify(params, null, 2))
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
