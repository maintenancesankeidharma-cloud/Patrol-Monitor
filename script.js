// ============================================================
// KONFIGURASI SUPABASE BARU — ganti dengan credential project Anda
// ============================================================
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const DEFAULT_AREAS = (typeof CONFIG_AREAS !== 'undefined' && CONFIG_AREAS.length)
    ? JSON.parse(JSON.stringify(CONFIG_AREAS))
    : [
        { id: 1, name: 'Jig Inspection A1', staff: 'PIC SHIFT A', shift: 'A' },
        { id: 2, name: 'Jig Inspection A2', staff: 'PIC SHIFT A', shift: 'A' },
        { id: 3, name: 'Jig Inspection B1', staff: 'PIC SHIFT B', shift: 'B' },
        { id: 4, name: 'Jig Inspection B2', staff: 'PIC SHIFT B', shift: 'B' }
    ];

const SHIFTS = [
    { key: 'A', label: 'SHIFT A', accent: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
    { key: 'B', label: 'SHIFT B', accent: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200' }
];

const CHECKPOINTS = ['start', 'middle', 'end'];
const CHECKPOINT_LABELS = { start: 'START', middle: 'MIDDLE', end: 'END' };

const STORAGE_KEY = 'patrol_areas';
const STORAGE_KEY_LEGACY = 'patrol_jigs';
const AUTH_STORAGE_KEY = 'patrol_auth';
const USERS_STORAGE_KEY = 'patrol_users';
const ADMIN_USERNAME = 'admin@patrol-qc.com';

let areas = loadAreasFromStorage();
let dailyStatus = {};
let recentHistory = [];

function loadAreasFromStorage() {
    try {
        let raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) raw = localStorage.getItem(STORAGE_KEY_LEGACY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed.map((a, i) => ({
                    id: i + 1,
                    name: a.name || '-',
                    staff: a.staff || '-',
                    shift: a.shift === 'B' ? 'B' : 'A'
                }));
            }
        }
    } catch (_) {}
    return JSON.parse(JSON.stringify(DEFAULT_AREAS));
}

function saveAreasToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(areas));
}

function getAuthUser() {
    try {
        const raw = localStorage.getItem(AUTH_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.loggedIn) return null;
        return parsed;
    } catch (_) {
        return null;
    }
}

function getOperatorName() {
    const auth = getAuthUser();
    if (!auth) return 'Operator';
    return auth.displayName || auth.username || 'Operator';
}

function getOperatorEmail() {
    const auth = getAuthUser();
    return auth ? (auth.username || null) : null;
}

function isCurrentUserAdmin() {
    const auth = getAuthUser();
    return auth && auth.username === ADMIN_USERNAME;
}

function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s || '';
    return div.innerHTML;
}

function formatTime(isoOrDate) {
    if (!isoOrDate) return null;
    return new Date(isoOrDate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function getTodayRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
    return { start, end };
}

function buildDailyStatusFromLogs(logs) {
    const status = {};
    areas.forEach(j => {
        status[j.id] = { start: null, middle: null, end: null };
    });
    if (!logs) return status;

    logs.forEach(log => {
        const jigId = log.jig_id;
        const cp = log.checkpoint;
        if (!status[jigId]) {
            status[jigId] = { start: null, middle: null, end: null };
        }
        if (CHECKPOINTS.includes(cp) && !status[jigId][cp]) {
            status[jigId][cp] = formatTime(log.created_at);
        }
    });
    return status;
}

function countCompletedAreas(status) {
    return areas.filter(a => {
        const s = status[a.id];
        return s && s.start && s.middle && s.end;
    }).length;
}

function getNextCheckpoint(jigId) {
    const s = dailyStatus[jigId] || { start: null, middle: null, end: null };
    if (!s.start) return 'start';
    if (!s.middle) return 'middle';
    if (!s.end) return 'end';
    return null;
}

async function fetchData() {
    try {
        const { start, end } = getTodayRange();
        const { data: logsToday } = await _supabase
            .from('patrol_logs')
            .select('*')
            .gte('created_at', start)
            .lte('created_at', end)
            .order('created_at', { ascending: true });

        const { data: allLogs } = await _supabase
            .from('patrol_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        dailyStatus = buildDailyStatusFromLogs(logsToday);
        recentHistory = allLogs || [];
        renderUI();
    } catch (e) {
        console.error('Koneksi Error:', e);
    }
}

async function handleBarcodeScan(areaId, source) {
    source = source || 'manual';
    const area = areas.find(a => a.id == areaId);
    if (!area) {
        alert('Barcode tidak dikenali. Periksa pengaturan area.');
        return;
    }

    const nextCp = getNextCheckpoint(area.id);
    if (!nextCp) {
        alert(`${area.name} sudah lengkap hari ini (Start, Middle, End).`);
        return;
    }

    const payload = {
        jig_id: area.id,
        jig_name: area.name,
        checkpoint: nextCp,
        operator_name: getOperatorName(),
        operator_email: getOperatorEmail()
    };

    try {
        const { error } = await _supabase.from('patrol_logs').insert([payload]);
        if (error) {
            alert('Gagal menyimpan scan. Pastikan tabel patrol_logs sudah dibuat di Supabase.\n\n' + (error.message || ''));
            return;
        }

        const label = CHECKPOINT_LABELS[nextCp];
        if (source === 'qr' || source === 'scanner') {
            showScanToast(`${label} tercatat — ${area.name}`);
        } else {
            alert(`✓ ${label} tercatat untuk ${area.name}`);
        }
        await fetchData();
    } catch (err) {
        alert('Error: ' + (err.message || err));
    }
}

function showScanToast(message) {
    let toast = document.getElementById('scanToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'scanToast';
        toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-2xl transition-opacity';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => { toast.style.opacity = '0'; }, 2800);
}

function renderCheckpointRow(label, time, isNext) {
    const done = !!time;
  const rowClass = done
        ? 'bg-emerald-50 border-emerald-200'
        : isNext
            ? 'bg-amber-50 border-amber-200 ring-1 ring-amber-300'
            : 'bg-slate-50 border-slate-100';
    const dotClass = done ? 'text-emerald-500' : isNext ? 'text-amber-500 animate-pulse' : 'text-slate-300';
    const statusText = done
        ? `<span class="text-emerald-700 font-black">${time}</span>`
        : isNext
            ? '<span class="text-amber-600 font-black text-[10px]">Menunggu scan</span>'
            : '<span class="text-slate-400 font-bold text-[10px]">—</span>';

    return `
        <div class="flex items-center justify-between px-3 py-2 rounded-xl border ${rowClass}">
            <div class="flex items-center gap-2">
                <span class="${dotClass} text-sm">●</span>
                <span class="text-[11px] font-black text-slate-700 uppercase tracking-wide">${label}</span>
            </div>
            ${statusText}
        </div>
    `;
}

function renderAreaCard(area) {
    const status = dailyStatus[area.id] || { start: null, middle: null, end: null };
    const nextCp = getNextCheckpoint(area.id);
    const complete = !nextCp;
    const progressCount = CHECKPOINTS.filter(cp => status[cp]).length;

    const card = document.createElement('div');
    card.className = `bg-white p-5 rounded-[2rem] shadow-sm border-2 transition-all duration-300 ${complete ? 'card-complete' : progressCount > 0 ? 'card-partial' : 'card-inactive'}`;

    const adminReset = isCurrentUserAdmin()
        ? `<button type="button" onclick="resetAreaToday(${area.id})" class="mt-3 w-full text-[9px] text-slate-400 hover:text-red-500 font-bold underline">Reset hari ini (admin)</button>`
        : '';

    card.innerHTML = `
        <div class="flex justify-between items-start mb-2">
            <span class="text-[10px] font-black text-slate-300">#${String(area.id).padStart(2, '0')}</span>
            <span class="text-[10px] font-black px-2 py-0.5 rounded-full ${complete ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}">${progressCount}/3</span>
        </div>
        <h3 class="font-black text-slate-800 text-sm leading-tight uppercase">${escapeHtml(area.staff)}</h3>
        <p class="text-[10px] font-bold text-slate-400 mb-4 italic uppercase">${escapeHtml(area.name)}</p>
        <div class="space-y-2">
            ${renderCheckpointRow('START', status.start, nextCp === 'start')}
            ${renderCheckpointRow('MIDDLE', status.middle, nextCp === 'middle')}
            ${renderCheckpointRow('END', status.end, nextCp === 'end')}
        </div>
        ${complete
            ? '<div class="mt-4 text-[10px] text-emerald-700 font-black bg-emerald-100 py-2 rounded-xl text-center uppercase tracking-wider">Checkpoint Lengkap</div>'
            : `<div class="mt-4 text-[10px] text-slate-500 font-black bg-slate-100 py-2 rounded-xl text-center italic">Scan berikutnya: ${nextCp ? CHECKPOINT_LABELS[nextCp] : '—'}</div>`
        }
        ${adminReset}
    `;
    return card;
}

function renderUI() {
    const grid = document.getElementById('jigGrid');
    if (!grid) return;
    grid.innerHTML = '';

    SHIFTS.forEach(shift => {
        const shiftAreas = areas.filter(a => a.shift === shift.key);
        if (!shiftAreas.length) return;

        const shiftTitle = document.createElement('div');
        shiftTitle.className = 'col-span-full font-black text-slate-400 text-xs mt-6 mb-1 tracking-[0.2em] uppercase flex items-center gap-2';
        shiftTitle.innerHTML = `<span class="h-px bg-slate-200 grow"></span> ${shift.label} <span class="h-px bg-slate-200 grow"></span>`;
        grid.appendChild(shiftTitle);

        shiftAreas.forEach(area => grid.appendChild(renderAreaCard(area)));
    });

    const dateEl = document.getElementById('currentDate');
    if (dateEl) {
        dateEl.innerText = new Date().toLocaleDateString('id-ID', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    const progressEl = document.getElementById('overallProgress');
    if (progressEl) {
        progressEl.innerText = `${countCompletedAreas(dailyStatus)}/${areas.length}`;
    }

    const tableBody = document.getElementById('activityTable');
    if (tableBody) {
        tableBody.innerHTML = recentHistory.map(log => {
            const cp = CHECKPOINT_LABELS[log.checkpoint] || (log.checkpoint || '').toUpperCase();
            const cpClass = log.checkpoint === 'start'
                ? 'bg-blue-100 text-blue-700'
                : log.checkpoint === 'middle'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700';
            return `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="p-4 font-mono text-[11px] text-slate-500">${new Date(log.created_at).toLocaleString('id-ID')}</td>
                    <td class="p-4 font-black text-slate-800 text-sm">${escapeHtml(log.operator_name)}</td>
                    <td class="p-4 text-xs font-bold text-slate-500">${escapeHtml(log.jig_name)}</td>
                    <td class="p-4"><span class="${cpClass} px-3 py-1 rounded-full text-[10px] font-black">${cp}</span></td>
                </tr>
            `;
        }).join('') || '<tr><td colspan="4" class="p-10 text-center text-slate-300 font-bold italic uppercase">Belum ada aktivitas</td></tr>';
    }
}

async function resetAreaToday(areaId) {
    if (!isCurrentUserAdmin()) return;
    const area = areas.find(a => a.id == areaId);
    if (!area || !confirm(`Reset semua checkpoint hari ini untuk ${area.name}?`)) return;

    const { start, end } = getTodayRange();
    const { data } = await _supabase
        .from('patrol_logs')
        .select('id')
        .eq('jig_id', areaId)
        .gte('created_at', start)
        .lte('created_at', end);

    if (data && data.length) {
        for (const row of data) {
            await _supabase.from('patrol_logs').delete().eq('id', row.id);
        }
    }
    fetchData();
}

function getAppBaseUrl() {
    let path = window.location.pathname || '/';
    path = path.replace(/index\.html?$/i, '');
    return window.location.origin + path;
}

function openQRModal() {
    const modal = document.getElementById('qrModal');
    const printArea = document.getElementById('qrPrintArea');
    if (!modal || !printArea) return;
    modal.classList.remove('hidden');
    printArea.innerHTML = '';

    const baseUrl = getAppBaseUrl();
    areas.forEach(area => {
        const qrUrl = `${baseUrl}?scan=${area.id}`;
        const shiftLabel = area.shift === 'B' ? 'SHIFT B' : 'SHIFT A';
        const qrCard = document.createElement('div');
        qrCard.className = 'qr-card-print border-2 border-slate-100 p-4 rounded-3xl flex flex-col items-center text-center bg-white shadow-sm';
        qrCard.innerHTML = `
            <div class="text-[9px] font-black text-indigo-500 mb-2 uppercase tracking-widest">${shiftLabel}</div>
            <div class="qr-placeholder w-32 h-32 mb-3 flex items-center justify-center bg-slate-50 rounded-xl"></div>
            <div class="font-black text-slate-800 text-xs leading-tight mb-1 uppercase">${escapeHtml(area.staff)}</div>
            <div class="text-[9px] text-slate-500 font-bold italic mb-1">${escapeHtml(area.name)}</div>
            <div class="text-[9px] text-slate-400 font-bold">Scan 3×: Start → Middle → End</div>
        `;
        printArea.appendChild(qrCard);

        const placeholder = qrCard.querySelector('.qr-placeholder');
        try {
            new QRCode(placeholder, { text: qrUrl, width: 128, height: 128 });
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'mt-2 text-[9px] font-black text-indigo-600 hover:text-indigo-800 underline';
            downloadBtn.textContent = 'Download QR';
            downloadBtn.addEventListener('click', function () {
                const imgOrCanvas = placeholder.querySelector('canvas') || placeholder.querySelector('img');
                if (!imgOrCanvas) { alert('QR belum siap.'); return; }
                const dataUrl = imgOrCanvas.tagName.toLowerCase() === 'canvas'
                    ? imgOrCanvas.toDataURL('image/png')
                    : imgOrCanvas.src;
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = `QR_Area_${area.id}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
            qrCard.appendChild(downloadBtn);
        } catch (e) {
            placeholder.innerHTML = '<span class="text-slate-400 text-xs">Error</span>';
        }
    });
}

function closeQRModal() {
    const modal = document.getElementById('qrModal');
    if (modal) modal.classList.add('hidden');
}

function openSettingsModal() {
    const tbody = document.getElementById('settingsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    areas.forEach((a, i) => tbody.appendChild(createSettingsRow(i + 1, a.staff, a.name, a.shift)));
    document.getElementById('settingsModal').classList.remove('hidden');
}

function createSettingsRow(no, staff, name, shift) {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-100 hover:bg-slate-50';
    const shiftOpts = ['A', 'B'].map(s => `<option value="${s}" ${shift === s ? 'selected' : ''}>SHIFT ${s}</option>`).join('');
    tr.innerHTML = `
        <td class="py-3 pr-2 text-sm font-bold text-slate-400">${no}</td>
        <td class="py-2 pr-2"><input type="text" class="settings-staff w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold" value="${(staff || '').replace(/"/g, '&quot;')}" placeholder="Nama PIC Patrol"></td>
        <td class="py-2 pr-2"><input type="text" class="settings-name w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold" value="${(name || '').replace(/"/g, '&quot;')}" placeholder="Nama Jig / Area"></td>
        <td class="py-2 pr-2"><select class="settings-shift w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold">${shiftOpts}</select></td>
        <td class="py-2"><button type="button" onclick="this.closest('tr').remove()" class="text-red-500 hover:text-red-700 text-lg font-black leading-none" title="Hapus">&times;</button></td>
    `;
    return tr;
}

function addSettingsRow() {
    const tbody = document.getElementById('settingsTableBody');
    const nextNo = tbody.querySelectorAll('tr').length + 1;
    tbody.appendChild(createSettingsRow(nextNo, '', '', 'A'));
}

function saveSettings() {
    const rows = document.querySelectorAll('#settingsTableBody tr');
    const newAreas = [];
    rows.forEach((row, i) => {
        const staff = (row.querySelector('.settings-staff') || {}).value || '';
        const name = (row.querySelector('.settings-name') || {}).value || '';
        const shift = (row.querySelector('.settings-shift') || {}).value || 'A';
        if (staff.trim() || name.trim()) {
            newAreas.push({
                id: i + 1,
                staff: staff.trim() || '-',
                name: name.trim() || '-',
                shift: shift === 'B' ? 'B' : 'A'
            });
        }
    });
    if (!newAreas.length) {
        alert('Minimal satu area harus diisi.');
        return;
    }
    areas = newAreas.map((a, i) => ({ ...a, id: i + 1 }));
    saveAreasToStorage();
    closeSettingsModal();
    renderUI();
}

function resetSettingsToDefault() {
    if (!confirm('Reset semua area ke default?')) return;
    areas = JSON.parse(JSON.stringify(DEFAULT_AREAS));
    saveAreasToStorage();
    openSettingsModal();
    renderUI();
}

function closeSettingsModal() {
    document.getElementById('settingsModal').classList.add('hidden');
}

function checkAutoScan() {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('scan');
    if (idParam) {
        window.history.replaceState({}, document.title, window.location.pathname);
        handleBarcodeScan(idParam, 'qr');
    }
}

function setupBarcodeScanner() {
    const input = document.getElementById('barcodeScannerInput');
    if (!input) return;

    let buffer = '';
    let lastKeyTime = 0;

    document.addEventListener('keydown', function (e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

        const now = Date.now();
        if (now - lastKeyTime > 100) buffer = '';
        lastKeyTime = now;

        if (e.key === 'Enter') {
            if (buffer.length > 0) {
                processScannerInput(buffer);
                buffer = '';
            }
            return;
        }
        if (e.key.length === 1) buffer += e.key;
    });
}

function processScannerInput(raw) {
    raw = (raw || '').trim();
    if (!raw) return;

    let jigId = null;
    if (/^\d+$/.test(raw)) {
        jigId = parseInt(raw, 10);
    } else {
        try {
            const url = new URL(raw);
            const scan = url.searchParams.get('scan');
            if (scan) jigId = parseInt(scan, 10);
        } catch (_) {
            const match = raw.match(/[?&]scan=(\d+)/);
            if (match) jigId = parseInt(match[1], 10);
        }
    }

    if (jigId) handleBarcodeScan(jigId, 'scanner');
    else alert('Barcode tidak valid: ' + raw);
}

function csvEscapeCell(val) {
    const s = val == null ? '' : String(val);
    if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
}

function csvRow(cells) {
    return cells.map(csvEscapeCell).join(',') + '\r\n';
}

function getDateRangeForDay(dateStr) {
    const parts = (dateStr || '').split('-').map(Number);
    const y = parts[0] || new Date().getFullYear();
    const m = (parts[1] || 1) - 1;
    const d = parts[2] || new Date().getDate();
    const start = new Date(y, m, d, 0, 0, 0).toISOString();
    const end = new Date(y, m, d, 23, 59, 59).toISOString();
    return { start, end, label: dateStr || formatDateInputValue(new Date()) };
}

function formatDateInputValue(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDateTimeExport(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('id-ID', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}

function normalizeShiftValue(val) {
    const s = String(val || '').trim().toUpperCase();
    if (s === 'B' || s === 'SHIFT B' || s === 'SHIF B' || s === '2') return 'B';
    return 'A';
}

function parseImportHeaderIndex(headers) {
    const idx = { staff: -1, name: -1, shift: -1 };
    headers.forEach((h, i) => {
        const key = String(h || '').trim().toLowerCase();
        if (/^(no|id|#)$/.test(key)) return;
        if (/pic|staff|petugas|nama\s*pic|patrol/.test(key)) idx.staff = i;
        else if (/jig|area|zona|lokasi|nama\s*jig/.test(key)) idx.name = i;
        else if (/shift/.test(key)) idx.shift = i;
    });
    if (idx.staff < 0 && idx.name < 0 && idx.shift < 0 && headers.length >= 3) {
        return { staff: 0, name: 1, shift: 2 };
    }
    if (idx.staff < 0 && headers.length >= 2) idx.staff = 0;
    if (idx.name < 0 && headers.length >= 2) idx.name = idx.staff === 0 ? 1 : 0;
    if (idx.shift < 0 && headers.length >= 3) idx.shift = 2;
    return idx;
}

function rowsToAreas(matrix) {
    if (!matrix || !matrix.length) return [];
    const firstRow = matrix[0].map(c => String(c == null ? '' : c).trim());
    const looksLikeHeader = firstRow.some(c => /pic|jig|area|shift|patrol/i.test(c));
    let dataRows = matrix;
    let colIdx = { staff: 0, name: 1, shift: 2 };

    if (looksLikeHeader) {
        colIdx = parseImportHeaderIndex(firstRow);
        dataRows = matrix.slice(1);
    }

    const result = [];
    dataRows.forEach(row => {
        if (!row || !row.length) return;
        const staff = String(row[colIdx.staff] == null ? '' : row[colIdx.staff]).trim();
        const name = String(row[colIdx.name] == null ? '' : row[colIdx.name]).trim();
        const shift = normalizeShiftValue(row[colIdx.shift]);
        if (!staff && !name) return;
        result.push({
            staff: staff || '-',
            name: name || '-',
            shift
        });
    });
    return result;
}

function downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
}

function downloadImportTemplate() {
    if (typeof XLSX === 'undefined') {
        alert('Library Excel belum dimuat. Muat ulang halaman.');
        return;
    }
    const wsData = [
        ['PIC Patrol', 'Nama Jig / Area', 'Shift (A/B)'],
        ['RIZKY MAULANA', 'Jig Inspection A1', 'A'],
        ['DEDI KURNIAWAN', 'Jig Inspection A2', 'A'],
        ['FIRMANSYAH', 'Jig Inspection B1', 'B']
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 22 }, { wch: 28 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Daftar Jig');
    XLSX.writeFile(wb, 'Template_Import_Jig_Patrol_QC.xlsx');
}

function handleExcelImport(inputEl) {
    const file = inputEl && inputEl.files && inputEl.files[0];
    if (inputEl) inputEl.value = '';
    if (!file) return;

    if (typeof XLSX === 'undefined') {
        alert('Library Excel belum dimuat. Muat ulang halaman.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
            const imported = rowsToAreas(matrix);

            if (!imported.length) {
                alert('Tidak ada data valid. Pastikan kolom: PIC Patrol, Nama Jig / Area, Shift (A/B).');
                return;
            }

            const mode = confirm(
                `${imported.length} baris ditemukan.\n\nOK = Ganti semua daftar jig\nBatal = Tambahkan ke daftar yang ada`
            );

            if (mode) {
                areas = imported.map((a, i) => ({ ...a, id: i + 1 }));
            } else {
                const merged = areas.slice();
                imported.forEach(row => merged.push(row));
                areas = merged.map((a, i) => ({ ...a, id: i + 1 }));
            }

            saveAreasToStorage();
            openSettingsModal();
            renderUI();
            alert(`Import berhasil: ${imported.length} jig.`);
        } catch (err) {
            alert('Gagal membaca file Excel: ' + (err.message || err));
        }
    };
    reader.readAsArrayBuffer(file);
}

function openExportModal() {
    const modal = document.getElementById('exportModal');
    const dateInput = document.getElementById('exportDate');
    if (!modal) return;
    if (dateInput) dateInput.value = formatDateInputValue(new Date());
    modal.classList.remove('hidden');
}

function closeExportModal() {
    const modal = document.getElementById('exportModal');
    if (modal) modal.classList.add('hidden');
}

async function fetchLogsForDate(dateStr) {
    const { start, end } = getDateRangeForDay(dateStr);
    try {
        const { data, error } = await _supabase
            .from('patrol_logs')
            .select('*')
            .gte('created_at', start)
            .lte('created_at', end)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error(e);
        return [];
    }
}

function buildCheckpointRows(logs, dateLabel) {
    const byJig = {};
    (logs || []).forEach(log => {
        const id = log.jig_id;
        if (!byJig[id]) {
            byJig[id] = { start: null, middle: null, end: null, operators: {} };
        }
        const cp = log.checkpoint;
        if (!CHECKPOINTS.includes(cp)) return;
        if (!byJig[id][cp]) {
            byJig[id][cp] = log.created_at;
            byJig[id].operators[cp] = log.operator_name || '';
        }
    });

    const rows = [];
    areas.forEach(area => {
        const rec = byJig[area.id] || { start: null, middle: null, end: null, operators: {} };
        const complete = rec.start && rec.middle && rec.end;
        rows.push({
            tanggal: dateLabel,
            shift: area.shift === 'B' ? 'SHIFT B' : 'SHIFT A',
            pic: area.staff,
            jig: area.name,
            start: formatDateTimeExport(rec.start),
            middle: formatDateTimeExport(rec.middle),
            end: formatDateTimeExport(rec.end),
            operatorStart: rec.operators.start || '',
            operatorMiddle: rec.operators.middle || '',
            operatorEnd: rec.operators.end || '',
            status: complete ? 'LENGKAP' : (rec.start || rec.middle || rec.end ? 'BELUM LENGKAP' : 'BELUM SCAN')
        });
    });

    const orphanIds = new Set();
    logs.forEach(log => {
        if (areas.find(a => a.id == log.jig_id)) return;
        if (orphanIds.has(log.jig_id)) return;
        orphanIds.add(log.jig_id);
        const rec = byJig[log.jig_id] || {};
        rows.push({
            tanggal: dateLabel,
            shift: '-',
            pic: '-',
            jig: log.jig_name || `Jig #${log.jig_id}`,
            start: formatDateTimeExport(rec.start),
            middle: formatDateTimeExport(rec.middle),
            end: formatDateTimeExport(rec.end),
            operatorStart: rec.operators ? rec.operators.start || '' : '',
            operatorMiddle: rec.operators ? rec.operators.middle || '' : '',
            operatorEnd: rec.operators ? rec.operators.end || '' : '',
            status: 'JIG TIDAK ADA DI LIST'
        });
    });

    return rows;
}

async function exportCheckpointLog() {
    const dateInput = document.getElementById('exportDate');
    const dateStr = dateInput ? dateInput.value : formatDateInputValue(new Date());
    const { label } = getDateRangeForDay(dateStr);
    const logs = await fetchLogsForDate(dateStr);
    const rows = buildCheckpointRows(logs, label);

    const header = [
        'Tanggal', 'Shift', 'PIC Patrol', 'Nama Jig / Area',
        'Timestamp START', 'Operator START',
        'Timestamp MIDDLE', 'Operator MIDDLE',
        'Timestamp END', 'Operator END',
        'Status'
    ];
    let csv = csvRow(header);
    rows.forEach(r => {
        csv += csvRow([
            r.tanggal, r.shift, r.pic, r.jig,
            r.start, r.operatorStart,
            r.middle, r.operatorMiddle,
            r.end, r.operatorEnd,
            r.status
        ]);
    });

    if (typeof XLSX !== 'undefined') {
        const aoa = [header];
        rows.forEach(r => {
            aoa.push([
                r.tanggal, r.shift, r.pic, r.jig,
                r.start, r.operatorStart,
                r.middle, r.operatorMiddle,
                r.end, r.operatorEnd,
                r.status
            ]);
        });
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 24 }, { wch: 20 }, { wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Checkpoint');
        XLSX.writeFile(wb, `Patrol_QC_Checkpoint_${label}.xlsx`);
    } else {
        downloadBlob(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), `Patrol_QC_Checkpoint_${label}.csv`);
    }
    closeExportModal();
}

async function exportDetailLog() {
    const dateInput = document.getElementById('exportDate');
    const dateStr = dateInput ? dateInput.value : formatDateInputValue(new Date());
    const { label } = getDateRangeForDay(dateStr);
    const logs = await fetchLogsForDate(dateStr);

    const header = ['Tanggal', 'Waktu Scan', 'Shift', 'PIC Patrol', 'Nama Jig / Area', 'Checkpoint', 'Operator QC', 'Email Operator'];
    let csv = csvRow(header);

    logs.forEach(log => {
        const area = areas.find(a => a.id == log.jig_id);
        csv += csvRow([
            label,
            formatDateTimeExport(log.created_at),
            area ? (area.shift === 'B' ? 'SHIFT B' : 'SHIFT A') : '-',
            area ? area.staff : '-',
            log.jig_name,
            CHECKPOINT_LABELS[log.checkpoint] || log.checkpoint,
            log.operator_name,
            log.operator_email || ''
        ]);
    });

    if (typeof XLSX !== 'undefined') {
        const aoa = [header];
        logs.forEach(log => {
            const area = areas.find(a => a.id == log.jig_id);
            aoa.push([
                label,
                formatDateTimeExport(log.created_at),
                area ? (area.shift === 'B' ? 'SHIFT B' : 'SHIFT A') : '-',
                area ? area.staff : '-',
                log.jig_name,
                CHECKPOINT_LABELS[log.checkpoint] || log.checkpoint,
                log.operator_name,
                log.operator_email || ''
            ]);
        });
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        XLSX.utils.book_append_sheet(wb, ws, 'Detail Scan');
        XLSX.writeFile(wb, `Patrol_QC_Detail_${label}.xlsx`);
    } else {
        downloadBlob(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), `Patrol_QC_Detail_${label}.csv`);
    }
    closeExportModal();
}

/** @deprecated gunakan exportDetailLog atau exportCheckpointLog */
async function exportCSV() {
    openExportModal();
}

function getStoredUsers() {
    try {
        const raw = localStorage.getItem(USERS_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

function saveStoredUsers(users) {
    try {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } catch (_) {}
}

function openAccountsModal() {
    renderAccountsTable();
    document.getElementById('newAccountUser').value = '';
    document.getElementById('newAccountPass').value = '';
    document.getElementById('accountsModal').classList.remove('hidden');
}

function closeAccountsModal() {
    document.getElementById('accountsModal').classList.add('hidden');
}

function renderAccountsTable() {
    const tbody = document.getElementById('accountsTableBody');
    if (!tbody) return;
    const users = getStoredUsers();
    tbody.innerHTML = users.map((u, i) => {
        const safeUser = String(u.username || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return `<tr class="border-b border-slate-100 hover:bg-slate-50">
            <td class="py-3 pr-2 text-sm font-bold text-slate-400">${i + 1}</td>
            <td class="py-2 pr-2 font-bold text-slate-800">${escapeHtml(u.username)}</td>
            <td class="py-2 pr-2 text-slate-500 text-sm">••••••••</td>
            <td class="py-2"><button type="button" onclick="removeAccount(this.getAttribute('data-username'))" data-username="${safeUser}" class="text-red-500 hover:text-red-700 text-lg font-black leading-none">&times;</button></td>
        </tr>`;
    }).join('') || '<tr><td colspan="4" class="py-6 text-center text-slate-400 font-bold text-sm">Belum ada akun tambahan.</td></tr>';
}

function addAccountFromForm() {
    const username = (document.getElementById('newAccountUser').value || '').trim();
    const password = document.getElementById('newAccountPass').value || '';
    if (!username || !password) { alert('Username dan password wajib diisi.'); return; }
    if (username.toLowerCase() === ADMIN_USERNAME.toLowerCase()) {
        alert('Username admin tidak bisa diduplikasi.');
        return;
    }
    const users = getStoredUsers();
    if (users.some(u => (u.username || '').toLowerCase() === username.toLowerCase())) {
        alert('Username sudah dipakai.');
        return;
    }
    users.push({ username, password });
    saveStoredUsers(users);
    document.getElementById('newAccountUser').value = '';
    document.getElementById('newAccountPass').value = '';
    renderAccountsTable();
}

function removeAccount(username) {
    if (!username || username.toLowerCase() === ADMIN_USERNAME.toLowerCase()) return;
    if (!confirm('Hapus akun "' + username + '"?')) return;
    saveStoredUsers(getStoredUsers().filter(u => (u.username || '').toLowerCase() !== username.toLowerCase()));
    renderAccountsTable();
}

function handleLogout() {
    try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        _supabase.auth.signOut();
    } catch (_) {}
    window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        const auth = getAuthUser();
        if (!auth) {
            window.location.href = 'login.html';
            return;
        }
        const loginEl = document.getElementById('loginAsIndicator');
        if (loginEl) {
            loginEl.textContent = auth.username === ADMIN_USERNAME
                ? 'Login sebagai: Admin'
                : 'Login sebagai: ' + (auth.username || '—');
        }
    } catch (_) {
        window.location.href = 'login.html';
        return;
    }

    setupBarcodeScanner();
    fetchData();
    checkAutoScan();
    setInterval(fetchData, 15000);

    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) fetchData();
    });

    const btnKelola = document.getElementById('btnKelolaAkun');
    if (btnKelola) btnKelola.style.display = isCurrentUserAdmin() ? '' : 'none';
});
