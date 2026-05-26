/**
 * ============================================================
 * KONFIGURASI AKUN — Nama PIC & Shift
 * ============================================================
 * Tambahkan akun Supabase di sini beserta nama PIC dan shift-nya.
 * Key = email login (huruf kecil), value = { displayName, shift }
 * shift: "A" | "B" | null (null untuk admin)
 */
const ACCOUNT_PROFILES = {
    'admin@patrol-qc.com':    { displayName: 'Admin',           shift: null },
    'leader-a@patrol-qc.com': { displayName: 'Leader A',        shift: 'A' },
    'leader-b@patrol-qc.com': { displayName: 'Leader B',        shift: 'B' },
    'pic1@patrol-qc.com':     { displayName: 'PIC 1',           shift: 'A' },
    'pic2@patrol-qc.com':     { displayName: 'PIC 2',           shift: 'A' },
    'pic3@patrol-qc.com':     { displayName: 'PIC 3',           shift: 'B' },
    'pic4@patrol-qc.com':     { displayName: 'PIC 4',           shift: 'B' }
};

/**
 * ============================================================
 * KONFIGURASI WAKTU RESET SHIFT
 * ============================================================
 * Status checkpoint akan ter-reset pada jam-jam berikut.
 * Contoh: [7, 20] artinya reset jam 07:00 dan 20:00.
 * Periode shift 1: 07:00 – 19:59
 * Periode shift 2: 20:00 – 06:59 (keesokan hari)
 */
const RESET_HOURS = [7, 20];

/**
 * ============================================================
 * KONFIGURASI DEFAULT JIG (fallback jika Supabase kosong)
 * ============================================================
 * Daftar ini hanya dipakai saat pertama kali atau jika
 * tabel patrol_config di Supabase belum diisi.
 */
/**
 * ============================================================
 * KONFIGURASI MQTT — Koneksi ke EMQX Cloud
 * ============================================================
 * Digunakan untuk menerima info product/model yang sedang running.
 * Topic: /model/running → payload: {"product":"..."}
 */
const MQTT_CONFIG = {
    broker: 'wss://x914fb68.ala.eu-central-1.emqxsl.com:8084/mqtt',
    username: 'Jarz147',
    password: 'Sankei2022!',
    topic: '/model/running',
    reconnectPeriod: 5000,
    connectTimeout: 10000
};

const CONFIG_AREAS = [
    { id: 1, name: "Jig Inspection 1", area: "Area 1" },
    { id: 2, name: "Jig Inspection 2", area: "Area 1" },
    { id: 3, name: "Jig Inspection 3", area: "Area 2" },
    { id: 4, name: "Jig Inspection 4", area: "Area 2" },
    { id: 5, name: "Jig Inspection 5", area: "Area 3" },
    { id: 6, name: "Jig Inspection 6", area: "Area 3" },
    { id: 7, name: "Jig Inspection 7", area: "Area 4" },
    { id: 8, name: "Jig Inspection 8", area: "Area 4" }
];

/**
 * ============================================================
 * KONFIGURASI MQTT — Mapping Topic per Area
 * ============================================================
 * Setiap topic /assyX/running mewakili satu Area produksi.
 * Payload: {"product":"14110-52S00-000"} = nama jig yang running.
 *
 * Saat payload masuk, sistem akan mencari card di area tsb
 * yang nama jig-nya cocok → card itu ditandai "RUNNING".
 *
 * PENTING: nilai "area" harus cocok dengan field area
 * di CONFIG_AREAS / Supabase.
 */
const MQTT_TOPIC_MAP = [
    { topic: '/assy9/running', area: 'ASSY9' },
    { topic: '/assy8/running', area: 'ASSY8' },
    { topic: '/assy7/running', area: 'ASSY7' },
    { topic: '/assy6/running', area: 'ASSY6' },
    { topic: '/assy3/running', area: 'ASSY3' },
    { topic: '/assy2/running', area: 'ASSY2' }
];
