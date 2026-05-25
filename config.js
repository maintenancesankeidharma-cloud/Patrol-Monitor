/**
 * Konfigurasi Area Jig Inspection & PIC Patrol QC
 * Edit file ini untuk mengubah nama area, PIC, dan shift.
 *
 * Format tiap item:
 *   - id    : nomor unik (sesuai ID di barcode QR)
 *   - name  : nama jig / area inspection
 *   - staff : nama PIC Patrol
 *   - shift : "A" | "B"  (SHIFT A / SHIFT B)
 */

const CONFIG_AREAS = [
    // --- SHIFT A ---
    { id: 1, name: "Jig Inspection A1", staff: "RIZKY MAULANA", shift: "A" },
    { id: 2, name: "Jig Inspection A2", staff: "DEDI KURNIAWAN", shift: "A" },
    { id: 3, name: "Jig Inspection A3", staff: "AGUS PRASETYO", shift: "A" },
    { id: 4, name: "Jig Inspection A4", staff: "HENDRA WIBOWO", shift: "A" },

    // --- SHIFT B ---
    { id: 5, name: "Jig Inspection B1", staff: "FIRMANSYAH", shift: "B" },
    { id: 6, name: "Jig Inspection B2", staff: "YUDI ANTON", shift: "B" },
    { id: 7, name: "Jig Inspection B3", staff: "REZA SAPUTRA", shift: "B" },
    { id: 8, name: "Jig Inspection B4", staff: "BAYU NUGROHO", shift: "B" }
];
