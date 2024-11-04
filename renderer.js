// renderer.js
const { ipcRenderer } = require('electron')

let mediaRecorder
let recordedChunks = []
const startBtn = document.getElementById('startBtn')
const stopBtn = document.getElementById('stopBtn')
const preview = document.getElementById('preview')

// 开始录制
startBtn.onclick = () => {
    ipcRenderer.send('start-recording')
}

// 停止录制
stopBtn.onclick = () => {
    mediaRecorder.stop()
    ipcRenderer.send('stop-recording')
}

// 设置视频源
ipcRenderer.on('SET_SOURCE', async(event, sourceId) => {
    try {
        // renderer.js 中修改 getUserMedia 的配置
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: sourceId,
                    minWidth: 1920,
                    maxWidth: 1920,
                    minHeight: 1080,
                    maxHeight: 1080,
                    frameRate: { ideal: 60, max: 60 } // 提高帧率
                }
            }
        })

        handleStream(stream)
        startRecording(stream)
    } catch (e) {
        console.error(e)
    }
})

// 处理视频流
function handleStream(stream) {
    preview.srcObject = stream
    preview.play()
}

// 开始录制
async function startRecording(sourceId) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: getVideoConstraints(sourceId)
        })

        handleStream(stream)

        const recorderOptions = getRecorderOptions()
        mediaRecorder = new MediaRecorder(stream, recorderOptions)
        mediaRecorder.ondataavailable = handleDataAvailable
        mediaRecorder.onstop = handleStop
        mediaRecorder.start(100)

        startInputTracking()
    } catch (e) {
        console.error('Error starting recording:', e)
    }
}

// 处理录制数据
function handleDataAvailable(e) {
    recordedChunks.push(e.data)
}


async function compressVideo(blob) {
    const ffmpeg = require('ffmpeg.js')

    // 将blob转换为ArrayBuffer
    const arrayBuffer = await blob.arrayBuffer()

    // 使用ffmpeg压缩视频
    const result = ffmpeg({
        MEMFS: [{ name: "input.webm", data: new Uint8Array(arrayBuffer) }],
        arguments: [
            "-i", "input.webm",
            "-c:v", "libvpx-vp9",
            "-crf", "30", // 控制质量，值越小质量越高
            "-b:v", "0", // 使用CRF模式
            "-deadline", "good", // 编码速度与质量的平衡
            "output.webm"
        ]
    })

    // 获取压缩后的视频数据
    const output = result.MEMFS[0]
    return new Blob([output.data], { type: 'video/webm' })
}

// 修改handleStop函数
async function handleStop() {
    const blob = new Blob(recordedChunks, {
        type: 'video/webm;codecs=vp9'
    })

    // 压缩视频
    const compressedBlob = await compressVideo(blob)

    const url = URL.createObjectURL(compressedBlob)
    const a = document.createElement('a')
    document.body.appendChild(a)
    a.style = 'display: none'
    a.href = url
    a.download = 'screen-recording.webm'
    a.click()

    recordedChunks = []
}



function getVideoConstraints(sourceId) {
    const resolution = document.getElementById('resolution').value
    const frameRate = parseInt(document.getElementById('frameRate').value)
    const resolutionMap = {
        '4k': { width: 3840, height: 2160 },
        '2k': { width: 2560, height: 1440 },
        '1080p': { width: 1920, height: 1080 },
        '720p': { width: 1280, height: 720 }
    }

    return {
        mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
            minWidth: resolutionMap[resolution].width,
            maxWidth: resolutionMap[resolution].width,
            minHeight: resolutionMap[resolution].height,
            maxHeight: resolutionMap[resolution].height,
            frameRate: { ideal: frameRate, max: frameRate }
        },
        hardware_acceleration: true
    }
}

function getRecorderOptions() {
    const bitrate = parseInt(document.getElementById('bitrate').value)
    return {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: bitrate
    }
}

// 开始追踪输入
function startInputTracking() {
    // 监听鼠标移动
    document.addEventListener('mousemove', (e) => {
        ipcRenderer.send('mouse-move', {
            x: e.clientX,
            y: e.clientY
        })
    })

    // 监听键盘输入
    document.addEventListener('keydown', (e) => {
        ipcRenderer.send('keyboard-input', e.key)
    })
}

// 添加性能监控
function monitorPerformance() {
    const performanceData = {
        fps: 0,
        cpuUsage: 0,
        memoryUsage: 0
    }

    setInterval(() => {
        // 监控帧率
        performanceData.fps = mediaRecorder.videoBitsPerSecond /
            (videoConstraints.width * videoConstraints.height * 24)

        // 如果性能下降，自动调整质量
        if (performanceData.fps < 20) {
            adjustQualityForPerformance()
        }
    }, 1000)
}

function adjustQualityForPerformance() {
    // 根据性能自动降低质量
    const currentResolution = document.getElementById('resolution').value
    const currentFrameRate = document.getElementById('frameRate').value

    if (currentResolution === '4k') {
        document.getElementById('resolution').value = '2k'
    } else if (currentFrameRate === '60') {
        document.getElementById('frameRate').value = '30'
    }

    // 重新启动录制
    stopRecording()
    startRecording(currentSourceId)
}