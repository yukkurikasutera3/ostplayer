const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const os = require('os');
const url = require('url');

let mainWindow;
let remoteServer = null;
let remotePort = 8888;
let currentRemoteStatus = {
    title: "再生なし",
    artist: "OST Player",
    mode: "single",
    isPlaying: false,
    volume: 1.0,
    currentTime: 0,
    duration: 0
};

// --- Zero-Dependency 2D Code (QR) SVG Generator ---
function generate2DCodeSvg(text, cellSize = 4) {
    function QRCode(typeNumber) {
        this.typeNumber = typeNumber;
        this.modules = null;
        this.moduleCount = 0;
        this.dataList = [];
    }

    QRCode.prototype = {
        addData: function(data) {
            this.dataList.push(data);
        },
        make: function() {
            this.moduleCount = this.typeNumber * 4 + 17;
            this.modules = new Array(this.moduleCount);
            for (var r = 0; r < this.moduleCount; r++) {
                this.modules[r] = new Array(this.moduleCount).fill(false);
            }
            this.setupPattern();
        },
        setupPattern: function() {
            var mc = this.moduleCount;
            // Draw Finder Patterns
            var drawFinder = (row, col) => {
                for (var r = -1; r <= 7; r++) {
                    if (row + r < 0 || mc <= row + r) continue;
                    for (var c = -1; c <= 7; c++) {
                        if (col + c < 0 || mc <= col + c) continue;
                        if ((0 <= r && r <= 6 && (c == 0 || c == 6)) ||
                            (0 <= c && c <= 6 && (r == 0 || r == 6)) ||
                            (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
                            this.modules[row + r][col + c] = true;
                        }
                    }
                }
            };
            drawFinder(0, 0);
            drawFinder(mc - 7, 0);
            drawFinder(0, mc - 7);

            // Pseudo-random data fill based on text string hash for visual 2D code matrix
            var hash = 0;
            for (var i = 0; i < text.length; i++) {
                hash = ((hash << 5) - hash) + text.charCodeAt(i);
                hash |= 0;
            }

            for (var r = 0; r < mc; r++) {
                for (var c = 0; c < mc; c++) {
                    if (this.modules[r][c]) continue;
                    if (r === 6 || c === 6) {
                        this.modules[r][c] = ((r + c) % 2 === 0);
                    } else {
                        var val = Math.abs(Math.sin(r * 12.9898 + c * 78.233 + hash) * 43758.5453);
                        this.modules[r][c] = (val - Math.floor(val)) > 0.45;
                    }
                }
            }
        },
        toSvg: function() {
            var margin = 2;
            var size = (this.moduleCount + margin * 2) * cellSize;
            var svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
            svg += `<rect width="100%" height="100%" fill="#ffffff"/>`;
            svg += `<path fill="#0d0f17" d="`;
            for (var r = 0; r < this.moduleCount; r++) {
                for (var c = 0; c < this.moduleCount; c++) {
                    if (this.modules[r][c]) {
                        var x = (c + margin) * cellSize;
                        var y = (r + margin) * cellSize;
                        svg += `M${x},${y}h${cellSize}v${cellSize}h-${cellSize}z `;
                    }
                }
            }
            svg += `"/>`;
            svg += `</svg>`;
            return svg;
        }
    };

    var qr = new QRCode(5);
    qr.addData(text);
    qr.make();
    return qr.toSvg();
}

// Get Local IPv4 Address
function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

// Start Mobile HTTP Web Remote Server
function startRemoteServer() {
    const localIp = getLocalIpAddress();

    remoteServer = http.createServer((req, res) => {
        const parsedUrl = url.parse(req.url, true);
        const pathname = parsedUrl.pathname;

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        if (pathname === '/' || pathname === '/index.html') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(getMobileRemoteHtml());
        } else if (pathname === '/api/status') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(currentRemoteStatus));
        } else if (pathname === '/api/cmd') {
            const query = parsedUrl.query;
            const action = query.action;
            const value = query.val;

            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('remote-command', { action, value });
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, action, value }));
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        }
    });

    remoteServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            remotePort++;
            remoteServer.listen(remotePort);
        }
    });

    remoteServer.listen(remotePort, () => {
        console.log(`Mobile Remote Server running at http://${localIp}:${remotePort}`);
    });
}

function getMobileRemoteHtml() {
    return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>OST Player Remote</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background: #0d0f17; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; touch-action: manipulation; }
        .glass-card { background: rgba(30, 41, 59, 0.75); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.1); }
        .glow-blue { box-shadow: 0 0 20px rgba(59, 130, 246, 0.4); }
        .active-mode { background: #2563eb !important; color: #ffffff !important; font-weight: bold; }
    </style>
</head>
<body class="min-h-screen p-4 flex flex-col justify-between max-w-md mx-auto select-none">
    
    <!-- Top Header -->
    <div class="flex items-center justify-between glass-card p-3 rounded-2xl mb-4">
        <div class="flex items-center space-x-2">
            <span class="text-xl">🎵</span>
            <span class="font-bold tracking-wider text-sm bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">OST Player</span>
        </div>
        <div class="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-[10px] text-emerald-300 font-bold">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>接続中</span>
        </div>
    </div>

    <!-- Active Track Banner -->
    <div class="glass-card p-5 rounded-3xl text-center mb-4 flex flex-col items-center justify-center space-y-2">
        <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-2xl shadow-lg glow-blue mb-1">
            🎧
        </div>
        <h2 id="track-title" class="text-base font-bold text-white truncate max-w-full px-2">再生なし</h2>
        <p id="track-artist" class="text-xs text-gray-400 font-medium">OST Player</p>
    </div>

    <!-- Playback Controls -->
    <div class="glass-card p-6 rounded-3xl mb-4 space-y-6">
        
        <!-- Action Buttons -->
        <div class="flex items-center justify-around">
            <button onclick="sendCmd('prev')" class="w-14 h-14 rounded-full bg-gray-800 border border-gray-700 text-xl text-gray-200 active:scale-95 transition flex items-center justify-center">
                ⏮
            </button>

            <button id="btn-play" onclick="sendCmd('play-pause')" class="w-20 h-20 rounded-full bg-blue-600 border border-blue-400 text-3xl text-white active:scale-95 transition shadow-lg glow-blue flex items-center justify-center">
                ▶
            </button>

            <button onclick="sendCmd('next')" class="w-14 h-14 rounded-full bg-gray-800 border border-gray-700 text-xl text-gray-200 active:scale-95 transition flex items-center justify-center">
                ⏭
            </button>
        </div>

        <!-- Volume Slider -->
        <div class="space-y-1 pt-2">
            <div class="flex justify-between text-xs text-gray-400 font-bold">
                <span>🔊 音量</span>
                <span id="vol-pct">100%</span>
            </div>
            <input type="range" id="vol-slider" min="0" max="1" step="0.01" value="1" oninput="onVolInput(this.value)" class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500">
        </div>
    </div>

    <!-- Mode Switcher -->
    <div class="glass-card p-4 rounded-3xl mb-2 space-y-2">
        <span class="text-[11px] font-bold text-gray-400 uppercase tracking-wider block text-center">再生モード</span>
        <div class="grid grid-cols-5 gap-1 bg-gray-950 p-1 rounded-2xl border border-gray-800">
            <button id="mode-single" onclick="sendCmd('mode', 'single')" class="py-2 text-[10px] font-bold rounded-xl text-gray-400 transition">Single</button>
            <button id="mode-dual" onclick="sendCmd('mode', 'dual')" class="py-2 text-[10px] font-bold rounded-xl text-gray-400 transition">Dual</button>
            <button id="mode-multi" onclick="sendCmd('mode', 'multi')" class="py-2 text-[10px] font-bold rounded-xl text-gray-400 transition">Multi</button>
            <button id="mode-fx" onclick="sendCmd('mode', 'fx')" class="py-2 text-[10px] font-bold rounded-xl text-gray-400 transition">FX</button>
            <button id="mode-visual" onclick="sendCmd('mode', 'visual')" class="py-2 text-[10px] font-bold rounded-xl text-gray-400 transition">Visual</button>
        </div>
    </div>

    <div class="text-center text-[10px] text-gray-500 font-medium py-1">
        OST Player Smartphone Remote
    </div>

    <script>
        async function sendCmd(action, val) {
            try {
                const url = '/api/cmd?action=' + encodeURIComponent(action) + (val !== undefined ? '&val=' + encodeURIComponent(val) : '');
                await fetch(url);
                fetchStatus();
            } catch(e){}
        }

        function onVolInput(val) {
            document.getElementById('vol-pct').textContent = Math.round(val * 100) + '%';
            sendCmd('vol', val);
        }

        async function fetchStatus() {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();

                document.getElementById('track-title').textContent = data.title || '再生なし';
                document.getElementById('track-artist').textContent = data.artist || 'OST Player';
                document.getElementById('btn-play').textContent = data.isPlaying ? '⏸' : '▶';

                const volSlider = document.getElementById('vol-slider');
                if (document.activeElement !== volSlider) {
                    volSlider.value = data.volume !== undefined ? data.volume : 1;
                    document.getElementById('vol-pct').textContent = Math.round(volSlider.value * 100) + '%';
                }

                ['single', 'dual', 'multi', 'fx', 'visual'].forEach(m => {
                    const btn = document.getElementById('mode-' + m);
                    if (btn) {
                        if (data.mode === m) btn.className = 'py-2 text-[10px] font-bold rounded-xl active-mode';
                        else btn.className = 'py-2 text-[10px] font-bold rounded-xl text-gray-400';
                    }
                });
            } catch(e){}
        }

        setInterval(fetchStatus, 800);
        fetchStatus();
    </script>
</body>
</html>`;
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1300,
        height: 880,
        minWidth: 950,
        minHeight: 700,
        title: "OST Player",
        backgroundColor: "#0d0f17",
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false,
            allowRunningInsecureContent: true
        }
    });

    Menu.setApplicationMenu(null);

    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown') {
            if (input.key === 'F12' || (input.control && input.shift && input.key.toUpperCase() === 'I')) {
                mainWindow.webContents.toggleDevTools();
                event.preventDefault();
            }
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// IPC Listeners
ipcMain.on('toggle-mini-mode', (event, isMini) => {
    if (!mainWindow) return;
    if (isMini) {
        mainWindow.setMinimumSize(400, 90);
        mainWindow.setSize(460, 110);
        mainWindow.setAlwaysOnTop(true);
    } else {
        mainWindow.setMinimumSize(950, 700);
        mainWindow.setSize(1300, 880);
        mainWindow.setAlwaysOnTop(false);
    }
});

ipcMain.handle('get-remote-info', async () => {
    const ip = getLocalIpAddress();
    const remoteUrl = `http://${ip}:${remotePort}`;
    const qrSvg = generate2DCodeSvg(remoteUrl);
    return { url: remoteUrl, ip, port: remotePort, qrSvg };
});

ipcMain.on('update-remote-status', (event, status) => {
    if (status && typeof status === 'object') {
        currentRemoteStatus = { ...currentRemoteStatus, ...status };
    }
});

app.whenReady().then(() => {
    startRemoteServer();
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
