/* ============ PEMBACA DAFTAR BELANJA (dipakai halaman pesan & kasir) ============
 * Mengubah teks pesanan (dari WhatsApp atau tulisan pembeli) menjadi baris barang.
 *   BacaDaftar.baca(teks, { angkaDiNama }) ->
 *     { nama, hp, harga, catatan, baris: [{ teks, qty, unit, kata, bebas }] }
 * Tahan terhadap:
 *  - awalan salinan WhatsApp: "[06.58, 31/10/2026] Bu Ani: gula 2 kg" (nama pengirim dipakai sebagai nama)
 *  - daftar dalam satu baris dipisah koma: "gula 2kg, minyak 1 liter, telur sekilo"
 *  - jumlah di depan atau di belakang: "2 renceng kopi", "kopi 2 renceng", "indomie x2"
 *  - kata bilangan: sekilo, setengah kilo, dua bungkus, bahasa Sunda (sakilo, tilu, satengah)
 *  - sapaan & penutup: "Assalamualaikum bu", "punten", "nuhun", "itu aja ya"
 *  - angka yang bagian dari nama barang: "surya 16", "aqua 600" (lewat angkaDiNama)
 * Baris rapi dari halaman pesan berbentuk "2 renceng - NAMA BARANG".
 */
const BacaDaftar = (() => {
  // kata satuan yang ditulis pembeli -> kode satuan di aplikasi
  const SATUAN = {
    renceng: 'RCG',
    rencang: 'RCG',
    renteng: 'RCG',
    rcg: 'RCG',
    l: 'RCG', // singkatan lama di toko: "3 L indocafe" = 3 renceng
    bungkus: 'BKS',
    bks: 'BKS',
    bgks: 'BKS',
    bungkos: 'BKS',
    pcs: 'PCS',
    pc: 'PCS',
    biji: 'PCS',
    buah: 'PCS',
    bh: 'PCS',
    butir: 'PCS',
    btr: 'PCS',
    batang: 'PCS',
    btg: 'PCS',
    siki: 'PCS',
    lembar: 'PCS',
    lbr: 'PCS',
    pak: 'PACK',
    pack: 'PACK',
    pck: 'PACK',
    dus: 'DUS',
    dos: 'DUS',
    karton: 'KTN',
    ktn: 'KTN',
    box: 'BOX',
    kotak: 'BOX',
    slop: 'SLOP',
    slp: 'SLOP',
    selop: 'SLOP',
    kg: 'KG',
    kilo: 'KG',
    kilogram: 'KG',
    ons: 'ONS',
    liter: 'LITER',
    ltr: 'LITER',
    lt: 'LITER',
    botol: 'BTL',
    btl: 'BTL',
    kaleng: 'KLG',
    klg: 'KLG',
    sachet: 'SACHET',
    saset: 'SACHET',
    sct: 'SACHET',
    lusin: 'LUSIN',
    ikat: 'IKAT',
    iket: 'IKAT',
    toples: 'TOPLES',
    strip: 'STRIP',
    sak: 'SAK',
    karung: 'KARUNG',
    bal: 'BAL',
    galon: 'GALON',
    pouch: 'POUCH'
  };
  // kode satuan -> kata yang mudah dibaca pembeli
  const KATA = {
    RCG: 'renceng',
    BKS: 'bungkus',
    PCS: 'pcs',
    PACK: 'pak',
    PAK: 'pak',
    PCK: 'pak',
    DUS: 'dus',
    KTN: 'karton',
    BOX: 'box',
    SLOP: 'slop',
    SLP: 'slop',
    KG: 'kg',
    ONS: 'ons',
    LITER: 'liter',
    BTL: 'botol',
    KLG: 'kaleng',
    SACHET: 'sachet',
    LUSIN: 'lusin',
    IKAT: 'ikat',
    TOPLES: 'toples',
    STRIP: 'strip',
    SAK: 'sak',
    KARUNG: 'karung',
    BAL: 'bal',
    GALON: 'galon',
    POUCH: 'pouch'
  };
  const ANGKA = {
    satu: 1,
    hiji: 1,
    dua: 2,
    tiga: 3,
    tilu: 3,
    empat: 4,
    opat: 4,
    lima: 5,
    enam: 6,
    genep: 6,
    tujuh: 7,
    delapan: 8,
    dalapan: 8,
    sembilan: 9,
    salapan: 9,
    sepuluh: 10,
    sapuluh: 10,
    setengah: 0.5,
    satengah: 0.5,
    stengah: 0.5,
    seperempat: 0.25,
    saparapat: 0.25
  };
  // kata yang hanya sapaan / basa-basi, bukan barang
  const SAPA = new Set(
    (
      'assalamualaikum asalamualaikum assalamu alaikum alaikumsalam wr wb wassalamualaikum wassalam punten permisi ' +
      'halo hallo hai hi selamat pagi siang sore malam bu ibu pak bapak teh teteh ceu euceu mang emang kang akang aa ' +
      'bi bibi neng mbak mas om tante bos boss haji hj terima kasih makasih trims tq thanks nuhun hatur sekian ' +
      'ya yah yaa mau mo pengen ingin pesan pesen mesen order dong nya aja saja wae deh itu segitu dulu ini berikut ' +
      'daftar belanja belanjaan list barang saya aku abdi kami tolong minta mohon sehat semoga barokah amin'
    ).split(' ')
  );
  const PEMBUKA =
    /^(?:ass?alamu|asalamu|punten|permisi|hall?o\b|selamat (?:pagi|siang|sore|malam)|terima ?kasih|makasih|hatur nuhun|nuhun|wassalam)/i;
  const PENGISI_DEPAN =
    /^(?:(?:mau|mo|pengen|ingin|minta|tolong|mohon|pesen|pesan|mesen|beli|meuli|order|ambil|tambah|tambahin|ditambah|plus|terus|trus|lalu|sama|sareng|jeung|dan|juga|yang|yg|nu)\s+)+/i;
  const PENGISI_BELAKANG = /(?:\s+(?:ya|yah|yaa|aja|saja|wae|deh|dong|juga|bu|ibu|kang|ceu|neng))+$/i;

  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const RE_SAT = Object.keys(SATUAN)
    .sort((a, b) => b.length - a.length)
    .map(esc)
    .join('|');
  const RE_SE =
    'kilo|kg|renceng|rencang|bungkus|dus|slop|pak|botol|kaleng|liter|lusin|ikat|iket|ons|sachet|butir|biji|batang|karton|galon|sak|karung|bal|bks|rcg';
  const RE_ANGKA = Object.keys(ANGKA)
    .sort((a, b) => b.length - a.length)
    .join('|');
  const Q = '(\\d+\\s*\\/\\s*\\d+|\\d+(?:[.,]\\d+)?)';
  const R = {
    // rapi dari halaman pesan / ketik rapi: "2 renceng - NAMA", "1 - nama", "2 kg = gula"
    rapi: new RegExp('^' + Q + '(?:\\s*([A-Za-z][A-Za-z ]{0,14}?))?\\s+[-–=:]\\s+(.+)$'),
    // "gula = 2 kg", "kopi : 2 renceng"
    rapiBalik: new RegExp('^(.+?)\\s+[-–=:]\\s+' + Q + '\\s*([A-Za-z][A-Za-z ]{0,14})?$'),
    xDepan: new RegExp('^' + Q + '\\s*[x×]\\s*(.+)$', 'i'),
    xBelakang: new RegExp('^(.+?)\\s*[x×]\\s*' + Q + '$', 'i'),
    depan: new RegExp('^' + Q + '(?:\\s*(' + RE_SAT + ')\\b\\.?)?\\s+(.+)$', 'i'),
    belakangSatuan: new RegExp('^(.+)\\s+' + Q + '\\s*(' + RE_SAT + ')\\.?$', 'i'),
    belakangAngka: new RegExp('^(.+?)\\s+' + Q + '$'),
    satuanSaja: new RegExp('^(.+)\\s+(' + RE_SAT + ')\\.?$', 'i')
  };
  // awalan salinan WhatsApp Web/Desktop dan file ekspor chat
  const WA1 =
    /^\[\d{1,2}[.:]\d{2}(?:[.:]\d{2})?(?:\s?[APap][Mm])?,\s*\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}\]\s*([^:]{1,40}):\s*/;
  const WA2 = /^\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}[.:]\d{2}(?:\s?[APap][Mm])?\s+-\s+([^:]{1,40}):\s*/;
  const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}]/gu;

  const namaSatuan = u => KATA[String(u || '').toUpperCase()] || String(u || '').toLowerCase();
  const kodeSatuan = w => {
    const k = String(w || '')
      .toLowerCase()
      .replace(/\.$/, '')
      .trim();
    return SATUAN[k] || '';
  };
  function angka(s) {
    s = String(s).trim().toLowerCase();
    if (ANGKA[s] != null) return ANGKA[s];
    const f = s.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (f) return Number(f[2]) ? Number(f[1]) / Number(f[2]) : 0;
    return Number(s.replace(',', '.')) || 0;
  }
  /** jumlah untuk ditampilkan: 0.5 -> "0,5", 2 -> "2" */
  const fmtQty = q => String(Math.round(Number(q) * 100) / 100).replace('.', ',');

  /** kata bilangan & "sekilo" -> angka, "2kg" -> "2 kg" */
  function normAngka(t) {
    t = t.replace(new RegExp('\\b(?:se|sa)(' + RE_SE + ')\\b', 'gi'), '1 $1');
    t = t.replace(
      new RegExp('\\b(\\d+|' + RE_ANGKA + ')\\s+(?:setengah|satengah|stengah)\\s+(' + RE_SAT + ')\\b', 'gi'),
      (_, a, u) => angka(a) + 0.5 + ' ' + u
    );
    t = t.replace(
      new RegExp('\\b(' + RE_ANGKA + ')\\s+(' + RE_SAT + ')\\b', 'gi'),
      (_, a, u) => angka(a) + ' ' + u
    );
    t = t.replace(new RegExp('\\s(' + RE_ANGKA + ')$', 'i'), (_, a) => ' ' + angka(a));
    t = t.replace(new RegExp('(\\d)(' + RE_SAT + ')\\b', 'gi'), '$1 $2');
    return t;
  }
  function bersih(line, o) {
    line = String(line).replace(/[  ]/g, ' ');
    const m = line.match(WA1) || line.match(WA2);
    if (m) {
      const s = m[1].trim();
      if (/^[+\d][\d\s-]{7,}$/.test(s)) o._hpWA = o._hpWA || s;
      else o._namaWA = o._namaWA || s;
      line = line.slice(m[0].length);
    }
    return line
      .replace(EMOJI, ' ')
      .replace(/[*_~`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  /** satu baris bisa berisi beberapa barang: dipisah koma, titik koma, "+", atau "dan" setelah jumlah */
  function pecah(line) {
    line = line.replace(/^\s*(?:\d{1,3}[.)]\s+(?=\S)|[-•*·▪>»]+\s*)/, '');
    if (R.rapi.test(line)) return [line];
    const out = [];
    const akhirJumlah = new RegExp('(?:\\d|\\b(?:' + RE_SAT + '))$', 'i');
    for (const b of line.split(/\s*[;,]\s*(?!\d)|\s+\+\s+|\.\s+(?=[A-Za-z])|[.!?]+$/)) {
      // "gula 2 kg dan minyak 1 liter": dipisah hanya kalau bagian kiri sudah diakhiri jumlah/satuan
      // (tanpa lookbehind regex supaya tetap jalan di HP lama)
      const pot = b.split(/\s+(?:dan|sama|jeung|terus|trus|tambah|plus)\s+/i);
      let cur = pot[0];
      const kata = b.match(/\s+(?:dan|sama|jeung|terus|trus|tambah|plus)\s+/gi) || [];
      for (let i = 1; i < pot.length; i++) {
        if (akhirJumlah.test(cur.trim())) {
          out.push(cur);
          cur = pot[i];
        } else cur += kata[i - 1] + pot[i];
      }
      out.push(cur);
    }
    return out.map(x => x.trim()).filter(Boolean);
  }
  function hanyaSapaan(t) {
    if (/\d/.test(t)) return false;
    if (PEMBUKA.test(t)) return true;
    const w = t
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter(Boolean);
    return !w.length || w.every(x => SAPA.has(x));
  }
  function rapikanTeks(t) {
    return t
      .replace(PENGISI_DEPAN, '')
      .replace(PENGISI_BELAKANG, '')
      .replace(/^[-x×*:=.,\s]+|[-x×*:=,\s]+$/g, '')
      .trim();
  }
  /** satu barang: { teks, qty, unit, kata, bebas } atau null */
  function bacaItem(c, opt, o, awalBaris) {
    let t = c.replace(/^\s*(?:\d{1,3}[.)]\s+|[-•*·▪>»]+\s*)/, '').trim();
    if (!t) return null;
    let bebas = false;
    const tanda = /\s*[[(](?:belum|tidak) ada di daftar[\])]\s*/i;
    if (tanda.test(t)) {
      bebas = true;
      t = t.replace(tanda, ' ').trim();
    }
    let m = t.match(R.rapi);
    if (m) {
      const w = (m[2] || '').trim();
      return jadi(m[3], angka(m[1]), w, bebas);
    }
    if (hanyaSapaan(t) && (awalBaris || !/^teh$/i.test(t))) return null;
    if (!/\d/.test(t) && t.split(' ').length <= 8) {
      if (/\b(?:di)?(?:antar|anter|anterin|antarkan|kirim|kirimin|kirimkan)\b/i.test(t)) {
        o.ambil = 'Diantar';
        if (t.split(' ').length > 1 && !/^(?:di)?(?:antar|anter)(?:kan)?$/i.test(t)) o.catatan.push(t);
        return null;
      }
      if (
        /(?:^|\s)diambil\b|\bambil (?:sendiri|ke toko|nanti|sore|besok)|^nanti (?:di)?ambil|\bke toko\b/i.test(
          t
        )
      ) {
        o.ambil = 'Diambil ke toko';
        return null;
      }
    }
    t = normAngka(t.replace(PENGISI_DEPAN, '').replace(PENGISI_BELAKANG, ''));
    if ((m = t.match(R.rapiBalik))) return jadi(m[1], angka(m[2]), (m[3] || '').trim(), bebas);
    let qty = 1,
      kata = '',
      teks = t;
    if ((m = t.match(R.xDepan))) {
      qty = angka(m[1]);
      teks = m[2];
    } else if ((m = t.match(R.depan))) {
      qty = angka(m[1]);
      kata = m[2] || '';
      teks = m[3];
      // "2 kopi kapal api renceng" -> satuan di belakang
      if (!kata && (m = teks.match(R.satuanSaja))) {
        teks = m[1];
        kata = m[2];
      }
    } else if ((m = t.match(R.belakangSatuan))) {
      teks = m[1];
      qty = angka(m[2]);
      kata = m[3];
    } else if ((m = t.match(R.xBelakang))) {
      teks = m[1];
      qty = angka(m[2]);
    } else if ((m = t.match(R.belakangAngka))) {
      const diNama = opt.angkaDiNama ? opt.angkaDiNama(m[1], m[2]) : angka(m[2]) >= 100;
      if (!diNama) {
        teks = m[1];
        qty = angka(m[2]);
      }
    } else if ((m = t.match(R.satuanSaja)) && !/^pak$/i.test(m[2])) {
      // "indomie goreng dus" (tanpa angka). "pak" di akhir lebih sering sapaan.
      teks = m[1];
      kata = m[2];
    }
    return jadi(teks, qty, kata, bebas);
  }
  function jadi(teks, qty, kata, bebas) {
    teks = rapikanTeks(String(teks || ''));
    if (!teks || !/[a-z0-9]/i.test(teks)) return null;
    kata = String(kata || '').toLowerCase();
    return {
      teks,
      qty: qty > 0 ? Math.round(qty * 1000) / 1000 : 1,
      unit: kata ? kodeSatuan(kata) || kata.toUpperCase() : '',
      kata,
      bebas
    };
  }

  function baca(raw, opt = {}) {
    const o = { nama: '', hp: '', harga: '', ambil: '', catatan: [], baris: [] };
    for (const asli of String(raw || '').split(/\r?\n/)) {
      const line = bersih(asli, o);
      if (!line) continue;
      let m;
      if ((m = line.match(/^nama(?:\s+(?:pemesan|pembeli|warung|toko|lengkap))?\s*[:=]\s*(.*)$/i))) {
        if (m[1].trim()) o.nama = m[1].trim();
        continue;
      }
      if ((m = line.match(/^(?:no\.?\s*)?(?:hp|wa|telp|telepon|whatsapp)\.?\s*[:=]\s*(.*)$/i))) {
        o.hp = m[1].trim();
        continue;
      }
      if ((m = line.match(/^harga\s*[:=]\s*(.+)$/i))) {
        o.harga = m[1].trim();
        continue;
      }
      if ((m = line.match(/^(catatan|keterangan|ket|alamat)\s*[:=]\s*(.*)$/i))) {
        if (m[2].trim()) o.catatan.push((/^alamat/i.test(m[1]) ? 'Alamat: ' : '') + m[2].trim());
        continue;
      }
      if ((m = line.match(/^(?:ambil|diambil|antar|diantar|pengambilan|pengiriman)\s*[:=]\s*(.+)$/i))) {
        o.ambil = /antar|kirim/i.test(m[1] + m[2]) ? 'Diantar' : 'Diambil ke toko';
        continue;
      }
      if (/^(?:diantar|diambil(?: ke toko)?|antar|ambil(?: ke toko| sendiri)?)\.?$/i.test(line)) {
        o.ambil = /antar/i.test(line) ? 'Diantar' : 'Diambil ke toko';
        continue;
      }
      if (/https?:\/\/|#pesan=/i.test(line) || /^(?:buka di kasir|link pesanan|kode pesanan)\b/i.test(line))
        continue;
      if (/^(?:perkiraan |kira-kira |jumlah )?total\b[^a-z]*(?:rp|:|$)/i.test(line)) continue;
      if (/^[-=_~.]{3,}$/.test(line)) continue;
      if (/^pesanan\b/i.test(line) && !/\d/.test(line)) continue;
      // kalimat petunjuk dari contoh format yang ikut tersalin
      if (/^(?:cara pesan|tulis nama|contoh\b|atau pesan|satu baris)/i.test(line)) continue;
      if (/:$/.test(line) && !/\d/.test(line)) continue;
      pecah(line).forEach((c, i) => {
        const b = bacaItem(c, opt, o, i === 0);
        if (b) o.baris.push(b);
      });
    }
    if (!o.nama && o._namaWA) o.nama = o._namaWA;
    if (!o.hp && o._hpWA) o.hp = o._hpWA;
    return {
      nama: o.nama,
      hp: o.hp,
      harga: o.harga,
      ambil: o.ambil,
      catatan: [o.ambil, ...o.catatan].filter(Boolean).join(' · '),
      baris: o.baris
    };
  }

  /** Ukuran di nama barang cocok dengan jumlah pesanan? "telur 1/2 kg" vs "TELUR AYAM 1/2 KG".
   *  2 = persis (barang itu sudah seukuran pesanan, jumlahnya jadi 1), 1 = barang ukuran 1 kg/liter, 0 = tidak */
  const UKUR = { KG: ['kg', 'kilo'], LITER: ['liter', 'ltr', 'lt', 'l'], ONS: ['ons'] };
  const PECAHAN = { 0.5: ['1/2'], 0.25: ['1/4'], 0.75: ['3/4'], 1.5: ['1.5'] };
  const tokUkur = s =>
    String(s || '')
      .toLowerCase()
      .replace(/(\d),(\d)/g, '$1.$2')
      .replace(/(\d)([a-z])/g, '$1 $2')
      .replace(/[^a-z0-9./]+/g, ' ')
      .trim()
      .split(' ');
  function ukuran(nama, qty, unit) {
    const k = UKUR[String(unit || '').toUpperCase()];
    if (!k || !(qty > 0)) return 0;
    const t = tokUkur(nama);
    const ada = b => t.some((x, i) => x === b && k.includes(t[i + 1]));
    if ([String(Math.round(qty * 1000) / 1000), ...(PECAHAN[qty] || [])].some(ada)) return 2;
    return qty >= 1 && ada('1') ? 1 : 0;
  }

  /** pembantu: apakah angka di belakang ("surya 16") bagian dari nama barang? */
  function pembantuAngka(idx, namaOf) {
    return (teks, n) => {
      const r = CariProduk.cari(idx, teks + ' ' + n, 1);
      return !!r[0] && CariProduk.tokens(namaOf(r[0])).includes(CariProduk.norm(n));
    };
  }

  return { baca, namaSatuan, kodeSatuan, fmtQty, angka, ukuran, pembantuAngka, SATUAN };
})();
