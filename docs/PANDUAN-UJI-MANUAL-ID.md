# Panduan uji manual SAGI WORSHIP untuk operator MacBook

Status rilis: **HOLD — belum dinyatakan siap produksi.** Dokumen ini adalah lembar kerja; **belum ada uji manual di bawah yang dinyatakan lulus**. Hasil otomatis Phase 8 tidak menggantikan pemeriksaan fisik.

## Sebelum mulai

1. Lakukan di luar ibadah. Siapkan MacBook dengan charger dan bahan latihan yang boleh digunakan: dua lagu buatan sendiri, dataset Scripture berformat `sagi-scripture` v1 yang berizin, PNG/JPG, MP4 H.264/AAC, WebM VP8/Vorbis, dan PDF dua halaman. Bukan semua MP4/WebM pasti kompatibel. Jika dataset belum tersedia, tandai uji Scripture **BLOCKED**, jangan unduh terjemahan sembarang.
2. Buka Chrome. Dari ikon profil, pilih tambah profil baru tanpa masuk akun/sinkronisasi; beri nama **SAGI QA A**. Buat profil kedua **SAGI QA B** untuk tujuan restore. Label menu mengikuti bahasa Chrome. Jangan gunakan profil kerja/ibadah, Guest, atau Incognito untuk uji persistensi ini. Pastikan ikon/nama profil benar sebelum setiap langkah.
3. Gunakan salinan data latihan saja. Semua aksi simpan/edit/hapus/restore dalam panduan berlaku **hanya di dua profil QA tersebut**. Jangan memilih Reset, clear site data, unregister service worker, repair, migrasi atau pembersihan storage pada profil mana pun.
4. Gunakan build yang sudah diuji. Jika server lokal sudah berjalan, minta teknisi memastikan alamat dan build yang benar. Jangan membuat build ulang, menjalankan `npm install`, mengganti `dist`, atau memakai server development untuk mengklaim hasil produksi.
5. Jika belum ada server, teknisi/operator yang memahami Terminal dapat menjalankan server untuk **dist yang sudah ada**, tanpa rebuild:

   ```sh
   cd /Users/macbookpro/Documents/SAGI
   npm run preview -- --port 4174 --strictPort
   ```

   Biarkan Terminal terbuka. Dalam profil QA, buka `http://127.0.0.1:4174/`. Jika port dipakai atau build tidak dapat dikonfirmasi, hentikan dan minta teknisi; jangan menghentikan server lain atau mengganti alamat diam-diam. Alamat/protokol/port berbeda mempunyai storage berbeda.
6. Buat folder bukti, misalnya `SAGI-QA-2026-11-02`, di lokasi pilihan operator. Screenshot Mac: Shift–Command–3 atau Shift–Command–4. Foto proyektor harus memperlihatkan seluruh layar. Rekam suara/video pendek jika menguji audio. Hindari materi pribadi dan jangan unggah bukti otomatis.

**Catatan sesi:** tanggal/jam ______; operator ______; MacBook/RAM/macOS ______; Chrome/versi ______; profil/alamat ______; identitas build yang dikonfirmasi teknisi ______; proyektor/kabel/dock/resolusi ______; jalur audio ______.

**Cara mengisi:** centang hanya satu hasil per uji setelah dilakukan. PASS berarti seluruh hasil yang diharapkan terpenuhi. FAIL berarti ada penyimpangan; tulis langkah dan hasil aktual. Gunakan BLOCKED jika perangkat/file/build belum tersedia, atau BELUM DIUJI jika belum dikerjakan. Jangan mengisi PASS berdasarkan perkiraan. Nama bukti disarankan `ID-tanggal-deskripsi`.

**Tanda perangkat:** **TANPA PROYEKTOR** dapat dilakukan dengan layar MacBook dan jendela output biasa. **PROYEKTOR FISIK** perlu perangkat nyata. **AUDIO EKSTERNAL** perlu HDMI atau perangkat USB/mixer; speaker MacBook tidak membuktikan jalur tersebut.

## A. Membuka aplikasi dan penggunaan offline

### A01 — Membuka build yang benar · TANPA PROYEKTOR

**Langkah:** 1) Pastikan profil SAGI QA A. 2) Buka alamat yang dikonfirmasi. 3) Buka Dashboard, lalu Pengaturan, lalu kembali ke Dashboard. 4) Catat identitas build dari teknisi; jangan menebaknya dari tampilan atau metadata versi 0.7.0 saja.

**Hasil yang diharapkan:** aplikasi terbuka tanpa halaman kosong/error; navigasi dapat dipakai. Profil QA baru tidak menampilkan koleksi pribadi dari profil ibadah. Identitas build dan alamat tercatat.

**Hasil:** [ ] PASS [ ] FAIL [ ] BLOCKED [ ] BELUM DIUJI

**Bukti:** screenshot Dashboard dan alamat/profil; identitas build; pesan error jika ada. Berkas/catatan aktual: ______.

### A02 — Menyimpan lalu membuka offline · TANPA PROYEKTOR

**Langkah:** 1) Selesaikan B01–B05 dan pastikan semua simpan selesai. 2) Saat masih online, tunggu indikator shell offline siap; reload satu kali. 3) Matikan Wi-Fi dan putuskan Ethernet/hotspot bila ada. 4) Tutup semua jendela SAGI pada profil QA A, buka lagi alamat yang sama. 5) Buka lagu, jadwal, Scripture dan media latihan; siapkan Preview. 6) Aktifkan jaringan kembali setelah bukti disimpan.

**Hasil yang diharapkan:** shell dan materi yang sudah tersimpan tersedia offline. Lagu/jadwal tetap ada. PDF/Scripture/media latihan dapat disiapkan tanpa unduhan tambahan. Tidak ada koleksi yang hilang. Jika hanya sebagian materi diuji, catat cakupan; jangan klaim seluruh tipe lulus.

**Hasil:** [ ] PASS [ ] FAIL [ ] BLOCKED [ ] BELUM DIUJI

**Bukti:** screenshot jaringan offline, aplikasi setelah dibuka ulang, daftar materi dan Preview. Catatan: ______.

## B. Songs, Scriptures, Media, Themes dan Schedules

### B01 — Lagu dan pengulangan bagian · TANPA PROYEKTOR

**Langkah:** 1) Klik **Tambah lagu**. 2) Isi judul `QA Lagu Satu`, lirik Verse `Latihan damai café é — 漢字 😀`. 3) Klik **Tambah bagian**, pilih Chorus dan isi `Latihan chorus`. 4) Gunakan **Tambahkan ke urutan** sehingga urutannya Verse–Chorus–Verse. 5) Tunggu **Tersimpan lokal**, klik **Selesai**. 6) Cari judul, buka lagi, lalu reload dan periksa urutan. Buat `QA Lagu Dua` dengan lirik berbeda.

**Hasil yang diharapkan:** isi dan pengulangan tersimpan; kedua judul dapat dicari. Teks sumber tidak berubah menjadi karakter rusak. Kehadiran teks belum membuktikan semua glyph/font terbaca di proyektor; periksa lagi C03.

**Hasil:** [ ] PASS [ ] FAIL [ ] BLOCKED [ ] BELUM DIUJI

**Bukti:** screenshot editor/urutan sebelum dan sesudah reload. Catatan: ______.

### B02 — Scripture berizin dan atribusi · TANPA PROYEKTOR

**Langkah:** 1) Buka tab **Alkitab**; pilih file pada **File dataset Alkitab**. 2) Baca metadata dan lisensi. Centang pernyataan hak penggunaan hanya jika benar, lalu **Konfirmasi dan impor**. 3) Pilih **Terjemahan**, kitab/pasal yang tersedia. 4) Isi **Referensi ayat** dengan referensi yang benar-benar ada dalam dataset; klik **Cari referensi**. 5) Pilih beberapa ayat yang menghasilkan lebih dari satu slide, lalu **Preview ayat**. 6) Buka setiap slide Preview dan bandingkan dengan sumber.

**Hasil yang diharapkan:** teks persis sesuai dataset; urutan benar; setiap lanjutan menampilkan referensi, edisi dan atribusi. Tidak ada teks ayat yang ditulis ulang oleh operator. Dataset yang gagal validasi ditolak dengan pesan, bukan dianggap berhasil.

**Hasil:** [ ] PASS [ ] FAIL [ ] BLOCKED [ ] BELUM DIUJI

**Bukti:** metadata/lisensi tanpa informasi pribadi, referensi terpilih, screenshot setiap lanjutan dan catatan perbandingan teks. Catatan: ______.

### B03 — Gambar, video dan PDF · TANPA PROYEKTOR

**Langkah:** 1) Buka **Media**, klik **Impor media**. 2) Pilih gambar, MP4, WebM dan PDF latihan. 3) Catat laporan setiap file; pilih kartu lalu **Preview media**. 4) Untuk PDF, isi **Halaman PDF** dengan `1-2`, lalu Preview. 5) Untuk video, jalankan kontrol Preview sebentar, pause dan periksa metadata. 6) Reload dan pastikan file tetap tercatat.

**Hasil yang diharapkan:** tipe yang dapat didekode muncul dan dapat disiapkan; kedua halaman PDF terlihat sesuai sumber. File yang tidak kompatibel menghasilkan pesan jelas. Tidak ada halaman kosong yang dianggap sukses. Playback Preview belum membuktikan audio/video LIVE fisik lulus.

**Hasil:** [ ] PASS [ ] FAIL [ ] BLOCKED [ ] BELUM DIUJI

**Bukti:** nama/ukuran/durasi/codec file, laporan impor, screenshot gambar dan halaman PDF 1/2. Catatan: ______.

### B04 — Tema custom · TANPA PROYEKTOR

**Langkah:** 1) Siapkan lagu pada Preview. 2) Buka **Tema**, klik **Buat tema**. 3) Isi **Nama tema** `QA Tema Amber`; pilih solid/gradient dan tipografi yang jelas. 4) Klik **Simpan tema**. 5) Pilih tema itu dan gunakan **Terapkan ke item Preview**. 6) Klik **Edit / rename tema**, ubah pengaturan tetapi jangan simpan; periksa bahwa tema tersimpan tetap seperti sebelumnya. 7) Tutup editor dengan pilihan membuang perubahan latihan jika diminta, lalu reload.

**Hasil yang diharapkan:** tema tersimpan dapat ditemukan; Preview memakai tema yang dipilih. Perubahan editor yang belum disimpan tidak diam-diam mengubah tema tersimpan. Langkah ini belum mengubah audience tanpa **Go Live**.

**Hasil:** [ ] PASS [ ] FAIL [ ] BLOCKED [ ] BELUM DIUJI

**Bukti:** screenshot tema tersimpan dan Preview; catatan sebelum/sesudah reload. Catatan: ______.

### B05 — Jadwal campuran dan pengulangan · TANPA PROYEKTOR

**Langkah:** 1) Klik **Buat jadwal**, isi **Nama jadwal** `QA Ibadah`, lalu **Simpan jadwal**. 2) Tambahkan `QA Lagu Satu`, `QA Lagu Dua`, lalu `QA Lagu Satu` lagi dengan **Ke jadwal** pada masing-masing lagu. 3) Tambahkan pilihan Scripture dan media melalui **Tambahkan ayat ke jadwal** / **Tambahkan media ke jadwal** pada tab terkait. 4) Naikkan/turunkan item dengan tombol panah urutan. 5) Duplikasi jadwal lewat kontrol **Duplikasi jadwal**. 6) Reload dan cocokkan kedua urutan.

**Hasil yang diharapkan:** urutan/repetisi bertahan. Jadwal duplikat berdiri sendiri; mengubah urutan duplikat tidak mengubah jadwal asal. Materi sumber tidak terhapus saat item jadwal latihan dihapus.

**Hasil:** [ ] PASS [ ] FAIL [ ] BLOCKED [ ] BELUM DIUJI

**Bukti:** screenshot urutan asli/duplikat dan daftar materi pembanding setelah reload. Catatan: ______.

### B06 — Usulan cakupan PPTX pertama · TANPA PROYEKTOR

**Langkah:** 1) Dari PowerPoint/LibreOffice yang sudah tersedia, ekspor presentasi latihan menjadi PDF atau gambar per slide. 2) Impor hasil ekspor melalui **Media**. 3) Preview semua halaman/gambar dan bandingkan dengan slide sumber. Jangan memasang renderer atau mengimpor PPTX langsung sebagai syarat lulus.

**Hasil yang diharapkan:** hasil statis PDF/gambar terbaca sesuai perbandingan; catat perbedaan font/layout. Animasi, transisi, media tertanam dan edit slide PPTX tidak dijanjikan. **Cakupan fallback ini masih menunggu persetujuan final pengguna**, meskipun uji file ekspornya lulus.

**Hasil:** [ ] PASS [ ] FAIL [ ] BLOCKED [ ] BELUM DIUJI

**Bukti:** screenshot sumber dan hasil impor tiap slide, format ekspor dan perbedaan. Catatan: ______.

## C. Preview/LIVE dan proyektor eksternal

### C01 — Pemisahan Preview dan LIVE · TANPA PROYEKTOR

**Langkah:** 1) Pilih `QA Lagu Satu` untuk Preview. 2) Klik **Open Projector Window**; biarkan output di layar MacBook. Izinkan popup jika diminta. 3) Klik **Go Live**. 4) Pilih `QA Lagu Dua` untuk Preview; ubah teks sementara dan klik **Apply Preview**. 5) Sebelum menekan Go Live, bandingkan dua jendela. 6) Klik Go Live untuk menampilkan pilihan baru.

**Hasil yang diharapkan:** output baru mulai hitam sampai menerima keadaan lengkap. Mengubah Preview tidak mengubah LIVE. Output berubah ke pilihan baru hanya setelah perintah publikasi. Status sinkron bukan bukti perangkat proyektor menyala.

**Hasil:** [ ] PASS [ ] FAIL [ ] BLOCKED [ ] BELUM DIUJI

**Bukti:** rekaman dua jendela sebelum/sesudah Go Live. Catatan: ______.

### C02 — Sambungan layar dan fullscreen · PROYEKTOR FISIK

**Langkah:** 1) Sambungkan proyektor/dock. Di **System Settings → Displays** macOS (nama lokal dapat berbeda), pilih extended display, bukan mirror. 2) Pilih resolusi nyata 1920×1080, lalu 1280×720 jika perangkat mendukung. 3) Buka output dan pindahkan ke proyektor; **Pilih layar (opsional)** boleh dipakai jika izin tersedia. 4) Klik **Fullscreen Projector**; jika ditolak, klik **Fullscreen** langsung di output. 5) Tekan Escape dan masuk fullscreen lagi.

**Hasil yang diharapkan:** operator tetap di MacBook; audience hanya melihat output. Rasio/margin tidak terpotong. Fullscreen ditolak tidak merusak gambar; penempatan manual dapat dipakai. Resolusi yang tidak didukung dicatat BLOCKED, bukan PASS.

**Hasil:** [ ] PASS [ ] FAIL [ ] BLOCKED [ ] BELUM DIUJI

**Bukti:** foto seluruh layar pada tiap resolusi, screenshot pengaturan display, model proyektor/dock/kabel, pesan izin. Catatan: ______.

### C03 — Keterbacaan dan atribusi di ruangan · PROYEKTOR FISIK

**Langkah:** 1) Presentasikan jadwal B05. 2) Coba Arial/Georgia/Verdana, font/margin yang akan digunakan, serta latar terang/gelap. 3) Periksa dari kursi terjauh. 4) Periksa karakter B01 dan setiap lanjutan Scripture B02. 5) Uji **Fit** dan **no-upscale** dari Pengaturan, siapkan Preview baru lalu Go Live; pengaturan tidak boleh diam-diam mengubah LIVE lama.

**Hasil yang diharapkan:** teks, referensi dan atribusi terbaca; tidak terpotong atau tertutup overscan. Tidak ada glyph kotak/hilang. Perubahan pengaturan baru berlaku pada persiapan/publikasi berikutnya.

**Hasil:** [ ] PASS [ ] FAIL [ ] BLOCKED [ ] BELUM DIUJI

**Bukti:** foto dari depan/belakang ruangan, ukuran font/margin/resolusi dan daftar karakter gagal. Catatan: ______.

### C04 — Sambung ulang dan recovery eksplisit · TANPA PROYEKTOR; ULANGI DENGAN PROYEKTOR

**Langkah:** 1) Saat LIVE, tunggu status checkpoint tersimpan. 2) Refresh jendela output; periksa sinkronisasi kembali. 3) Tutup output, klik **Open Projector Window** untuk membukanya lagi. 4) Tutup output lama, reload operator. 5) Periksa tawaran **Resume presentasi** / **Discard checkpoint** sebelum memilih Resume. 6) Buka output baru; ulangi dengan video yang sebelumnya dimainkan.

**Hasil yang diharapkan:** tidak ada auto-resume/takeover. Konten checkpoint pulih setelah keputusan eksplisit; video/background tetap paused. Output baru mulai hitam sampai keadaan valid diterima. Catat checkpoint dapat tertinggal dari posisi playback terakhir.

**Hasil layar Mac:** [ ] PASS [ ] FAIL [ ] BLOCKED [ ] BELUM DIUJI · **Hasil proyektor:** [ ] PASS [ ] FAIL [ ] BLOCKED [ ] BELUM DIUJI

**Bukti:** rekaman refresh/reopen/Resume, status checkpoint dan video paused. Catatan: ______.

## D. Audio HDMI/USB dan playback video

### D01 — Jalur audio dan kontrol LIVE · AUDIO EKSTERNAL

**Langkah:** 1) Turunkan volume awal, pilih output HDMI atau USB yang benar di **System Settings → Sound → Output**; catat nama perangkat. 2) Preview video bersuara, lalu Go Live. 3) Pastikan video masuk paused, klik **Play LIVE**. Jika browser menolak audio, ikuti izin/gesture langsung di output, lalu kirim Play baru. 4) Uji Pause, Mute, volume 0/50/100%, Loop on/off. 5) Ulangi seluruh langkah untuk jalur HDMI dan USB yang akan dipakai; jangan mengganti perangkat saat ibadah untuk eksperimen.

**Hasil yang diharapkan:** suara keluar lewat jalur terpilih; monitor LIVE operator tidak membuat suara ganda. Tidak ada bunyi saat paused/mute/volume nol; tidak clipping pada level kerja yang disepakati. Perangkat yang tidak tersedia tetap BLOCKED. Speaker internal hanya uji awal, bukan kelulusan HDMI/USB.

**HDMI:** [ ] PASS [ ] FAIL [ ] BLOCKED [ ] BELUM DIUJI · **USB:** [ ] PASS [ ] FAIL [ ] BLOCKED [ ] BELUM DIUJI

**Bukti:** rekaman audio/video, screenshot jalur audio, codec/durasi dan level mixer/volume. Catatan: ______.

### D02 — Codec, akhir video dan background · TANPA PROYEKTOR UNTUK UJI AWAL; FINAL DENGAN PROYEKTOR/AUDIO

**Langkah:** 1) Uji MP4 H.264/AAC dan WebM VP8/Vorbis serta setiap codec produksi yang direncanakan. 2) Mainkan setiap file sampai selesai, bukan hanya frame awal. 3) Uji Loop, pause dan lanjut. 4) Terapkan tema background video latihan pada teks, Go Live dan mainkan background melalui kontrol background. 5) Refresh output dan lakukan C04.

**Hasil yang diharapkan:** tidak macet/error decoder; akhir video menahan frame terakhir bila Loop mati, tidak otomatis berpindah jadwal. Background video selalu senyap. Refresh/recovery tidak memulai gerakan atau suara otomatis. File gagal dicatat FAIL untuk kombinasi itu, tidak digeneralisasi ke semua container.

**Hasil awal Mac:** [ ] PASS [ ] FAIL [ ] BLOCKED [ ] BELUM DIUJI · **Hasil fisik:** [ ] PASS [ ] FAIL [ ] BLOCKED [ ] BELUM DIUJI

**Bukti:** daftar container/codec/resolusi/fps/durasi, waktu macet dan video akhir/Loop/recovery. Catatan: ______.

### D03 — Latihan panjang · PROYEKTOR FISIK + AUDIO EKSTERNAL

**Langkah:** 1) Jalankan jadwal representatif minimal empat jam atau dua kali durasi ibadah yang direncanakan, pilih yang lebih lama. 2) Setiap 30 menit catat respons Next/Black, kelancaran video/audio, suhu/kipas, CPU/memori proses di Activity Monitor. 3) Selama latihan, siapkan Preview baru dan lakukan transisi normal. Jangan sengaja memenuhi disk atau mematikan daya MacBook.

**Hasil yang diharapkan:** tidak ada hang, audio putus/berganda, salah urutan atau kontrol penting tidak responsif. Jika memori terus naik atau kontrol melambat, catat FAIL untuk investigasi; satu angka memori saja bukan bukti kebocoran. Batas kapasitas rilis belum ditentukan oleh sampel otomatis 46,5 MiB.

**Hasil:** [ ] PASS [ ] FAIL [ ] BLOCKED [ ] BELUM DIUJI

**Bukti:** waktu mulai/selesai, tabel observasi 30-menitan, Activity Monitor dan rekaman masalah. Catatan: ______.

## E. Emergency Black, Clear Text dan Restore

### E01 — Kontrol darurat · TANPA PROYEKTOR UNTUK UJI AWAL; FINAL DENGAN PROYEKTOR/AUDIO

**Langkah:** 1) Go Live teks dengan background. 2) Klik **Clear Text**, lalu **Restore**. 3) Mainkan video bersuara; klik **Emergency Black** di header, lalu **Restore**. 4) Ulangi Black saat background video bergerak. 5) Dari Pengaturan, ulangi Emergency Black pada LIVE yang aktif. Jangan menekan End Session sebagai pengganti Black.

**Hasil yang diharapkan:** Clear Text menyembunyikan teks/footer, mempertahankan background; media mandiri tetap terlihat. Black membuat output hitam, mem-pause dan membisukan video/background yang terhubung. Restore mengembalikan visual, tetapi playback tetap paused sampai Play eksplisit. Posisi/jadwal tidak dihapus. Black bukan bukti sesi restore sudah diakhiri.

**Hasil awal Mac:** [ ] PASS [ ] FAIL [ ] BLOCKED [ ] BELUM DIUJI · **Hasil fisik:** [ ] PASS [ ] FAIL [ ] BLOCKED [ ] BELUM DIUJI

**Bukti:** rekaman layar proyektor beserta audio sebelum/Black/Restore, waktu respons yang diamati. Catatan: ______.

### E02 — Shortcut dan fokus editor · TANPA PROYEKTOR

**Langkah:** 1) Klik area kosong panel kontrol LIVE agar fokus berada di panel. 2) Coba ←, →, Space, B, lalu C. Gunakan tombol Restore untuk mengembalikan normal. 3) Klik kolom pencarian/editor, ketik `b c` dan gunakan tombol panah. 4) Gunakan Tab/Shift–Tab untuk mencapai kontrol, perhatikan fokus dan labelnya.

**Hasil yang diharapkan:** shortcut presentasi bekerja dalam konteks LIVE; saat mengetik, huruf tidak menjadi perintah Black/Clear Text. Fokus terlihat, tombol penting dapat dicapai. Hasil ini tidak menggantikan uji VoiceOver lengkap.

**Hasil:** [ ] PASS [ ] FAIL [ ] BLOCKED [ ] BELUM DIUJI

**Bukti:** rekaman fokus dan kedua jendela, urutan tombol yang tidak dapat dicapai. Catatan: ______.

### E03 — Gangguan kabel/output · PROYEKTOR FISIK

**Langkah:** 1) Di latihan, tampilkan materi; catat keadaan terakhir. 2) Cabut/pasang kabel display dengan aman, lalu periksa layar tujuan dan jalur audio macOS. 3) Jika output tertinggal/tidak terjangkau, pastikan suara dimatikan pada mixer/perangkat secara manual dan tutup jendela output lama. 4) Buka output yang baru dipasangkan dan periksa sebelum Go Live.

**Hasil yang diharapkan:** operator dapat menjalankan pemulihan manual tanpa perubahan koleksi. Browser mungkin tidak bisa mendeteksi proyektor mati; perintah Black tidak dijamin mencapai output yang kehilangan komunikasi. Jangan menganggap status sinkron membuktikan piksel/suara fisik benar. Catat batas ini dan setiap kegagalan pemulihan.

**Hasil:** [ ] PASS [ ] FAIL [ ] BLOCKED [ ] BELUM DIUJI

**Bukti:** foto kondisi kabel/layar, status operator dan langkah pemulihan audio/display. Catatan: ______.

## F. Backup, verifikasi dan restore terisolasi

### F01 — Backup lengkap dan verifikasi · TANPA PROYEKTOR

**Langkah:** 1) Dalam QA A, selesaikan simpan editor; catat jumlah/judul lagu, jadwal dan media latihan. 2) Buka **Pengaturan → Backup & Recovery**, klik **Buat backup .sagibak**. 3) Jika ada dialog **BACKUP PARSIAL**, baca seluruh penghilangan; pilih Batal jika Anda mengharapkan backup lengkap, atau konfirmasi sebagai uji parsial terpisah. 4) Simpan file di folder bukti. 5) Pilih file yang benar-benar tersimpan melalui **File backup**, klik **Verifikasi file**.

**Hasil yang diharapkan:** file dapat dibuka ulang dan verifikasi lulus. Lengkap berarti lengkap untuk konten durable yang didukung/diizinkan, bukan memori editor yang belum disimpan. Restricted Scripture dapat menghasilkan backup parsial dan wajib terungkap; jangan menyebutnya lengkap. Unduhan saja belum membuktikan file tersimpan baik.

**Hasil:** [ ] PASS [ ] FAIL [ ] BLOCKED [ ] BELUM DIUJI

**Bukti:** nama/ukuran file, waktu, hasil verifikasi, daftar penghilangan jika parsial, inventaris pembanding. Jangan unggah backup pribadi. Catatan: ______.

### F02 — Backup saat LIVE · TANPA PROYEKTOR; ULANGI FISIK BILA ADA

**Langkah:** 1) Go Live lagu latihan di QA A. 2) Catat teks dan posisi output. 3) Buat backup seperti F01 tanpa End Session. 4) Bandingkan output saat dan setelah backup, lalu verifikasi file.

**Hasil yang diharapkan:** backup tidak mengganti/mem-flush LIVE. Output tetap seperti semula. Checkpoint durable boleh tertinggal dari frame terbaru; backup bukan janji menyimpan frame terakhir yang belum committed.

**Hasil:** [ ] PASS [ ] FAIL [ ] BLOCKED [ ] BELUM DIUJI

**Bukti:** rekaman dua jendela selama proses dan hasil verifikasi. Catatan: ______.

### F03 — Fresh restore di QA B · TANPA PROYEKTOR

**Langkah:** 1) Tutup output QA A setelah bukti F02. Beralih ke profil **SAGI QA B** yang baru dan kosong; pastikan bukan profil ibadah. 2) Buka alamat/build sama; jika perlu cache shell terlebih dahulu. Jangan mengedit preferensi/membuat materi sebelum uji fresh. 3) Di Pengaturan pilih file F01, **Verifikasi file**, lalu **Siapkan restore**. 4) Pilih **Workspace kosong**. 5) Klik **End Session untuk restore / repair**, baca lalu konfirmasi; tutup output QA B yang masih ada. 6) Klik **Tinjau konflik restore** setelah End Session, baca dampak/lisensi dan centang **Saya memahami dampak restore dan pilihan konflik** hanya jika benar. 7) Klik **Publikasikan restore**. 8) Setelah sukses, reload; cocokkan semua inventaris yang diizinkan. Jika ada checkpoint, pilih Resume/Discard secara eksplisit.

**Hasil yang diharapkan:** hanya QA B menerima data. QA A tetap utuh. Restore sukses mewajibkan reload dan tidak otomatis LIVE/playback. Materi, urutan/repetisi, tema dan file yang tidak dihilangkan cocok dengan inventaris. Jika workspace ternyata tidak kosong, aplikasi menolak; jangan membersihkan database untuk memaksa fresh—gunakan profil QA baru dengan nama lain dan catat percobaan.

**Hasil:** [ ] PASS [ ] FAIL [ ] BLOCKED [ ] BELUM DIUJI

**Bukti:** nama profil, preview dampak, receipt/pesan sukses, inventaris sebelum/sesudah dan status recovery. Catatan: ______.

### F04 — Batal, file salah dan konflik · TANPA PROYEKTOR

**Langkah:** 1) Di QA B hasil F03, catat inventaris. Pilih file latihan salah yang disiapkan teknisi (bukan menimpa backup asli), klik **Verifikasi file**. 2) Dengan backup sah, siapkan restore dan tinjau mode **Merge · pertahankan data tujuan**, lalu biarkan checkbox konfirmasi kosong atau batalkan; jangan publish. 3) Untuk uji konflik, di QA A ubah lirik lagu latihan, simpan, buat/verifikasi backup baru. Kembali ke QA B dan tinjau merge backup baru. 4) Periksa disclosure pada keep-existing; bila mencoba **Merge · simpan keduanya jika aman**, baca penolakan/dampak sebelum keputusan. Jangan menonaktifkan pengaman atau mengubah database lewat DevTools.

**Hasil yang diharapkan:** file salah ditolak dan membatalkan tidak mengubah inventaris. Keep-existing tidak diam-diam menautkan jadwal ke lirik konflik. Keep-both menduplikasi agregat/referensi secara konsisten jika aman; arsip dengan override/draft yang tidak aman boleh ditolak secara jelas tanpa perubahan parsial. Untuk membuktikan keep-both berhasil, gunakan arsip latihan tanpa konflik override yang disiapkan teknisi; uji yang hanya meninjau preview bukan bukti publikasi berhasil.

**Hasil:** [ ] PASS [ ] FAIL [ ] BLOCKED [ ] BELUM DIUJI

**Bukti:** pesan error/penolakan, preview konflik, pilihan yang dibatalkan, inventaris tetap dan catatan apakah publikasi benar-benar dilakukan. Catatan: ______.

## G. Update PWA aman setelah ibadah

### G01 — Menutup sesi sebelum update · TANPA PROYEKTOR; ULANGI PADA INSTALLED PWA

**Langkah:** 1) Selesaikan ibadah dan semua editor; tunggu simpan. 2) Buat/verifikasi backup eksternal seperti F01. 3) Dari Pengaturan lakukan **End Session untuk restore / repair**, konfirmasi, pastikan output milik sesi tertutup; tutup output lama yang terpisah secara manual. 4) Catat inventaris/checkpoint dan pesan pembaruan jika ada. Jangan memaksa update selama LIVE.

**Hasil yang diharapkan:** sesi telah berakhir, file backup terverifikasi tersedia. **Black saja tidak cukup.** Pesan pembaruan tersedia belum berarti worker/build baru aktif. Langkah ini tidak memasang build baru.

**Hasil:** [ ] PASS [ ] FAIL [ ] BLOCKED [ ] BELUM DIUJI

**Bukti:** pesan End Session, output tertutup, hasil verifikasi dan inventaris/checkpoint. Catatan: ______.

### G02 — Menunggu aktivasi dan membuka versi yang cocok · TANPA PROYEKTOR; INSTALLED PWA PERLU UJI SENDIRI

**Prasyarat:** teknisi menyediakan build A/B yang disetujui pada **origin QA terpisah**, identitas tiap build, serta cara memeriksa worker B yang benar-benar aktif. Jangan mengganti `dist` build yang sudah diuji atau melakukan deployment untuk menjalankan checklist ini. Jika belum tersedia, hasil **BLOCKED**.

**Langkah:** 1) Di origin/profil QA update, catat build A dan inventaris; buka operator/output. 2) Teknisi menyediakan B; catat pemberitahuan pending. 3) Pastikan audience dan data A tidak berubah saat B menunggu. 4) Sesudah G01, tutup semua jendela/tab SAGI untuk origin QA termasuk installed PWA/output; biarkan browser berjalan agar transisi aktivasi dapat selesai. 5) Teknisi mengonfirmasi **worker B sendiri sudah activated**, bukan hanya ada worker A yang active. Tidak ada durasi tunggu tetap yang telah dijamin. 6) Buka operator kembali; teknisi cocokkan identitas B, kemudian buka output dari operator baru. 7) Bandingkan inventaris; lakukan recovery eksplisit, periksa paused. 8) Putus jaringan dan ulangi buka B offline.

**Hasil yang diharapkan:** B yang benar aktif dan kedua jendela memakai build cocok, semua data tetap ada, offline/recovery berhasil tanpa auto-play. Reopen/quit browser terlalu cepat pernah mempertahankan A; bila masih A, **jangan centang PASS, jangan membuka output campuran**. Catat FAIL untuk percobaan upgrade itu dan minta teknisi. Jangan menekan skipWaiting, unregister, clear cache/site data atau mencoba berulang selama ibadah. Versi metadata 0.7.0 saja tidak membedakan dua build; jika identitas tidak dapat dipastikan, BLOCKED.

**Browser window:** [ ] PASS [ ] FAIL [ ] BLOCKED [ ] BELUM DIUJI · **Installed PWA:** [ ] PASS [ ] FAIL [ ] BLOCKED [ ] BELUM DIUJI

**Bukti:** identitas A/B, status pending/aktivasi worker B dari teknisi, waktu tutup/buka, versi kedua jendela, inventaris sebelum/sesudah dan video recovery paused/offline. Catatan: ______.

## Rekap dan aturan berhenti

Isi setelah pengujian: PASS ___; FAIL ___; BLOCKED ___; BELUM DIUJI ___. ID uji gagal/terhalang: ______. Operator/tanggal: ______. Reviewer/tanggal: ______.

Hentikan uji terkait dan laporkan jika ada data hilang/restore parsial, bypass hak tulis, teks/lirik/urutan audience salah, kebocoran Scripture terlarang, atau Black gagal pada output yang koneksinya sehat. Jangan memperbaiki data/build sendiri. Catat hasil aktual dan pertahankan bukti.

**Tanpa proyektor**, operator dapat menyelesaikan A, B, C01, C04 versi layar Mac, E02, F dan tahap browser G. C02/C03/E03 serta hasil fisik C04/D/E01 tetap memerlukan perangkat nyata. Uji awal di Mac bukan pengganti pengesahan fisik.

Release tetap **HOLD** sampai hasil manual ditinjau, browser/storage dikualifikasi, risiko dependensi diputuskan dan scope PPTX disetujui. Lihat [disposisi risiko dan keputusan](DISPOSISI-RISIKO-RILIS-ID.md), [laporan Phase 8](PHASE-8.md), dan [checklist hardware teknis](HARDWARE-QA.md).
