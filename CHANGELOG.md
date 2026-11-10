# Changelog

Semua perubahan penting SAGI WORSHIP dicatat di sini.

## [Belum dirilis] — Tampilan SagiWorship (tahap 1)

Tampilan dashboard disesuaikan dengan desain SagiWorship versi Unity. Tidak ada perubahan data, IndexedDB, atau format backup.

- Sidebar "Sagi Worship" dengan tombol Dashboard/Pengaturan besar; status **READY / LIVE / BLACK / CLEAR TEXT** di kanan atas.
- Kontrol jendela proyektor (Open, Fullscreen, Reconnect, Pilih layar) pindah ke bar atas.
- Panel **Jadwal Ibadah** menampilkan Week aktif dengan nama besar.
- Panel **Preview**: SLIDES / SECTION, PREVIEW OUTPUT, EDIT TEXT BEFORE LIVE, TEXT STYLE.
- Panel **LIVE**: PROJECTOR PREVIEW, BLACK, CLEAR TEXT, ‹ PREV, GO LIVE, NEXT ›.
- Tab **SONGS / SCRIPTURES / MEDIA / THEMES**; tab SONGS berisi Playlists (pilih Week aktif, + New playlist), Folders (Music), pencarian dengan tombol hapus, dan baris lagu PREVIEW / EDIT / HAPUS.
- Tes: 3 tes E2E baru (`e2e/sagi-layout.spec.ts`); total 165 unit dan 75 E2E lulus.
- Berikutnya: tahap 2 (tarik lagu ke Week) dan tahap 3 (Text Style lengkap).

## [0.7.1] — 10 November 2026

Perbaikan stabilitas layar proyektor dan kontrol LIVE (P0) dari audit dual-display, untuk pemakaian lewat Chrome di laptop macOS/Windows dengan proyektor dalam mode **Extend Display**. Tidak ada fitur baru di luar cakupan ini.

**Status: belum siap produksi.** Rilis ini belum di-deploy ke Vercel dan belum diuji dengan proyektor fisik.

### Diperbaiki

- **H1 — Tombol Fullscreen terlihat oleh jemaat.** Setelah operator mengklik "Fullscreen" di jendela proyektor, tombol itu tetap tampil di pojok layar jemaat karena masih memegang fokus. Sekarang tombol hanya muncul sesaat ketika mouse digerakkan di layar proyektor (atau ketika difokus dengan keyboard), dan fokus dilepas setelah fullscreen berhasil.
- **M2 — Kursor mouse terlihat di layar jemaat.** Kursor kini disembunyikan saat layar proyektor diam dan muncul kembali ketika mouse digerakkan.
- **H2 — Layar bisa tidur saat slide statis.** Selama sesi LIVE (termasuk saat Black), jendela operator dan jendela proyektor meminta *Screen Wake Lock* agar layar laptop dan proyektor tidak meredup atau tidur, misalnya saat ayat khotbah tampil lama. Kunci dilepas ketika sesi LIVE berakhir dan diminta ulang setelah jendela kembali terlihat. Footer operator menampilkan status penjaga layar; jika browser menolak, operator diminta mematikan sleep/screen saver di pengaturan OS.
- **H3 — Pergantian slide terlambat dengan background media besar.** Proyektor sebelumnya membaca ulang dan menghitung SHA-256 seluruh file background pada setiap pergantian slide (terukur ±0,45 detik untuk 128 MB dan ±0,9 detik untuk 256 MB di laptop uji). Sekarang setiap media diverifikasi integritasnya dan didecode **sekali per jendela proyektor**, lalu dipakai ulang untuk Next/Previous/Clear Text/Restore. Batas snapshot presentasi tetap diperiksa setiap kali. Jendela proyektor yang baru dibuka atau di-refresh selalu memverifikasi ulang. Preview dan monitor operator tetap memverifikasi seperti sebelumnya.
- **H4 — Shortcut keyboard mudah tidak berfungsi.**
  - Shortcut LIVE kini aktif di seluruh jendela operator selama LIVE, bukan hanya saat panel LIVE memiliki fokus. Shortcut tetap mati saat mengetik (kolom teks, pencarian, pilihan) dan di dalam editor lagu, editor tema, dan dialog impor Alkitab.
  - Tombol clicker presentasi didukung: **PageDown/PageUp** untuk slide berikutnya/sebelumnya dan **`.`** untuk Black (selain ← → Space B C).
  - Tombol yang ditekan saat jendela proyektor sedang fokus (misalnya setelah mengklik Fullscreen di sana) diteruskan ke operator. Operator tetap satu-satunya pemegang kendali dan memvalidasi setiap perintah.
  - Setiap perintah dari proyektor memiliki ID unik sehingga tidak dieksekusi dua kali walaupun pesan dikirim melalui dua jalur (BroadcastChannel dan postMessage).
  - Teks bantuan shortcut di Pengaturan dan panel LIVE diperbarui.

### Kompatibilitas

- IndexedDB tetap **skema v1** dengan 12 store; tidak ada migrasi.
- Format backup tetap **`sagi-backup` versi 1** (`SAGIBAK1`). Field `appVersion` pada manifest backup baru kini `0.7.1`; field ini hanya metadata pembuat dan backup 0.7.0 tetap dapat dipulihkan.
- Protokol proyektor tetap **v4**. Pesan `COMMAND` adalah tambahan; jendela versi lama mengabaikannya. Format checkpoint tidak berubah.
- Tidak ada perubahan dependency.

### Pengujian otomatis (lulus)

- Typecheck: lulus.
- Unit test: **165/165** lulus (148 sebelumnya + 17 baru untuk wake lock, cache verifikasi media, pemetaan shortcut, validasi pesan `COMMAND`, dan pencegahan eksekusi ganda).
- Build produksi: lulus, 207 entri precache offline.
- E2E Chromium tanpa retry: **72/72** lulus (66 sebelumnya + 6 baru di `e2e/projector-stability.spec.ts`).
- Tes baru diverifikasi gagal pada kode 0.7.0 (5 dari 6; satu tes keamanan memang lulus di kedua versi) dan stabil saat diulang tiga kali.

### Belum selesai

- **M1** — Peringatan saat tab operator ditutup atau dimuat ulang ketika LIVE.
- **M4** — Label status "Error" yang tidak muncul pada regresi di staging Vercel (layar jemaat tetap aman; penyebab belum ditemukan).
- **L1** — Label fase/versi usang di UI dan identitas build yang terlihat di jendela proyektor.
- **Pengujian proyektor fisik belum dilakukan**, termasuk fullscreen di layar eksternal macOS/Windows, sleep/screen saver OS selama slide statis, jeda nyata dengan background video besar, clicker presentasi sungguhan, kabel HDMI dicabut-pasang, audio HDMI, resolusi/overscan proyektor, dan latihan ibadah 2–4 jam. Go Live pertama dengan media background baru yang besar tetap memerlukan satu kali verifikasi awal.
