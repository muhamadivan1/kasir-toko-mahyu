/* ============ TANYA AI (asisten insight) ============ */
function dRange(a, b) {
  const p = x => {
    const m = String(x || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : null;
  };
  const A = p(a) ?? dayStart(-6),
    B = p(b);
  return [A, (B ?? dayStart(0)) + 86400000];
}
function salesIn(a, b) {
  const [A, B] = dRange(a, b);
  return S.sales.filter(s => !s.batal && s.waktu >= A && s.waktu < B);
}
const AI_TOOLS = [
  {
    name: 'ringkasan_penjualan',
    description:
      'Ringkasan penjualan dalam rentang tanggal: omzet (Warung + Material), jumlah transaksi, perkiraan laba, rata-rata per transaksi, per metode bayar, rincian per hari, dan rincian per uang (Warung termasuk PojokBayar, BRILink, Material) lengkap dengan pengeluaran dan laba bersih.',
    input_schema: {
      type: 'object',
      properties: {
        dari: { type: 'string', description: 'YYYY-MM-DD' },
        sampai: { type: 'string', description: 'YYYY-MM-DD (termasuk)' }
      },
      required: ['dari', 'sampai']
    },
    run: ({ dari, sampai }) => {
      const l = salesIn(dari, sampai);
      const [A, B] = dRange(dari, sampai);
      const R = rekapUang(A, B);
      const om = R.semua.penjualan;
      const per = {};
      l.forEach(s => {
        const k = dkey(s.waktu);
        per[k] = per[k] || { tanggal: k, omzet: 0, transaksi: 0 };
        per[k].omzet += penjualanSale(s);
        per[k].transaksi++;
      });
      const met = {};
      l.forEach(s => (met[s.metode] = (met[s.metode] || 0) + penjualanSale(s)));
      const perUang = {};
      for (const k of kasAktif()) {
        const x = R[k.id];
        perUang[k.nama] =
          k.id === 'brilink'
            ? {
                transaksi: x.trx,
                tarik_tunai: x.tarik,
                transfer_setor: x.setor,
                pendapatan_admin: x.admin,
                potongan_bank: x.modal,
                pengeluaran: x.biaya,
                laba_bersih: x.bersih
              }
            : {
                penjualan: x.jual,
                laba_kotor: x.laba,
                pengeluaran: x.biaya,
                laba_bersih: x.bersih,
                layanan_pojokbayar: x.nLyn
                  ? { transaksi: x.nLyn, jual: x.lynJual, untung: x.lynLaba }
                  : undefined,
                utang_baru: x.utang
              };
      }
      return {
        omzet: om,
        transaksi: l.length,
        perkiraan_laba: R.semua.laba,
        pengeluaran_toko: R.semua.biaya,
        laba_bersih: R.semua.bersih,
        diambil_untuk_rumah: R.semua.prive,
        belanja_barang_dagangan: R.semua.kulakan,
        rata_rata_per_transaksi: l.length ? Math.round(om / l.length) : 0,
        per_metode: met,
        per_uang: perUang,
        utang_baru: l.reduce((x, s) => x + (s.utang || 0) + (s.kurang || 0), 0),
        ada_barang_tanpa_harga_beli: R.semua.tanpaHB,
        per_hari: Object.values(per)
      };
    }
  },
  {
    name: 'barang_terlaris',
    description:
      'Daftar barang paling laku dalam rentang tanggal, diurutkan berdasarkan omzet, jumlah, atau laba.',
    input_schema: {
      type: 'object',
      properties: {
        dari: { type: 'string' },
        sampai: { type: 'string' },
        urut: { type: 'string', enum: ['omzet', 'jumlah', 'laba'] },
        batas: { type: 'integer' }
      },
      required: ['dari', 'sampai']
    },
    run: ({ dari, sampai, urut = 'omzet', batas = 15 }) => {
      const t = {};
      salesIn(dari, sampai).forEach(s =>
        s.items.forEach(i => {
          if (i.layanan) return;
          const k = i.nama + ' [' + (i.satuan || 'PCS') + ']';
          t[k] = t[k] || { nama: k, jumlah: 0, omzet: 0, laba: 0 };
          t[k].jumlah += i.qty;
          t[k].omzet += i.qty * i.harga;
          t[k].laba += i.qty * (i.harga - (i.hargaBeli || i.harga));
        })
      );
      return Object.values(t)
        .sort((a, b) => b[urut] - a[urut])
        .slice(0, Math.min(50, batas));
    }
  },
  {
    name: 'penjualan_per_jam',
    description:
      'Jumlah transaksi dan omzet per jam (0-23) dan per hari dalam seminggu, untuk mengetahui jam/hari ramai.',
    input_schema: {
      type: 'object',
      properties: { dari: { type: 'string' }, sampai: { type: 'string' } },
      required: ['dari', 'sampai']
    },
    run: ({ dari, sampai }) => {
      const h = {},
        d = {};
      const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      salesIn(dari, sampai).forEach(s => {
        const w = new Date(s.waktu);
        const k = w.getHours();
        h[k] = h[k] || { jam: k, transaksi: 0, omzet: 0 };
        h[k].transaksi++;
        h[k].omzet += penjualanSale(s);
        const n = hari[w.getDay()];
        d[n] = d[n] || { hari: n, transaksi: 0, omzet: 0 };
        d[n].transaksi++;
        d[n].omzet += penjualanSale(s);
      });
      return { per_jam: Object.values(h), per_hari: Object.values(d) };
    }
  },
  {
    name: 'cari_produk',
    description:
      'Cari produk berdasarkan kata (nama/alias/barcode). Mengembalikan harga jual per kategori harga, harga beli, stok, dan barcode.',
    input_schema: { type: 'object', properties: { kata: { type: 'string' } }, required: ['kata'] },
    run: ({ kata }) =>
      searchProducts(kata, 20).map(p => ({
        nama: p.nama,
        alias: p.alias || '',
        kategori: p.kategori || '',
        barcode: p.barcode || '',
        harga_beli: p.hargaBeli || 0,
        harga: Object.fromEntries(tiers().map(t => [t.nama, priceOf(p, t.id)])),
        stok: p.stok,
        satuan: p.satuan,
        satuan_lain: (p.units || []).map(u => ({
          satuan: u.nama,
          isi: u.isi,
          harga_umum: priceUnit(p, u.nama, 'umum')
        }))
      }))
  },
  {
    name: 'daftar_stok',
    description:
      'Daftar barang berdasarkan kondisi stok: minus, habis (0), menipis (<= batas), atau terendah.',
    input_schema: {
      type: 'object',
      properties: {
        kondisi: { type: 'string', enum: ['minus', 'habis', 'menipis', 'terendah'] },
        batas: { type: 'integer' }
      },
      required: ['kondisi']
    },
    run: ({ kondisi, batas = 30 }) => {
      let l = S.products.filter(p => p.aktif !== false);
      const st = p => Number(p.stok) || 0;
      if (kondisi === 'minus') l = l.filter(p => st(p) < 0);
      else if (kondisi === 'habis') l = l.filter(p => st(p) === 0);
      else if (kondisi === 'menipis') l = l.filter(p => st(p) > 0 && st(p) <= Number(p.minStok || 0));
      const sold = {};
      salesIn(dkey(dayStart(-29)), dkey(Date.now())).forEach(s =>
        s.items.forEach(i => (sold[i.productId] = (sold[i.productId] || 0) + i.qty))
      );
      return {
        jumlah: l.length,
        catatan:
          'Data stok dari Fastmart banyak yang belum akurat (minus) sampai dilakukan hitung ulang stok.',
        barang: l
          .sort((a, b) => st(a) - st(b))
          .slice(0, Math.min(60, batas))
          .map(p => ({ nama: p.nama, stok: st(p), terjual_30_hari: sold[p.id] || 0 }))
      };
    }
  },
  {
    name: 'piutang_pelanggan',
    description:
      'Daftar pelanggan yang masih punya utang beserta saldo, tanggal belanja utang terakhir, dan tanggal bayar terakhir.',
    input_schema: { type: 'object', properties: {} },
    run: () =>
      S.customers
        .map(c => {
          const su = S.sales
            .filter(s => s.customerId === c.id && !s.batal && s.utang > 0)
            .sort((a, b) => b.waktu - a.waktu)[0];
          const pb = S.payments
            .filter(p => p.customerId === c.id && p.jenis !== 'utang')
            .sort((a, b) => b.waktu - a.waktu)[0];
          return {
            nama: c.nama,
            kategori_harga: tierName(c.tier || 'umum'),
            saldo_utang: saldoUtang(c.id),
            utang_terakhir: su ? dkey(su.waktu) : null,
            bayar_terakhir: pb ? dkey(pb.waktu) : null
          };
        })
        .filter(x => x.saldo_utang > 0)
        .sort((a, b) => b.saldo_utang - a.saldo_utang)
  },
  {
    name: 'produk_bermasalah',
    description:
      'Produk yang perlu dibenahi: harga jual <= harga beli (rugi), belum ada harga jual, belum ada harga beli, belum ada barcode.',
    input_schema: { type: 'object', properties: {} },
    run: () => {
      const a = S.products.filter(p => p.aktif !== false);
      const ex = l => ({
        jumlah: l.length,
        contoh: l.slice(0, 15).map(p => ({
          nama: p.nama,
          harga_beli: p.hargaBeli || 0,
          harga: Object.fromEntries(tiers().map(t => [t.nama, (p.harga || {})[t.id] || 0]))
        }))
      });
      return {
        harga_jual_tidak_untung: ex(a.filter(isRugi)),
        tanpa_harga_jual: ex(a.filter(p => !priceOf(p, 'umum'))),
        tanpa_harga_beli: { jumlah: a.filter(p => !Number(p.hargaBeli)).length },
        tanpa_barcode: { jumlah: a.filter(p => !p.barcode).length }
      };
    }
  },
  {
    name: 'daftar_transaksi',
    description:
      'Daftar transaksi dalam rentang tanggal, bisa disaring nama pelanggan. Berisi waktu, pelanggan, metode, total, dan barang.',
    input_schema: {
      type: 'object',
      properties: {
        dari: { type: 'string' },
        sampai: { type: 'string' },
        pelanggan: { type: 'string' },
        batas: { type: 'integer' }
      },
      required: ['dari', 'sampai']
    },
    run: ({ dari, sampai, pelanggan, batas = 30 }) => {
      let l = salesIn(dari, sampai);
      if (pelanggan)
        l = l.filter(s => (s.customerNama || '').toLowerCase().includes(pelanggan.toLowerCase()));
      return l
        .sort((a, b) => b.waktu - a.waktu)
        .slice(0, Math.min(80, batas))
        .map(s => ({
          no: s.no,
          waktu: tglJam(s.waktu),
          pelanggan: s.customerNama || 'umum',
          metode: s.metode,
          total: s.total,
          utang: s.utang || 0,
          barang: s.items.map(i => `${i.nama} x${i.qty} @${i.harga}`)
        }));
    }
  }
];
function aiSystem() {
  const st = settings();
  return `Kamu adalah asisten toko untuk ${st.nama} (${st.alamat}), sebuah toko kelontong/warung yang juga menjual grosir ke warung lain. Uang toko dipisah: Warung (barang warung + layanan PojokBayar seperti pulsa dan token), BRILink (tarik tunai, transfer), dan Material (toko bangunan). Uang BRILink bukan penjualan, pendapatannya hanya dari admin. Hari ini ${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} (${dkey(Date.now())}).
Yang bertanya adalah pemilik toko, kemungkinan orang tua yang tidak terbiasa istilah teknis. Jawab dalam bahasa Indonesia sederhana, singkat, dan langsung ke inti. Pakai format Rupiah (contoh Rp 12.500).
Selalu ambil data lewat alat (tools) yang tersedia, jangan mengarang angka. Kalau data tidak cukup, katakan terus terang. Kamu hanya bisa MELIHAT data, tidak bisa mengubah harga, stok, atau transaksi.
Kategori harga yang ada: ${tiers()
    .map(t => t.nama)
    .join(
      ', '
    )}. Jumlah produk aktif: ${S.products.filter(p => p.aktif !== false).length}. Jumlah transaksi tercatat di aplikasi ini: ${S.sales.length} (data penjualan baru dicatat sejak aplikasi ini dipakai).
Berikan saran praktis yang bisa langsung dilakukan bila relevan (misal barang yang perlu dibelanja ulang, harga yang perlu dicek).`;
}
function mdLite(t) {
  let h = esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  return h
    .split('\n')
    .map(l =>
      /^\s*[-•*]\s+/.test(l)
        ? '<div style="padding-left:14px;text-indent:-10px">• ' + l.replace(/^\s*[-•*]\s+/, '') + '</div>'
        : l.trim() === ''
          ? '<div style="height:6px"></div>'
          : '<div>' + l + '</div>'
    )
    .join('');
}
const AI = { busy: false, adapter: null, adapterKey: '', view: [] };
const AI_PROVIDERS = {
  gemini: {
    nama: 'Google Gemini',
    models: ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.6-flash'],
    keyHint: 'AIza… atau AQ.…',
    link: 'aistudio.google.com',
    info: 'Buat API key di aistudio.google.com (ada kuota gratis dengan batas pemakaian).'
  },
  claude: {
    nama: 'Anthropic Claude',
    models: ['claude-haiku-4-5-20251001', 'claude-sonnet-5-5'],
    keyHint: 'sk-ant-…',
    link: 'platform.claude.com',
    info: 'Buat API key di platform.claude.com (berbayar sesuai pemakaian).'
  },
  openai: {
    nama: 'OpenAI (ChatGPT)',
    models: ['gpt-6-luna', 'gpt-6.1-sol'],
    keyHint: 'sk-…',
    link: 'platform.openai.com',
    info: 'Buat API key di platform.openai.com (berbayar sesuai pemakaian).'
  },
  openrouter: {
    nama: 'OpenRouter (banyak model, ada yang gratis)',
    models: ['openrouter/auto'],
    keyHint: 'sk-or-…',
    link: 'openrouter.ai',
    info: 'Satu API key untuk ratusan model dari berbagai perusahaan. Nama model lihat di openrouter.ai/models.'
  }
};
function aiConf() {
  const c = S.meta.aiConf || {};
  if (!c.keys) {
    c.keys = {};
    if (S.meta.aiKey) {
      c.keys.claude = S.meta.aiKey;
      c.provider = c.provider || 'claude';
      c.model = c.model || S.meta.aiModel;
    }
  }
  c.provider = c.provider || 'gemini';
  c.model = c.model || AI_PROVIDERS[c.provider].models[0];
  return c;
}
function aiReady() {
  const c = aiConf();
  return !!c.keys[c.provider];
}
async function aiFetch(url, opt) {
  let r;
  try {
    r = await fetch(url, opt);
  } catch (e) {
    throw new Error('Tidak bisa terhubung. Fitur Tanya AI butuh internet.');
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const raw = (j.error && (j.error.message || j.error)) || r.statusText;
    const m = typeof raw === 'string' ? raw : JSON.stringify(raw);
    if (
      r.status === 401 ||
      r.status === 403 ||
      /API key not valid|invalid.*key|unauthorized|ACCESS_TOKEN/i.test(m)
    )
      throw new Error(
        'API key ditolak oleh penyedia AI (' + m.slice(0, 160) + '). Cek lagi key-nya, atau buat key baru.'
      );
    if (r.status === 429)
      throw new Error(
        'Kuota/batas pemakaian habis atau terlalu sering. Coba lagi nanti. (' + m.slice(0, 120) + ')'
      );
    if (r.status === 404)
      throw new Error('Model tidak ditemukan. Ganti nama model di pengaturan AI. (' + m.slice(0, 120) + ')');
    throw new Error(m.slice(0, 300));
  }
  return j;
}
const toolDefs = () => AI_TOOLS.map(({ run, ...t }) => t);
function gemSchema(x) {
  if (!x || typeof x !== 'object') return x;
  const o = {};
  for (const [k, v] of Object.entries(x)) {
    if (k === 'type') o.type = String(v).toUpperCase();
    else if (k === 'properties')
      o.properties = Object.fromEntries(Object.entries(v).map(([a, b]) => [a, gemSchema(b)]));
    else if (k === 'items') o.items = gemSchema(v);
    else o[k] = v;
  }
  return o;
}
function makeAdapter(c) {
  const key = c.keys[c.provider],
    model = c.model;
  if (c.provider === 'claude') {
    const h = [];
    return {
      addUser: t => h.push({ role: 'user', content: t }),
      call: async () => {
        const j = await aiFetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model,
            max_tokens: 1500,
            system: aiSystem(),
            tools: toolDefs(),
            messages: h
          })
        });
        h.push({ role: 'assistant', content: j.content });
        return {
          text: j.content
            .filter(x => x.type === 'text')
            .map(x => x.text)
            .join('\n'),
          calls:
            j.stop_reason === 'tool_use'
              ? j.content
                  .filter(x => x.type === 'tool_use')
                  .map(x => ({ id: x.id, name: x.name, args: x.input || {} }))
              : []
        };
      },
      addResults: rs =>
        h.push({
          role: 'user',
          content: rs.map(r => ({ type: 'tool_result', tool_use_id: r.id, content: r.out }))
        })
    };
  }
  if (c.provider === 'gemini') {
    const h = [];
    return {
      addUser: t => h.push({ role: 'user', parts: [{ text: t }] }),
      call: async () => {
        const decl = AI_TOOLS.map(t => {
          const d = { name: t.name, description: t.description };
          if (Object.keys(t.input_schema.properties || {}).length) d.parameters = gemSchema(t.input_schema);
          return d;
        });
        const j = await aiFetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: aiSystem() }] },
              contents: h,
              tools: [{ functionDeclarations: decl }]
            })
          }
        );
        const cand = (j.candidates || [])[0];
        if (!cand || !cand.content) {
          const why =
            (j.promptFeedback && j.promptFeedback.blockReason) || (cand && cand.finishReason) || 'kosong';
          throw new Error('AI tidak memberi jawaban (' + why + '). Coba ubah pertanyaannya.');
        }
        h.push(cand.content);
        const parts = cand.content.parts || [];
        return {
          text: parts
            .filter(p => p.text && !p.thought)
            .map(p => p.text)
            .join(''),
          calls: parts
            .filter(p => p.functionCall)
            .map(p => ({ id: p.functionCall.id, name: p.functionCall.name, args: p.functionCall.args || {} }))
        };
      },
      addResults: rs =>
        h.push({
          role: 'user',
          parts: rs.map(r => ({
            functionResponse: {
              ...(r.id ? { id: r.id } : {}),
              name: r.name,
              response: { result: JSON.parse(r.out) }
            }
          }))
        })
    };
  }
  const url =
    c.provider === 'openrouter'
      ? 'https://openrouter.ai/api/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';
  const h = [];
  return {
    addUser: t => h.push({ role: 'user', content: t }),
    call: async () => {
      const headers = { 'content-type': 'application/json', authorization: 'Bearer ' + key };
      if (c.provider === 'openrouter') {
        headers['X-Title'] = 'Kasir Toko Mahyu';
      }
      const j = await aiFetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: aiSystem() }, ...h],
          tools: toolDefs().map(t => ({
            type: 'function',
            function: { name: t.name, description: t.description, parameters: t.input_schema }
          }))
        })
      });
      const msg = ((j.choices || [])[0] || {}).message;
      if (!msg) throw new Error('AI tidak memberi jawaban.');
      h.push(msg);
      return {
        text: msg.content || '',
        calls: (msg.tool_calls || []).map(tc => ({
          id: tc.id,
          name: tc.function.name,
          args: (() => {
            try {
              return JSON.parse(tc.function.arguments || '{}');
            } catch (e) {
              return {};
            }
          })()
        }))
      };
    },
    addResults: rs => rs.forEach(r => h.push({ role: 'tool', tool_call_id: r.id, content: r.out }))
  };
}
async function aiAsk(q) {
  if (AI.busy) return;
  if (!aiReady()) {
    aiKeyDialog();
    return;
  }
  const c = aiConf();
  const ak = c.provider + '|' + c.model;
  if (!AI.adapter || AI.adapterKey !== ak) {
    AI.adapter = makeAdapter(c);
    AI.adapterKey = ak;
  }
  AI.busy = true;
  AI.adapter.addUser(q);
  AI.view.push({ who: 'me', html: esc(q) });
  const status = { who: 'tool', html: '⏳ Sedang berpikir…' };
  AI.view.push(status);
  drawAI();
  try {
    let done = false;
    for (let step = 0; step < 8 && !done; step++) {
      const res = await AI.adapter.call();
      if (!res.calls.length) {
        AI.view.splice(AI.view.indexOf(status), 1);
        AI.view.push({ who: 'ai', html: mdLite(res.text || '(tidak ada jawaban)') });
        done = true;
        break;
      }
      const results = res.calls.map(u => {
        const tool = AI_TOOLS.find(t => t.name === u.name);
        let out;
        try {
          out = tool ? tool.run(u.args || {}) : { error: 'alat tidak dikenal' };
        } catch (e) {
          out = { error: e.message };
        }
        status.html = '🔎 Melihat data: ' + esc(String(u.name).replace(/_/g, ' ')) + '…';
        return { id: u.id, name: u.name, out: JSON.stringify(out).slice(0, 60000) };
      });
      drawAI();
      AI.adapter.addResults(results);
    }
    if (!done) {
      AI.view.splice(AI.view.indexOf(status), 1);
      AI.view.push({
        who: 'ai',
        html: 'Maaf, pertanyaannya terlalu rumit. Coba dipecah jadi pertanyaan yang lebih sederhana.'
      });
    }
  } catch (e) {
    const i = AI.view.indexOf(status);
    if (i >= 0) AI.view.splice(i, 1);
    AI.adapter = null;
    AI.view.push({ who: 'err', html: '❌ ' + esc(e.message) });
  }
  AI.busy = false;
  drawAI();
}
function aiKeyDialog() {
  const c = JSON.parse(JSON.stringify(aiConf()));
  const m =
    modal(`<h3>🤖 Pengaturan Tanya AI</h3><p style="margin-top:0">Pilih penyedia AI, lalu isi API key-nya. Butuh <b>internet</b> saat bertanya.</p>
   <label>Penyedia AI</label><select id="ap">${Object.entries(AI_PROVIDERS)
     .map(([k, v]) => `<option value="${k}">${esc(v.nama)}</option>`)
     .join('')}</select>
   <p class="muted" style="font-size:13px;margin:4px 0 0" id="ainfo"></p>
   <label>Model</label><input id="am" list="amlist" autocomplete="off"><datalist id="amlist"></datalist>
   <label>API key</label><input id="ak" type="password" autocomplete="off">
   <div id="atest" style="margin-top:8px"></div>
   <p class="muted" style="font-size:13px">API key hanya disimpan di perangkat ini dan tidak ikut ke file backup. Saat bertanya, ringkasan data toko yang dibutuhkan untuk menjawab dikirim ke penyedia AI yang dipilih. Jangan bagikan API key ke orang lain.</p>
   <div class="row" style="margin-top:12px"><button class="btn ghost" id="atst">🔌 Tes koneksi</button><span class="grow"></span><button class="btn ghost" data-close>Batal</button><button class="btn pri" id="aok">Simpan</button></div>`);
  const fill = () => {
    const pv = $('#ap', m).value,
      P = AI_PROVIDERS[pv];
    $('#ainfo', m).textContent = P.info;
    $('#amlist', m).innerHTML = P.models.map(x => `<option value="${esc(x)}">`).join('');
    $('#am', m).value = c.provider === pv && c.model ? c.model : P.models[0];
    $('#ak', m).value = c.keys[pv] || '';
    $('#ak', m).placeholder = P.keyHint;
    $('#atest', m).innerHTML = '';
  };
  $('#ap', m).value = c.provider;
  fill();
  $('#ap', m).onchange = () => {
    c.provider = $('#ap', m).value;
    c.model = '';
    fill();
  };
  const collect = () => {
    c.provider = $('#ap', m).value;
    c.model = $('#am', m).value.trim() || AI_PROVIDERS[c.provider].models[0];
    const k = $('#ak', m).value.trim();
    if (k) c.keys[c.provider] = k;
    else delete c.keys[c.provider];
    return c;
  };
  $('#atst', m).onclick = async () => {
    const cc = collect();
    if (!cc.keys[cc.provider]) return toast('Isi API key dulu', true);
    $('#atest', m).innerHTML = '<span class="muted">Menghubungi…</span>';
    try {
      const a = makeAdapter(cc);
      a.addUser('Tes koneksi. Balas singkat: "Siap membantu Toko Mahyu".');
      let r = await a.call();
      if (r.calls.length) {
        a.addResults(r.calls.map(x => ({ id: x.id, name: x.name, out: '{}' })));
        r = await a.call();
      }
      $('#atest', m).innerHTML =
        `<div class="banner" style="background:#e9f7ef;border-color:#a8dcbc;color:#14532d">✔ Berhasil terhubung. Jawaban: ${esc((r.text || '').slice(0, 120))}</div>`;
    } catch (e) {
      $('#atest', m).innerHTML =
        `<div class="banner" style="background:#fdecec;border-color:#f3b4b4;color:#7f1d1d">❌ ${esc(e.message)}</div>`;
    }
  };
  $('#aok', m).onclick = async () => {
    collect();
    S.meta.aiConf = c;
    await DB.put('meta', { id: 'aiConf', value: c });
    if (S.meta.aiKey) {
      delete S.meta.aiKey;
      await DB.del('meta', 'aiKey');
    }
    AI.adapter = null;
    m.close();
    toast('Pengaturan AI disimpan ✔');
    render();
  };
}

const AI_SARAN = [
  'Bagaimana penjualan 7 hari terakhir dibanding minggu sebelumnya?',
  'Barang apa yang paling laku bulan ini?',
  'Barang apa saja yang dijual tanpa untung?',
  'Jam berapa toko paling ramai?',
  'Warung mana yang utangnya paling besar dan sudah lama?',
  'Barang laku apa yang stoknya perlu dibelanja ulang?'
];
views.ai = () => {
  $('#main').innerHTML = `<div class="card" style="max-width:900px;margin:0 auto">
   <div class="row"><h2 class="grow" style="margin:0">🤖 Tanya AI <span class="badge warn">uji coba</span></h2><button class="btn sm ghost" id="aiSet">⚙️ Pilih AI & API key</button>${AI.view.length ? '<button class="btn sm ghost" id="aiNew">Mulai baru</button>' : ''}</div>
   <p class="muted" style="margin:6px 0 12px;font-size:14px">Tanyakan apa saja tentang penjualan, stok, harga, atau utang. AI hanya membaca data, tidak mengubah apa pun. ${aiReady() ? `<span class="badge ok">${esc(AI_PROVIDERS[aiConf().provider].nama)} · ${esc(aiConf().model)}</span>` : '<b style="color:var(--bad)">Belum aktif: pilih AI & isi API key dulu.</b>'}</p>
   <div id="aiLog" style="min-height:200px;max-height:calc(100vh - 360px);overflow:auto;padding:4px"></div>
   <div class="row" style="flex-wrap:wrap;gap:6px;margin:10px 0" id="aiSug">${AI.view.length ? '' : AI_SARAN.map(s => `<button class="btn sm ghost" data-s="${esc(s)}" style="white-space:normal;text-align:left">${esc(s)}</button>`).join('')}</div>
   <div class="row"><input id="aiQ" class="grow" placeholder="Ketik pertanyaan… (misal: berapa untung hari ini?)" autocomplete="off"><button class="btn pri" id="aiGo">Tanya</button></div></div>`;
  $('#aiSet').onclick = aiKeyDialog;
  $('#aiNew') &&
    ($('#aiNew').onclick = () => {
      AI.adapter = null;
      AI.view = [];
      render();
    });
  $$('#aiSug [data-s]').forEach(
    b =>
      (b.onclick = () => {
        $('#aiSug').innerHTML = '';
        aiAsk(b.dataset.s);
      })
  );
  const go_ = () => {
    const q = $('#aiQ').value.trim();
    if (!q) return;
    $('#aiQ').value = '';
    $('#aiSug').innerHTML = '';
    aiAsk(q);
  };
  $('#aiGo').onclick = go_;
  $('#aiQ').onkeydown = e => {
    if (e.key === 'Enter') go_();
  };
  drawAI();
  $('#aiQ').focus();
};
function drawAI() {
  const l = $('#aiLog');
  if (!l) return;
  l.innerHTML =
    AI.view
      .map(v =>
        v.who === 'me'
          ? `<div style="display:flex;justify-content:flex-end;margin:8px 0"><div style="background:var(--pri);color:#fff;border-radius:14px 14px 2px 14px;padding:10px 14px;max-width:80%">${v.html}</div></div>`
          : v.who === 'tool'
            ? `<div class="muted" style="font-size:13px;margin:6px 4px">${v.html}</div>`
            : v.who === 'err'
              ? `<div class="banner" style="background:#fdecec;border-color:#f3b4b4;color:#7f1d1d">${v.html}</div>`
              : `<div style="display:flex;margin:8px 0"><div style="background:#f2f5fa;border:1px solid var(--line);border-radius:14px 14px 14px 2px;padding:10px 14px;max-width:88%;line-height:1.5">${v.html}</div></div>`
      )
      .join('') || '<div class="empty">Pilih contoh pertanyaan di bawah atau ketik sendiri.</div>';
  l.scrollTop = l.scrollHeight;
  const b = $('#aiGo');
  if (b) b.disabled = AI.busy;
}
