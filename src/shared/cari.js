/* ============ MESIN PENCARIAN PRODUK (dipakai halaman pesan pelanggan) ============
 * Pencarian yang "memaafkan": tahan salah ketik ringan, paham istilah sehari-hari / bahasa Sunda,
 * dan mengurutkan hasil dari yang paling cocok + paling sering dibeli.
 *   const idx = CariProduk.indeks(daftar, item => ({ nama, alias, kategori, populer }));
 *   CariProduk.cari(idx, 'endog 1 kg', 30)  ->  [item, ...]
 */
const CariProduk = (() => {
  // istilah pelanggan -> kata yang ada di nama produk
  const SINONIM = {
    endog: ['telur'],
    telor: ['telur'],
    odol: ['pasta gigi', 'pepsodent', 'ciptadent', 'formula'],
    aci: ['tapioka', 'kanji'],
    kanji: ['tapioka'],
    bako: ['tembakau'],
    samsu: ['dji sam soe'],
    gg: ['gudang garam'],
    jarum: ['djarum'],
    djarum: ['jarum'],
    roko: ['rokok'],
    udud: ['rokok'],
    mi: ['mie'],
    mei: ['mie'],
    indomi: ['indomie'],
    supermi: ['supermie'],
    minyak: ['minyak goreng'],
    migor: ['minyak goreng'],
    beas: ['beras'],
    uyah: ['garam'],
    gulpas: ['gula pasir', 'gula putih'],
    pasir: ['putih'],
    saos: ['saus'],
    saus: ['saos'],
    sampo: ['shampoo', 'shampo'],
    shampo: ['shampoo'],
    tisu: ['tissue', 'tisue'],
    tissue: ['tisu'],
    pampers: ['popok'],
    popok: ['pampers', 'diapers'],
    deterjen: ['detergen', 'rinso', 'daia', 'soklin', 'attack'],
    detergen: ['deterjen'],
    sabun: ['soap'],
    korek: ['korek api'],
    nyamuk: ['obat nyamuk', 'baygon', 'vape', 'hit'],
    kopi: ['coffee'],
    susu: ['milk'],
    es: ['ice'],
    cai: ['air'],
    aqua: ['air mineral'],
    galon: ['air galon'],
    kerupuk: ['krupuk'],
    krupuk: ['kerupuk'],
    permen: ['candy'],
    royko: ['royco'],
    vetsin: ['micin', 'sasa', 'ajinomoto'],
    micin: ['penyedap', 'sasa', 'ajinomoto', 'masako'],
    pembalut: ['softex', 'charm', 'laurier'],
    rinso: ['deterjen'],
    terigu: ['tepung terigu'],
    tepung: ['terigu']
  };
  // kata yang tidak menentukan barang (boleh tidak cocok)
  const KATA_BEBAS = new Set([
    'yang',
    'yg',
    'dan',
    'sama',
    'beli',
    'mau',
    'pesan',
    'pesen',
    'tolong',
    'nu',
    'anu',
    'teh',
    'sareng',
    'rasa'
  ]);
  const SATUAN = new Set([
    'pcs',
    'pc',
    'rcg',
    'renceng',
    'bks',
    'bungkus',
    'dus',
    'karton',
    'ktn',
    'pak',
    'pack',
    'slop',
    'btl',
    'botol',
    'kg',
    'gr',
    'gram',
    'ml',
    'liter',
    'ltr',
    'sachet',
    'box',
    'lusin',
    'klg',
    'kaleng',
    'biji',
    'buah',
    'kilo',
    'kilogram',
    'ons',
    'butir',
    'btr',
    'batang',
    'btg',
    'ikat',
    'iket',
    'galon',
    'kotak',
    'pouch',
    'sak',
    'karung',
    'bal',
    'lembar',
    'selop',
    'slp',
    'saset',
    'sct',
    'bgks',
    'dos',
    'lt',
    'rencang',
    'renteng',
    'l'
  ]);

  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/(\d)([a-z])/g, '$1 $2')
      .replace(/([a-z])(\d)/g, '$1 $2')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }
  const tokens = s => norm(s).split(' ').filter(Boolean);
  /** bentuk "bunyi" sebuah kata, supaya ejaan Indonesia untuk merek asing tetap cocok (sunlite = sunlight) */
  const bunyi = w =>
    w
      .replace(/ght/g, 't')
      .replace(/ph/g, 'f')
      .replace(/ck|q/g, 'k')
      .replace(/x/g, 'ks')
      .replace(/dj/g, 'j')
      .replace(/tj/g, 'c')
      .replace(/sh/g, 's')
      .replace(/oe|oo/g, 'u')
      .replace(/ee|y/g, 'i')
      .replace(/(.)\1+/g, '$1')
      .replace(/h$/, '');

  /** jarak edit (Damerau-Levenshtein terbatas), berhenti kalau sudah > maks */
  function jarak(a, b, maks) {
    if (Math.abs(a.length - b.length) > maks) return maks + 1;
    const d = [];
    for (let i = 0; i <= a.length; i++) d[i] = [i];
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      let rowMin = Infinity;
      for (let j = 1; j <= b.length; j++) {
        const c = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
          v = Math.min(v, d[i - 2][j - 2] + 1);
        d[i][j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > maks) return maks + 1;
    }
    return d[a.length][b.length];
  }

  function indeks(list, ambil) {
    return list.map(item => {
      const x = ambil(item);
      const namaTok = tokens(x.nama);
      const aliasTok = tokens(x.alias);
      return {
        item,
        namaTok,
        semua: [...new Set([...namaTok, ...aliasTok])],
        katTok: tokens(x.kategori),
        teks: ' ' + [...namaTok, '|', ...aliasTok].join(' ') + ' ',
        populer: Number(x.populer) || 0,
        prioritas: Array.isArray(x.prioritas) ? x.prioritas.map(k => String(k).toLowerCase()) : [],
        prioritasEkstra: Number(x.prioritasEkstra) || 0,
        // singkatan dari huruf depan tiap kata: "gudang garam surya 16" -> ggs / ggs16
        singkat: namaTok
          .filter(t => !/^\d/.test(t))
          .map(t => t[0])
          .join(''),
        singkatAngka: namaTok.map(t => (/^\d/.test(t) ? t : t[0])).join('')
      };
    });
  }

  /** skor satu kata pencarian terhadap satu produk (0 = tidak cocok) */
  function skorKata(e, q) {
    if (e.semua.includes(q)) return 10;
    const angka = /^\d+$/.test(q);
    if (!angka && q.length >= 2 && e.semua.some(t => t.startsWith(q))) return 7;
    if (!angka && q.length >= 3 && e.teks.includes(q)) return 4;
    for (const s of SINONIM[q] || [])
      if (e.teks.includes(' ' + norm(s) + ' ') || e.teks.includes(' ' + norm(s))) return 9;
    if (e.katTok.includes(q) || (q.length >= 4 && e.katTok.some(t => t.startsWith(q)))) return 5;
    if (!angka && q.length >= 4) {
      const maks = q.length >= 7 ? 2 : 1;
      const qb = bunyi(q);
      const mirip = t => {
        const tb = bunyi(t);
        const potong = tb.length > qb.length + 1 ? tb.slice(0, qb.length + 1) : tb;
        return qb === tb || jarak(qb, potong, maks) <= maks;
      };
      if (e.semua.some(t => t.length >= 3 && mirip(t))) return 3;
    }
    return 0;
  }

  /** barang kebutuhan rumah tangga: naik jauh kalau yang dicari berhubungan dengan kata kuncinya
   *  (cari "minyak" -> minyak goreng), naik sedikit kalau tidak (cari "garam" -> rokok Gudang Garam) */
  function skorPrioritas(e, kataCari) {
    const k = e.prioritas;
    if (!k.length) return 0;
    if (k.includes('*')) return 30 + 5 * e.prioritasEkstra;
    const nyambung = kataCari.some(
      w =>
        w.length >= 2 && k.some(x => x.startsWith(w) || w.startsWith(x) || (w.length >= 4 && x.includes(w)))
    );
    return nyambung ? 30 + 5 * e.prioritasEkstra : 6;
  }

  /** seperti cari(), tetapi tiap hasil membawa skornya ({item, skor, cocok}).
   *  cocok = kemiripan kata saja (tanpa laris/prioritas), dipakai untuk menilai "yakin atau tidak" */
  function cariSkor(idx, query, batas = 40) {
    const qs = tokens(query);
    if (!qs.length) return [];
    const wajib = qs.filter(q => !KATA_BEBAS.has(q) && !SATUAN.has(q) && !/^\d+$/.test(q));
    const opsional = qs.filter(q => !wajib.includes(q));
    const qn = norm(query);
    const qRapat = qn.replace(/ /g, '');
    const bisaSingkat = qs.length <= 2 && qRapat.length >= 2 && /^[a-z]/.test(qRapat);
    const hasil = [];
    for (const e of idx) {
      if (bisaSingkat && (e.singkat.startsWith(qRapat) || e.singkatAngka.startsWith(qRapat))) {
        const persis = e.singkat === qRapat || e.singkatAngka === qRapat;
        hasil.push([
          (persis ? 30 : 18) + Math.min(6, Math.log2(1 + e.populer)) + skorPrioritas(e, []),
          e,
          persis ? 30 : 18
        ]);
        continue;
      }
      let skor = 0,
        meleset = 0;
      for (const q of wajib) {
        const s = skorKata(e, q);
        if (s) skor += s;
        else meleset++;
      }
      if (wajib.length && (meleset > 1 || (meleset === 1 && wajib.length < 3))) continue;
      if (!wajib.length && !opsional.some(q => e.semua.includes(q))) continue;
      skor -= meleset * 6;
      for (const q of opsional) if (e.semua.includes(q)) skor += 6;
      if (e.teks.startsWith(' ' + qn)) skor += 8;
      const cocok = skor; // kemiripan kata saja, sebelum ditambah laris / prioritas
      if (wajib[0] && e.namaTok[0] && (e.namaTok[0] === wajib[0] || e.namaTok[0].startsWith(wajib[0])))
        skor += 4;
      skor += Math.min(6, Math.log2(1 + e.populer));
      skor += skorPrioritas(e, wajib);
      skor -= e.namaTok.length * 0.15;
      hasil.push([skor, e, cocok]);
    }
    hasil.sort((a, b) => b[0] - a[0] || b[1].populer - a[1].populer);
    return hasil.slice(0, batas).map(h => ({ item: h[1].item, skor: h[0], cocok: h[2] }));
  }
  /** daftar barang yang cocok, paling cocok di atas */
  function cari(idx, query, batas = 40) {
    return cariSkor(idx, query, batas).map(h => h.item);
  }

  return { indeks, cari, cariSkor, norm, tokens };
})();
