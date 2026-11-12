# Sinkron lagu, media, dan tema antar laptop (Supabase)

Lagu di **Musik** (tab Songs), file di **Media** (gambar, video, dan PDF di Presentations), dan **tema buatan sendiri** di Themes bisa sama di semua laptop yang masuk dengan akun Supabase gereja: tambah, ubah, atau hapus di satu laptop, laptop lain ikut berubah dalam beberapa detik (file besar sesuai kecepatan internet). Data disimpan di database **Supabase** milik gereja; setiap laptop tetap menyimpan salinan offline, jadi ibadah tetap jalan tanpa internet.

Yang disinkronkan:

- **Lagu** di Musik (judul, penyanyi/pencipta, kategori, bahasa, bagian lirik, urutan).
- **Media**: file asli dan thumbnail, judul, jenis. File dikirim dalam potongan 4 MiB yang dicek SHA-256 di laptop penerima; file rusak atau belum lengkap tidak dipasang dan dicoba lagi nanti.
- **Tema** buatan sendiri: nama, latar (warna, gradasi, gambar, atau video dari Media), dan tampilan teks. Tema bawaan (Default Black, Sunset, …) sudah ada di semua laptop.

Belum ikut: Week 1–4, ayat Alkitab, dan pengaturan.

## Sekali saja: siapkan server (admin)

1. **Buat project Supabase** di https://supabase.com (paket gratis cukup). Pilih region **Southeast Asia (Singapore)**. Simpan password database di tempat aman.
2. **Buat tabel**: di project, buka **SQL Editor › New query**, salin seluruh isi [`supabase/songs-sync.sql`](../supabase/songs-sync.sql), lalu **Run**. Lalu **New query** lagi, salin seluruh isi [`supabase/library-sync.sql`](../supabase/library-sync.sql) (tabel media & tema dan tempat file `sagi-media`), lalu **Run**. Keduanya aman dijalankan ulang.

   Sudah memakai sinkron lagu sebelumnya? Cukup jalankan `supabase/library-sync.sql` sekali. Sebelum itu, panel menulis "Media & Tema belum aktif di server sinkron"; lagu tetap tersinkron seperti biasa.
3. **Matikan pendaftaran umum**: **Authentication › Sign In / Providers**, matikan **Allow new users to sign up**. Hanya akun yang dibuat admin yang bisa masuk.
4. **Buat akun gereja**: **Authentication › Users › Add user › Create new user** (email + password kuat, centang *Auto Confirm User*). Bisa satu akun bersama untuk tim multimedia, atau satu akun per operator.
5. **Ambil alamat dan kunci publik**: **Project Settings › API** (atau **Connect**): salin **Project URL** (`https://xxxx.supabase.co`) dan **anon / publishable key**. Jangan pernah memakai *service_role / secret key* di aplikasi.
6. **Pasang di Vercel** (project `sagi-worship`): **Settings › Environment Variables**, tambahkan untuk *Production* (dan *Preview* bila perlu):
   - `VITE_SYNC_URL` = Project URL
   - `VITE_SYNC_KEY` = anon / publishable key

   Lalu deploy ulang (push berikutnya ke `staging`, atau **Redeploy** di Vercel). Kunci *anon* memang boleh ada di aplikasi web; tabel dilindungi Row Level Security sehingga hanya akun yang sudah masuk yang bisa membaca atau menulis.

## Di setiap laptop

1. Buka SagiWorship, tab **Songs**. Di sidebar, bagian **Sinkron antar laptop**, masukkan email dan password akun gereja, klik **Masuk**.
2. Selesai. Lagu, media, dan tema yang sudah ada di laptop ini dikirim ke server, milik laptop lain diambil. Status menunjukkan misalnya "Tersinkron 10.42 · 25 lagu · 12 media · 3 tema · 3 dari laptop lain".

Sinkron berjalan sendiri: saat dibuka, setiap 15 detik, 2 detik setelah lagu, media, atau tema diubah, saat jendela difokuskan, dan saat internet kembali. **Sinkron sekarang** menjalankannya langsung. **Keluar** menghentikan sinkron; lagu, media, dan tema di laptop itu tetap ada.

Sinkron hanya berjalan di tab yang sedang mengedit (bukan tab "hanya baca").

## Tidak bisa masuk?

Setiap akun yang sudah masuk melihat **pustaka lagu yang sama** (boleh satu akun bersama atau satu akun per operator). Lagu dari laptop A baru muncul di laptop B setelah laptop A juga masuk dan statusnya "Tersinkron".

Pesan di bawah tombol **Masuk** menyebut alasannya:

- **"Akun ini belum dikonfirmasi"**: akun dibuat tanpa *Auto Confirm User*. Admin: Supabase › **Authentication › Users** › pilih akun › **Confirm email** (atau hapus lalu buat ulang dengan *Auto Confirm User* dicentang).
- **"Email atau password salah"**: periksa ejaan email dan huruf besar/kecil password. Akun baru hanya bisa dibuat admin di Supabase (pendaftaran umum dimatikan); admin juga bisa mengganti password di **Authentication › Users** › akun › ⋯.
- **"Terlalu banyak percobaan masuk"**: tunggu 1–2 menit lalu coba lagi.
- **"Server sinkron tidak menjawab"**: project Supabase mungkin dijeda; admin klik **Restore project**.
- Panel bertuliskan **"Belum disiapkan"**: laptop itu membuka versi lama atau alamat lain. Buka https://sagi-worship.vercel.app dan klik **Muat versi baru** bila muncul.

## Aturan yang dipakai

- **Offline dulu**: tanpa internet semua tetap berjalan; perubahan dikirim saat online lagi.
- **Tidak ada yang tertimpa diam-diam**: setiap lagu punya nomor versi di server. Kalau lagu yang sama diubah di dua laptop sebelum sempat sinkron, versi di server tetap dipakai dan versi laptop ini disimpan sebagai lagu baru "… (salinan laptop ini)". Pilih yang benar lalu hapus yang lain.
- **Hapus ikut tersinkron**: lagu yang dihapus ditandai di server sehingga laptop lain ikut menghapusnya (beserta item jadwal di laptop itu yang memakai lagu tersebut). Kalau di laptop lain lagu itu justru diubah sebelum penghapusan sampai, perubahan itu yang menang dan lagunya kembali.
- **Media dan tema**: file yang sama persis yang diimpor terpisah di dua laptop dikenali (sidik SHA-256) dan tidak diunduh atau ditampilkan dua kali. Media yang dihapus di satu laptop ikut terhapus di laptop lain. Tema yang memakai gambar/video menunggu file latarnya sampai dulu, lalu muncul. Bila tema yang sama diubah di dua laptop, perubahan terakhir yang sampai ke server yang dipakai.
- **Gabung saat pertama masuk**: lagu yang sudah ada di masing-masing laptop digabung. Lagu yang sama yang diketik terpisah di dua laptop akan muncul dua kali; hapus salah satunya.
- Sesi login dan catatan sinkron disimpan di browser laptop itu (localStorage), tidak ikut backup.

## Catatan

- Project Supabase gratis bisa **dijeda** bila lama tidak dipakai (sekitar seminggu tanpa aktivitas). Statusnya akan menampilkan error; admin cukup klik **Restore project** di dashboard Supabase.
- **Kapasitas file**: paket gratis Supabase memberi sekitar **1 GB** penyimpanan file. Video besar cepat menghabiskannya; untuk proyektor cukup MP4 H.264 1080p. Bila penuh, panel menulis "Penyimpanan Supabase penuh" dan media baru tetap ada di laptop itu saja (lagu dan tema tetap tersinkron). Potongan file tidak dihapus dari server saat media dihapus di aplikasi; admin bisa mengosongkan bucket `sagi-media` di **Storage** bila perlu (laptop yang masih punya file akan mengirimnya lagi hanya untuk media baru).
- Lirik lagu disimpan di server Supabase milik gereja. Pastikan gereja berhak menyimpan lirik tersebut (lisensi lagu, mis. CCLI).
- Kode: `src/sync/songSync.ts` (mesin sinkron dan login), `src/sync/librarySync.ts` (media dan tema), `src/sync/libraryAdapters.ts`, `src/hooks/useSongSync.ts` (jadwal sinkron), `src/components/SyncPanel.tsx` (panel), `supabase/songs-sync.sql` dan `supabase/library-sync.sql` (server). Test memakai server tiruan `src/sync/fakeSupabase.ts`.
