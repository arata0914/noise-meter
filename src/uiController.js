export class UIController {
    constructor() {
        this.analogCanvas = document.getElementById('analog-gauge');
        this.waveformCanvas = document.getElementById('waveform-canvas');
        this.historyCanvas = document.getElementById('history-canvas');

        this.analogCtx = this.analogCanvas.getContext('2d');
        this.waveformCtx = this.waveformCanvas.getContext('2d');
        this.historyCtx = this.historyCanvas.getContext('2d');

        this.dbValueEl = document.getElementById('db-value');
        this.minValEl = document.getElementById('min-val');
        this.avgValEl = document.getElementById('avg-val');
        this.maxValEl = document.getElementById('max-val');
        this.statusIndicator = document.getElementById('status-indicator');
        this.referenceItems = document.querySelectorAll('.reference-list li');
        this.recordText = document.getElementById('record-text');

        this.historyData = new Array(600).fill(0);

        this.minDb = Infinity;
        this.maxDb = -Infinity;
        this.sumDb = 0;
        this.countDb = 0;
        this.intervalSum = 0;
        this.intervalCount = 0;

        this.accentColor = '#00ff9d';
        this.dangerColor = '#ff4b4b';
        this.textColor = '#ffffff';

        this.updateInterval = 100; // ms
        this.lastUpdate = 0;

        this.currentLang = 'ja'; // Default to Japanese
        this.translations = {
            en: {
                status_ready: "Ready",
                status_listening: "Listening",
                status_recording: "Recording...",
                status_paused: "Paused",
                status_saving: "Saving...",
                label_min: "INT AVG",
                label_avg: "AVG",
                label_max: "MAX",
                btn_start: "Start",
                btn_stop: "Stop",
                btn_record: "Record",
                btn_stop_rec: "Stop Rec",
                label_interval: "Update Interval:",
                graph_realtime: "Real-time Waveform",
                graph_history: "History (Last 60s)",
                ref_title: "Noise Levels Reference",
                ref_120: "Jet Engine",
                ref_100: "Construction Site",
                ref_80: "Subway / Loud Traffic",
                ref_60: "Conversation",
                ref_40: "Library",
                ref_20: "Whisper"
            },
            ja: {
                status_ready: "準備完了",
                status_listening: "測定中",
                status_recording: "録音中...",
                status_paused: "一時停止",
                status_saving: "保存中...",
                label_min: "区間平均",
                label_avg: "平均",
                label_max: "最大",
                btn_start: "開始",
                btn_stop: "停止",
                btn_record: "録音",
                btn_stop_rec: "録音停止",
                label_interval: "更新間隔:",
                graph_realtime: "リアルタイム波形",
                graph_history: "履歴 (過去60秒)",
                ref_title: "騒音レベル目安",
                ref_120: "ジェット機",
                ref_100: "工事現場",
                ref_80: "地下鉄 / 交通量の多い道路",
                ref_60: "日常会話",
                ref_40: "図書館",
                ref_20: "ささやき声"
            }
        };

        // Apply initial language
        this.setLanguage(this.currentLang);

        // Initial Theme Setup
        this.isLightMode = false;
        this.updateThemeColors();

        // Handle Resize
        window.addEventListener('resize', () => this.handleResize());
        // Initial sizing check
        this.handleResize();
    }

    toggleTheme() {
        this.isLightMode = !this.isLightMode;
        document.body.classList.toggle('light-mode', this.isLightMode);

        // Update button icon
        const btn = document.getElementById('theme-toggle');
        if (btn) btn.textContent = this.isLightMode ? '🌙' : '☀';

        this.updateThemeColors();

        // Redraw everything
        this.drawAnalogGauge(this.lastDb || 0);
        if (this.historyData.length > 0) this.drawHistoryGraph();
        // Waveform is redrawn every frame anyway
    }

    updateThemeColors() {
        const style = getComputedStyle(document.body);
        this.accentColor = style.getPropertyValue('--accent-color').trim();
        this.dangerColor = style.getPropertyValue('--danger-color').trim();
        this.textColor = style.getPropertyValue('--text-primary').trim();
        this.gaugeBg = style.getPropertyValue('--gauge-bg').trim();
        this.gaugeNeedle = style.getPropertyValue('--gauge-needle').trim();
    }

    handleResize() {
        // Resize Analog Gauge Canvas if needed
        // We want internal resolution to match display size for sharpness, 
        // or keep high res and scale down via CSS.
        // Current CSS sets width/height. Let's ensure internal matches or is high DPI.

        const dpr = window.devicePixelRatio || 1;

        // Helper to resize canvas
        const resizeCanvas = (canvas, w, h) => {
            const rect = canvas.getBoundingClientRect();
            // If CSS sizes are set, we might want to use them, but for now let's stick to fixed internal size 
            // or adapt.
            // Actually, for the analog gauge, we have fixed drawing logic based on 300x300 (or similar).
            // If we change canvas size, we need to scale drawing commands.
            // Easiest is to keep internal resolution high (e.g. 300x300 or 600x600) and let CSS scale it.
            // But we need to make sure CSS aspect ratio matches.

            // For waveform/history, we want them to fill width.
            if (canvas.id !== 'analog-gauge') {
                canvas.width = rect.width * dpr;
                canvas.height = rect.height * dpr;
                const ctx = canvas.getContext('2d');
                ctx.scale(dpr, dpr);
            }
        };

        resizeCanvas(this.waveformCanvas);
        resizeCanvas(this.historyCanvas);

        // Redraw graphs if data exists (optional, might be cleared)
        // We don't persist waveform data, but history data exists.
        if (this.historyData.length > 0) {
            this.drawHistoryGraph();
        }

        // Analog gauge:
        // We keep internal size fixed (300x300) to simplify drawing logic, 
        // and let CSS handle the visual size (responsive).
        // So no resize logic needed for analog-gauge canvas itself, 
        // just ensure CSS is correct (handled in style.css).
    }

    setLanguage(lang) {
        if (!this.translations[lang]) return;
        this.currentLang = lang;
        const t = this.translations[lang];

        // Update all elements with data-i18n
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            if (t[key]) {
                el.textContent = t[key];
            }
        });
    }

    setUpdateInterval(seconds) {
        this.updateInterval = seconds * 1000;
    }

    updateDisplay(db, timestamp) {
        this.lastDb = db; // Store for redraws

        // Accumulate for Interval Average
        this.intervalSum += db;
        this.intervalCount++;

        // Update Digital (Throttled)
        if (timestamp - this.lastUpdate >= this.updateInterval) {
            this.dbValueEl.textContent = db.toFixed(1);
            this.lastUpdate = timestamp;

            // Calculate Interval Average
            const intervalAvg = this.intervalCount > 0 ? (this.intervalSum / this.intervalCount) : db;
            this.minValEl.textContent = intervalAvg.toFixed(1);

            // Reset Interval Accumulators
            this.intervalSum = 0;
            this.intervalCount = 0;

            // Update Global Stats
            // Note: minDb is no longer displayed, but we can still track it if needed, 
            // or we could repurpose minDb to track the minimum interval average?
            // For now, let's keep maxDb as global max.
            if (db > this.maxDb) this.maxDb = db;

            // Global Average
            this.sumDb += db;
            this.countDb++;

            this.maxValEl.textContent = this.maxDb.toFixed(1);
            this.avgValEl.textContent = (this.sumDb / this.countDb).toFixed(1);
        }

        this.updateReferenceTable(db);
        this.drawAnalogGauge(db);
    }

    updateReferenceTable(db) {
        this.referenceItems.forEach(item => {
            const level = parseInt(item.dataset.level);
            if (db >= level - 10 && db < level + 10) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    drawAnalogGauge(db) {
        const ctx = this.analogCtx;
        const w = this.analogCanvas.width;
        const h = this.analogCanvas.height;
        const cx = w / 2;
        const cy = h / 2 + 35; // Moved up from +60 to +35 to fit text
        const radius = 130;

        // Professional Scale Params
        const minDb = 30;
        const maxDb = 130;
        const totalAngle = Math.PI * 0.8;
        const startAngle = Math.PI + (Math.PI - totalAngle) / 2;
        const endAngle = startAngle + totalAngle;

        ctx.clearRect(0, 0, w, h);

        // Draw Scale Background
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.lineWidth = 2;
        ctx.strokeStyle = this.gaugeBg; // Use theme color
        ctx.stroke();

        // Draw Ticks
        const majorStep = 10;
        const minorStep = 2;

        for (let v = minDb; v <= maxDb; v += minorStep) {
            const normalized = (v - minDb) / (maxDb - minDb);
            const angle = startAngle + normalized * totalAngle;

            const isMajor = v % majorStep === 0;
            const tickLen = isMajor ? 15 : 8;
            const tickWidth = isMajor ? 2 : 1;

            const x1 = cx + Math.cos(angle) * (radius - tickLen);
            const y1 = cy + Math.sin(angle) * (radius - tickLen);
            const x2 = cx + Math.cos(angle) * radius;
            const y2 = cy + Math.sin(angle) * radius;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineWidth = tickWidth;

            // Color Zones
            let color = this.textColor; // Use theme text color for ticks
            if (v >= 80 && v < 100) color = '#e6b800'; // Darker yellow for visibility
            if (v >= 100) color = this.dangerColor;

            ctx.strokeStyle = color;
            ctx.stroke();

            // Draw Labels
            if (isMajor) {
                const lx = cx + Math.cos(angle) * (radius - 25);
                const ly = cy + Math.sin(angle) * (radius - 25);

                ctx.fillStyle = color;
                ctx.font = '12px "JetBrains Mono"';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(v.toString(), lx, ly);
            }
        }

        // Draw Needle
        const clampedDb = Math.max(minDb, Math.min(maxDb, db));
        const needleNorm = (clampedDb - minDb) / (maxDb - minDb);
        const needleAngle = startAngle + needleNorm * totalAngle;

        const needleLen = radius - 5;
        const nx = cx + Math.cos(needleAngle) * needleLen;
        const ny = cy + Math.sin(needleAngle) * needleLen;

        // Needle Shadow/Glow
        ctx.shadowBlur = 5;
        ctx.shadowColor = this.isLightMode ? 'rgba(0,0,0,0.2)' : 'rgba(255, 0, 0, 0.5)';

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(nx, ny);
        ctx.lineWidth = 2;
        ctx.strokeStyle = this.gaugeNeedle;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Pivot
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
        ctx.fillStyle = '#333';
        ctx.fill();
        ctx.strokeStyle = '#555';
        ctx.stroke();

        // Label on Face
        if (!this.isLightMode) {
            ctx.fillStyle = '#666';
            ctx.font = '14px "Inter"';
            ctx.textAlign = 'center';
            ctx.fillText("SOUND LEVEL METER", cx, cy - 40);
        }

        ctx.fillStyle = this.isLightMode ? '#888' : '#666';
        ctx.font = '10px "Inter"';
        ctx.fillText("dB (A)", cx, cy - 25);
    }

    drawWaveform(dataArray) {
        const ctx = this.waveformCtx;
        const dpr = window.devicePixelRatio || 1;
        const w = this.waveformCanvas.width / dpr;
        const h = this.waveformCanvas.height / dpr;

        ctx.clearRect(0, 0, w, h);
        ctx.lineWidth = 2;
        ctx.strokeStyle = this.accentColor;
        ctx.beginPath();

        const sliceWidth = w / dataArray.length;
        let x = 0;

        for (let i = 0; i < dataArray.length; i++) {
            const v = dataArray[i] / 128.0; // 0 to 2
            const y = (v * h) / 2; // Scale to canvas height

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);

            x += sliceWidth;
        }

        ctx.lineTo(w, h / 2);
        ctx.stroke();
    }

    updateHistoryGraph(db) {
        // Add new point
        this.historyData.push(db);
        if (this.historyData.length > 600) { // Keep last 600 points
            this.historyData.shift();
        }

        this.drawHistoryGraph();
    }

    drawHistoryGraph() {
        const ctx = this.historyCtx;
        const dpr = window.devicePixelRatio || 1;
        const w = this.historyCanvas.width / dpr;
        const h = this.historyCanvas.height / dpr;

        ctx.clearRect(0, 0, w, h);

        // Draw Grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        // Horizontal lines
        for (let i = 0; i <= 140; i += 20) {
            const y = h - (i / 140) * h;
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
        }
        ctx.stroke();

        // Draw Line
        ctx.strokeStyle = '#00ccff';
        ctx.lineWidth = 2;
        ctx.beginPath();

        const step = w / 600;

        for (let i = 0; i < this.historyData.length; i++) {
            const db = this.historyData[i];
            const x = i * step;
            const y = h - (db / 140) * h;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }

        ctx.stroke();
    }

    setStatus(statusKey) {
        // statusKey should be a key in translations (e.g., 'status_listening')
        // Or we can pass raw string if not in dict?
        // Let's assume we pass keys now for better i18n

        const t = this.translations[this.currentLang];
        const text = t[statusKey] || statusKey;

        this.statusIndicator.textContent = text;

        // Reset classes
        this.statusIndicator.className = 'status-indicator';

        if (statusKey === 'status_recording') {
            this.statusIndicator.classList.add('recording');
        } else if (statusKey === 'status_listening') {
            this.statusIndicator.classList.add('active');
        }

        // Update button text specifically for record button if needed
        // (Handled by data-i18n mostly, but dynamic state changes need care)
        if (statusKey === 'status_recording') {
            this.recordText.textContent = t['btn_stop_rec'];
            // Update data-i18n to keep it in sync for lang switch
            this.recordText.dataset.i18n = 'btn_stop_rec';
        } else {
            this.recordText.textContent = t['btn_record'];
            this.recordText.dataset.i18n = 'btn_record';
        }
    }
}
