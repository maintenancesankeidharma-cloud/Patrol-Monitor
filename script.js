-- ============================================================
-- PERBAIKAN: Leader check gagal simpan
-- Error: violates check constraint "patrol_logs_checkpoint_check"
--
-- Jalankan SEMUA baris ini di Supabase → SQL Editor → Run
-- ============================================================

-- Hapus constraint lama (hanya allow start / middle / end)
ALTER TABLE public.patrol_logs
    DROP CONSTRAINT IF EXISTS patrol_logs_checkpoint_check;

-- Normalisasi data lama agar lolos constraint baru
-- 1) Jika ada value legacy 'leader_check', map ke 'leader_end'
UPDATE public.patrol_logs
SET checkpoint = 'leader_end'
WHERE checkpoint = 'leader_check';

-- 2) Jika ada nilai null/kosong, isi default aman
UPDATE public.patrol_logs
SET checkpoint = 'start'
WHERE checkpoint IS NULL OR trim(checkpoint) = '';

-- Opsi A — Izinkan checkpoint leader 3 tahap + kompatibel legacy
ALTER TABLE public.patrol_logs
    ADD CONSTRAINT patrol_logs_checkpoint_check
    CHECK (checkpoint IN (
        'start', 'middle', 'end',
        'leader_start', 'leader_middle', 'leader_end',
        'leader_check'
    ));

-- Jika Opsi A masih error, jalankan Opsi B saja (hapus constraint):
-- ALTER TABLE public.patrol_logs DROP CONSTRAINT IF EXISTS patrol_logs_checkpoint_check;

-- Verifikasi
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.patrol_logs'::regclass;
