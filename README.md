# Kasir Toko Mahyu

Aplikasi kasir offline satu file HTML untuk **Toko Mahyu** (toko kelontong, PojokBayar, BRILink, dan toko material),
ditambah halaman pesan online untuk pelanggan. Dibuat supaya mudah dipakai orang tua: tombol besar, sedikit klik,
buka dan tutup kasir otomatis, backup otomatis, dan suara yang membacakan total serta kembalian.

Tidak ada server dan tidak ada database online. Semua data toko (penjualan, stok, harga beli, utang, pelanggan)
tersimpan di browser perangkat kasir (IndexedDB). Yang tampil di internet hanya halaman aplikasi kosong dan
daftar barang beserta harga jual (`public/katalog.json`).

## Fitur utama

- Kasir: scan barcode (scanner atau kamera HP), cari barang tahan salah ketik, satuan (PCS, RCG, SETENGAH, DUS),
  harga Umum dan Warung, uang kurang jadi utang, struk thermal, label harga rak.
- Uang terpisah per laci (Warung, BRILink, Material), layanan PojokBayar dan BRILink, buka dan tutup kasir otomatis.
- Pelanggan dan utang (tagih lewat WhatsApp), supplier dan utang toko, daftar kulakan otomatis.
- Pesan online: pelanggan memilih barang di HP, pesanan masuk ke kasir lewat link WhatsApp.
- Pengaman scan: QR BPOM dan kode asing ditolak, kolom nama pembeli tidak kemasukan hasil scan.
- Backup harian otomatis ke folder Download, suara membacakan total (bisa dimatikan).

## Cara menjalankan

Tidak perlu instal apa pun untuk memakai aplikasinya:

- **Di PC kasir tanpa internet**: buka `public/index.html` di Google Chrome.
- **Online**: folder `public/` ditayangkan Cloudflare Pages dari repo ini (Build command kosong,
  Build output directory `public`). Setiap push ke `main` otomatis tayang dalam 1 sampai 2 menit.

Untuk mengubah kode:

```bash
python build.py                       # gabungkan src/ -> dist/ (index.html, pesan.html, sw.js, ...)
cp dist/index.html dist/pesan.html dist/manifest.json dist/sw.js dist/icon*.png public/   # (Windows: copy)
cd tools && npm install && npm run format   # opsional: rapikan kode dengan prettier
```

Tes otomatis memakai Python + Playwright dan salinan backup toko di `tests/data/` (folder ini tidak ikut repo):

```bash
pip install playwright && python -m playwright install chromium
python build.py && python tests/test36.py
```

## Keamanan data

- File backup (`backup-kasir-toko-mahyu*.json`), file Excel, dan `tests/data/` diabaikan oleh `.gitignore`.
  Jangan pernah meng-commit file itu.
- Token GitHub, API key Tanya AI, dan izin file backup hanya disimpan di perangkat kasir (`PRIVATE_META`),
  tidak ada di kode dan tidak ikut backup.
- `public/katalog.json` ditulis oleh aplikasi kasir lewat GitHub API. Selalu `git pull` sebelum `git push`.

Panduan pemakaian untuk orang tua ada di [`docs/PANDUAN.txt`](docs/PANDUAN.txt).

Aplikasi kasir offline (satu file HTML) + halaman pesan pelanggan. Tanpa server, tanpa database online:
semua data disimpan di browser (IndexedDB) perangkat kasir.

## Struktur folder

```
build.py                  penggabung sumber -> dist/ (index.html, pesan.html, manifest.json, sw.js)
src/
  index.template.html     kerangka halaman kasir (tempat kosong /*__CSS__*/, /*__APP__*/, dst.)
  css/app.css             semua tampilan kasir
  shared/cari.js          mesin pencarian produk (tahan salah ketik + istilah sehari-hari), dipakai 2 halaman
  assets/logo.svg         logo Toko Mahyu (vektor): ikon tab & logo di kepala halaman kasir dan halaman pesan
  assets/icon-*.png       ikon aplikasi 512 px (dibuat dari logo.svg dengan tools/buat_ikon.py)
  shared/daftar.js        pembaca daftar belanja / pesan WA (BacaDaftar): koma, jumlah depan/belakang, sekilo, Sunda, sapaan, awalan WA
  js/                     kode kasir, digabung urut nama file
  pesan/                  halaman pesan pelanggan (pesan.template.html, pesan.css, pesan.js)
  data/barcode-indonesia.tsv  daftar barcode bawaan (barcode<TAB>nama), dibuat dengan tools/barcode_lokal.py
  sw.js                   service worker (cache offline saat di-hosting)
lib/                      pustaka pihak ketiga (JsBarcode, SheetJS mini, qrcode-generator, jsQR, ZXing)
tools/                    prettier + aturan format kode
```

## Modul kasir (`src/js`)

| File | Isi |
|---|---|
| `00-util.js` | `$`, `$$`, `rp` (format rupiah), `num` (baca angka), `esc`, tanggal, `toast`, `beep` |
| `01-db.js` | IndexedDB (versi 2, store `kas` untuk catatan uang), state `S`, `save()` / `saveMeta()` (tulis langsung ke disk), backup & pulihkan, backup harian otomatis ke folder Download tanpa izin (`siapkanBackupHarian`, `jalankanBackupHarian` pada sentuhan pertama, 1 file per hari, pengaturan `backupUnduh`) |
| `02-produk-helpers.js` | harga per kategori & satuan, barcode, stok satuan dasar, pencarian kasir, ganti nama satuan yang salah pilih (`gantiSatuanDialog`, `gantiNamaSatuan`: PCS jadi RCG tanpa konversi, riwayat transaksi ikut), tambah satuan dengan isi terhadap satuan mana saja (`quickUnitDialog`: 1 RCG = 2 SETENGAH, tertulis "Artinya: 1 SETENGAH = 5 PCS"), pembetulan isi satuan (`rencanaSatuan`, `aturUlangSatuan`, `betulkanSatuanDialog`: renceng minuman sachet = 10 PCS, setengah = 5 PCS, stok & riwayat ikut dihitung ulang) |
| `03-ui.js` | router halaman (`views`, `go`, `render`), `modal`, `confirmBox`, tombol gulir besar, kotak uang/harga hanya angka (`kotakUang`, semua `input[inputmode=numeric]` kecuali `data-bukanuang`) |
| `04-fokus.js` | kursor otomatis di kolom scan / pencarian (juga setelah cetak struk) |
| `05-aturan.js` | aturan toko: penyatuan kategori (SIGARET → ROKOK), harga warung otomatis, barang prioritas pencarian, merapikan nama produk, migrasi data, harga beli perkiraan untuk barang tanpa harga beli (`isiHargaBeliKosong`: harga warung − 500, `p.hbKira`, `hbPerkiraan`, `hbAsli`) |
| `06-kas.js` | uang terpisah (Warung, BRILink, Material), jenis layanan & tarifnya, pembagian transaksi ke tiap laci (`rincianSale`), utang per laci, uang kurang tanpa nama (`sisaKurang`, `terimaKurang`), posisi uang di laci (`posisiUang`), rekap laba bersih (`rekapUang`), buka & tutup kasir otomatis sesuai jam toko (`kasirOtomatis`, `tikKasirOtomatis`, pengaturan `uang.otomatis`, `jamBuka`, `jamTutup`: uang awal / tutup = uang menurut catatan, posisi uang tidak berubah) |
| `07-layanan-menu.js` | daftar layanan PojokBayar & BRILink (nama, urutan, arah uang, tarif bawaan) sama dengan menu aplikasinya |
| `08-kategori.js` | 23 kategori standar warung (urutan rak, ikon, isi), tebakan kategori dari nama barang, peta kategori Fastmart lama, pilah otomatis |
| `09-tolak-scan.js` | tolak QR BPOM (nomor izin edar MD/ML/NA/...), QR alamat situs, dan kode huruf hasil scanner yang tidak dikenal di kolom scan, barcode, dan cari (`jenisKodeAsing`, `tolakKode`, `dariScanner`), kolom nama pembeli (`#custName`, `#kName`, form pelanggan) tidak menerima ketikan scanner (`KOLOM_NAMA`, kartu member tetap boleh) |
| `10-kasir.js` | layar kasir, keranjang, pembayaran, riwayat, ubah & duplikat transaksi, utang lama dibayar sekalian belanja (`utangLamaDialog`, baris `utangLama`), struk tanpa QR kalau uang bayar diisi (`tanpaQR`), saran barang tahan salah ketik di kolom scan (`indeksKasir`, `cariMirip`: bagian "Mungkin maksudnya" + baris Tambah produk baru yang bisa dipilih dengan panah) |
| `11-struk-label.js` | cetak struk (STATUS LUNAS / BELUM LUNAS), label barcode, label harga rak (`labelRakHTML`, `printLabelRak`) |
| `12-kamera.js` | scan barcode lewat kamera HP |
| `13-qris.js` | baca QRIS toko, QRIS dinamis bernominal |
| `14-ubah-harga.js` | ubah harga dari keranjang kasir (langsung tersimpan ke produk) & form harga ✏️ |
| `15-pesanan.js` | membaca pesanan (link, WhatsApp, QR, teks bebas lewat `BacaDaftar`), mencocokkan ke barang dengan `CariProduk` (`indeksPesanan`, `matchLine`: nama persis, skor kata `cocok` ≥ 7, ukuran 1/2 KG), meninjau sebelum masuk keranjang, contoh format untuk pembeli |
| `16-pesan-online.js` | katalog.json (`hd` = harga awal, warung), terbit ke GitHub, link `#pesan=` (v2 ringkas: array tanpa nama barang, v1 lama tetap dibaca), serah-terima antar tab |
| `17-suara.js` | input suara di kasir (Web Speech API, bahasa Indonesia): baca jumlah, satuan, nama barang, nominal layanan ("pulsa sepuluh ribu") |
| `17a-bacakan.js` | suara membacakan total & kembalian / kekurangan (`bacakan`, `terbilang`, tombol 🔊 / 🔇 di kasir, pengaturan `bacakan`, `bacakanCepat`) |
| `18-layanan.js` | layanan di keranjang kasir: pulsa, paket data, token & tagihan listrik, e-wallet, tagihan lain (PojokBayar), tarik tunai, transfer, bayar lewat BRILink |
| `19-cari-barcode.js` | nama barang otomatis dari barcode: daftar bawaan (`src/data/barcode-indonesia.tsv`) + API Produk Indonesia, Open Food Facts, Open Beauty Facts, Open Products Facts; form tambah cepat; isi harga barang yang belum berharga (tidak pernah terjual Rp 0); barang daftar bawaan dijadikan produk (`dariDaftar`) |
| `20-produk.js` | halaman produk (filter berkelompok dengan jumlah: perlu diperbaiki, laku / tidak laku 30 hari, jenis barang), form produk (kategori ditebak dari nama), cek harga warung, ubah kategori massal |
| `21-stok.js` | barang masuk, opname, riwayat stok |
| `22-hadiah.js` | daftar hadiah poin member & penukaran |
| `22-pelanggan.js` | pelanggan, utang (bayar per laci, tunai / non-tunai), catat utang dari buku (`catatUtangDialog`, payments `jenis: 'utang'`), rincian utang FIFO (`rincianUtang`), tagih lewat WhatsApp (`tagihDialog`), poin member |
| `23-beranda.js` | ringkasan & "perlu perhatian" |
| `24-laporan.js` | laporan per laci (Semua / Warung / BRILink / Material), Excel, detail & batal transaksi |
| `26-uang.js` | halaman 💰 Uang: buka & tutup kasir, pengeluaran, uang masuk, pindah uang, samakan saldo, cetak laporan harian, pilih barang material |
| `27-kulakan.js` | daftar kulakan otomatis dari penjualan 30 hari + stok, cetak / WhatsApp, barang datang |
| `25-ai.js` | Tanya AI (Gemini / Claude / OpenAI / OpenRouter), hanya membaca data |
| `28-supplier.js` | supplier & sales (jadwal datang `kunjunganDalam`), utang toko ke supplier (`notaSupplier`, bayar = kas keluar kategori kulakan, tidak mengurangi laba), pesanan ke sales (`pesananSupplier`, `barangDatang`), agenda & pengingat Beranda (`pengingatSupplier`), kirim daftar kulakan ke WA sales |
| `30-pengaturan.js` | pengaturan bertab + import Fastmart & export Excel |
| `99-start.js` | tombol pintas global & proses saat aplikasi dibuka |

## Aturan penulisan kode

- Satu modul = satu urusan. Fungsi kecil, nama berbahasa Indonesia / istilah toko kalau itu yang dipakai sehari-hari.
- Data selalu lewat `save(store, obj)` / `saveMeta(id)` supaya langsung tersimpan dan backup otomatis jalan.
- Pengaturan bertingkat memakai `withDefaults()` agar objeknya tetap sama (aman diubah langsung).
- Data rahasia per perangkat (`aiKey`, `aiConf`, `ghConf`, `backupHandle`) ada di `PRIVATE_META` dan tidak ikut backup.
- Uang: penjualan tidak disalin ke store `kas`. Pembagian uangnya dihitung dari isi transaksi (`rincianSale`),
  laci tiap baris ikut disimpan di `item.kas` supaya laporan lama tidak berubah kalau barang dipindah laci.
  Store `kas` hanya berisi catatan buka/tutup kasir, pengeluaran, uang masuk, pindah uang, dan samakan saldo.
- Tampilan dibuat dengan template string. Semua teks dari pengguna wajib lewat `esc()`.
- Format kode: `tools/node_modules/.bin/prettier --config tools/.prettierrc.json --write "src/**/*.{js,css}"`

## Membuat ulang aplikasi

```
python3 build.py          # hasil di dist/
```

Untuk hosting, salin `dist/index.html`, `dist/pesan.html`, `dist/manifest.json`, `dist/sw.js`, `dist/icon.png`
ke folder `public/` di repo GitHub. `public/katalog.json` dibuat oleh kasir (tombol "Perbarui katalog online").

## Alur pesanan online

1. Kasir membuat `katalog.json` (barang aktif + harga yang boleh dilihat pelanggan, tanpa harga beli/stok).
2. Katalog diunggah ke repo GitHub lewat API (token fine-grained, izin *Contents: Read and write*, satu repo).
3. Cloudflare Pages menayangkan ulang situs otomatis setiap ada perubahan di repo.
4. Pelanggan membuka `pesan.html`, memilih barang + harga Perorangan/Warung, lalu kirim WhatsApp.
   Pesan berisi daftar barang dan link `https://<situs>/#pesan=<data base64url>`.
5. Link dibuka di komputer kasir: kalau kasir sudah terbuka di tab lain, pesanan dikirim ke tab itu
   (BroadcastChannel), lalu muncul jendela tinjau pesanan. Barang dicocokkan lewat ID produk, jadi tepat.
6. Kalau kasir sedang melayani pembeli, pesanan hanya disimpan di daftar 📥 Pesanan (tidak mengganggu).

## Uang terpisah & layanan

- Laci (`KAS`): `warung` (barang warung + layanan PojokBayar), `brilink`, `material`. Saldo non-tunai: `pb` (Saldo
  PojokBayar), `rek` (Rekening BRILink).
- Baris layanan di keranjang: `manual: true, layanan: '<jenis>', kas, lyn: {nominal, admin, biaya, modal, jual, tujuan, ket, token}`.
  `harga` = uang dari pelanggan (tarik tunai negatif), `harga - hargaBeli` = untung toko.
- Total keranjang bisa minus (tarik tunai lebih besar dari belanja) = uang diberikan ke pelanggan, hanya tunai.
- Diskon & tukar poin hanya mengurangi belanja (dibagi sebanding Warung / Material). Utang: uang muka untuk Warung dulu.
- Posisi laci = patokan terakhir (buka / tutup / samakan saldo) + semua arus sesudahnya. Transaksi yang dibatalkan
  atau diubah mengurangi laci pada waktu pembatalannya.

## Nama barang dari barcode

- Daftar bawaan: `src/data/barcode-indonesia.tsv`, dibuat oleh `tools/barcode_lokal.py` dari
  github.com/wpangestu/list-barcode-product-indonesia (boleh dipakai sesuai kebutuhan menurut README-nya).
  Barcode dengan digit cek yang salah dibuang. Ditanam ke `index.html` sebagai `window.BARCODE_LOKAL`.
- Internet (dari browser kasir, bukan dari server): semua sumber dipanggil bersamaan dengan batas 7 detik,
  hasil diambil dari sumber teratas yang menemukan. Urutan: API Produk Indonesia (alpha-projects.cloud),
  Open Food Facts, Open Beauty Facts, Open Products Facts (data terbuka, lisensi ODbL).
- Hasil hanya untuk mengisi nama (dan satuan). Harga selalu diisi pemilik toko.
