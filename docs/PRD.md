# SAGI WORSHIP
## Product Requirements Document (PRD)
**Versi:** 1.0 — Draft untuk persetujuan  
**Tanggal:** 31 Oktober 2026  
**Platform:** Web Browser, Offline-First PWA  
**Status:** Perencanaan, belum diimplementasikan

### 1. Ringkasan Produk

SAGI WORSHIP adalah aplikasi presentasi multimedia untuk mendukung pelayanan ibadah gereja. Aplikasi memungkinkan operator mengelola lirik lagu, ayat Alkitab, gambar, video, dokumen, tema visual, dan jadwal ibadah melalui satu antarmuka.

SAGI WORSHIP memiliki dua halaman utama:

1. **Dashboard:** pengelolaan materi, penyiapan slide, dan kontrol presentasi LIVE.
2. **Pengaturan:** konfigurasi layar, tipografi, media, serta penyimpanan data.

Aplikasi ditargetkan berjalan melalui browser desktop dan tetap berfungsi tanpa koneksi internet setelah instalasi awal.

### 2. Tujuan Pengembangan

- Mempermudah operator multimedia mengelola materi ibadah.
- Menyiapkan slide berikutnya tanpa mengganggu tampilan jemaat.
- Menampilkan presentasi melalui monitor atau proyektor eksternal.
- Menyimpan lagu, playlist, media, tema, dan preferensi secara lokal.
- Menyediakan kontrol LIVE yang stabil dan mudah dipahami.
- Mengurangi ketergantungan pada internet selama ibadah.
- Menciptakan aplikasi dengan identitas SAGI WORSHIP yang mandiri.

### 3. Pengguna Utama

**Operator multimedia:** menyiapkan dan mengoperasikan presentasi ibadah.

**Worship leader:** menyusun kebutuhan lagu dan urutan materi ibadah bersama operator.

**Tim media gereja:** mengelola materi, lagu, visual, dan perpustakaan media.

Versi pertama didesain untuk satu operator aktif pada satu komputer, dengan kemungkinan menggunakan dua layar.

### 4. Lingkup Produk

#### 4.1 Dashboard

Dashboard mencakup:

- Jadwal Ibadah / Service Schedule
- Playlist Management
- Preview Workspace
- Preview Text Editor
- LIVE Projector Control
- Songs Library
- Scriptures Library
- Media Library
- Themes Library

#### 4.2 Pengaturan

Pengaturan mencakup:

- Display Output
- Reference Resolution
- Default Typography
- Video Playback
- Audio Settings
- Data & Storage
- Backup & Restore
- Reset Preferences
- Keyboard Shortcuts

### 5. Fitur Dashboard

#### FR-01 — Jadwal Ibadah / Service Schedule

Pengguna dapat membuat jadwal ibadah dengan nama bebas, misalnya "Sunday Service", "Youth Worship", atau "Week 5".

**Kebutuhan fungsional:**
- Membuat, mengganti nama, menduplikasi, dan menghapus jadwal.
- Menetapkan satu jadwal aktif.
- Menambahkan lagu, ayat, media, dan slide teks ke jadwal.
- Mengubah urutan item menggunakan drag-and-drop.
- Menghapus item dari jadwal tanpa menghapus sumber aslinya.
- Menampilkan jenis item dan jumlah slide.
- Menyimpan perubahan secara otomatis.
- Memberikan peringatan sebelum penghapusan permanen.

**Kriteria selesai:** Jadwal tetap tersedia setelah aplikasi ditutup dan dibuka kembali.

#### FR-02 — Songs Library

Library berisi kumpulan lagu yang dapat dicari, dipilih, diedit, dan digunakan berulang kali.

**Data lagu:**
- Judul
- Penyanyi / pencipta (opsional)
- Kategori
- Bahasa
- Isi lirik
- Bagian lagu (Intro, Verse, Chorus, Bridge, Ending)
- Urutan bagian presentasi
- Tanggal dibuat dan diperbarui

**Fitur utama:**
- Tambah lagu.
- Edit lagu.
- Hapus lagu dengan konfirmasi.
- Cari berdasarkan judul atau isi lirik.
- Preview sebelum digunakan.
- Tambahkan ke jadwal aktif.
- Duplikasi lagu.
- Atur urutan verse dan chorus.
- Impor/ekspor koleksi lagu dalam format internal aplikasi.

**Perilaku:** Mengedit lagu yang sudah ada dalam jadwal tidak boleh diam-diam mengubah konten LIVE. Perubahan harus diterapkan melalui mekanisme Preview dan Go Live.

#### FR-03 — Scriptures

Fitur untuk memilih dan menampilkan ayat Alkitab.

**Kebutuhan:**
- Pilih terjemahan yang sudah diimpor secara sah.
- Pilih kitab.
- Pilih pasal.
- Pilih satu atau beberapa ayat.
- Cari referensi ayat.
- Preview teks.
- Tambahkan ayat ke jadwal.
- Pecah ayat menjadi slide berdasarkan pengaturan.
- Tampilkan nama kitab, pasal, dan nomor ayat.

**Batasan:** Aplikasi tidak boleh menyertakan database Alkitab berhak cipta tanpa lisensi yang sesuai. Untuk versi awal, dukung impor dataset yang pengguna berhak gunakan.

#### FR-04 — Media Library

Mendukung:
- JPG, PNG, dan WebP.
- MP4 dan WebM dengan codec yang didukung browser.
- PDF.
- PPTX melalui renderer/konversi lokal yang diverifikasi.

**Fitur:**
- Impor satu atau banyak file.
- Tampilkan thumbnail.
- Preview media.
- Tambahkan media ke jadwal.
- Navigasi halaman PDF.
- Navigasi slide presentasi.
- Loop video.
- Hapus media.
- Perlihatkan ukuran file dan status kompatibilitas.

**Catatan:** PPTX tidak dijanjikan memiliki animasi atau efek transisi identik dengan Microsoft PowerPoint. File yang tidak kompatibel harus menghasilkan pesan error yang jelas, bukan blank screen.

#### FR-05 — Themes Library

Sistem tema mengatur tampilan output proyektor.

**Fitur:**
- Default Black.
- Gradient preset (Sunset, Ocean, Purple).
- Background gambar pribadi.
- Background video jika didukung.
- Mengubah warna lirik.
- Mengubah font, ukuran, alignment, line spacing.
- Bold, italic, underline.
- Outline dan shadow.
- Membuat, mengganti nama, duplikasi, dan menghapus custom theme.
- Menerapkan tema ke Preview atau item presentasi.

#### FR-06 — Preview Workspace

Preview adalah area persiapan sebelum materi ditampilkan kepada jemaat.

**Fitur:**
- Menampilkan daftar slide dari item yang dipilih.
- Menandai slide Preview yang aktif.
- Menampilkan hasil rendering Preview.
- Mengedit teks slide sementara.
- Reset teks ke sumber.
- Mengubah gaya tampilan.
- Menggunakan Apply Preview untuk menyimpan perubahan sementara.
- Go Live untuk mengirim slide yang dipilih ke output.

**Aturan utama:** Perubahan di Preview tidak langsung mengubah LIVE.

#### FR-07 — LIVE Projector Control

LIVE adalah pengendali output presentasi.

**Kontrol:**
- Go Live.
- Previous.
- Next.
- Black.
- Clear Text.
- Restore output.
- Open Projector Window.
- Fullscreen Projector.

**Perilaku:**
- Go Live mengganti tampilan jemaat ke slide Preview yang dipilih.
- Next/Previous menavigasi slide dalam urutan jadwal aktif.
- Black menampilkan layar hitam tanpa menghapus posisi presentasi.
- Clear Text menyembunyikan teks, mempertahankan background bila tersedia.
- Restore mengembalikan kondisi visual sebelumnya.
- Jika output window ditutup, operator mendapatkan indikator terputus.
- Jika proyektor terlepas, status tetap jelas dan pengguna dapat membuka ulang output.

#### FR-08 — Multi-Window Projector

SAGI WORSHIP menyediakan:
- Operator Window.
- Projector Output Window.

Output dirancang dengan rasio referensi 16:9 (1920 × 1080) dan diskalakan agar sesuai layar sebenarnya.

Pemilihan monitor otomatis hanya dilakukan jika browser dan izin pengguna mendukung. Jika tidak, operator dapat memindahkan jendela output secara manual ke proyektor lalu mengaktifkan fullscreen.

#### FR-09 — Keyboard Shortcuts

Shortcut default yang direncanakan:

- Right Arrow: slide berikutnya.
- Left Arrow: slide sebelumnya.
- Space: navigasi berikutnya saat kontrol presentasi aktif.
- B: Black / Restore.
- C: Clear Text / Restore.
- Escape: keluar fullscreen menggunakan perilaku browser.

Shortcut tidak aktif saat pengguna sedang mengetik pada editor atau pencarian, kecuali shortcut yang secara eksplisit diperbolehkan.

### 6. Fitur Pengaturan

#### FR-10 — Display Settings

- Status monitor dan projector window.
- Pemilihan layar jika API tersedia.
- Reference Canvas 1920 × 1080.
- Scaling dengan rasio tetap.
- Tombol Test Projector.
- Toggle fullscreen jika diizinkan browser.

#### FR-11 — Typography

- Default font.
- Default font size.
- Bold.
- Alignment.
- Line spacing.
- Outline.
- Shadow.
- Safe margin.
- Maksimal baris per slide.
- Auto fit jika teks melebihi area.

#### FR-12 — Video dan Audio

- Loop Video LIVE.
- Loop Video Preview.
- Start Video Muted.
- Default video volume.
- Periksa format/codec yang dapat dimainkan.
- Pengaturan volume di atas 100% hanya jika implementasi dan pemrosesan audio mendukung tanpa clipping yang tidak terkendali.

#### FR-13 — Local Data Management

- Menyimpan metadata dan koleksi secara lokal.
- Menyimpan aset media dalam penyimpanan browser yang sesuai.
- Menampilkan perkiraan pemakaian storage.
- Meminta persistent storage ketika tersedia.
- Backup data ke file yang bisa disimpan pengguna.
- Restore dari file backup yang tervalidasi.
- Menyediakan proses pemulihan jika data corrupt.
- Penghapusan data hanya melalui aksi eksplisit dan konfirmasi.

### 7. Arsitektur Teknis Usulan

**Frontend:** React + TypeScript + Vite.

**Styling:** Tailwind CSS + komponen UI yang dikembangkan secara konsisten.

**PWA:** Service Worker untuk application shell dan aset statis agar bisa digunakan offline.

**Database:** IndexedDB untuk jadwal, lagu, preferensi, dan metadata.

**Penyimpanan media:** IndexedDB / Origin Private File System sesuai hasil prototipe performa.

**Projector synchronization:** BroadcastChannel dengan strategi sinkronisasi keadaan dan fallback untuk menjaga konsistensi antarjendela.

**Testing:** Vitest untuk logika dan Playwright untuk E2E, termasuk dua jendela.

**Deployment:** Aplikasi statis yang dapat dipasang sebagai PWA. Pengembangan awal berjalan lokal; tidak ada backend atau akun wajib.

### 8. Struktur Data Konseptual

Entitas yang dibutuhkan:

- `songs`
- `song_sections`
- `scripture_translations`
- `scripture_verses`
- `media_assets`
- `themes`
- `schedules`
- `schedule_items`
- `slide_overrides`
- `settings`
- `live_session_state`
- `backup_manifest`

Semua entitas utama mempunyai ID stabil dan metadata perubahan.

Item jadwal mereferensikan konten sumber. Preview override dan LIVE state disimpan terpisah agar proses presentasi tidak mengubah data sumber tanpa disengaja.

### 9. Non-Functional Requirements

**Offline:** Fungsi inti bisa dipakai tanpa internet setelah pemasangan dan pengunduhan aset aplikasi selesai.

**Reliability:** Kesalahan Preview tidak boleh langsung merusak output LIVE.

**Performance:** Interaksi navigasi harus terasa cepat dan responsif; target performa diukur pada perangkat uji nyata.

**Accessibility:** Mendukung navigasi keyboard, label kontrol, focus indicator, dan kontras memadai.

**Security:** Tidak menggunakan CDN runtime sebagai ketergantungan offline, tidak mengunggah materi ibadah otomatis, validasi file impor, sanitasi konten, dan tidak mengevaluasi kode dari dokumen impor.

**Data Integrity:** Penulisan data atomik secara logis, migrasi skema, pencegahan multi-tab edit conflict, backup terverifikasi.

**Privacy:** Materi lagu dan data lokal tidak dikirim ke server analitik.

### 10. Batasan Versi Pertama

- Belum ada kolaborasi operator real-time antarperangkat.
- Belum ada sinkronisasi cloud.
- Belum ada aplikasi mobile khusus.
- Tidak menjanjikan dukungan semua efek PowerPoint.
- Tidak menjanjikan kontrol penuh terhadap monitor tanpa izin browser.
- Tidak menyediakan konten lagu atau Alkitab berlisensi tanpa hak penggunaan.

### 11. Acceptance Criteria Produk

Versi pertama dapat diterima ketika:

1. Aplikasi berjalan offline pada browser desktop target.
2. Pengguna dapat membuat dan menggunakan beberapa jadwal ibadah.
3. Lagu tersimpan dan dapat ditampilkan sebagai slide.
4. Preview dan LIVE berjalan terpisah.
5. Output kedua dapat dibuka dan dikendalikan operator.
6. Black, Clear Text, Next, Previous, dan Go Live berfungsi konsisten.
7. Scripture dataset berizin dapat diimpor dan dipresentasikan.
8. Gambar, video kompatibel, dan PDF dapat digunakan.
9. Presentasi PPTX yang didukung ditampilkan melalui mekanisme yang diuji.
10. Tema dapat dibuat, diterapkan, dan disimpan.
11. Data tetap tersedia setelah restart browser normal.
12. Backup dapat dipulihkan pada profil browser baru.
13. Kegagalan impor, storage, atau projector window tidak menyebabkan kerusakan data.
14. Pengujian otomatis dan pengujian operator di proyektor nyata selesai.

### 12. Tahapan Implementasi

**Phase 0 — Product & UX Approval**
Finalisasi PRD, desain visual, prioritas, dan acceptance criteria.

**Phase 1 — Application Foundation**
Routing, layout, theme system, PWA shell, database, dan unit testing.

**Phase 2 — Songs & Scheduling**
CRUD lagu, sections, playlist, drag-and-drop, autosave.

**Phase 3 — Preview & Projector**
Rendering slide, sinkronisasi dua jendela, Go Live, Black, Clear Text, keyboard controls.

**Phase 4 — Scriptures**
Dataset importer, kitab, pasal, ayat, preview, dan slide generation.

**Phase 5 — Media**
Gambar, video, PDF, serta evaluasi dan implementasi dukungan PPTX.

**Phase 6 — Themes & Settings**
Custom themes, typography, output settings, audio/video preferences.

**Phase 7 — Backup, Recovery & Security**
Backup/restore, migrasi, storage management, audit keamanan.

**Phase 8 — Quality Assurance & Release**
Unit test, integration test, Playwright E2E, pengujian offline, pengujian proyektor nyata, dan packaging PWA.

**Persyaratan:** Setiap fase membutuhkan review dan persetujuan sebelum lanjut ke implementasi berikutnya.