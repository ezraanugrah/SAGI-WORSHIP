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

### Tahap 2 — tarik lagu ke Week dan ukuran ringkas

- Lagu di daftar **Music** bisa ditarik ke panel **Jadwal Ibadah** (kotak "Tarik lagu dari Music ke sini" atau di atas daftar item) untuk ditambahkan ke Week aktif. Tombol "Ke jadwal" tetap tersedia untuk keyboard. Pengurutan item dengan tarik-lepas tetap berjalan.
- Ukuran tampilan dibuat ringkas dan cair (huruf, tombol, sidebar, jarak mengikuti lebar layar; monitor Preview/LIVE mengikuti tinggi layar). Dashboard (tiga panel + tab) muat satu layar di 1280×720, 1366×768, 1440×900, dan 1920×1080; tanpa geser samping di HP.
- Tes E2E seret-lepas ditambahkan.

### Toolbar kanan atas dan tab tipis

- **Toolbar LIVE cepat** di kanan atas (tampil di semua halaman): **Go Live**, **Black**, **Clear**, dan **Live** (membuka/memfokuskan jendela proyektor; menyala saat tersinkron). Aturannya sama dengan panel LIVE; tombol Black di toolbar menggantikan tombol Black darurat sebelumnya.
- **Tab bawah tipis**: Songs · Scriptures · Media · **Presentations** · Themes, dengan garis oranye pada tab aktif.
- **Presentations**: daftar khusus PDF presentasi (hasil ekspor PowerPoint/Keynote/Google Slides) dengan impor, pilih halaman, Preview, dan Go Live. Memakai penyimpanan media yang sama; tanpa perubahan format data.
- Berikutnya: Logo (nama gereja) dan Alerts (teks berjalan), lalu Text Style lengkap.

### Tata letak workspace (Schedule | Preview | Live) dan Alerts

Tata letak mengikuti gambar referensi dengan warna gelap/oranye yang sama. Data, IndexedDB, dan format backup tetap kompatibel (checkpoint lama tetap terbaca).

- **Satu layar penuh**: sidebar kiri dihapus; menu Dashboard/Pengaturan pindah ke bar atas. Di laptop/desktop (≥1181 px) semua muat satu layar dan tiap panel bergulir sendiri; di layar kecil panel bertumpuk.
- **Schedule** (kiri): judul "Schedule - nama Week", thumbnail per item, dan item yang sedang di-Preview terbuka menjadi daftar slide-nya (klik slide = pilih di Preview). Lagu dari Songs dan kartu dari Media/Presentations ditambahkan dengan **ditarik** ke Schedule.
- **Preview** (tengah): daftar slide bernomor dengan label bagian dan teksnya; slide terpilih langsung bisa diedit (Apply Preview / Reset / Buang). Di bawahnya **Preview Output** dengan "Slide X of N" dan tombol ‹ ›.
- **Live** (kanan): daftar slide LIVE (klik = lompat ke slide itu), **Live Output**, "Slide X of N", ‹ ›, dan baris diagnostik ringkas.
- **Alerts** di toolbar: pesan berjalan di bagian bawah layar jemaat. Tetap tampil saat pindah slide atau Go Live berikutnya, tersembunyi saat Black, dihentikan dengan "Hentikan alert". Maksimal 300 karakter; ikut tersimpan di checkpoint dan backup.
- **Library**: Songs dan Media/Presentations memakai daftar kategori di kiri dan isi di kanan; Media berupa grid thumbnail. Editor lagu terbuka sebagai jendela di atas workspace.
- **Tanpa fitur ganda** (cukup satu):
  - Go Live, Black, Clear Text, dan buka jendela proyektor hanya di toolbar kanan atas. Tombol di panel LIVE, "Restore", dan "Open Projector Window" dihapus; klik Black/Clear lagi untuk kembali normal.
  - Layar/Fullscreen/Reconnect hanya di bar atas (tombol proyektor di Pengaturan dihapus).
  - Pilih/buat Week hanya lewat Playlists di tab Songs (select dan tombol "Buat jadwal" di panel Schedule dihapus).
  - Lagu ditambahkan hanya dengan ditarik ("Ke jadwal" dihapus); Preview lagu dengan klik judulnya ("Preview →" dihapus).
  - Media ditambahkan dengan ditarik ("Tambahkan media ke jadwal" dihapus; halaman PDF yang dipilih ikut terbawa).
  - Filter jenis media memakai daftar kategori (select "Jenis media" dihapus).
- Logo ditunda sesuai permintaan.

### Pembaruan versi, tab hanya baca, dan drop tanpa Week

- **Versi baru langsung bisa dipakai**: saat versi baru tersedia muncul tombol **Muat versi baru** (sebelumnya harus menutup semua jendela SAGI). Jika LIVE sedang berjalan, ada konfirmasi dulu. Aplikasi memeriksa versi baru setiap jam.
- **Tab hanya baca terlihat jelas**: jika SAGI terbuka di tab lain, kotak status menampilkan **HANYA BACA** dan ada banner dengan tombol **Muat ulang** dan **Edit di tab ini** (tab lain menjadi hanya baca setelah konfirmasi).
- Tombol toolbar yang abu-abu menjelaskan alasannya saat disorot (misalnya "Go Live dulu" atau "Klik lagu atau item jadwal untuk Preview dulu").
- **Tarik lagu/media ke Schedule tanpa Week**: langsung masuk ke Week 1 (lihat di bawah).

### Kategori Songs: Playlist Jadwal (Week 1–4) dan Musik

- Kategori di tab Songs kini hanya **Playlist Jadwal** berisi **Week 1, Week 2, Week 3, Week 4** dan **Folder › Musik**. Klik sebuah Week untuk membukanya di **Jadwal Ibadah**; Week dibuat otomatis saat pertama dipakai. Tombol "New playlist" dihapus.
- Daftar Musik dengan **Cari musik**; lagu ditarik ke Jadwal Ibadah. Jika belum memilih Week, lagu masuk ke **Week 1**.
- Panel kiri berjudul **Jadwal Ibadah - Week n**. Ganti nama, duplikasi, dan hapus jadwal diganti **Kosongkan jadwal** (semua item dilepas; lagu dan media tidak dihapus) agar Week bisa dipakai ulang.
- Jadwal lama dengan nama lain tidak dihapus: tetap tersimpan di database dan backup, hanya tidak tampil di daftar. Jadwal bernama "week1"/"Week 1" otomatis dipakai sebagai Week 1, dan seterusnya.
- Tes: unit test Week 1–4 dan Kosongkan jadwal; E2E memakai Week 1–4.

### Tarik lagu baru, panel Live lebih bersih, dan pembaruan otomatis

- **Lagu baru mudah ditarik**: setelah menambah lagu (klik Selesai), lagu itu disorot dengan label **"Baru · tarik ke jadwal"** dan langsung terlihat di daftar Musik. Pencarian yang menyembunyikannya dikosongkan sekali.
- Setiap baris lagu punya pegangan tarik ⠿. Saat menarik lagu/media, **Jadwal Ibadah** diberi garis oranye dan tulisan **"Lepas di sini → Week n"**.
- **Panel Live**: baris diagnostik (Fullscreen/Mode/Dikirim/Dirender/Shortcut), "Belum ada checkpoint", dan "Coba checkpoint lagi" dihapus dari panel. Status checkpoint pindah ke bar status bawah; tombol **Coba checkpoint lagi** hanya muncul jika penyimpanan gagal. Detail diagnostik ada di tooltip status koneksi.
- **Tata letak atas: Jadwal Ibadah | Preview Output | Live Output.** Daftar slide di kolom Preview juga dihapus: kolom tengah hanya monitor **Preview Output** (sama besar dengan Live Output) dengan "Slide X of N", ‹ ›, dan tombol **Edit teks**. Slide dipilih dari daftar slide item di Jadwal Ibadah atau ‹ ›. Edit teks membuka jendela kecil (Apply Preview / Reset / Buang; Esc atau ✕ untuk menutup, dengan konfirmasi jika ada perubahan).
- **Live Output hanya berubah saat Go Live diklik.** Fitur sementara "Langsung ke Live" (Preview otomatis tampil di Live) dicoba lalu dihapus atas permintaan: Preview Output untuk menyiapkan, Go Live untuk menampilkan ke jemaat.
- **Themes Library: Impor media** (seperti tab Media), untuk gambar dan video (JPG · PNG · WebP · MP4 · WebM). Satu file langsung membuka tema baru dengan file itu sebagai background (nama tema dari nama file). Beberapa file sekaligus hanya diimpor dan siap dipilih di **Buat tema › Media background**. Di editor tema juga ada **Impor media** untuk mengganti background (video selalu silent). Semua tersimpan di Media; file yang sama dipakai ulang, tidak ganda.
- (Sebelumnya) **Jadwal Ibadah | Preview | Live Output.** Daftar slide di kolom Live dihapus (sama dengan daftar di Preview); kolom Live kini hanya monitor **Live Output** yang lebih besar dengan "Slide X of N" dan ‹ ›.
- **Versi baru tidak bisa tertahan lagi**: versi baru langsung aktif begitu terunduh walau jendela SAGI lain (mis. proyektor) masih terbuka. Halaman yang sedang dipakai tidak dimuat ulang sendiri; banner "Muat versi baru" muncul agar operator memuat ulang setelah ibadah.
- Tes: unit test alert (validasi, Go Live/Black/navigasi, checkpoint, otorisasi) dan backup round-trip dengan alert; E2E diperbarui ke kontrol baru dan ditambah tes Alerts, daftar slide Schedule/LIVE, serta tarik media.

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
