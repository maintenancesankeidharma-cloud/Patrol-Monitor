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
 * KONFIGURASI DEFAULT JIG (fallback jika Supabase kosong)
 * ============================================================
 * Daftar ini hanya dipakai saat pertama kali atau jika
 * tabel patrol_config di Supabase belum diisi.
 */
const CONFIG_AREAS = [
    { id: 1, name: "Jig Inspection 1" },
    { id: 2, name: "Jig Inspection 2" },
    { id: 3, name: "Jig Inspection 3" },
    { id: 4, name: "Jig Inspection 4" },
    { id: 5, name: "Jig Inspection 5" },
    { id: 6, name: "Jig Inspection 6" },
    { id: 7, name: "Jig Inspection 7" },
    { id: 8, name: "Jig Inspection 8" }
];
