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

### Masuk Sinkron antar laptop: alasan penolakan jelas

- Sebelumnya setiap penolakan login ditampilkan sebagai "Email atau password salah", termasuk akun yang belum dikonfirmasi di Supabase atau terlalu banyak percobaan. Kini panel **Sinkron antar laptop** menyebut alasan sebenarnya dan cara memperbaikinya: akun belum dikonfirmasi (admin: Authentication › Users › Confirm email), email/password salah, terlalu banyak percobaan (tunggu 1–2 menit), atau server Supabase dijeda (Restore project).
- `docs/SYNC.md` punya bagian **Tidak bisa masuk?**. Semua akun yang masuk berbagi pustaka lagu yang sama; lagu dari satu laptop muncul di laptop lain setelah laptop pertama juga masuk dan tersinkron.
- Tes: unit test untuk akun belum dikonfirmasi, terlalu banyak percobaan, dan server dijeda (server tiruan menjawab seperti Supabase Auth). Dua tes E2E kini memakai `baseURL` dari konfigurasi, bukan port yang ditulis langsung.

### Preview Output dihapus; lirik Extra Bold putih bergaris hitam; ukuran, outline, dan Edit teks di bawah Live Output

- **Workspace kini hanya Jadwal Ibadah | Live Output.** Kolom Preview Output dihapus, sehingga monitor Live Output melebar (di 1440×900 kira-kira 700×394, sebelumnya 504×283). Di bawah Jadwal Ibadah ada baris info **Siap tayang**: judul item yang akan tampil saat Go Live dan "Slide X of N". Slide awal dipilih dari daftar slide item di Jadwal Ibadah. Live Output tetap hanya berubah saat Go Live diklik.
- **Tampilan lirik tetap untuk semua font dan tema: Extra Bold (800), putih, dengan outline hitam.** Montserrat dan Poppins dibundel dalam ketebalan 800; Bebas Neue (satu ketebalan) ditebalkan browser; Georgia/Times New Roman memakai Bold bawaan. Editor tema tidak lagi punya Bobot teks, Warna teks, dan Outline (warna/tebal) karena sudah tetap; tema mengatur latar, posisi, dan bayangan.
- **Satu baris di bawah Live Output:** Slide X of N · ‹ › · **Ukuran** (1–100%) · **Outline** (1–100%) · **Edit teks**. 100% ukuran = 160 px dan 100% outline = 12 px pada layar 1080p. Menggeser Ukuran/Outline langsung menyusun ulang slide yang sedang LIVE di posisi teks yang sama (mode Black/Clear Text tetap), dan nilainya tersimpan untuk semua slide berikutnya. **Edit teks** mengubah teks slide yang sedang LIVE dan langsung tampil di layar jemaat (Reset mengembalikan teks sumber; lagu di Musik tidak berubah). Teks yang tidak muat ditolak dengan pesan.
- **Pengaturan › Tipografi lirik**: Ukuran teks kini dalam persen (1–100%) dan ada slider **Outline** (1–100%); keduanya sama dengan slider di bawah Live Output.
- Fitur edit teks dan ‹ › di Preview (Apply Preview, font/ukuran per Preview) dihapus bersama Preview Output, agar tidak ada tombol ganda. Data lama tetap terbaca; backup baru menyimpan nilai outline.
- Tes: unit test tampilan lirik tetap, Edit teks LIVE (termasuk saat Black dan teks yang tidak muat), dan penyusunan ulang LIVE dengan ukuran baru di slide yang sama; E2E baris di bawah Live Output (satu baris, ukuran 75% = 120 px, outline 50% = 6 px, Edit teks + Reset, tersimpan di Pengaturan), Siap tayang tanpa tombol, dan tes lama diubah ke alur Live.

### Go Live sebagai saklar tayang; tema tetap dipakai

- **Sebelum Go Live**: lagu, item, atau slide (Verse 1, Verse 2, …) yang diklik di Jadwal Ibadah langsung tampil di panel **Live Output** dengan tanda **"Belum tayang · klik Go Live"** (bingkai oranye putus-putus). Proyektor belum berubah. Tombol ‹ › dan Edit teks di bawah panel bekerja pada slide yang tampil itu.
- **Setelah Go Live diklik**: setiap item atau slide yang diklik di Jadwal Ibadah langsung tampil di Live Output **dan** proyektor, tanpa klik Go Live lagi; tombol ‹ › mengendalikan proyektor dan sorotan di Jadwal ikut. Black / Clear Text tetap seperti semula. Lagu yang dipilih dari Musik, Media, atau Alkitab tetap menunggu Go Live.
- **Tema**: tombol kini **Terapkan ke item Live Output**. Tema tampil di panel Live Output (setelah Go Live juga di proyektor) dan **tetap dipakai** untuk lagu, ayat, atau item jadwal apa pun yang ditampilkan berikutnya, sampai tema lain dipilih (kartu tema bertanda "Dipakai"; sama dengan Default theme di Pengaturan).
- Mengubah Ukuran/Outline juga memperbarui slide yang menunggu di panel.
- Tes: unit test status "belum tayang"; E2E klik slide sebelum/sesudah Go Live, proyektor menunggu Go Live, tema tetap dipakai untuk lagu berikutnya, dan tema saat Black.

### Tambah lagu langsung tersimpan; latar video tema berputar sendiri

- **Lagu langsung tersimpan, tidak jadi draft.** Bagian lirik boleh dibiarkan kosong: bagian kosong menjadi **slide kosong** (mis. slide awal yang memang kosong). Lagu cukup punya judul dan lirik minimal di satu bagian. Draft lama ("Draft yang dapat dipulihkan") tersimpan sebagai lagu begitu dibuka lalu diklik **Simpan sekarang**. Di Jadwal Ibadah slide kosong ditulis "(slide kosong)".
- Editor lagu: **Tambahkan ke urutan** dihapus, dan tombol **Selesai** dihapus. **Simpan sekarang** menyimpan lalu menutup editor (tanpa membuat revisi baru bila tidak ada perubahan); bila judul/lirik belum ada, editor tetap terbuka dengan pesan yang kurang. Editor masih bisa ditutup dengan ✕.
- **Latar video tema berputar sendiri**, berulang dan **tanpa suara**, di panel Live Output (juga saat "Belum tayang") dan di proyektor; berhenti saat Black dan berputar lagi setelah Black dimatikan, juga setelah proyektor di-refresh atau presentasi dipulihkan. **Pause background LIVE** tetap bisa menghentikannya. Video dari tab **Media** tidak berubah: bersuara dan diputar dengan **Play LIVE**.
- Tes: unit test bagian kosong (lagu valid, slide kosong polos/bertema) dan latar video otomatis/Black/jeda operator; E2E editor satu tombol dengan slide kosong, dan latar video yang berputar sendiri.

### Video dari Media selalu bersuara

- **Video dari tab Media mulai bersuara** di proyektor (centang **Mute LIVE** tidak lagi menyala sendiri). Opsi "Mulai video tanpa suara" di Pengaturan dihapus; Mute LIVE tetap bisa dipakai kapan saja. **Latar video tema tetap selalu tanpa suara.**
- Bila Chrome menahan suara di jendela proyektor yang belum pernah diklik, video tetap diputar (sementara tanpa suara), status di bawah Live Output menampilkan "Suara menunggu satu klik di jendela proyektor (mis. tombol Fullscreen)", dan suara langsung menyala setelah satu klik di jendela proyektor.
- Tes: E2E video Media bersuara dan simulasi suara yang ditahan browser lalu menyala setelah satu klik.

### Dua bahasa: Indonesia / English

- Tombol bahasa (ikon terjemah + **ID**/**EN**) di kanan atas mengganti semua layar operator ke **English** atau kembali ke **Indonesia**: bar atas, Jadwal Ibadah, Live Output, tab Songs/Scriptures/Media/Presentations/Themes, editor lagu dan tema, sinkron antar laptop, Pengaturan (termasuk Backup & Recovery), dialog konfirmasi, serta pesan status dan error yang sering muncul. Pilihan disimpan per laptop dan diikuti jendela proyektor. Bahasa Indonesia tetap bawaan.
- Isi slide (lirik, ayat, judul lagu) tidak pernah diterjemahkan. Label teknis (aria) tetap bahasa Indonesia.
- Teks Indonesia dipakai sebagai kunci kamus (`src/i18n/en.ts`); pesan yang dibuat saat berjalan (mis. "Tersinkron 11.13 · 25 lagu", "Checkpoint tersimpan · LIVE 4") diterjemahkan dengan pola, termasuk bentuk tunggal/jamak bahasa Inggris.
- Tes: unit test memastikan setiap teks `t("…")` punya terjemahan Inggris dengan placeholder yang sama; E2E tombol bahasa (lagu dibuat dalam English, lirik tetap, pilihan bertahan setelah muat ulang).

### Sinkron Media dan Themes dengan akun yang sama

- Akun Supabase yang dipakai di **Sinkron antar laptop** kini menyinkronkan **lagu, media, dan tema** sekaligus. Gambar, video, dan PDF di Media serta tema buatan sendiri yang diimpor di satu laptop muncul di laptop lain yang masuk dengan akun gereja; media yang dihapus ikut terhapus.
- File dikirim ke Supabase Storage (bucket pribadi `sagi-media`) dalam potongan 4 MiB yang dicek SHA-256 saat diterima; file yang sama persis tidak dikirim atau diunduh dua kali. Tema bergambar/video menunggu file latarnya, lalu memakai salinan di laptop itu.
- **Admin perlu sekali menjalankan `supabase/library-sync.sql`** di Supabase › SQL Editor. Sebelum itu panel menulis "Media & Tema belum aktif di server sinkron" dan lagu tetap tersinkron. Bila penyimpanan penuh, panel memberi tahu dan media tetap aman di laptop.
- Status sinkron: "Tersinkron 10.42 · 25 lagu · 12 media · 3 tema". Keluar tetap menyimpan lagu, media, dan tema di laptop.
- File dicek per potongan tepat sebelum dikirim (sekali saja), bukan seluruh video setiap kali sinkron, supaya video LIVE tetap lancar. Salinan yang rusak di laptop pengirim tidak dikirim; panel menyebut file mana yang perlu diimpor ulang.
- Tes: 6 unit test (gambar + tema ke laptop lain, video 9 MiB dalam potongan, file sama dikenali, hapus dan potongan yang belum ada, salinan rusak tidak dikirim, server belum siap/penuh) dan E2E dua laptop (media + tema bergambar sampai di laptop kedua, gambar terbaca).

### Scriptures: satu slide per pilihan ayat dan latar ayat sendiri

- **Satu slide untuk seluruh pilihan**: memilih misalnya **Amsal 3:3–6** menampilkan ayat 3–6 sekaligus di Live Output dan proyektor, Indonesia (AYT) di kiri dan English (KJV) di kanan, tiap ayat bernomor. Huruf mengecil otomatis sampai muat (minimal 24 px pada 1080p); hanya pilihan yang terlalu panjang (mis. Mazmur 119:1–40) dibagi rata ke beberapa slide. Satu ayat panjang juga dikecilkan agar muat satu slide.
- **Latar ayat** di tab Scriptures: impor gambar/video, pilih dari Media, atau **Hitam polos**. Latar ini hanya untuk ayat; tema di Themes tidak lagi mengubah ayat, dan latar ayat tidak mengubah lagu. Video latar berputar tanpa suara. Bila ayat sedang LIVE, latar baru langsung tampil di proyektor; ayat yang belum di-Go Live tetap menunggu. Latar ayat ikut tersinkron antar laptop bersama tema.
- Diperbaiki: setelah memakai tema buatan sendiri, Live Output tidak lagi salah menampilkan "Sumber berubah/dihapus" (perbandingan tema kini memakai nomor revisi).
- Tes: unit test Amsal 3:3–6 satu slide dua kolom, ayat panjang satu slide, latar ayat vs tema; E2E Kejadian 1:3–10 satu slide dan latar ayat sampai proyektor lalu kembali hitam.

### Scriptures: baris lisensi di bawah daftar ayat dihapus

- Kalimat "AYT © YLSA · CC BY-NC-SA · KJV Public Domain" tidak lagi tampil di bawah daftar ayat di tab Scriptures. Atribusi tetap tampil di setiap slide (Live Output dan proyektor). Baris ini hanya muncul bila memakai TB/TB2/ESV dari API resmi, karena sumber itu mewajibkan pemberitahuannya.

### Slide ayat tanpa baris lisensi

- Baris "AYT © YLSA · CC BY-NC-SA · Public Domain" (juga TB/TB2/ESV) tidak lagi tampil di bawah ayat di Live Output dan proyektor. Yang tampil hanya baris referensi, mis. "Ulangan 4:4–8 · AYT · 2024" dan "Deuteronomy 4:4–8 · KJV · 1769". Data lisensi tetap tersimpan di materi dan backup.
- Ruang bawah untuk referensi diperkecil (170 → 110 px pada 1080p), jadi ayat mendapat tempat lebih besar.

### Musik: ✨ Susun Otomatis (tanpa AI)

- Tombol **Susun Otomatis** di samping **Tambah lagu**: isi judul, penyanyi/pencipta, dan lirik lengkap; bagian lagu (Verse 1, 2 …, Pre Chorus, Chorus, Post Chorus, Bridge, Intro, Instrumental, Outro) dibuat dari label di lirik, termasuk variasi seperti `[Verse 1]`, `V1`, `Bait 2`, `Reff:`, `Refrain`, `Pre-Reff`, `Chorus 2x`. Chorus yang diulang disimpan sekali dan muncul lagi di urutan.
- Lirik tanpa label dipisah per bait (baris kosong); bait yang berulang dianggap Chorus, sisanya Verse; semua tebakan bertanda "Perlu dicek". Tidak ada bagian yang dikarang, dan kata-kata lirik tidak diubah.
- Preview sebelum simpan: ubah label, edit lirik, hapus bagian, atur/ulang urutan, lalu **Simpan ke Song Library**. Tidak ada yang tersimpan sebelum tombol itu. Tidak memakai AI atau internet; tidak ada perubahan format data, backup, atau sinkron. Tambah lagu manual tetap seperti biasa.
- Tes: 8 unit test (label lengkap, lirik polos, Chorus berulang, tanpa Bridge/Intro, variasi label, lirik panjang, input kosong/CRLF, simpan–buka–presentasi) dan 2 E2E (alur lengkap sampai slide dan muat ulang; lirik tanpa label dan editor manual tetap jalan).

### Media: info penyimpanan yang jelas dan ruang dibebaskan otomatis

- Tulisan teknis di bawah daftar Media/Presentations ("Library … MiB · snapshot/tema tertahan … · payload yatim …", "Simpan file sumber …", "Tidak ada backup media otomatis") diganti satu baris jelas: "Media di laptop ini: 255.0 MB" (plus "… MB lagi masih dipakai tema/LIVE" bila ada), dan keterangan bahwa media ikut tersinkron lewat Songs › Sinkron antar laptop.
- Sisa data file dari media yang sudah dihapus kini dibersihkan otomatis (saat media dihapus dan saat tab Media dibuka), jadi tombol "Bersihkan media tanpa referensi" tidak diperlukan lagi. Media di library, serta yang masih dipakai LIVE, checkpoint, atau tema, tidak pernah ikut terhapus.
- Ukuran di kartu media memakai MB.

### Media sampai ke semua laptop: progres terlihat, versi baru terpasang sendiri

- Tab **Media** (dan Presentations) menampilkan baris sinkron: "Sinkron (email): Tersinkron … · 12 media", saat berjalan "Mengirim media: video.mp4 · 3/9 bagian" atau "Mengambil media: …", dan bila belum masuk: "Media hanya ada di laptop ini sampai Anda masuk …". Panel Sinkron di Songs menampilkan progres yang sama.
- Pengiriman dan pengambilan file berjalan 3 bagian sekaligus (lebih cepat); media terbaru dikirim lebih dulu; bila koneksi putus atau SAGI ditutup, pengiriman lanjut dari bagian yang belum terkirim.
- **Versi baru SAGI terpasang sendiri di setiap laptop**: diperiksa tiap 5 menit dan saat jendela difokuskan; dipasang otomatis setelah pemberitahuan 15 detik bila tidak ada yang LIVE, tidak ada pemulihan yang menunggu, dan jendela proyektor tertutup ("Nanti" untuk menunda). Sebelumnya perlu klik "Muat versi baru" dan pemeriksaan hanya tiap jam, sehingga laptop lain bisa tertinggal versi lama tanpa sinkron media.
- Tes: unit test (terbaru dulu, progres, lanjut setelah putus) dan E2E (gambar + video ke laptop kedua, baris sinkron di Media, pemasangan versi baru otomatis/Nanti/menunggu proyektor). Diuji juga dengan video MP4 1080p 31 MB.

### Jadwal Ibadah (Week 1–4) ikut tersinkron

- Isi dan urutan Week 1–4 (lagu, ayat, media) kini sama di semua laptop yang masuk dengan akun gereja: menambah, menghapus, mengurutkan, atau mengosongkan Week di satu laptop ikut berubah di laptop lain dalam beberapa detik. Week yang sedang aktif tetap pilihan tiap laptop.
- Lagu dikenali dari id-nya, media dari sidik file-nya, ayat dari edisi Alkitab dan nomor ayat, sehingga tiap laptop memakai salinannya sendiri. Week yang memuat media/tema yang belum sampai atau ayat dari Alkitab yang belum dipasang di laptop itu menunggu dan diberi tahu di panel sinkron.
- Saat laptop pertama kali masuk, item Week miliknya digabung di belakang item dari server tanpa dobel. Bila Week yang sama diubah di dua laptop sebelum sinkron, versi yang lebih dulu sampai ke server yang dipakai.
- **Admin perlu sekali menjalankan `supabase/schedule-sync.sql`** di Supabase › SQL Editor. Sebelum itu panel menulis "Jadwal belum aktif di server sinkron"; lagu, media, dan tema tetap tersinkron.
- Status sinkron: "… · 3 tema · 2 jadwal".
- Tes: 5 unit test (Week berisi lagu + ayat + gambar ke laptop lain dengan id Alkitab/media masing-masing, urut/hapus/kosongkan dua arah, gabung saat pertama masuk, menunggu Alkitab, server belum siap) dan E2E dua laptop (tarik lagu ke Week 1 lalu muncul di laptop lain; hapus ikut).

### Tombol Live dihapus: cukup Go Live

- Tombol **Live** di toolbar kanan atas dihapus. **Go Live** kini sekaligus membuka jendela proyektor bila belum terbuka (di layar yang dipilih lewat **Layar**), lalu menampilkan slide ke jemaat.
- Untuk membuka jendela proyektor sebelum ada slide, atau menyambungkannya lagi, pakai **Reconnect** di kiri atas (juga memakai layar yang dipilih).
- Tes: E2E diperbarui (Go Live membuka proyektor; tes lain membuka proyektor lewat Reconnect).

### Go Live selalu sampai ke proyektor

- **Diperbaiki:** setelah halaman SAGI dimuat ulang (refresh atau pembaruan), Go Live membuka jendela baru (biasanya di layar laptop) sementara jendela proyektor yang sudah terbuka tidak berubah, sehingga tampak "Go Live tidak keluar di proyektor". Kini jendela proyektor punya nama tetap: Go Live/Reconnect menemukan jendela yang masih terbuka dan menyambungkannya kembali di tempat, tanpa memuat ulang (tetap fullscreen, slide terakhir tetap tampil sampai slide baru tiba).
- **Diperbaiki:** setelah dimuat ulang, Go Live sebelumnya mati diam-diam selama banner "Checkpoint presentasi tersedia" belum dijawab. Kini Go Live tetap bisa diklik: SAGI bertanya "Buang presentasi itu dan tampilkan slide Preview ini?" lalu menampilkannya. Resume/Discard di banner tetap tersedia.
- Tes: E2E baru (Go Live → muat ulang SAGI → lagu lain → Go Live sampai ke jendela proyektor yang sama tanpa jendela baru dan tanpa reload); helper tes proyektor memakai ulang jendela yang sama.

### Proyektor otomatis di layar kedua (Extend desktop)

- Dengan laptop + proyektor/TV dalam mode **Extend desktop**, SAGI kini memilih **layar proyektor** (layar eksternal, bukan layar laptop) secara otomatis begitu Chrome diizinkan melihat layar. Cukup klik **Layar** sekali dan izinkan; setelah itu **Go Live** dan **Reconnect** selalu membuka jendela proyektor di layar itu, juga setelah SAGI dimuat ulang.
- Layar yang dipilih operator di "Layar tujuan" diingat (berdasarkan nama layar) di browser ini.
- Bila ada dua layar tetapi izin belum diberikan, setelah Go Live muncul pesan: jendela proyektor terbuka di layar laptop; klik **Layar** sekali, atau geser jendela ke layar proyektor lalu klik Fullscreen di sana. Bila hanya satu layar terdeteksi saat klik Layar, SAGI menyarankan menyambungkan HDMI dan memilih Extend desktop.
- Tes: unit test pemilihan layar (eksternal, diingat, kembali bila layar hilang) dan E2E dua layar (layar proyektor dipilih otomatis, Go Live membuka di koordinat layar proyektor, pilihan diingat; tanpa izin muncul petunjuk).

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
