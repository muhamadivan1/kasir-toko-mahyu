/* ============ DAFTAR LAYANAN (sama dengan menu aplikasi PojokBayar & BRILink Mobile) ============
 * Setiap layanan:
 *   nama   = tulisan di tombol (sama dengan di aplikasinya)    kas  = 'warung' (PojokBayar) / 'brilink'
 *   form   = 'nominal' (pilih nominal) | 'tagihan' (ketik jumlah tagihan) | 'paket' (harga paket) | 'jasa' (biaya saja)
 *   arah   = BRILink: 'masuk' (pelanggan bayar), 'keluar' (uang diberikan ke pelanggan), 'jasa', 'pilih' (dipilih saat isi)
 *   tujuan = label kolom nomor tujuan     pilihan = tombol pilihan (operator, e-wallet, dll)
 *   admin  = untung bawaan (contoh, bisa diubah di Pengaturan)     kata = kata yang bisa diketik di kolom scan
 *   cart   = nama di keranjang & struk     lama = layanan versi lama (tidak tampil di menu, tetap bisa dibaca)
 */
const NOMINAL_PULSA = [5000, 10000, 15000, 20000, 25000, 50000, 100000];
const NOMINAL_TOKEN = [20000, 50000, 100000, 200000, 500000, 1000000];
const NOMINAL_EWALLET = [10000, 20000, 25000, 50000, 100000, 200000];
const NOMINAL_UANG = [100000, 200000, 300000, 500000, 1000000, 2000000];
const NOMINAL_TARIK = [50000, 100000, 200000, 300000, 500000, 1000000];
const PILIH_EWALLET = ['DANA', 'OVO', 'GoPay', 'ShopeePay', 'LinkAja'];
const PILIH_GAME = ['Mobile Legends', 'Free Fire', 'PUBG Mobile', 'Google Play', 'Lainnya'];
const NAMA_PELANGGAN = 'Nama pelanggan (boleh kosong)';
const LAYANAN = {
  /* ---------- PojokBayar (uang Warung) ---------- */
  pbsahabat: {
    nama: 'Paket Sahabat',
    ikon: '🎁',
    kas: 'warung',
    form: 'paket',
    tujuan: 'Nomor HP',
    contohPaket: 'nama paket',
    admin: 2000,
    kata: ['sahabat']
  },
  pbkirim: {
    nama: 'Kirim Uang',
    ikon: '💸',
    kas: 'warung',
    form: 'nominal',
    tujuan: 'Tujuan (bank / e-wallet, nomor & nama)',
    awalan: 'ke ',
    nominal: NOMINAL_UANG,
    labelNom: 'Uang yang dikirim',
    admin: 5000,
    kata: ['kirim']
  },
  pulsa: {
    nama: 'Pulsa',
    ikon: '📱',
    kas: 'warung',
    form: 'nominal',
    tujuan: 'Nomor HP',
    nominal: NOMINAL_PULSA,
    admin: 2000,
    kata: ['pulsa']
  },
  kuota: {
    nama: 'Data',
    ikon: '🌐',
    kas: 'warung',
    form: 'paket',
    tujuan: 'Nomor HP',
    contohPaket: 'Telkomsel 10 GB 30 hari',
    admin: 3000,
    kata: ['data', 'kuota', 'internet'],
    cart: 'PAKET DATA'
  },
  token: {
    nama: 'Token Listrik',
    ikon: '⚡',
    kas: 'warung',
    form: 'nominal',
    tujuan: 'No. meter / ID pelanggan',
    nominal: NOMINAL_TOKEN,
    admin: 3000,
    token: true,
    ket: 'beli token (prabayar), nanti dapat nomor token',
    kata: ['token', 'listrik', 'pln', 'meteran'],
    cart: 'TOKEN LISTRIK'
  },
  pln: {
    nama: 'Tagihan Listrik',
    ikon: '💡',
    kas: 'warung',
    form: 'tagihan',
    tujuan: 'ID pelanggan PLN',
    admin: 3000,
    ket: 'bayar tagihan bulanan (pascabayar)',
    kata: ['listrik', 'pln', 'tagihan'],
    cart: 'TAGIHAN LISTRIK'
  },
  pdam: {
    nama: 'PDAM',
    ikon: '🚰',
    kas: 'warung',
    form: 'tagihan',
    tujuan: 'No. pelanggan PDAM',
    admin: 3000,
    kata: ['pdam']
  },
  tagihan: {
    nama: 'Tagihan',
    ikon: '🧾',
    kas: 'warung',
    form: 'tagihan',
    tujuan: 'ID / nomor pelanggan',
    pilihan: [
      'BPJS Kesehatan',
      'Telkom / Indihome',
      'HP pascabayar',
      'Multifinance / cicilan',
      'TV kabel',
      'Lainnya'
    ],
    admin: 3000,
    kata: ['tagihan', 'bpjs', 'telkom', 'indihome', 'cicilan']
  },
  emoney: {
    nama: 'Emoney',
    ikon: '💳',
    kas: 'warung',
    form: 'nominal',
    tujuan: 'Nomor kartu',
    pilihan: ['Mandiri e-money', 'BRIZZI', 'Flazz BCA', 'TapCash BNI', 'Lainnya'],
    nominal: [20000, 50000, 100000, 200000],
    admin: 2000,
    kata: ['emoney', 'etoll', 'flazz', 'tapcash']
  },
  game: {
    nama: 'Game Voucher',
    ikon: '🎮',
    kas: 'warung',
    form: 'paket',
    tujuan: 'ID game / nomor HP',
    pilihan: PILIH_GAME,
    contohPaket: '86 diamond',
    admin: 2000,
    kata: ['game', 'diamond'],
    cart: 'VOUCHER GAME'
  },
  ewallet: {
    nama: 'Dompet Digital',
    ikon: '👛',
    kas: 'warung',
    form: 'nominal',
    tujuan: 'Nomor HP',
    pilihan: PILIH_EWALLET,
    nominal: NOMINAL_EWALLET,
    admin: 2000,
    kata: ['dana', 'ovo', 'gopay', 'shopeepay', 'linkaja', 'ewallet', 'dompet', 'topup']
  },
  hiburan: {
    nama: 'Hiburan',
    ikon: '🎬',
    kas: 'warung',
    form: 'paket',
    tujuan: 'Nomor HP / email',
    pilihan: ['Vidio', 'Netflix', 'Spotify', 'Lainnya'],
    contohPaket: '1 bulan',
    admin: 2000,
    kata: ['hiburan', 'vidio', 'netflix', 'spotify']
  },
  bpjstk: {
    nama: 'BP Jamsostek',
    ikon: '👷',
    kas: 'warung',
    form: 'tagihan',
    tujuan: 'No. KPJ / NIK peserta',
    admin: 3000,
    kata: ['jamsostek', 'bpjs']
  },
  motorlistrik: {
    nama: 'Motor Listrik',
    ikon: '🛵',
    kas: 'warung',
    form: 'paket',
    tujuan: 'ID / nomor pelanggan',
    contohPaket: 'isi / tukar baterai',
    admin: 2000,
    kata: ['motor']
  },

  /* ---------- BRILink (uang BRILink) · Layanan Bank ---------- */
  infosaldo: {
    nama: 'Info Saldo BRI',
    ikon: 'ℹ️',
    kas: 'brilink',
    form: 'jasa',
    arah: 'jasa',
    tujuan: NAMA_PELANGGAN,
    admin: 0,
    kata: ['saldo']
  },
  infosaldolain: {
    nama: 'Info Saldo Bank Lain',
    ikon: 'ℹ️',
    kas: 'brilink',
    form: 'jasa',
    arah: 'jasa',
    tujuan: NAMA_PELANGGAN,
    admin: 0,
    kata: ['saldo']
  },
  trfbri: {
    nama: 'Transfer BRI',
    ikon: '🔁',
    kas: 'brilink',
    form: 'nominal',
    arah: 'masuk',
    tujuan: 'No. rekening BRI & nama tujuan',
    awalan: 'ke ',
    nominal: NOMINAL_UANG,
    labelNom: 'Uang yang dikirim',
    admin: 5000,
    kata: ['transfer', 'tf', 'kirim']
  },
  trfbank: {
    nama: 'Transfer Bank Lain',
    ikon: '🏛️',
    kas: 'brilink',
    form: 'nominal',
    arah: 'masuk',
    tujuan: 'Bank, no. rekening & nama tujuan',
    awalan: 'ke ',
    nominal: NOMINAL_UANG,
    labelNom: 'Uang yang dikirim',
    admin: 5000,
    kata: ['transfer', 'tf', 'kirim', 'bank']
  },
  tarik: {
    nama: 'Tarik Tunai BRI',
    ikon: '💵',
    kas: 'brilink',
    form: 'nominal',
    arah: 'keluar',
    tujuan: NAMA_PELANGGAN,
    nominal: NOMINAL_TARIK,
    admin: 5000,
    kata: ['tarik']
  },
  setorsimpanan: {
    nama: 'Setor Simpanan',
    ikon: '🏦',
    kas: 'brilink',
    form: 'nominal',
    arah: 'masuk',
    tujuan: 'No. rekening BRI & nama',
    awalan: 'ke ',
    nominal: NOMINAL_UANG,
    labelNom: 'Uang yang disetor',
    admin: 3000,
    kata: ['setor', 'simpanan', 'nabung', 'tabung']
  },
  setorbank: {
    nama: 'Setor Ke Bank Lain',
    ikon: '🏛️',
    kas: 'brilink',
    form: 'nominal',
    arah: 'masuk',
    tujuan: 'Bank, no. rekening & nama',
    awalan: 'ke ',
    nominal: NOMINAL_UANG,
    labelNom: 'Uang yang disetor',
    admin: 5000,
    kata: ['setor', 'bank']
  },
  setorpinjaman: {
    nama: 'Setor Tunai Pinjaman',
    ikon: '📄',
    kas: 'brilink',
    form: 'tagihan',
    arah: 'masuk',
    tujuan: 'No. rekening pinjaman & nama',
    labelNom: 'Uang yang disetor',
    admin: 3000,
    kata: ['setor', 'pinjaman', 'angsuran', 'kur']
  },
  tariktanpakartu: {
    nama: 'Tarik Tunai Tanpa Kartu',
    ikon: '📲',
    kas: 'brilink',
    form: 'nominal',
    arah: 'keluar',
    tujuan: NAMA_PELANGGAN,
    nominal: NOMINAL_TARIK,
    admin: 5000,
    kata: ['tarik', 'tanpa']
  },
  enablekartu: {
    nama: 'Enable Kartu',
    ikon: '💳',
    kas: 'brilink',
    form: 'jasa',
    arah: 'jasa',
    tujuan: NAMA_PELANGGAN,
    admin: 0,
    kata: ['enable', 'aktivasi']
  },
  tarikln: {
    nama: 'Tarik Tunai Luar Negeri',
    ikon: '🌏',
    kas: 'brilink',
    form: 'nominal',
    arah: 'keluar',
    tujuan: NAMA_PELANGGAN,
    nominal: NOMINAL_TARIK,
    admin: 5000,
    kata: ['tarik', 'luar']
  },
  ubahpin: {
    nama: 'Ubah PIN',
    ikon: '🔑',
    kas: 'brilink',
    form: 'jasa',
    arah: 'jasa',
    tujuan: NAMA_PELANGGAN,
    admin: 0,
    kata: ['pin']
  },
  ministatement: {
    nama: 'Mini Statement',
    ikon: '📃',
    kas: 'brilink',
    form: 'jasa',
    arah: 'jasa',
    tujuan: NAMA_PELANGGAN,
    admin: 0,
    kata: ['mini', 'mutasi']
  },
  tarikdana: {
    nama: 'Tarik Tunai DANA',
    ikon: '👛',
    kas: 'brilink',
    form: 'nominal',
    arah: 'keluar',
    tujuan: 'Nomor HP DANA / nama',
    nominal: NOMINAL_TARIK,
    admin: 5000,
    kata: ['tarik', 'dana']
  },

  /* ---------- BRILink · Pembayaran ---------- */
  briva: {
    nama: 'BRIVA',
    ikon: '🧾',
    kas: 'brilink',
    form: 'tagihan',
    arah: 'masuk',
    tujuan: 'Nomor BRIVA',
    labelNom: 'Jumlah bayar',
    admin: 3000,
    kata: ['briva']
  },
  tokenbri: {
    nama: 'PLN Token',
    ikon: '⚡',
    kas: 'brilink',
    form: 'nominal',
    arah: 'masuk',
    tujuan: 'No. meter / ID pelanggan',
    nominal: NOMINAL_TOKEN,
    admin: 3000,
    token: true,
    ket: 'beli token (prabayar), nanti dapat nomor token',
    kata: ['token', 'listrik', 'pln'],
    cart: 'TOKEN LISTRIK'
  },
  tagihanbri: {
    nama: 'PLN Tagihan',
    ikon: '💡',
    kas: 'brilink',
    form: 'tagihan',
    arah: 'masuk',
    tujuan: 'ID pelanggan PLN',
    admin: 3000,
    ket: 'bayar tagihan bulanan (pascabayar)',
    kata: ['listrik', 'pln', 'tagihan'],
    cart: 'TAGIHAN LISTRIK'
  },
  telpon: {
    nama: 'Telepon Pascabayar',
    ikon: '☎️',
    kas: 'brilink',
    form: 'tagihan',
    arah: 'masuk',
    tujuan: 'Nomor telepon / HP',
    admin: 3000,
    kata: ['telepon', 'telpon', 'pascabayar', 'halo']
  },
  bpjskes: {
    nama: 'BPJS Kesehatan',
    ikon: '🏥',
    kas: 'brilink',
    form: 'tagihan',
    arah: 'masuk',
    tujuan: 'No. VA keluarga / no. kartu',
    admin: 3000,
    kata: ['bpjs', 'kesehatan']
  },
  bpjstkbri: {
    nama: 'BPJS Ketenagakerjaan',
    ikon: '👷',
    kas: 'brilink',
    form: 'tagihan',
    arah: 'masuk',
    tujuan: 'No. KPJ / NIK peserta',
    admin: 3000,
    kata: ['bpjs', 'jamsostek', 'ketenagakerjaan']
  },
  asuransi: {
    nama: 'Asuransi',
    ikon: '🛡️',
    kas: 'brilink',
    form: 'tagihan',
    arah: 'masuk',
    tujuan: 'No. polis',
    admin: 3000,
    kata: ['asuransi']
  },
  pdambri: {
    nama: 'PDAM',
    ikon: '🚰',
    kas: 'brilink',
    form: 'tagihan',
    arah: 'masuk',
    tujuan: 'No. pelanggan PDAM',
    admin: 3000,
    kata: ['pdam']
  },
  tokopedia: {
    nama: 'Tokopedia',
    ikon: '🛍️',
    kas: 'brilink',
    form: 'tagihan',
    arah: 'masuk',
    tujuan: 'Kode bayar Tokopedia',
    labelNom: 'Jumlah bayar',
    admin: 3000,
    kata: ['tokopedia', 'tokped']
  },
  pbb: {
    nama: 'Pajak Bumi Bangunan',
    ikon: '🏠',
    kas: 'brilink',
    form: 'tagihan',
    arah: 'masuk',
    tujuan: 'NOP (nomor objek pajak)',
    labelNom: 'Jumlah pajak',
    admin: 3000,
    kata: ['pbb', 'pajak'],
    cart: 'PAJAK BUMI BANGUNAN (PBB)'
  },
  multifinance: {
    nama: 'Multifinance',
    ikon: '🏍️',
    kas: 'brilink',
    form: 'tagihan',
    arah: 'masuk',
    tujuan: 'No. kontrak & nama',
    labelNom: 'Jumlah angsuran',
    admin: 3000,
    kata: ['multifinance', 'cicilan', 'leasing', 'angsuran', 'kredit']
  },
  nex: {
    nama: 'Nex Parabola',
    ikon: '📡',
    kas: 'brilink',
    form: 'tagihan',
    arah: 'masuk',
    tujuan: 'No. pelanggan',
    admin: 3000,
    kata: ['nex', 'parabola']
  },
  gadai: {
    nama: 'Pembayaran Gadai',
    ikon: '⚖️',
    kas: 'brilink',
    form: 'tagihan',
    arah: 'masuk',
    tujuan: 'No. gadai / nama',
    labelNom: 'Jumlah bayar',
    admin: 3000,
    kata: ['gadai', 'pegadaian']
  },
  mpn: {
    nama: 'MPN G3',
    ikon: '🏛️',
    kas: 'brilink',
    form: 'tagihan',
    arah: 'masuk',
    tujuan: 'Kode billing',
    labelNom: 'Jumlah bayar',
    admin: 3000,
    kata: ['mpn', 'billing', 'pajak']
  },
  kartukredit: {
    nama: 'Kartu Kredit',
    ikon: '💳',
    kas: 'brilink',
    form: 'tagihan',
    arah: 'masuk',
    tujuan: 'No. kartu kredit',
    labelNom: 'Jumlah bayar',
    admin: 3000,
    kata: ['kredit']
  },
  donasi: {
    nama: 'Donasi',
    ikon: '🤲',
    kas: 'brilink',
    form: 'tagihan',
    arah: 'masuk',
    tujuan: 'Tujuan donasi',
    labelNom: 'Jumlah donasi',
    admin: 0,
    kata: ['donasi', 'zakat', 'infaq', 'sedekah']
  },

  /* ---------- BRILink · Top Up ---------- */
  pulsabri: {
    nama: 'Pulsa & Paket Data',
    ikon: '📱',
    kas: 'brilink',
    form: 'nominal',
    arah: 'masuk',
    tujuan: 'Nomor HP',
    nominal: NOMINAL_PULSA,
    labelNom: 'Harga pulsa / paket',
    admin: 2000,
    kata: ['pulsa', 'data', 'kuota'],
    cart: 'PULSA / DATA'
  },
  gamebri: {
    nama: 'Voucher Games',
    ikon: '🎮',
    kas: 'brilink',
    form: 'tagihan',
    arah: 'masuk',
    tujuan: 'ID game / nomor HP',
    pilihan: PILIH_GAME,
    labelNom: 'Harga voucher',
    admin: 2000,
    kata: ['game', 'diamond'],
    cart: 'VOUCHER GAME'
  },
  brizzi: {
    nama: 'BRIZZI',
    ikon: '💳',
    kas: 'brilink',
    form: 'nominal',
    arah: 'masuk',
    tujuan: 'No. kartu BRIZZI',
    nominal: [20000, 50000, 100000, 200000],
    admin: 2000,
    kata: ['brizzi']
  },
  dompetbri: {
    nama: 'Dompet Digital',
    ikon: '👛',
    kas: 'brilink',
    form: 'nominal',
    arah: 'masuk',
    tujuan: 'Nomor HP',
    pilihan: PILIH_EWALLET,
    nominal: NOMINAL_EWALLET,
    admin: 2000,
    kata: ['dana', 'ovo', 'gopay', 'shopeepay', 'linkaja', 'ewallet', 'dompet', 'topup']
  },

  /* ---------- BRILink · Produk BRI ---------- */
  progpem: {
    nama: 'Program Pemerintah',
    ikon: '🏛️',
    kas: 'brilink',
    form: 'tagihan',
    arah: 'pilih',
    tujuan: 'Nama penerima / pelanggan',
    labelNom: 'Jumlah uang',
    admin: 0,
    kata: ['bansos', 'bantuan', 'blt', 'pkh']
  },
  brilogistik: {
    nama: 'BRI Logistik',
    ikon: '📦',
    kas: 'brilink',
    form: 'tagihan',
    arah: 'masuk',
    tujuan: 'Nama & alamat tujuan kiriman',
    labelNom: 'Ongkos kirim',
    admin: 0,
    kata: ['logistik', 'ekspedisi', 'ongkir']
  },

  /* ---------- BRILink · Tiket & Belanja ---------- */
  kereta: {
    nama: 'Tiket Kereta Api',
    ikon: '🚆',
    kas: 'brilink',
    form: 'tagihan',
    arah: 'masuk',
    tujuan: 'Nama penumpang / kode booking',
    labelNom: 'Harga tiket',
    admin: 5000,
    kata: ['kereta', 'kai', 'tiket']
  },
  pesawat: {
    nama: 'Tiket Pesawat',
    ikon: '✈️',
    kas: 'brilink',
    form: 'tagihan',
    arah: 'masuk',
    tujuan: 'Nama penumpang / kode booking',
    labelNom: 'Harga tiket',
    admin: 5000,
    kata: ['pesawat', 'tiket']
  },
  pasarbri: {
    nama: 'Pasar BRILink',
    ikon: '🏪',
    kas: 'brilink',
    form: 'tagihan',
    arah: 'masuk',
    tujuan: 'Keterangan belanja',
    labelNom: 'Total belanja',
    admin: 0,
    kata: ['pasar']
  },

  /* ---------- versi lama (22 Okt), tetap bisa dibaca di riwayat ---------- */
  transfer: {
    nama: 'Transfer / setor tunai',
    ikon: '🏦',
    kas: 'brilink',
    form: 'nominal',
    arah: 'masuk',
    tujuan: 'Bank, no. rekening & nama tujuan',
    awalan: 'ke ',
    nominal: NOMINAL_UANG,
    admin: 5000,
    cart: 'TRANSFER / SETOR',
    lama: true
  },
  bribayar: {
    nama: 'Bayar lewat BRILink',
    ikon: '🧾',
    kas: 'brilink',
    form: 'tagihan',
    arah: 'masuk',
    tujuan: 'ID / nomor pelanggan',
    pilihan: ['Tagihan listrik', 'BPJS', 'Top up e-wallet', 'Cicilan', 'Lainnya'],
    admin: 3000,
    cart: 'BAYAR (BRILINK)',
    lama: true
  }
};
/** Susunan menu, sama urutannya dengan layar aplikasi. {id, nama, ikon, sub} = tombol yang membuka pilihan lagi. */
const MENU_LAYANAN = [
  {
    kas: 'warung',
    judul: 'PojokBayar',
    ikon: '📲',
    bagian: [
      {
        judul: '',
        isi: [
          'pbsahabat',
          'pbkirim',
          'pulsa',
          'kuota',
          { id: 'listrik', nama: 'Listrik', ikon: '💡', sub: ['token', 'pln'] },
          'pdam',
          'tagihan',
          'emoney',
          'game',
          'ewallet',
          'hiburan',
          'bpjstk',
          'motorlistrik'
        ]
      }
    ]
  },
  {
    kas: 'brilink',
    judul: 'BRILink',
    ikon: '🏦',
    bagian: [
      {
        judul: 'Layanan Bank',
        isi: [
          'infosaldo',
          'infosaldolain',
          'trfbri',
          'trfbank',
          'tarik',
          'setorsimpanan',
          'setorbank',
          'setorpinjaman',
          'tariktanpakartu',
          'enablekartu',
          'tarikln',
          'ubahpin',
          'ministatement',
          'tarikdana'
        ]
      },
      {
        judul: 'Pembayaran',
        isi: [
          'briva',
          { id: 'plnbri', nama: 'PLN', ikon: '⚡', sub: ['tokenbri', 'tagihanbri'] },
          'telpon',
          'bpjskes',
          'bpjstkbri',
          'asuransi',
          'pdambri',
          'tokopedia',
          'pbb',
          'multifinance',
          'nex',
          'gadai',
          'mpn',
          'kartukredit',
          'donasi'
        ]
      },
      { judul: 'Top Up', isi: ['pulsabri', 'gamebri', 'brizzi', 'dompetbri'] },
      { judul: 'Produk BRI', isi: ['progpem', 'brilogistik'] },
      { judul: 'Tiket & Belanja', isi: ['kereta', 'pesawat', 'pasarbri'] }
    ]
  }
];
/** Semua jenis layanan sesuai urutan menu (tombol bersub dibuka) */
function urutanLayanan() {
  const out = [];
  for (const g of MENU_LAYANAN)
    for (const b of g.bagian) for (const x of b.isi) typeof x === 'string' ? out.push(x) : out.push(...x.sub);
  return out;
}
/** Yang paling sering dipakai kalau hanya mengetik "bri" di kolom scan */
const BRILINK_POPULER = ['tarik', 'trfbri', 'trfbank', 'setorsimpanan', 'tokenbri', 'pulsabri'];
/** Kata yang langsung memilih pilihan tertentu, misal "dana" -> Dompet Digital DANA */
const KATA_PILIHAN = {
  dana: 'DANA',
  ovo: 'OVO',
  gopay: 'GoPay',
  shopeepay: 'ShopeePay',
  linkaja: 'LinkAja',
  bpjs: 'BPJS Kesehatan',
  telkom: 'Telkom / Indihome',
  indihome: 'Telkom / Indihome',
  cicilan: 'Multifinance / cicilan',
  flazz: 'Flazz BCA',
  tapcash: 'TapCash BNI',
  vidio: 'Vidio',
  netflix: 'Netflix',
  spotify: 'Spotify'
};
