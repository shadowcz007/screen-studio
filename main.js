// main.js
const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron')
const path = require('path')
const fs = require('fs')

let mainWindow
let isRecording = false
let recordingData = {
    mousePositions: [], // 存储鼠标位置
    keyboardInputs: [], // 存储键盘输入
    startTime: null
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    })

    mainWindow.loadFile('index.html')
    mainWindow.webContents.openDevTools()
}

app.whenReady().then(createWindow)

// 处理开始录制请求
ipcMain.on('start-recording', async() => {
    try {
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 1920, height: 1080 }
        })

        mainWindow.webContents.send('SET_SOURCE', sources[0].id)
        isRecording = true
        recordingData.startTime = Date.now()
    } catch (e) {
        console.error(e)
    }
})

// 处理停止录制请求
ipcMain.on('stop-recording', () => {
    isRecording = false
    saveRecordingData()
})

// 记录鼠标位置
ipcMain.on('mouse-move', (event, position) => {
    if (!isRecording) return

    recordingData.mousePositions.push({
        timestamp: Date.now() - recordingData.startTime,
        x: position.x,
        y: position.y
    })
})

// 记录键盘输入
ipcMain.on('keyboard-input', (event, key) => {
    if (!isRecording) return

    recordingData.keyboardInputs.push({
        timestamp: Date.now() - recordingData.startTime,
        key: key
    })
})

// 保存记录数据
function saveRecordingData() {
    const data = JSON.stringify(recordingData)
    fs.writeFileSync('recording_data.json', data)
        // 重置数据
    recordingData = {
        mousePositions: [],
        keyboardInputs: [],
        startTime: null
    }
}