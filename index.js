const { app, BrowserWindow } = require('electron')
require('electron-reload')(__dirname);

function createWindow () {
    const win = new BrowserWindow({
        width: 450,
        height: 730,
        webPreferences: {
            nodeIntegration: true
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

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
