# SAGI WORSHIP

Phase 7 Backup, Restore, Recovery & Security untuk aplikasi presentasi ibadah offline. Implementasi lokal sesuai [PRD](docs/PRD.md), tanpa analitik. Data tetap tersimpan offline di tiap perangkat; satu-satunya layanan online opsional adalah sinkron lagu Musik antar laptop lewat Supabase milik gereja ([docs/SYNC.md](docs/SYNC.md)). Alkitab bawaan: AYT (Indonesia, CC BY-NC-SA) dan KJV (English, domain publik).

## Menjalankan

Gunakan Node.js 22.13+ (atau Node 24 LTS) dan npm.

```sh
npm install
npm run dev
```

Dashboard: `http://127.0.0.1:5173/`; pengaturan: `http://127.0.0.1:5173/#/settings`.

```sh
npm test
npm run build
npm run preview
```

Offline hanya tersedia di **production build** melalui HTTPS atau localhost. Buka preview saat online, tunggu indikator “Shell offline siap”, lalu matikan jaringan dan reload URL yang sama. Service worker menggunakan pembaruan tertunda agar versi baru tidak otomatis memuat ulang workspace ketika ibadah berlangsung. Tutup semua jendela aplikasi sebelum membuka versi baru.

## Phase 1 yang tersedia

- React, TypeScript, Vite dan Tailwind; seluruh runtime dibundel lokal.
- Layout Dashboard dan Pengaturan dengan hash routing, fokus keyboard, dan ukuran responsif.
- Preview visual dengan preset tema; area LIVE tetap terpisah dan belum terhubung.
- IndexedDB skema v1 untuk 12 entitas PRD, validasi preferensi, dan penulisan transaksi tunggal.
- Preferensi font, ukuran, margin, tema, video, dan volume tersimpan lintas reload.
- Web Locks membatasi penulis workspace ke satu tab; tab lain hanya baca sampai dimuat ulang. Browser tanpa Web Locks hanya membaca.
- Manifest PWA, cache shell produksi, status offline, estimasi storage dan permintaan persistent storage.
- Vitest dengan fake IndexedDB untuk skema, persistensi, validasi, dan preservasi data rusak.

## Phase 2 yang tersedia

- CRUD lagu, metadata, lima jenis bagian, urutan berulang, pencarian, dan duplikasi.
- Beberapa jadwal: buat, ganti nama, duplikasi, hapus, pilih aktif, dan tambahkan lagu.
- Pengurutan melalui drag-and-drop atau tombol naik/turun dengan dukungan keyboard.
- Autosave tervalidasi, draft terpisah yang dapat dipulihkan, pemeriksaan revisi, dan transaksi atomik.
- Semua mutasi, termasuk preferensi, dilindungi hak tulis Web Locks di repository. Tab lain hanya baca.
- Tidak ada migrasi/reset data. Skema tetap v1 dan preferensi Phase 1 dipertahankan.

## Pengujian

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm audit
npm audit --omit=dev
```

Playwright menjalankan preview **production build** pada `127.0.0.1:4174` dan menggunakan browser context baru pada setiap tes. Jalankan build terlebih dahulu. Tes IndexedDB menggunakan nama database acak dan membersihkan hanya database tes tersebut. Tidak ada tes yang menggunakan profil browser pribadi atau menghapus data workspace pengguna.

Suite mencakup CRUD, urutan lagu/jadwal, reload, draft/retry, transaksi gagal, data rusak, tab hanya baca, kehilangan lock, kompatibilitas Phase 1, dan offline. Screenshot responsif serta jejak kegagalan berada di `test-results/`; laporan HTML di `playwright-report/` (`npm run test:e2e:report`).

## Susun Otomatis (Musik)

Di tab **Songs**, tombol **✨ Susun Otomatis** di samping **Tambah lagu**: isi judul, penyanyi/pencipta, dan tempel lirik lengkap, lalu klik **Susun Otomatis**. Tanpa AI dan tanpa internet; lirik tidak dikirim ke mana pun dan kata-katanya tidak diubah.

- Label di lirik dikenali: `Verse 1`, `[Verse 1]`, `V1`, `Bait 2`, `Pre-Chorus`, `Pre-Reff`, `Chorus`, `Reff`/`Reff:`, `Refrain`, `Post-Chorus`, `Bridge`, `Intro`, `Instrumental`/`Interlude`, `Outro`/`Ending`/`Coda`, juga `Chorus 2x`. Label yang diulang tanpa lirik (atau dengan lirik sama) mengulang bagian itu di urutan; bagiannya disimpan sekali.
- Tanpa label: bait dipisah baris kosong; bait yang muncul lagi dianggap Chorus, sisanya Verse 1, 2, …; semua tebakan bertanda **Perlu dicek**. Intro, Bridge, atau Instrumental tidak pernah dikarang.
- Hasil bisa dikoreksi (label, lirik, hapus bagian, urutan naik/turun/hapus/tambah) dan baru tersimpan setelah **Simpan ke Song Library**. Lagu tersimpan seperti lagu biasa (editor, slide, tema, jadwal, sinkron, backup); tidak ada format data baru. Kode: `src/songs/autoArrange.ts`, `src/components/AutoArrange.tsx`.

## Sinkron lagu antar laptop

Lagu di **Musik**, media, tema, dan **Jadwal Ibadah Week 1–4** bisa sama di semua laptop gereja (jalankan `supabase/songs-sync.sql`, `supabase/library-sync.sql`, dan `supabase/schedule-sync.sql` sekali). Admin menyiapkan project Supabase sekali (tabel dari `supabase/songs-sync.sql`, akun gereja, lalu `VITE_SYNC_URL` dan `VITE_SYNC_KEY` di Vercel). Di tiap laptop, tab **Songs › Sinkron antar laptop**, masuk dengan akun gereja. Tambah/ubah/hapus lagu ikut ke laptop lain dalam beberapa detik; tanpa internet tetap jalan. Bentrok tidak menimpa: versi laptop ini disimpan sebagai salinan. Langkah lengkap: [docs/SYNC.md](docs/SYNC.md).

## Phase 3 — Preview & Projector

Pilih judul lagu untuk menyiapkan deck standalone, atau pilih item jadwal untuk menyiapkan seluruh urutan jadwal. Preview memiliki daftar slide, editor sementara, Apply/Reset, dan gaya dasar. LIVE hanya berubah melalui Go Live atau kontrol LIVE yang diotorisasi. Perubahan sumber dan Pengaturan tidak memperbarui LIVE otomatis.

Buka **Open Projector Window**, pindahkan jendela ke layar jemaat, dan pilih fullscreen langsung di jendela tersebut bila permintaan operator ditolak browser. Output baru/refresh mulai hitam sampai menerima snapshot lengkap. Saat komunikasi terputus, output yang sudah berjalan mempertahankan frame terakhir.

Kontrol: Go Live, Previous/Next, Black, Clear Text, Restore, Reconnect, dan fullscreen. Fokuskan panel LIVE untuk ← / → / Space / B / C. Shortcut tidak aktif di editor/pencarian. Emergency Black tersedia di header operator, termasuk pada Pengaturan.

Setelah restart operator, pilih **Resume presentasi** atau **Discard checkpoint** secara eksplisit. Tidak ada auto-resume/takeover. Checkpoint dapat tertinggal dari LIVE jika storage gagal; Black tetap bekerja selama hak tulis valid. Tutup output lama dan buka output yang dipasangkan dengan sesi baru.

Tidak ada migrasi schema: IndexedDB tetap v1. Seluruh pemeriksaan produksi/offline dijalankan melalui perintah di atas. Dokumen hasil: [docs/PHASE-3.md](docs/PHASE-3.md).

## Phase 4 — Scriptures

Tab **Scriptures** berisi **Alkitab / Bible** dua bahasa: **Alkitab Yang Terbuka (AYT)** di kiri dan **King James Version (KJV)** di kanan, Kejadian sampai Wahyu. Klik **Pasang Alkitab** sekali (centang persetujuan pemakaian non-komersial), lalu pilih **Kitab**, **Pasal**, **Ayat** dari–sampai (atau ketik `Kej 1:3-10` / `John 3:16`). Daftar ayat tampil berdampingan; **Preview** dan LIVE menampilkan dua kolom dengan referensi dan atribusi kedua edisi. **Tambahkan ke jadwal** memasukkan ayat ke Week aktif (atau Week 1). TB Edisi Kedua (© LAI) dan ESV (© Crossway) tidak dibundel karena lisensinya melarang menyebarkan Alkitab lengkap, tetapi bisa dipakai lewat panel **Sumber online** dengan API key gereja (Bible API LAI dan ESV API). Key hanya disimpan di browser perangkat itu, hanya ayat yang dipilih yang diambil (maks. 500 ayat per versi), dan tanpa internet ayat yang belum tersimpan memakai AYT/KJV. Format dataset dan checksum: [docs/SCRIPTURE-DATASET.md](docs/SCRIPTURE-DATASET.md).

Pilih terjemahan, kitab, pasal, lalu centang ayat; gunakan referensi seperti `John 3:16-18,20` berdasarkan nama/alias dataset, atau pencarian teks literal offline. Pilihan dapat ditambahkan ke jadwal bersama lagu, diurutkan, diduplikasi bersama jadwal, atau disiapkan untuk Preview. Teks ayat tidak dapat diedit dalam Preview. Slide menampilkan referensi dan edisi terjemahan (mis. "Amsal 3:3–6 · AYT · 2024") pada setiap kelanjutan; baris lisensi tidak ditampilkan di slide, tetapi tetap tersimpan di data materi dan backup. Ayat yang dipilih (mis. Amsal 3:3–6) tampil utuh dalam **satu slide**: Indonesia di kiri, English di kanan, huruf mengecil otomatis sampai muat (minimal 24 px pada layar 1080p); hanya pilihan yang terlalu panjang dibagi rata ke beberapa slide. Latar ayat diatur sendiri di **Scriptures › Latar ayat** (gambar/video atau hitam polos) dan tidak ikut tema di Themes.

Go Live tetap eksplisit. Impor/penghapusan dataset tidak mengubah LIVE atau checkpoint yang telah dibekukan. Penghapusan dataset juga menghapus item jadwal terkait setelah konfirmasi; snapshot lama tetap menyimpan kutipan dan metadata izin. Edisi berbeda diimpor berdampingan, tanpa penggantian otomatis. Simpan file sumber berizin karena checkpoint bukan backup dataset.

Skema IndexedDB tetap v1. Checkpoint baru dan protokol proyektor menggunakan versi 2; checkpoint lagu versi 1 tetap terbaca. Jika versi jendela berbeda, tutup output dan muat ulang kedua jendela. Hasil dan batas pengujian: [docs/PHASE-4.md](docs/PHASE-4.md).

## Phase 5 — Media Library

Tab **Media** mengimpor JPG/PNG/WebP, MP4/WebM yang dapat didekode browser, serta PDF. File disimpan offline sebagai Blob IndexedDB; metadata, thumbnail, checksum, jadwal, dan pin presentasi memiliki transaksi tervalidasi. Skema database tetap v1. Tidak ada unggahan atau layanan konversi eksternal.

**Folder pantauan:** di sidebar Media, klik **Pilih folder** (mis. Downloads) sekali. Selama aplikasi terbuka (tab apa pun), folder diperiksa tiap 5 detik; file media baru muncul di atas grid dengan tanda **Baru** dan tombol **Impor** / **Impor semua**, dan tab Media menampilkan jumlahnya. Centang **Impor otomatis file baru** agar unduhan yang sudah selesai langsung masuk Media. Butuh Chrome/Edge di laptop; aplikasi hanya membaca folder itu, dan pilihan folder tidak ikut backup.

Pilih kartu media, periksa metadata/kompatibilitas, lalu gunakan **Preview media** atau **Tambahkan media ke jadwal**. PDF mendukung thumbnail halaman dan input rentang seperti `1-3,5`. Halaman terpilih dirasterisasi lokal sebelum presentasi. Jadwal dapat mencampur lagu, ayat, gambar, video, dan halaman PDF.

Video masuk LIVE dalam kondisi paused. **Play LIVE**, **Pause LIVE**, Loop, Mute, dan Volume hanya mengendalikan output yang dipasangkan. Kontrol video Preview terpisah; monitor LIVE operator tidak mengeluarkan audio. Black menyembunyikan output, menghentikan video, dan mematikan suaranya; Restore tidak otomatis memulai playback kembali. Refresh/recovery video selalu paused dan membutuhkan Play baru.

Penghapusan sumber juga membersihkan referensi jadwal setelah konfirmasi, tetapi aset yang dibutuhkan Preview/LIVE/checkpoint tetap disimpan. **Bersihkan media tanpa referensi** tidak menghapus aset yang dipin. Pin sesi yang terhenti/crash dipertahankan konservatif; simpan file sumber karena belum ada backup media otomatis.

Checkpoint format 3 dan protokol proyektor v3 mendukung referensi media tanpa mengirim Blob melalui pesan sinkronisasi. Projector hanya membaca aset yang ada pada snapshot tervalidasi dan tidak memiliki WriterGate. Checkpoint lama tetap dapat dibaca. Setelah update PWA, tutup output lama dan buka kedua jendela dengan versi yang sama.

PPTX baru dievaluasi terpisah, belum didukung langsung oleh aplikasi. Gunakan ekspor lokal ke PDF/gambar sambil menunggu keputusan dukungan PPTX. Hasil: [docs/PHASE-5.md](docs/PHASE-5.md). Batas ukuran, codec, PDF, dan retensi: [docs/MEDIA-FORMATS.md](docs/MEDIA-FORMATS.md).

## Phase 6 — Themes & Advanced Settings

Tab **Tema** menyediakan preset built-in dan tema custom: buat, edit/rename, duplikasi, cari/filter, hapus dengan konfirmasi, aplikasikan ke Preview, jadikan default, atau simpan assignment pada item jadwal lagu/Scripture. Preset built-in tidak diedit langsung; duplikasi untuk membuat versi pribadi. Perubahan editor hanya mengubah preview lokal sampai disimpan/diterapkan; audience tetap memerlukan **Go Live**.

Background: solid, gradient, gambar dan video lokal yang telah diimpor. Video background selalu silent, dengan kontrol Preview/LIVE terpisah. Black mem-pause; Restore/refresh/recovery tidak otomatis memulai motion. Tipografi mendukung font sistem, size/weight/color/alignment/spacing, outline/shadow, margin dan fitting terbatas. Footer Scripture tetap terlindungi dan tidak dapat diedit/disembunyikan oleh tema.

Pengaturan lanjutan menyimpan default tema, reference canvas 720p/1080p, Fit/no-upscale, aksesibilitas dan kontrol layar. Default hanya berlaku saat persiapan baru. Tema yang memiliki assignment/default membutuhkan pengganti eksplisit saat dihapus. Pin tema/Preview/LIVE/checkpoint mempertahankan background meskipun sumber library dihapus.

IndexedDB tetap schema v1; checkpoint baru format 4, protocol projector v4. Checkpoint/override lama tetap dibaca. Tutup jendela versi lama setelah update PWA; jangan downgrade snapshot secara diam-diam. Detail hasil, batas sistem font dan manual QA: [docs/PHASE-6.md](docs/PHASE-6.md).

## Phase 7 — Backup, Restore, Recovery & Security

Pengaturan menyediakan **Backup & Recovery**: backup `.sagibak`, verifikasi ulang file, staging lokal, preview konflik, fresh restore, merge keep-existing/keep-both yang aman, serta Storage Health. Semua proses offline; tidak ada enkripsi atau cloud. Backup parsial karena izin ekspor Scripture selalu dijelaskan. Snapshot/checkpoint juga diperiksa agar teks terlarang tidak ikut diekspor.

Publikasi restore memerlukan **End Session**, penutupan projector, preview/konfirmasi ulang dan WriterGate. Seluruh perubahan tujuan serta receipt dipublikasikan dalam satu transaksi atomik. Setelah sukses, muat ulang sebelum mengedit atau Resume. LIVE tidak otomatis aktif; video tetap paused. Data lama, tombstone, schema v1 dan checkpoint legacy dipertahankan. Repair hanya membangun ulang pin dari dependensi terverifikasi setelah konfirmasi; data ambigu/orphan tidak dihapus otomatis.

Baca [format backup](docs/BACKUP-FORMAT.md), [panduan recovery](docs/RECOVERY.md), [security/dependency review](docs/SECURITY.md), dan [hasil Phase 7](docs/PHASE-7.md). Simpan salinan eksternal yang telah dibuka dan diverifikasi; browser-local pins bukan backup independen.

## Batas review

Penyimpanan terikat origin/profil browser dan quota/eviction browser. Aplikasi harus terpasang/tercache pada origin tujuan sebelum restore offline. Uji batas ukuran, file picker/disk-full, installed PWA, codec/font dan projector fisik secara manual. Tidak ada deployment, Git initialization, commit, push, upgrade dependency besar atau penggantian service worker. **Phase 7 menunggu review; Phase 8 membutuhkan persetujuan terpisah.**

Riwayat implementasi: [Phase 1](docs/PHASE-1.md), [Phase 2](docs/PHASE-2.md).
