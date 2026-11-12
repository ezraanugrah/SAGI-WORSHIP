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
- **Penguat volume video sampai 200%.** **Volume LIVE** (di bawah Live Output) dan **Volume default** (Pengaturan) kini bisa 0–200%. Sampai 100% memakai volume asli video seperti sebelumnya; di atas 100% suara di jendela proyektor diperkuat lewat Web Audio. Chrome baru mengizinkan penguat setelah **satu klik di jendela proyektor** (misalnya tombol Fullscreen); sebelum itu video diputar 100% dan status playback LIVE menampilkan "Volume >100% menunggu satu klik di jendela proyektor". Suara bisa pecah bila video sudah keras. Data lama tetap valid; batas volume di checkpoint/backup kini 200%.
- **Themes Library: Impor media** (seperti tab Media), untuk gambar dan video (JPG · PNG · WebP · MP4 · WebM). Satu file langsung membuka tema baru dengan file itu sebagai background (nama tema dari nama file). Beberapa file sekaligus hanya diimpor dan siap dipilih di **Buat tema › Media background**. Di editor tema juga ada **Impor media** untuk mengganti background (video selalu silent). Semua tersimpan di Media; file yang sama dipakai ulang, tidak ganda.
- (Sebelumnya) **Jadwal Ibadah | Preview | Live Output.** Daftar slide di kolom Live dihapus (sama dengan daftar di Preview); kolom Live kini hanya monitor **Live Output** yang lebih besar dengan "Slide X of N" dan ‹ ›.
- **Versi baru tidak bisa tertahan lagi**: versi baru langsung aktif begitu terunduh walau jendela SAGI lain (mis. proyektor) masih terbuka. Halaman yang sedang dipakai tidak dimuat ulang sendiri; banner "Muat versi baru" muncul agar operator memuat ulang setelah ibadah.
- Tes: unit test alert (validasi, Go Live/Black/navigasi, checkpoint, otorisasi) dan backup round-trip dengan alert; E2E diperbarui ke kontrol baru dan ditambah tes Alerts, daftar slide Schedule/LIVE, serta tarik media.

### Tab Scriptures dikosongkan: hanya Alkitab / Bible

- Semua isi tab **Scriptures** dihapus: impor dataset, pilih terjemahan/kitab/pasal, cari referensi dan teks ayat, serta **Alkitab bawaan** (KJV dan kartu TB2) yang sempat ditambahkan. File KJV bawaan dan skrip pembuatnya juga dihapus.
- Tab kini hanya berisi satu bagian kosong **Alkitab / Bible** ("Belum ada isi."), yang akan diisi kemudian.
- Mesin Scripture tidak diubah: item Scripture yang sudah ada di jadwal, checkpoint, dan backup tetap tampil, tersimpan, dan bisa dipulihkan. Data Alkitab yang sudah diimpor di perangkat tidak dihapus.
- Tes: E2E yang memakai UI tab lama dihapus (`phase4.spec.ts`, Alkitab bawaan, ekspor Scripture terbatas) atau disesuaikan (tema phase6, backup gabungan phase7). Perilaku mesinnya tetap dicakup unit test. Ada 1 E2E baru untuk bagian Alkitab / Bible.

### Alkitab / Bible dua bahasa: Indonesia kiri, English kanan

- Tab **Scriptures** kini berisi **Alkitab / Bible** lengkap Kejadian–Wahyu dalam dua bahasa: **Alkitab Yang Terbuka (AYT)** dan **King James Version (KJV)**. Klik **Pasang Alkitab** sekali (centang persetujuan non-komersial); kedua Alkitab diunduh, divalidasi, dan tersimpan offline.
- Pilih **Kitab**, **Pasal**, dan **Ayat dari–sampai** (mis. Kejadian 1:3–10), atau ketik di **Cari cepat** (`Kej 1:3-10`, `Yoh 3:16`, `Psalm 23`). Ayat tampil berdampingan: kiri Indonesia, kanan English.
- **Preview** dan **LIVE** menampilkan dua kolom: kiri AYT, kanan KJV, dengan footer "Kejadian 1:3 · AYT · 2024 | Genesis 1:3 · KJV · 1769" dan atribusi "AYT © YLSA · CC BY-NC-SA · Public Domain". Ayat panjang dipecah ke beberapa slide; teks tiap kolom tetap utuh. Berlaku juga dengan tema.
- **Tambahkan ke jadwal** memasukkan ayat ke Week aktif, atau Week 1 bila belum memilih Week (sama seperti menarik lagu).
- Kenapa bukan TB Edisi Kedua dan ESV: keduanya berhak cipta (LAI dan Crossway) dan melarang menyebarkan Alkitab lengkap tanpa izin tertulis; `mdbible-main.zip` berisi ESV. AYT (CC BY-NC-SA, YLSA) dan KJV (domain publik) boleh dipakai dan disebarkan untuk ibadah non-komersial. TB2/ESV bisa disambungkan lewat API resmi (LAI Bible API, ESV API) setelah gereja punya API key.
- Format jadwal, backup, dan restore tidak berubah: pilihan disimpan pada AYT; pasangan KJV ditambahkan saat slide disiapkan.
- Diperbaiki: backup gagal ("field/record tidak didukung") bila checkpoint LIVE berisi slide dua bahasa; validasi backup kini mengenal kolom kanan. Ada unit test backup → restore untuk kasus ini.
- Tes: unit test (kedua file lewat validator aplikasi, 31.102 ayat berpasangan, referensi dua bahasa, slide dua kolom termasuk Ester 8:9, penolakan teks kolom yang diubah, tetap satu bahasa tanpa KJV) dan 4 E2E (pasang, Kejadian 1:3–10 dua kolom sampai LIVE, cari cepat + jadwal + reload, unduhan gagal, tema).

### TB2 dan ESV lewat API resmi (API key gereja)

- Di tab **Scriptures**, panel **Sumber online: TB2 dan ESV** (di bawah tabel ayat): isi **API key LAI** (Bible API LAI) dan/atau **API key ESV** (api.esv.org), centang ketentuan masing-masing, **Simpan**, lalu **Tes TB2 / Tes ESV**. Setelah itu **Kolom kiri** bisa TB2 dan **Kolom kanan** bisa ESV.
- Hanya ayat yang dipilih yang diambil dari API, lalu tampil di tabel, Preview, dan LIVE dengan footer "Kejadian 1:3 · TB2 · 2023 | Genesis 1:3 · ESV · 2016" dan atribusi "TB2 © LAI 2023 · ESV® © Crossway · esv.org".
- Sesuai ketentuan penerbit: API key hanya disimpan di browser perangkat ini (tidak di kode, situs, atau backup); paling banyak 500 ayat per versi tersimpan, kedaluwarsa 30 hari, bisa dihapus; teks tidak diubah; checkpoint berisi TB2/ESV tidak ikut backup.
- Tanpa internet, ayat yang belum tersimpan memakai AYT/KJV, dan slide serta pesan status menyebut versinya.
- Catatan: dokumentasi Bible API LAI (Postman) sedang tidak bisa dibuka, jadi alamat dan kode versi TB2 bisa diubah dan jawaban yang tidak cocok ditolak. Belum diuji dengan API key asli.
- Tes: 9 unit test (pengaturan, cache 500 ayat, permintaan ESV/LAI, penolakan jawaban salah, penggantian kolom, tanpa peringatan "sumber berubah") dan 2 E2E dengan API tiruan.

### Media: folder pantauan untuk file baru dari laptop

- Di sidebar tab **Media** ada **Folder pantauan**: klik **Pilih folder** (mis. Downloads) sekali. Selama SagiWorship terbuka, di tab mana pun, folder itu diperiksa setiap 5 detik dan setiap kali jendela difokuskan.
- File media yang baru diunduh (JPG, PNG, WebP, MP4, WebM, PDF) langsung terdeteksi: muncul di atas grid Media dengan tanda **Baru** serta tombol **Impor** dan **Impor semua**, dan tab Media menampilkan "N baru".
- **Impor otomatis file baru** (opsional) memasukkan unduhan yang sudah selesai tanpa klik. File yang masih diunduh (`.crdownload`, `.part`, atau ukurannya masih berubah) ditunggu dulu; tiap file dicoba sekali.
- File lama di folder yang belum ada di Media bisa dilihat lewat **Lihat semua yang belum di Media**. File yang sudah ada (nama dan ukuran sama) tidak ditawarkan lagi.
- Folder diingat setelah reload; browser bisa minta izin sekali lagi setelah dibuka ulang (**Izinkan akses folder**). Aplikasi hanya membaca folder itu, dan pilihan folder tidak ikut backup. Butuh Chrome atau Edge di laptop.
- Diperbaiki: label "baru" di tab kini memakai warna oranye (sebelumnya tertimpa gaya tab).
- Tes: 4 unit test (filter file, urutan, cek sudah di Media, izin) dan 2 E2E dengan folder sungguhan di penyimpanan browser (deteksi + impor sekali klik, impor otomatis saat tab lain terbuka, folder diingat setelah reload).

### Sinkron lagu Musik antar laptop (Supabase + login)

- Tab **Songs** punya panel **Sinkron antar laptop**: masuk dengan email + password akun gereja. Lagu yang ditambah, diubah, atau dihapus di Musik pada satu laptop ikut berubah di laptop lain yang memakai web SagiWorship, dalam beberapa detik.
- Tetap offline-first: setiap laptop menyimpan salinan sendiri; tanpa internet semua tetap jalan dan perubahan dikirim saat online lagi. Sinkron otomatis saat dibuka, tiap 15 detik, 2 detik setelah lagu berubah, saat jendela difokuskan, dan saat internet kembali; ada tombol **Sinkron sekarang** dan **Keluar**.
- Tidak ada yang tertimpa diam-diam: setiap lagu punya nomor versi di server. Bila lagu yang sama diubah di dua laptop, versi server dipakai dan versi laptop ini disimpan sebagai "… (salinan laptop ini)". Penghapusan ikut tersinkron; perubahan di laptop lain yang belum tahu soal penghapusan akan mengembalikan lagu itu.
- Server: Supabase milik gereja dengan tabel `songs` dan Row Level Security (hanya akun yang masuk); skrip `supabase/songs-sync.sql`, panduan admin di `docs/SYNC.md`. Aplikasi membaca `VITE_SYNC_URL` dan `VITE_SYNC_KEY` (kunci publik/anon) dari Vercel; tanpa itu panel menampilkan "Belum disiapkan".
- Sesi login dan catatan sinkron disimpan di browser laptop itu, tidak ikut backup. Yang disinkronkan baru lagu; Week, ayat, media, dan tema belum.
- Tes: 8 unit test dengan server Supabase tiruan (login, refresh token, offline, tambah/ubah/hapus antar dua laptop, bentrok, perubahan di tengah sinkron, edit menang atas hapus, gabung dua pustaka, data server rusak dilewati) dan 2 E2E dengan dua profil browser.

### ESV lewat esv.org

- Panel **Sumber online** kini menaruh **ESV · esv.org (Crossway)** paling atas, dengan langkah bernomor dan tautan langsung: buat akun gratis di esv.org, buat aplikasi di api.esv.org untuk mendapatkan API key, lalu tempel, centang ketentuan, Simpan, dan Tes.
- Di samping perikop yang dipilih ada tautan **esv.org ↗** (mis. `https://www.esv.org/Genesis+1:3-10/`) untuk membuka atau membandingkan perikop di esv.org; baris atribusi menautkan ke www.esv.org bila ESV dipakai, sesuai ketentuan ESV API.
- Teks penjelasan panel dipersingkat.
- Dicek: `esv-api-master.zip` adalah pembungkus untuk ESV API **versi 2** (`esvapi.org/v2`, key "IP"), yang sudah dihentikan Crossway (HTTP 410) dan dialihkan ke api.esv.org. SagiWorship sudah memakai versi terbarunya (v3), jadi tidak dipakai.
- Tes: unit test tautan esv.org; E2E memeriksa tautan perikop, tautan pembuatan API key, dan www.esv.org.

### Preview menampilkan rentang ayat bersama, dan TB dari Alkitab SABDA

- **Rentang ayat tampil bersama.** Pilih misalnya Bilangan 4:4–7 lalu **Preview**: keempat ayat muncul dalam satu slide, masing-masing diberi nomor kecil (⁴ ⁵ ⁶ ⁷), di kedua kolom. Huruf otomatis mengecil secukupnya (paling kecil setengah ukuran normal) dan memakai tinggi layar penuh. Rentang yang terlalu panjang dibagi ke sesedikit mungkin slide dengan jumlah ayat yang seimbang; kolom Indonesia dan Inggris selalu memuat ayat yang sama. Footer menyebut rentangnya: "Bilangan 4:4–7 · AYT · 2024 | Numbers 4:4–7 · KJV · 1769". Slide yang berisi satu ayat tetap seperti sebelumnya (teks persis, ukuran normal, dipecah bila terlalu panjang).
- **TB dari Alkitab SABDA.** Kolom kiri kini bisa **TB · online (Alkitab SABDA)**, tanpa API key: centang persetujuan, klik **Pakai TB**, lalu **Tes TB**. Hanya perikop yang dipilih yang diambil dari API passage SABDA (lewat alamat `/api/sabda` milik situs ini), paling banyak 500 ayat tersimpan, dengan atribusi "TB © LAI 1974". Sesuai kebijakan teks LAI, kutipan untuk ibadah non-komersial (tidak lebih dari 1.000 ayat, bukan satu kitab utuh) tidak memerlukan izin tertulis. TB lengkap tetap tidak dibundel.
- Tautan **sabda.org ↗** membuka pasal yang dipilih di sabda.org (format `https://sabda.org/alkitab/tb/?kitab=4&pasal=4`).
- Tes: unit test pengepakan ayat (kedua kolom sama, footer rentang, semua ayat tercakup, ukuran huruf per slide di backup) dan SABDA (alamat, XML, penolakan kitab/pasal salah, kolom kiri TB); E2E Bilangan 4:4–7 dalam satu slide, Mazmur 119:1–40 bersambung, dan TB SABDA dengan server tiruan.

### Tab Media hanya gambar dan video; video LIVE lebih lancar

- **Tab Media hanya untuk gambar (JPG, PNG, WebP) dan video (MP4, WebM).** Kategori PDF dihapus (tinggal Semua media · Gambar · Video), dialog impor hanya menawarkan gambar/video, dan PDF yang tetap dipilih ditolak dengan pesan "PDF diimpor di tab Presentations" sebelum file dibaca. PDF presentasi tetap di tab **Presentations** (data PDF lama tidak dihapus, hanya pindah tampil di sana). Folder pantauan Media juga hanya mendeteksi gambar/video.
- Kartu media menampilkan jenis dan durasi/ukuran ("Video · 0:40 · 58.4 MiB", "Gambar · 1920×1080 · …"), bukan "1 halaman".
- **Video tidak tersendat saat operator bekerja.** Sebelumnya setiap Preview/Go Live membaca ulang dan meng-hash seluruh file video, bersamaan dengan proyektor yang sedang memutar (jendela proyektor berbagi proses browser dengan jendela operator). Kini tiap file diverifikasi sekali per jendela, probe decode tidak diulang, dan hash diproses 4 potongan sekaligus. Diukur dengan Chrome pada video 1080p60 228 MB: Preview 1,8 → ±0,85 detik, Go Live 1,7 → ±1,0 detik, Preview ulang saat video LIVE berjalan 2,0 → 0,13 detik, frame drop di proyektor 5 → 0. Jendela proyektor tetap memverifikasi sendiri sebelum menampilkan (media rusak tetap ditolak).
- Video yang berat (di atas 1080p atau di atas 25 Mbps) diberi peringatan saat impor dan di detail media, dengan saran memakai MP4 H.264 1080p.
- Tes: unit test filter tab dan folder pantauan; E2E impor PDF lewat Presentations dan penolakan PDF di tab Media.

### Editor lagu: simpan tidak gagal lagi, kolom lebih sedikit

- **Diperbaiki: "Gagal menyimpan: Draft tidak valid".** Muncul bila kotak label bagian dikosongkan (mis. saat mengganti "Verse 1"), dan lagu tidak bisa disimpan atau ditutup. Draft kini boleh berisi label kosong, dan saat disimpan label kosong diisi dari jenis bagian. Pesan draft menyebut yang masih kurang, mis. "Isi judul lagu dan lirik bagian 2 untuk menyimpan lagu."
- Editor lagu kini hanya meminta **Judul lagu** dan **Penyanyi / pencipta**; kolom Kategori dan Bahasa dihapus (nilai lama tetap tersimpan di data, backup, dan sinkron).
- Kotak **Label bagian** dihapus. **Jenis bagian** dipilih dari: Intro, Verse 1, Verse 2, Pre Chorus, Chorus, Bridge; nama itu yang tampil di urutan dan slide. **Tambah bagian** memilih bagian berikutnya yang belum dipakai. Lagu lama dengan nama lain (mis. "Ending", "Reff") tetap tampil dengan namanya sampai diganti. Format data tidak berubah (Pre Chorus disimpan dengan jenis Chorus), jadi backup dan sinkron dengan laptop versi lama tetap jalan.
- Tes: unit test label kosong, pesan draft, dan pilihan bagian; E2E editor dua kolom dan pilihan bagian.

### Live Output sama dengan Preview Output; tab Themes disederhanakan

- **Live Output kini sama persis dengan Preview Output**: ukuran dan posisi monitor sama (sebelumnya monitor Live bergeser karena kotak kontrol video yang tinggi), footer sama ("Slide X of N" + ‹ ›), dan kontrol video LIVE dipadatkan dalam satu baris (Play LIVE · Pause LIVE · Loop · Mute · Volume). Status pemutaran tampil di footer, mis. "Playing · 0:12 / 0:40".
- **Video di Live Output ikut berjalan** (tanpa suara) bersama proyektor dan menyesuaikan posisinya dengan laporan proyektor (selisih paling banyak ±1 detik), tidak lagi diam di frame pertama. Diukur dengan video 1080p60 228 MB: proyektor tetap 0–1 frame drop dari ±585 frame.
- **Tab Themes**: Cari tema, Filter tema, Buat tema, dan bagian detail lama (Edit / rename, Duplikasi, Terapkan ke item Preview, Terapkan ke semua teks Preview, Jadikan default persiapan, Hapus tema, Item jadwal untuk tema) dihapus. Tema dibuat lewat **Impor media**: satu file membuka editor tema, beberapa file langsung menjadi tema masing-masing (nama dari nama file).
- Detail tema kini hanya punya satu tombol: **Terapkan ke item Preview + Live Output**. Tema dipasang pada item Preview lalu Live Output langsung ikut berganti tanpa klik Go Live. Bila layar sedang Black atau Clear Text, mode itu dipertahankan (tema baru tampil setelah Black/Clear dimatikan).
- Background video tema juga diverifikasi sekali per jendela (sebelumnya di-hash ulang pada setiap Preview lagu bertema).
- Data tema lama, tema pada item jadwal, dan tema default tetap tersimpan dan tetap dipakai; hanya tombol pengelolaannya yang dihapus dari tampilan.
- Tes: unit test Go Live yang mempertahankan Black/Clear; E2E Live Output = Preview Output, video Live ikut berjalan, satu tombol tema ke Preview + Live (termasuk saat Black), dan semua tes tema kini membuat tema lewat Impor media.

### Lirik terpisah dari latar tema, 5 font lirik, latar selalu memenuhi 16:9

- **Lirik dan latar tema tidak lagi disatukan.** Font, ukuran, safe margin, dan jumlah baris lirik selalu diambil dari **Pengaturan › Tipografi lirik** (sebelumnya "Tipografi default"), untuk semua slide dengan atau tanpa tema. Jadi ukuran lirik bisa dibuat besar (sampai 120 px) di tema apa pun. Tema hanya mengatur latar serta tampilan teks di atasnya (warna, tebal, rata, outline, bayangan). Editor tema tidak lagi punya Font tema, Ukuran tema, Ukuran minimum, Text fitting, Maksimum baris, dan Margin.
- **Font lirik hanya lima: Montserrat, Poppins, Bebas Neue, Georgia, Times New Roman.** Montserrat, Poppins, dan Bebas Neue dibundel di aplikasi (lisensi OFL, paket @fontsource) dan ikut tersimpan offline, jadi tampil sama di proyektor tanpa internet. Georgia dan Times New Roman memakai font bawaan macOS/Windows. Font lama (Arial, Verdana) di data/backup tetap terbaca dan digambar sebagai Montserrat; default baru Montserrat. Font dimuat sebelum teks diukur agar pembagian slide tepat. Montserrat lebih lebar daripada Arial, jadi rentang ayat panjang bisa butuh satu slide lagi (mis. Kejadian 1:3–10 dua bahasa kini 2 slide; Bilangan 4:4–7 tetap 1 slide); pilih Times New Roman atau Georgia bila ingin lebih padat.
- **Latar gambar/video tema selalu memenuhi output 16:9**, di tengah, tanpa pengaturan: gambar atau video dengan ukuran apa pun (mis. 862×485 atau 1200×719) dipotong seperlunya, tidak pernah gepeng atau berbingkai hitam. Kontrol Background fit dan Fokus x/y dihapus (Dim background tetap).
- Slider Ukuran teks dan Safe margin di Pengaturan kini punya label untuk pembaca layar.
- Tes: unit test gaya lirik global pada tema (ukuran, font, margin, tanda tangan tema) dan daftar font; E2E Poppins 100 px tetap dipakai di Preview dan Live Output bertema, latar `object-fit: cover`, dan editor tema tanpa kolom font/ukuran/fit.

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
