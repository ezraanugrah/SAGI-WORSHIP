# Usulan disposisi risiko dan cakupan rilis pertama

Tanggal: 2 November 2026. Status: **HOLD — SELURUH KEPUTUSAN DI BAWAH MASIH MENUNGGU PERSETUJUAN**. Dokumen ini tidak menerima risiko atas nama pengguna dan tidak menyatakan siap produksi.

Dasar: audit dan graph dependensi tersimpan pada Phase 8, bukan audit npm baru pada follow-up dokumentasi ini. Runtime tercatat 0 temuan; audit penuh mencatat **9 laporan paket development: 2 low dan 7 moderate**, bukan sembilan eksploit audience yang berdiri sendiri. Tiga keluarga advisory mendasari laporan tersebut. Lihat [analisis teknis](SECURITY-RELEASE.md), [audit penuh](evidence/phase-8/full-audit.json), [jalur dependensi](evidence/phase-8/dependency-paths.json) dan metadata upstream tersimpan `upstream-*.json`.

## Batas paparan yang ditinjau

Semua jalur di tabel berawal dari `vite-plugin-pwa → workbox-build`. Paparan yang ditemukan berada pada pemrosesan konfigurasi, template, pola file dan precache saat build. Materi lagu, media atau backup yang dipilih operator di browser tidak ditemukan masuk ke API build ini. Ini mengurangi paparan yang teramati, **bukan bukti bebas risiko supply chain, konfigurasi atau CI**. Nol temuan runtime bukan hasil penetration test.

## Tabel sembilan laporan paket

**Kolom remediasi kompatibel adalah usulan untuk investigasi; belum ada perbaikan lengkap yang terverifikasi kompatibel.** Upgrade major/override/penggantian build chain tidak menjadi izin otomatis. **Kolom penerimaan risiko adalah opsi keputusan terpisah, belum disetujui.** C1–C5 di bawah wajib ditetapkan jika opsi itu dipilih.

| ID / paket terkunci | Severity / sumber laporan | Usulan remediasi kompatibel | Opsi penerimaan risiko sementara — belum disetujui |
| --- | --- | --- | --- |
| R01 `workbox-build` 7.4.1 | Moderate; propagasi deepmerge, glob dan rantai template | Pantau rilis Workbox yang memperbaiki seluruh jalur dalam rentang konsumen yang didukung; metadata Phase 8 masih 7.4.1. Tidak ada solusi lengkap kompatibel yang terbukti. | Terima hanya sebagai risiko tool build dengan konfigurasi/input tepercaya, C1–C5; tetap menanggung R02–R09. Bukan penghapusan temuan. |
| R02 `@rollup/plugin-node-resolve` 16.0.3 | Low; propagasi deepmerge | Cari patch upstream yang menghapus/memperbaiki penggunaan deepmerge. Metadata tersimpan 16.0.3 masih meminta `deepmerge ^4.2.2`. | Batasi konfigurasi plugin pada sumber yang direview; C1–C5 dan pengecualian yang sama dengan R03. |
| R03 `deepmerge` 4.3.1 | Low; prototype poisoning langsung | Advisory tidak mencantumkan versi patched. Tunggu perbaikan upstream atau ajukan penggantian terpisah; jangan mengklaim patch tersedia. | Terima sementara paparan konfigurasi build yang tepercaya; C1–C5. Risiko poisoning tetap ada jika objek berbahaya mencapai API itu. |
| R04 `@trickfilm400/rollup-plugin-off-main-thread` 3.0.0-pre1 | Moderate; propagasi EJS/Jake/filelist/minimatch | Cari perbaikan pada jalur yang kompatibel dengan Workbox. Upstream 4.0.0 yang tercatat berada di luar `^3.0.0-pre1` dan memakai EJS `^7.0.1`; bukan patch kompatibel yang sudah diuji. | Batasi template/opsi build pada berkas proyek tepercaya; C1–C5. Major 4 tidak dipasang tanpa persetujuan. |
| R05 `ejs` 3.1.10 | Moderate; propagasi rantai Jake | Evaluasi rilis/rantai upstream yang tidak membawa dependensi terdampak, melalui konsumen yang kompatibel. Tidak ada kandidat drop-in terverifikasi pada kajian ini. | Terima terbatas untuk tool template build, tanpa template/opsi dari sumber tak tepercaya; C1–C5. Bukan bukti EJS aman untuk input arbitrer. |
| R06 `jake` 10.9.4 | Moderate; propagasi filelist/minimatch | Utamakan pembaruan upstream konsumen yang menghapus atau memperbarui jalur lama; uji kesesuaian API sebelum mengusulkan versi. | Terima rantai tool build yang tidak diberi task/konfigurasi eksternal; C1–C5. Tetap mewarisi risiko R07/R09. |
| R07 `filelist` 1.0.6 | Moderate; propagasi minimatch 5.1.9 | Cari upstream yang mendukung minimatch patched dalam kontrak API-nya. Versi patched minimatch 11.0.1 berada di luar `^5.0.1`; override bukan perbaikan kompatibel yang terbukti. | Hanya pola file build tetap dan direview; C1–C5. Jangan menerima pola dari dokumen/impor pengguna. |
| R08 `glob` 11.1.0 | Moderate; bypass pembatalan traversal | Advisory mencantumkan patch 14.0.2, di luar rentang Workbox `^11.0.1`. Usulkan jalur upstream resmi, atau evaluasi major terpisah; tidak dipaksakan. | Terima kemungkinan traversal berlanjut setelah pembatalan pada build lokal terkontrol; C1–C5. Jangan anggap timeout menjamin proses sudah berhenti. |
| R09 `minimatch` 10.2.6 dan nested 5.1.9 | Moderate; amplifikasi pola / denial of service langsung | Patch advisory 11.0.1 menyeberangi rentang glob `^10.1.1` dan filelist `^5.0.1`. Cari pembaruan kedua konsumen; jangan mengganti salah satu lalu menganggap seluruh jalur selesai. | Hanya pola tetap tepercaya, batasi job build yang dikendalikan penanggung jawab; C1–C5. Hindari input pola tidak tepercaya; DoS belum diperbaiki. |

Tiga advisory diperiksa read-only pada follow-up ini: [deepmerge](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), [glob](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), [minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249). Pernyataan versi upstream lainnya bersumber dari snapshot metadata Phase 8, bukan jaminan versi terbaru di masa mendatang. EJS/Jake/filelist dan paket induk di tabel merupakan propagasi laporan, bukan advisory langsung tambahan yang dibuktikan di sini.

## Syarat opsi penerimaan risiko (C1–C5)

- **C1 — Batas lingkungan:** build hanya dari konfigurasi, pola, template, sumber dan aset proyek yang tepercaya serta direview. Jangan menjalankan task/opsi/pola build dari arsip operator. Pembatasan ini merupakan prosedur yang diusulkan, bukan security policy baru yang telah diterapkan.
- **C2 — Penanggung jawab:** nama dan kontak reviewer/owner risiko wajib diisi. Tidak otomatis dialihkan kepada operator ibadah.
- **C3 — Masa berlaku:** tentukan tanggal mulai dan kedaluwarsa; usulan maksimum 30 hari sampai review berikutnya, masih perlu disetujui. Keputusan juga ditinjau ulang sebelum rilis apa pun.
- **C4 — Pemicu review dini:** advisory baru/berubah, rilis patch upstream, perubahan dependency/config/Node, penggunaan CI/hosting, input build tidak tepercaya, atau ditemukannya jalur eksploit nyata membatalkan asumsi lama dan memerlukan review ulang.
- **C5 — Bukti:** catat paket/versi/advisory, alasan bisnis, paparan, kontrol prosedural, audit/log dan persetujuan tertulis. Status tetap “temuan belum diperbaiki”; jangan menyebut audit penuh bersih.

Jika memilih remediasi, persetujuan harus menyebut versi/perubahan yang konkret, alasan kompatibilitas dan rencana rollback. Sesudah perubahan yang disetujui, ulangi typecheck, build, audit runtime/penuh, unit/E2E, offline/PDF/media worker dan A→B update. Tidak ada upgrade, override, `audit fix`, penggantian service worker, CSP atau Trusted Types dilakukan dalam follow-up ini.

## Formulir keputusan risiko

Isi keputusan per R01–R09 atau satu formulir kelompok yang menyebut seluruh ID; paket yang tidak disebut tetap belum diputuskan.

| Kolom | Isi reviewer |
| --- | --- |
| ID risiko / versi / advisory yang dicakup | ______ |
| Pilihan | [ ] Tunda rilis sambil menunggu perbaikan [ ] Setujui investigasi remediasi kompatibel [ ] Terima sementara dengan C1–C5 |
| Alasan dan batas paparan yang disetujui | ______ |
| Owner / reviewer / pemberi persetujuan | ______ |
| Tanggal mulai / kedaluwarsa / review berikutnya | ______ |
| Kontrol prosedural dan bukti penerapan | ______ |
| Hasil persetujuan final | [ ] Disetujui [ ] Ditolak [ ] Belum diputuskan |

Semua kolom sengaja kosong. Tidak ada accepted-risk option yang sudah diterima melalui dokumen ini.

## Usulan cakupan PPTX rilis pertama — MENUNGGU PERSETUJUAN FINAL

**Usulan:** operator mengekspor PPTX secara lokal melalui PowerPoint/LibreOffice yang sudah tersedia menjadi **PDF atau gambar per slide**, lalu mengimpor hasil itu melalui Media Library SAGI. Tidak ada unggahan/konversi cloud. PPTX langsung tidak didukung oleh build saat ini.

Yang dinilai: halaman/gambar statis, urutan dan kesesuaian visual hasil ekspor. Operator memeriksa setiap halaman, font, teks, gambar serta batas ukuran yang berlaku. Dukungan tidak mencakup animasi/transisi PowerPoint, media tertanam, macro/OLE, edit objek slide atau jaminan identik piksel. Hak konten tetap tanggung jawab pengguna. Uji manual B06 menguji hasil ekspor, bukan implementasi renderer PPTX.

PRD awal memuat dukungan PPTX langsung pada acceptance criterion 9. Phase 5 menerima fallback operasional, tetapi itu tidak otomatis mengubah PRD atau menutup gate rilis. Persetujuan final harus menyatakan bahwa cakupan rilis pertama dibatasi ke fallback PDF/gambar. Integrasi renderer/konverter langsung memerlukan otorisasi dan kajian baru.

**Keputusan PPTX:** [ ] Setujui fallback PDF/gambar sebagai scope rilis pertama [ ] Tolak; tunda gate scope rilis [ ] Minta proposal renderer terpisah.

**Nama/tanggal/alasan persetujuan:** ______. **Status saat dokumen dibuat: BELUM DISETUJUI.**

## Keputusan lain yang masih terbuka

| Keputusan | Status saat ini | Bukti/otorisasi yang dibutuhkan |
| --- | --- | --- |
| Hasil proyektor, HDMI/USB audio, font, fullscreen dan latihan panjang | MANUAL QA | Panduan uji diisi oleh operator; review hasil fisik |
| Browser yang resmi didukung | APPROVAL REQUIRED | Chrome fisik/installed PWA; Edge belum dikualifikasi; Firefox/WebKit tidak tersedia; Safari belum diuji |
| Prosedur update setelah ibadah dan verifikasi build | MANUAL QA / APPROVAL REQUIRED bila mengubah produk | Bukti worker B benar aktif dan jendela cocok; premature reopen dapat tetap A |
| Kapasitas kerja rilis | APPROVAL REQUIRED setelah QA | Arsip ~46,5 MiB adalah sampel tertinggi teruji, bukan batas aman; 2 GiB belum terkualifikasi |
| Sembilan temuan development | APPROVAL REQUIRED | Formulir R01–R09 / C1–C5 atau proposal remediasi konkret |
| Scope PPTX | APPROVAL REQUIRED | Persetujuan final fallback atau proposal terpisah |
| GitHub/Vercel, upgrade/override, migrasi, policy enforcement | Tidak diotorisasi oleh follow-up ini | Persetujuan terpisah sebelum tindakan; tidak dilakukan |

Release tetap **HOLD**. Keputusan scope atau risiko saja tidak menggantikan kelulusan hardware, browser, storage dan recovery. Lihat [panduan operator](PANDUAN-UJI-MANUAL-ID.md), [release checklist](RELEASE-CHECKLIST.md), dan [laporan Phase 8](PHASE-8.md).
