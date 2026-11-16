/* ============ INPUT SUARA (MIKROFON) DI KASIR ============
 * Klik 🎤 atau tekan F9, lalu ucapkan barang yang dibeli, misalnya:
 *   "indomie goreng dua", "kopi kapal api satu renceng", "surya enam belas dua bungkus",
 *   "gula sekilo dan minyak goreng" (beberapa barang dipisah kata "dan").
 * Perintah: "hapus" = batalkan barang terakhir dari suara, "bayar" = buka pembayaran,
 *           "selesai" = matikan mikrofon. Kalau ada beberapa barang mirip, sebutkan nomornya ("dua").
 * Memakai pengenal suara bawaan Chrome / Edge (Web Speech API), butuh internet.
 */
const suara = { aktif: false, rec: null, terakhir: [], dengar: '', pilihan: null };

const ANGKA_KATA = {
  nol: 0,
  satu: 1,
  dua: 2,
  tiga: 3,
  empat: 4,
  lima: 5,
  enam: 6,
  tujuh: 7,
  delapan: 8,
  sembilan: 9
};
const ANGKA_KHUSUS = { setengah: 0.5, seperempat: 0.25, sepuluh: 10, sebelas: 11, seratus: 100 };
/** satuan yang juga sering jadi ukuran di nama barang ("GULA 1 KG", "MINYAK 2 LITER") */
const SATUAN_UKURAN = ['KG', 'LITER'];
const angkaKeTeks = v => ({ 0.5: '1/2', 0.25: '1/4', 0.75: '3/4' })[v] || String(v);
const SATUAN_SUARA = {
  bungkus: 'BKS',
  bks: 'BKS',
  renceng: 'RCG',
  rencang: 'RCG',
  rcg: 'RCG',
  dus: 'DUS',
  dos: 'DUS',
  karton: 'DUS',
  slop: 'SLOP',
  pak: 'PACK',
  pack: 'PACK',
  botol: 'BTL',
  kaleng: 'KLG',
  kilo: 'KG',
  kg: 'KG',
  kilogram: 'KG',
  liter: 'LITER',
  biji: 'PCS',
  buah: 'PCS',
  pcs: 'PCS',
  sachet: 'SACHET',
  saset: 'SACHET',
  lusin: 'LUSIN',
  ikat: 'IKAT',
  strip: 'STRIP'
};

/** Baca angka mulai dari kata ke-i. Mengembalikan {nilai, n: jumlah kata} atau null. */
function bacaAngka(tok, i) {
  const w = tok[i];
  if (!w) return null;
  if (/^\d+([.,]\d+)?$/.test(w)) return { nilai: Number(w.replace(',', '.')), n: 1 };
  if (/^\d+\/\d+$/.test(w)) {
    const [a, b] = w.split('/').map(Number);
    return { nilai: a / b, n: 1 };
  }
  if (w in ANGKA_KHUSUS) return { nilai: ANGKA_KHUSUS[w], n: 1 };
  if (!(w in ANGKA_KATA)) return null;
  const v = ANGKA_KATA[w];
  if (tok[i + 1] === 'belas') return { nilai: 10 + v, n: 2 };
  if (tok[i + 1] === 'puluh') {
    const satuan = ANGKA_KATA[tok[i + 2]];
    return satuan ? { nilai: v * 10 + satuan, n: 3 } : { nilai: v * 10, n: 2 };
  }
  return { nilai: v, n: 1 };
}
/** Nominal uang dari ucapan: "sepuluh ribu" -> 10000, "lima ratus ribu" -> 500000, "25.000" -> 25000 */
function nominalUcapan(teks) {
  const tok = String(teks || '')
    .toLowerCase()
    .replace(/\bseribu\b/g, 'satu ribu')
    .replace(/\bsejuta\b/g, 'satu juta')
    .replace(/\bseratus\b/g, 'satu ratus')
    .split(/\s+/)
    .filter(Boolean);
  let total = 0,
    cur = 0,
    ada = false;
  for (let i = 0; i < tok.length; i++) {
    const w = tok[i];
    if (w === 'ratus') cur = (cur || 1) * 100;
    else if (w === 'ribu' || w === 'rb') {
      total += (cur || 1) * 1000;
      cur = 0;
      ada = true;
    } else if (w === 'juta' || w === 'jt') {
      total += (cur || 1) * 1e6;
      cur = 0;
      ada = true;
    } else if (/^\d[\d.,]*$/.test(w)) {
      cur += num(w);
      ada = true;
    } else {
      const a = bacaAngka(tok, i);
      if (!a) continue;
      cur += a.nilai;
      i += a.n - 1;
      ada = true;
    }
  }
  return ada ? Math.round(total + cur) : 0;
}
/** Satu bagian ucapan -> { qty, unit, query, alt } (alt = tafsiran lain kalau angka di akhir bisa nama/jumlah) */
function bacaBagianUcapan(bag) {
  const tok = bag
    .replace(/\bsekilo\b/g, '1 kilo')
    .replace(/\bseliter\b/g, '1 liter')
    .split(/\s+/)
    .filter(Boolean);
  const angka = [];
  for (let i = 0; i < tok.length;) {
    const a = bacaAngka(tok, i);
    if (a) {
      angka.push({ i, n: a.n, nilai: a.nilai });
      i += a.n;
    } else i++;
  }
  const iSatuan = tok.findIndex(w => SATUAN_SUARA[w]);
  let qty = null;
  if (iSatuan >= 0) qty = angka.find(a => a.i + a.n === iSatuan) || null;
  if (!qty && angka.length && angka[0].i === 0 && tok.length > angka[0].n) qty = angka[0];
  if (!qty && angka.length >= 2) qty = angka[angka.length - 1];
  const unit = iSatuan >= 0 ? SATUAN_SUARA[tok[iSatuan]] : '';
  const susun = jumlah => {
    const out = [];
    for (let i = 0; i < tok.length; i++) {
      if (i === iSatuan) continue;
      const a = angka.find(x => x.i === i);
      if (a) {
        if (a !== jumlah) out.push(String(a.nilai));
        i += a.n - 1;
        continue;
      }
      out.push(tok[i]);
    }
    return out.join(' ').trim();
  };
  const hasil = { qty: qty ? qty.nilai : 1, unit, query: susun(qty) };
  // "gula setengah kilo" bisa berarti barang "GULA 1/2 KG" (jumlah 1), bukan 0,5 x gula
  if (qty && SATUAN_UKURAN.includes(unit))
    hasil.ukuran = {
      qty: 1,
      unit: '',
      query: `${hasil.query} ${angkaKeTeks(qty.nilai)} ${unit.toLowerCase()}`
    };
  const akhir = angka[angka.length - 1];
  if (!qty && angka.length === 1 && akhir.i + akhir.n === tok.length && akhir.i > 0)
    hasil.alt = { qty: akhir.nilai, query: susun(akhir) };
  return hasil;
}
function pecahUcapan(teks) {
  return teks
    .toLowerCase()
    .replace(/[.,!?]/g, ' ')
    .split(/\s+(?:dan|sama|terus|lalu|tambah|ditambah)\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}
/** Indeks pencarian untuk suara (tahan salah dengar, memakai urutan prioritas & barang laku) */
function indeksSuara() {
  const pop = popularitasCache();
  return CariProduk.indeks(
    S.products.filter(p => p.aktif !== false),
    p => ({
      nama: p.nama,
      alias: p.alias,
      kategori: p.kategori,
      populer: pop[p.id] || 0,
      prioritas: isPrioritas(p) ? (p.prioritas === true ? ['*'] : prioritasCocok(p)) : [],
      prioritasEkstra: prioritasEkstra(prioritasCocok(p))
    })
  );
}
/** Cari barang untuk satu bagian ucapan. Mengembalikan {hasil:[{item,skor}], qty, unit, query} */
function cariDariUcapan(b, idx) {
  if (b.ukuran) {
    const u = CariProduk.cariSkor(idx, b.ukuran.query, 5);
    const tok = u[0] ? CariProduk.tokens(u[0].item.nama) : [];
    const perlu = CariProduk.tokens(b.ukuran.query.split(' ').slice(-2).join(' '));
    if (u.length && perlu.every(t => tok.includes(t))) return { ...b, ...b.ukuran, hasil: u };
  }
  let pilih = { ...b, hasil: CariProduk.cariSkor(idx, b.query, 5) };
  if (b.alt) {
    // "surya 16" -> 16 bagian nama kalau barang teratasnya memang mengandung angka itu
    const angkaNama = String(b.alt.qty);
    const top = pilih.hasil[0];
    if (!top || !CariProduk.tokens(top.item.nama).includes(angkaNama)) {
      const lain = CariProduk.cariSkor(idx, b.alt.query, 5);
      if (lain.length) pilih = { ...b, ...b.alt, hasil: lain };
    }
  }
  return pilih;
}

/** Langsung tambahkan barang teratas kalau jelas paling cocok:
 *  skornya unggul, atau namanya paling "polos" (INDOMIE GORENG 85 GR vs INDOMIE GORENG RASA RENDANG) */
const TOKEN_UKURAN = new Set([
  'gr',
  'g',
  'kg',
  'ml',
  'l',
  'ltr',
  'liter',
  'pcs',
  'rcg',
  'bks',
  'btl',
  'pack',
  'pak',
  'pck',
  'dus',
  'klg',
  'sachet',
  'slop'
]);
function kataTambahan(p, query) {
  const q = new Set(CariProduk.tokens(query));
  return CariProduk.tokens(p.nama).filter(t => !q.has(t) && !/^\d+$/.test(t) && !TOKEN_UKURAN.has(t)).length;
}
function yakinPilihan(satu, dua, query) {
  if (!dua || satu.skor - dua.skor >= 3) return true;
  // nama barang teratas persis yang diucapkan (hanya beda ukuran), yang lain punya kata tambahan
  const semua = CariProduk.tokens(query).every(t => CariProduk.tokens(satu.item.nama).includes(t));
  return semua && kataTambahan(satu.item, query) === 0 && kataTambahan(dua.item, query) > 0;
}

/* ---------- menjalankan perintah & menambah barang ---------- */
function tambahDariSuara(p, qty, unit) {
  const un = unit ? pickUnit(p, unit) : unitScanOf(p);
  addToCart(p, qty, un);
  suara.terakhir.push({ id: p.id, satuan: un, qty });
  toast(`🎤 + ${String(qty).replace('.', ',')} ${un} · ${p.nama}`);
}
function hapusTerakhirSuara() {
  const x = suara.terakhir.pop();
  if (!x) return toast('Belum ada barang dari suara', true);
  const it = cart.items.find(i => i.productId === x.id && i.satuan === x.satuan);
  if (it) {
    it.qty = r4(it.qty - x.qty);
    if (it.qty <= 0) cart.items.splice(cart.items.indexOf(it), 1);
  }
  drawCart();
  toast('🎤 Barang terakhir dibatalkan');
}
function prosesUcapan(teks) {
  teks = String(teks || '')
    .trim()
    .toLowerCase();
  if (!teks) return;
  suara.dengar = teks;
  if (/^(selesai|stop|berhenti|matikan( mikrofon)?|tutup)$/.test(teks)) return stopSuara();
  if (currentView !== 'kasir' || $('.modal')) {
    drawMic();
    return;
  }
  if (/^(hapus|batal|batalkan|hapus (yang )?terakhir|salah)$/.test(teks)) return hapusTerakhirSuara();
  if (/^bayar$/.test(teks)) {
    drawMic();
    return cart.items.length ? openPay() : toast('Keranjang masih kosong', true);
  }
  // layanan: "pulsa sepuluh ribu", "isi token lima puluh ribu", "tarik tunai lima ratus ribu"
  const ly = layananCocok(teks);
  if (ly.length) {
    drawMic();
    // menu teratas langsung dibuka; kalau salah, tombol "← Menu" kembali ke daftar
    return layananDialog(ly[0].jenis, { ...ly[0], nominal: nominalUcapan(teks) });
  }
  // memilih salah satu barang yang mirip: "dua" / "nomor dua"
  if (!suara.pilihan && /^(nomor|no)\s+\S+$/.test(teks)) {
    drawMic();
    return;
  }
  if (suara.pilihan) {
    const t = teks.replace(/^(nomor|no)\s+/, '').split(/\s+/);
    const a = bacaAngka(t, 0);
    if (a && a.n === t.length && suara.pilihan.list[a.nilai - 1]) {
      const pl = suara.pilihan;
      suara.pilihan = null;
      tambahDariSuara(pl.list[a.nilai - 1], pl.qty, pl.unit);
      drawMic();
      return;
    }
    suara.pilihan = null;
  }
  const idx = indeksSuara();
  for (const bag of pecahUcapan(teks)) {
    const b = cariDariUcapan(bacaBagianUcapan(bag), idx);
    const [satu, dua] = b.hasil;
    if (!satu) {
      beep(false);
      toast(`🎤 “${b.query}” tidak ketemu di daftar barang`, true);
      const i = $('#scan');
      if (i) {
        i.value = b.query;
        showSuggest(b.query);
      }
      continue;
    }
    if (yakinPilihan(satu, dua, b.query)) tambahDariSuara(satu.item, b.qty, b.unit);
    else {
      suara.pilihan = {
        list: b.hasil.slice(0, 4).map(h => h.item),
        qty: b.qty,
        unit: b.unit,
        query: b.query
      };
      beep(true);
    }
  }
  drawMic();
}

/* ---------- mikrofon ---------- */
const PESAN_ERROR_SUARA = {
  'not-allowed':
    'Mikrofon belum diizinkan. Klik ikon di kiri alamat (gembok / ⓘ) > Mikrofon > Izinkan, lalu coba lagi.',
  'service-not-allowed': 'Input suara tidak diizinkan browser. Pakai Google Chrome atau Microsoft Edge.',
  'audio-capture': 'Mikrofon tidak terdeteksi. Cek headset / mikrofon laptop.',
  network: 'Input suara butuh internet. Cek koneksi lalu coba lagi.',
  'language-not-supported': 'Bahasa Indonesia belum didukung browser ini.'
};
function mulaiSuara() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return toast('Browser ini belum bisa input suara. Pakai Google Chrome atau Microsoft Edge.', true);
  const rec = new SR();
  rec.lang = 'id-ID';
  rec.continuous = true;
  rec.interimResults = true;
  rec.onresult = e => {
    let sementara = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) prosesUcapan(r[0].transcript);
      else sementara += r[0].transcript;
    }
    if (sementara) {
      suara.dengar = sementara + ' …';
      drawMic();
    }
  };
  rec.onerror = e => {
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    toast(PESAN_ERROR_SUARA[e.error] || 'Input suara bermasalah: ' + e.error, true);
    stopSuara();
  };
  // Chrome berhenti sendiri setelah diam beberapa saat: nyalakan lagi selama masih aktif
  rec.onend = () => {
    if (suara.aktif && suara.rec === rec)
      try {
        rec.start();
      } catch (err) {}
  };
  Object.assign(suara, { aktif: true, rec, dengar: '', pilihan: null });
  try {
    rec.start();
  } catch (err) {}
  beep(true);
  drawMic();
}
function stopSuara() {
  const rec = suara.rec;
  Object.assign(suara, { aktif: false, rec: null, pilihan: null, dengar: '' });
  try {
    rec && rec.stop();
  } catch (err) {}
  drawMic();
}
function toggleSuara() {
  suara.aktif ? stopSuara() : mulaiSuara();
}
function drawMic() {
  const btn = $('#micBtn'),
    panel = $('#micPanel');
  if (btn) btn.classList.toggle('on', suara.aktif);
  if (!panel) return;
  if (!suara.aktif) {
    panel.innerHTML = '';
    return;
  }
  const pl = suara.pilihan;
  panel.innerHTML = `<div class="micpanel"><div class="row" style="gap:8px"><span class="micdot"></span><b>Mendengarkan…</b><span class="grow"></span><button class="btn sm ghost" id="micStop" type="button">⏹ Matikan (F9)</button></div>
    ${suara.dengar ? `<div class="micsaid">“${esc(suara.dengar)}”</div>` : ''}
    ${
      pl
        ? `<div class="micpick"><div>Ada beberapa yang mirip “${esc(pl.query)}”. Sebutkan nomornya atau klik:</div>${pl.list
            .map(
              (p, i) =>
                `<button class="btn ghost" data-mp="${i}" type="button"><b>${i + 1}.</b> ${esc(p.nama)} <span class="muted">Rp ${rp(priceUnit(p, unitScanOf(p), cart.tier))}</span></button>`
            )
            .join('')}</div>`
        : `<div class="michint">Ucapkan barang + jumlah, contoh: “indomie goreng dua”, “kopi kapal api satu renceng”, “gula sekilo dan minyak goreng”. Ucapkan “hapus” untuk membatalkan barang terakhir, “bayar”, atau “selesai”.</div>`
    }</div>`;
  $('#micStop', panel).onclick = stopSuara;
  $$('[data-mp]', panel).forEach(
    b =>
      (b.onclick = () => {
        const p = pl.list[+b.dataset.mp];
        suara.pilihan = null;
        tambahDariSuara(p, pl.qty, pl.unit);
        drawMic();
        focusScan();
      })
  );
}
