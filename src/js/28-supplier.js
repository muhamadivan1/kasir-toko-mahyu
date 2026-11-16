/* ============ SUPPLIER, SALES & UTANG TOKO ============
 * - Daftar supplier / sales: nama, nama sales, No. HP, jadwal datang, tempo bayar, barang yang dibawa.
 * - Utang toko ke supplier (nota): total, jatuh tempo, dibayar / dicicil dari laci. Pembayarannya dicatat
 *   sebagai "belanja barang dagangan": uang laci berkurang, laba tidak berkurang (modal barang sudah
 *   dihitung dari harga beli barang yang terjual).
 * - Pesanan ke sales: kapan barangnya dijanjikan datang. Saat datang, langsung lanjut ke Barang masuk.
 * Disimpan di meta (ikut file backup): suppliers, notaSupplier, pesananSupplier.
 */
const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const daftarSup = () => (S.meta.suppliers = S.meta.suppliers || []);
const daftarNota = () => (S.meta.notaSupplier = S.meta.notaSupplier || []);
const daftarPesanSup = () => (S.meta.pesananSupplier = S.meta.pesananSupplier || []);
const supOf = id => daftarSup().find(s => s.id === id);
const namaSup = id => (supOf(id) || {}).nama || 'Supplier';
const sudahBayarNota = n => (n.bayar || []).reduce((a, b) => a + (Number(b.jumlah) || 0), 0);
const sisaNota = n => Math.max(0, (Number(n.total) || 0) - sudahBayarNota(n));
const utangKeSupplier = sid =>
  daftarNota()
    .filter(n => !sid || n.supplierId === sid)
    .reduce((a, n) => a + sisaNota(n), 0);
/** 'YYYY-MM-DD' -> waktu jam 00.00 */
function tglKe(k) {
  const [y, mo, d] = String(k).split('-').map(Number);
  return new Date(y, mo - 1, d).getTime();
}
/** selisih hari dari hari ini: 0 = hari ini, 1 = besok, -2 = lewat 2 hari */
const hariDari = k => Math.round((tglKe(k) - dayStart(0)) / 864e5);
const kataHari = n =>
  n === 0
    ? 'hari ini'
    : n === 1
      ? 'besok'
      : n === -1
        ? 'kemarin'
        : n > 0
          ? n + ' hari lagi'
          : 'lewat ' + -n + ' hari';
function tglPendek(k) {
  const d = new Date(tglKe(k));
  return NAMA_HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN_PENDEK[d.getMonth()];
}
const tambahHari = (k, n) => dkey(tglKe(k) + n * 864e5 + 3600e3);
async function simpanSupplier() {
  await saveMeta('suppliers');
  await saveMeta('notaSupplier');
  await saveMeta('pesananSupplier');
}

/* ---------- jadwal sales datang ---------- */
/** tanggal-tanggal kunjungan sales dalam [hari ini + dari, + jumlah hari) */
function kunjunganDalam(s, dari = 0, jumlah = 7) {
  const j = s.jadwal || {};
  const out = [];
  for (let i = dari; i < dari + jumlah; i++) {
    const t = dayStart(i);
    const d = new Date(t);
    let ya = false;
    if (j.pola === 'mingguan') ya = (j.hari || []).includes(d.getDay());
    else if (j.pola === '2minggu') {
      const beda = j.mulai ? Math.round((t - tglKe(j.mulai)) / 864e5) : 0;
      ya = (j.hari || []).includes(d.getDay()) && ((Math.floor(beda / 7) % 2) + 2) % 2 === 0;
    } else if (j.pola === 'bulanan' && j.tanggal) {
      const akhir = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      ya = d.getDate() === Math.min(Number(j.tanggal), akhir);
    }
    if (ya) out.push(dkey(t));
  }
  return out;
}
function jadwalTeks(s) {
  const j = s.jadwal || {};
  const hari = (j.hari || [])
    .slice()
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map(h => NAMA_HARI[h])
    .join(' & ');
  if (j.pola === 'mingguan' && hari) return 'Setiap ' + hari;
  if (j.pola === '2minggu' && hari) return '2 minggu sekali, ' + hari;
  if (j.pola === 'bulanan' && j.tanggal) return 'Setiap tanggal ' + j.tanggal;
  return 'Tidak tentu';
}
const kunjunganBerikut = s => kunjunganDalam(s, 0, 62)[0] || '';

/** Agenda: sales datang, barang pesanan datang, jatuh tempo utang. Yang terlambat ikut tampil paling atas. */
function agendaSupplier(hari = 7) {
  const a = [];
  for (const s of daftarSup())
    if (s.aktif !== false) for (const k of kunjunganDalam(s, 0, hari)) a.push({ k, jenis: 'datang', s });
  for (const p of daftarPesanSup())
    if (!p.selesai && p.datang && hariDari(p.datang) < hari)
      a.push({ k: p.datang, jenis: 'barang', p, s: supOf(p.supplierId) });
  for (const n of daftarNota())
    if (sisaNota(n) > 0 && n.jatuhTempo && hariDari(n.jatuhTempo) < hari)
      a.push({ k: n.jatuhTempo, jenis: 'tempo', n, s: supOf(n.supplierId) });
  const urut = { tempo: 0, barang: 1, datang: 2 };
  return a.sort((x, y) => tglKe(x.k) - tglKe(y.k) || urut[x.jenis] - urut[y.jenis]);
}

/* ---------- WhatsApp ke sales ---------- */
function waSales(s, isi = '') {
  const no = waNumber(s && s.hp);
  if (!no) return toast('No. HP sales belum diisi. Isi dulu lewat tombol Ubah.', true);
  const teks = `Assalamualaikum${s.sales ? ' ' + namaRapi(s.sales) : ''}, dari ${settings().nama}.${isi ? '\n' + isi : ''}`;
  const w = window.open('https://wa.me/' + no + '?text=' + encodeURIComponent(teks), '_blank');
  if (!w) toast('Browser memblokir jendela baru. Izinkan popup untuk membuka WhatsApp.', true);
}
/** Kirim daftar belanja ke sales lewat WA, lalu catat sebagai pesanan (kapan barang datang) */
function pilihSalesDialog(daftarTeks) {
  const ada = daftarSup().filter(s => s.aktif !== false && waNumber(s.hp));
  const m = modal(
    `<h3>📲 Kirim daftar belanja ke sales</h3>
   <p class="muted" style="margin-top:0">Pilih sales yang dituju. WhatsApp terbuka dengan daftar barangnya, lalu pesanan ini bisa dicatat supaya ada pengingat kapan barangnya datang.</p>
   ${ada.map(s => `<div class="row suprow"><div class="grow"><b>${esc(s.nama)}</b><div class="muted" style="font-size:13px">${esc([s.sales, hpRapi(s.hp), jadwalTeks(s)].filter(Boolean).join(' · '))}</div></div><button class="btn wa" data-ps="${s.id}">📲 Kirim</button></div>`).join('') || '<p class="muted">Belum ada sales yang punya No. HP. Tambahkan di menu 🚚 Supplier.</p>'}
   <div class="row actbar"><button class="btn ghost" id="psLain">Pilih kontak sendiri di WhatsApp</button><span class="grow"></span><button class="btn ghost" data-close>Tutup</button></div>`,
    { wide: true }
  );
  $$('[data-ps]', m).forEach(
    b =>
      (b.onclick = () => {
        const s = supOf(b.dataset.ps);
        waSales(s, 'Mau pesan barang:\n' + daftarTeks);
        m.close();
        pesananSupDialog({ supplierId: s.id, isi: daftarTeks });
      })
  );
  $('#psLain', m).onclick = () => {
    window.open(
      'https://wa.me/?text=' + encodeURIComponent(`Daftar belanja ${settings().nama}:\n${daftarTeks}`),
      '_blank'
    );
    m.close();
  };
}

/* ---------- pilihan supplier di form ---------- */
function opsiSupplier(sel) {
  return (
    `<option value="">— pilih supplier / sales —</option>` +
    daftarSup()
      .filter(s => s.aktif !== false || s.id === sel)
      .sort((a, b) => a.nama.localeCompare(b.nama))
      .map(
        s =>
          `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(s.nama)}${s.sales ? ' (' + esc(s.sales) + ')' : ''}</option>`
      )
      .join('') +
    '<option value="__baru">➕ Supplier baru…</option>'
  );
}
/** select supplier dengan pilihan "Supplier baru": membuka form supplier lalu memilihnya */
function pasangPilihSupplier(sel, onPilih) {
  sel.onchange = () => {
    if (sel.value !== '__baru') return onPilih && onPilih(sel.value);
    sel.value = '';
    editSupplier(null, s => {
      sel.innerHTML = opsiSupplier(s.id);
      onPilih && onPilih(s.id);
    });
  };
}

/* ---------- form supplier ---------- */
function editSupplier(s, after) {
  const baru = !s;
  s = s
    ? { ...s, jadwal: { ...(s.jadwal || {}) } }
    : {
        id: uid(),
        nama: '',
        sales: '',
        hp: '',
        tempo: 0,
        barang: '',
        catatan: '',
        aktif: true,
        jadwal: { pola: '' }
      };
  const j = s.jadwal;
  j.hari = j.hari || [];
  const m = modal(
    `<h3>🚚 ${baru ? 'Tambah' : 'Ubah'} supplier / sales</h3>
   <div class="grid2"><div><label>Nama supplier / agen *</label><input id="spN" value="${esc(s.nama)}" placeholder="contoh: Agen Indofood Sumedang" autofocus></div>
   <div><label>Nama sales</label><input id="spS" value="${esc(s.sales || '')}" placeholder="contoh: Pak Dedi"></div></div>
   <div class="grid2"><div><label>No. HP / WA sales</label><input id="spH" value="${esc(s.hp || '')}" inputmode="tel" placeholder="08xxxxxxxxxx"></div>
   <div><label>Tempo bayar (hari)</label><input id="spT" inputmode="numeric" value="${s.tempo || ''}" placeholder="0 = bayar tunai"><div class="subhint">Berapa hari utang boleh ditunda, misal 14.</div></div></div>
   <label>Jadwal sales datang</label>
   <div class="tabs2 polapick">${[
     ['', 'Tidak tentu'],
     ['mingguan', 'Tiap minggu'],
     ['2minggu', '2 minggu sekali'],
     ['bulanan', 'Tiap bulan']
   ]
     .map(
       ([v, l]) =>
         `<button type="button" data-pola="${v}" class="${(j.pola || '') === v ? 'on' : ''}">${l}</button>`
     )
     .join('')}</div>
   <div id="spHariBox"><label>Hari datang (boleh lebih dari satu)</label><div class="haripick">${[
     1, 2, 3, 4, 5, 6, 0
   ]
     .map(
       h =>
         `<button type="button" data-hari="${h}" class="${j.hari.includes(h) ? 'on' : ''}">${NAMA_HARI[h]}</button>`
     )
     .join('')}</div></div>
   <div id="spMulaiBox"><label>Kunjungan terdekat</label><input type="date" id="spM" value="${esc(j.mulai || dkey(Date.now()))}" style="max-width:240px"><div class="subhint">Dipakai untuk menghitung minggu selang-seling.</div></div>
   <div id="spTglBox"><label>Tanggal datang setiap bulan</label><input id="spD" inputmode="numeric" value="${j.tanggal || ''}" placeholder="1 sampai 31" style="max-width:160px"></div>
   <p class="hint" id="spNext"></p>
   <label>Barang yang dibawa</label><input id="spB" value="${esc(s.barang || '')}" placeholder="contoh: Indomie, Sarimi, Pop Mie">
   <label>Catatan</label><input id="spC" value="${esc(s.catatan || '')}" placeholder="contoh: bayar tiap kunjungan berikutnya">
   ${baru ? '' : `<label class="chk"><input type="checkbox" id="spA" ${s.aktif !== false ? 'checked' : ''}> Masih langganan (tampil di agenda)</label>`}
   <div class="row actbar">${baru ? '' : '<button class="btn bad" id="spDel">Hapus</button>'}<span class="grow"></span><button class="btn ghost" data-close>Batal</button><button class="btn pri" id="spOk">💾 Simpan</button></div>`,
    { wide: true }
  );
  const baca = () => {
    j.mulai = $('#spM', m).value;
    j.tanggal = Number(String($('#spD', m).value).replace(/\D/g, '')) || '';
  };
  const tampil = () => {
    baca();
    $('#spHariBox', m).classList.toggle('hide', !['mingguan', '2minggu'].includes(j.pola));
    $('#spMulaiBox', m).classList.toggle('hide', j.pola !== '2minggu');
    $('#spTglBox', m).classList.toggle('hide', j.pola !== 'bulanan');
    const k = kunjunganBerikut({ jadwal: j });
    $('#spNext', m).innerHTML = j.pola
      ? k
        ? `📅 Jadwal: <b>${esc(jadwalTeks({ jadwal: j }))}</b>. Kunjungan berikutnya <b>${tglPendek(k)}</b> (${kataHari(hariDari(k))}).`
        : 'Pilih harinya dulu.'
      : '';
  };
  $$('[data-pola]', m).forEach(
    b =>
      (b.onclick = () => {
        j.pola = b.dataset.pola;
        $$('[data-pola]', m).forEach(x => x.classList.toggle('on', x === b));
        tampil();
      })
  );
  $$('[data-hari]', m).forEach(
    b =>
      (b.onclick = () => {
        const h = +b.dataset.hari;
        j.hari = j.hari.includes(h) ? j.hari.filter(x => x !== h) : [...j.hari, h];
        b.classList.toggle('on', j.hari.includes(h));
        tampil();
      })
  );
  $('#spM', m).onchange = tampil;
  $('#spD', m).oninput = tampil;
  tampil();
  $('#spOk', m).onclick = async () => {
    baca();
    s.nama = $('#spN', m).value.trim();
    if (!s.nama) {
      toast('Isi nama supplier dulu', true);
      return $('#spN', m).focus();
    }
    s.sales = $('#spS', m).value.trim();
    s.hp = $('#spH', m).value.trim();
    s.tempo = num($('#spT', m).value) || 0;
    s.barang = $('#spB', m).value.trim();
    s.catatan = $('#spC', m).value.trim();
    if ($('#spA', m)) s.aktif = $('#spA', m).checked;
    if (!['mingguan', '2minggu'].includes(j.pola)) j.hari = [];
    const L = daftarSup();
    const i = L.findIndex(x => x.id === s.id);
    if (i < 0) L.push(s);
    else L[i] = s;
    await saveMeta('suppliers');
    m.close();
    toast('Supplier disimpan ✔');
    after ? after(s) : currentView === 'supplier' && render();
  };
  $('#spDel', m) &&
    ($('#spDel', m).onclick = async () => {
      const sisa = utangKeSupplier(s.id);
      if (sisa > 0)
        return toast(`Masih ada utang ke supplier ini Rp ${rp(sisa)}. Lunasi atau hapus notanya dulu.`, true);
      if (!(await confirmBox(`Hapus supplier ${s.nama}?`, 'Hapus', true))) return;
      S.meta.suppliers = daftarSup().filter(x => x.id !== s.id);
      S.meta.pesananSupplier = daftarPesanSup().filter(p => p.supplierId !== s.id);
      await simpanSupplier();
      m.close();
      render();
    });
}

/* ---------- utang toko ke supplier (nota) ---------- */
function jatuhTempoAwal(sid, tglTerima) {
  const s = supOf(sid);
  return tambahHari(tglTerima || dkey(Date.now()), s && s.tempo ? s.tempo : 14);
}
function catatNotaDialog(preset = {}, after) {
  const today = dkey(Date.now());
  let jtManual = !!preset.jatuhTempo;
  const m = modal(
    `<h3>📒 Catat utang toko ke supplier</h3>
   <p class="muted" style="margin-top:0">Untuk barang yang sudah diterima tapi belum dibayar (bayar nanti / tempo).</p>
   <label>Supplier / sales *</label><select id="nsS">${opsiSupplier(preset.supplierId || '')}</select>
   <div class="grid2"><div><label>Tanggal barang diterima</label><input type="date" id="nsW" value="${esc(preset.tanggal || today)}"></div>
   <div><label>No. nota / faktur (opsional)</label><input id="nsNo" value="${esc(preset.noNota || '')}"></div></div>
   <div class="grid2"><div><label>Total utang (Rp) *</label><input id="nsT" inputmode="numeric" class="bignum" value="${preset.total ? rp(preset.total) : ''}"></div>
   <div><label>Jatuh tempo bayar</label><input type="date" id="nsJ" value="${esc(preset.jatuhTempo || jatuhTempoAwal(preset.supplierId, today))}"><div class="subhint" id="nsJh"></div></div></div>
   <label>Catatan (opsional)</label><input id="nsC" value="${esc(preset.catatan || '')}" placeholder="contoh: 2 dus Indomie goreng, 1 dus Sarimi">
   <div class="row actbar"><span class="grow"></span><button class="btn ghost" data-close>Batal</button><button class="btn pri" id="nsOk">💾 Simpan</button></div>`
  );
  const hint = () => {
    const s = supOf($('#nsS', m).value);
    const k = $('#nsJ', m).value;
    $('#nsJh', m).textContent = k
      ? `${tglPendek(k)} (${kataHari(hariDari(k))})${s && s.tempo ? ` · tempo ${s.tempo} hari` : ''}`
      : '';
  };
  const ulangTempo = () => {
    if (!jtManual) $('#nsJ', m).value = jatuhTempoAwal($('#nsS', m).value, $('#nsW', m).value);
    hint();
  };
  pasangPilihSupplier($('#nsS', m), ulangTempo);
  $('#nsW', m).onchange = ulangTempo;
  $('#nsJ', m).onchange = () => {
    jtManual = true;
    hint();
  };
  hint();
  $('#nsOk', m).onclick = async () => {
    const sid = $('#nsS', m).value;
    const total = num($('#nsT', m).value);
    if (!sid) return toast('Pilih supplier dulu', true);
    if (!(total > 0)) return toast('Isi total utangnya', true);
    const n = {
      id: uid(),
      supplierId: sid,
      waktu: tglKe($('#nsW', m).value || today) + 12 * 3600e3,
      noNota: $('#nsNo', m).value.trim(),
      total,
      jatuhTempo: $('#nsJ', m).value || '',
      catatan: $('#nsC', m).value.trim(),
      bayar: []
    };
    daftarNota().push(n);
    await saveMeta('notaSupplier');
    m.close();
    toast(`Utang ke ${namaSup(sid)} Rp ${rp(total)} dicatat ✔`);
    after ? after(n) : render();
  };
}
function bayarNotaDialog(n, after) {
  const s = supOf(n.supplierId) || {};
  const sisa = sisaNota(n);
  let kas = kasAktif().some(k => k.id === 'warung') ? 'warung' : '';
  const m = modal(
    `<h3>💸 Bayar utang ke ${esc(s.nama || 'supplier')}</h3>
   <p style="margin-top:0">${n.noNota ? 'Nota ' + esc(n.noNota) + ' · ' : ''}diterima ${tgl(n.waktu)} · total Rp ${rp(n.total)}${sudahBayarNota(n) ? ' · sudah dibayar Rp ' + rp(sudahBayarNota(n)) : ''}<br>Sisa: <b style="font-size:20px">Rp ${rp(sisa)}</b></p>
   <label>Jumlah dibayar sekarang (Rp)</label><input id="bnJ" inputmode="numeric" class="bignum" value="${rp(sisa)}">
   <label>Uangnya dari</label><div class="kaspick">${[
     ...kasAktif().filter(k => k.id !== 'brilink'),
     { id: '', ikon: '📝', nama: 'Uang di luar laci', warna: '#6b7686' }
   ]
     .map(
       k =>
         `<button type="button" data-bn="${k.id}" class="${k.id === kas ? 'on' : ''}" style="--kc:${k.warna}">${k.ikon} ${esc(k.id ? 'Laci ' + k.nama : k.nama)}</button>`
     )
     .join('')}</div>
   <p class="hint">Dicatat sebagai belanja barang dagangan: uang laci berkurang, tapi laba tidak berkurang (modal barang sudah dihitung dari harga beli). Pilih <b>Uang di luar laci</b> kalau dibayar dari uang simpanan.</p>
   <div class="row actbar"><span class="grow"></span><button class="btn ghost" data-close>Batal</button><button class="btn ok" id="bnOk">💾 Simpan pembayaran</button></div>`
  );
  $$('[data-bn]', m).forEach(
    b =>
      (b.onclick = () => {
        kas = b.dataset.bn;
        $$('[data-bn]', m).forEach(x => x.classList.toggle('on', x === b));
      })
  );
  $('#bnOk', m).onclick = async () => {
    const j = num($('#bnJ', m).value);
    if (!(j > 0)) return toast('Isi jumlah yang dibayar', true);
    if (j > sisa) return toast(`Lebih dari sisa utang (Rp ${rp(sisa)})`, true);
    const b = { id: uid(), waktu: Date.now(), jumlah: j, kas };
    if (kas) {
      const e = await catatUang({
        jenis: 'keluar',
        kas,
        jumlah: j,
        kategori: 'kulakan',
        stok: true,
        notaId: n.id,
        catatan: 'Bayar utang ke ' + (s.nama || 'supplier') + (n.noNota ? ' (nota ' + n.noNota + ')' : '')
      });
      b.kasId = e.id;
    }
    n.bayar = [...(n.bayar || []), b];
    await saveMeta('notaSupplier');
    m.close();
    toast(
      sisaNota(n)
        ? `Dibayar Rp ${rp(j)} ✔ Sisa Rp ${rp(sisaNota(n))}`
        : `Utang ke ${s.nama || 'supplier'} lunas ✔`
    );
    after ? after() : render();
  };
  $('#bnJ', m).onkeydown = e => e.key === 'Enter' && $('#bnOk', m).click();
}
function rincianNotaDialog(n) {
  const m = modal(
    `<h3>📒 Utang ke ${esc(namaSup(n.supplierId))}</h3>
   <table class="kast"><tbody>
    <tr><td>Barang diterima</td><td class="num">${tgl(n.waktu)}</td></tr>
    ${n.noNota ? `<tr><td>No. nota</td><td class="num">${esc(n.noNota)}</td></tr>` : ''}
    <tr><td>Jatuh tempo</td><td class="num">${n.jatuhTempo ? tglPendek(n.jatuhTempo) + ' (' + kataHari(hariDari(n.jatuhTempo)) + ')' : '-'}</td></tr>
    <tr><td>Total</td><td class="num">Rp ${rp(n.total)}</td></tr>
    ${(n.bayar || []).map(b => `<tr><td>Dibayar ${tgl(b.waktu)} · ${b.kas ? 'laci ' + esc(infoKas(b.kas).nama) : 'di luar laci'}</td><td class="num">− Rp ${rp(b.jumlah)}</td></tr>`).join('')}
    <tr><td><b>Sisa</b></td><td class="num"><b>Rp ${rp(sisaNota(n))}</b></td></tr>
   </tbody></table>
   ${n.catatan ? `<p class="hint">📝 ${esc(n.catatan)}</p>` : ''}
   <div class="row actbar"><button class="btn bad" id="rnDel">Hapus nota</button><span class="grow"></span><button class="btn ghost" data-close>Tutup</button>${sisaNota(n) ? '<button class="btn ok" id="rnPay">💸 Bayar</button>' : ''}</div>`
  );
  $('#rnPay', m) &&
    ($('#rnPay', m).onclick = () => {
      m.close();
      bayarNotaDialog(n);
    });
  $('#rnDel', m).onclick = async () => {
    const dariLaci = (n.bayar || []).filter(b => b.kasId);
    const ket = dariLaci.length
      ? ` Pembayaran dari laci (Rp ${rp(dariLaci.reduce((a, b) => a + b.jumlah, 0))}) ikut dihapus dari catatan uang.`
      : '';
    if (!(await confirmBox('Hapus nota utang ini?' + ket, 'Hapus', true))) return;
    for (const b of dariLaci) if (S.kas.some(e => e.id === b.kasId)) await remove('kas', b.kasId);
    S.meta.notaSupplier = daftarNota().filter(x => x.id !== n.id);
    await saveMeta('notaSupplier');
    m.close();
    render();
  };
}

/* ---------- pesanan ke sales (kapan barang datang) ---------- */
function pesananSupDialog(preset = {}, after) {
  const p = preset.id
    ? { ...preset }
    : { id: uid(), supplierId: '', dipesan: dkey(Date.now()), datang: '', isi: '', ...preset };
  const m = modal(
    `<h3>🗓️ ${preset.id ? 'Ubah' : 'Catat'} pesanan ke sales</h3>
   <p class="muted" style="margin-top:0">Supaya ada pengingat kapan barangnya datang. Saat barang datang, tekan <b>📥 Sudah datang</b> di agenda.</p>
   <label>Supplier / sales *</label><select id="psS">${opsiSupplier(p.supplierId)}</select>
   <div class="grid2"><div><label>Tanggal pesan</label><input type="date" id="psW" value="${esc(p.dipesan)}"></div>
   <div><label>Barang dijanjikan datang</label><input type="date" id="psD" value="${esc(p.datang || '')}"><div class="subhint" id="psDh">Kosongkan kalau belum tahu.</div></div></div>
   <label>Isi pesanan</label><textarea id="psI" rows="5" placeholder="contoh:&#10;Indomie goreng 2 dus&#10;Sarimi soto 1 dus">${esc(p.isi || '')}</textarea>
   <div class="row actbar">${preset.id ? '<button class="btn bad" id="psDel">Hapus</button>' : ''}<span class="grow"></span><button class="btn ghost" data-close>Batal</button><button class="btn pri" id="psOk">💾 Simpan</button></div>`,
    { wide: true }
  );
  const hint = () => {
    const k = $('#psD', m).value;
    $('#psDh', m).textContent = k
      ? `${tglPendek(k)} (${kataHari(hariDari(k))})`
      : 'Kosongkan kalau belum tahu.';
  };
  const usulDatang = sid => {
    // perkiraan: kunjungan sales berikutnya
    if ($('#psD', m).value) return;
    const s = supOf(sid);
    const k = s && kunjunganDalam(s, 1, 40)[0];
    if (k) $('#psD', m).value = k;
    hint();
  };
  pasangPilihSupplier($('#psS', m), usulDatang);
  if (p.supplierId) usulDatang(p.supplierId);
  $('#psD', m).onchange = hint;
  hint();
  $('#psOk', m).onclick = async () => {
    p.supplierId = $('#psS', m).value;
    if (!p.supplierId) return toast('Pilih supplier dulu', true);
    p.dipesan = $('#psW', m).value || dkey(Date.now());
    p.datang = $('#psD', m).value;
    p.isi = $('#psI', m).value.trim();
    const L = daftarPesanSup();
    const i = L.findIndex(x => x.id === p.id);
    if (i < 0) L.push(p);
    else L[i] = p;
    await saveMeta('pesananSupplier');
    m.close();
    toast(p.datang ? `Pesanan dicatat ✔ Pengingat ${tglPendek(p.datang)}` : 'Pesanan dicatat ✔');
    after ? after(p) : currentView === 'supplier' && render();
  };
  $('#psDel', m) &&
    ($('#psDel', m).onclick = async () => {
      if (!(await confirmBox('Hapus pesanan ini?', 'Hapus', true))) return;
      S.meta.pesananSupplier = daftarPesanSup().filter(x => x.id !== p.id);
      await saveMeta('pesananSupplier');
      m.close();
      render();
    });
}
/** Barang pesanan datang: lanjut ke Barang masuk (stok bertambah, bisa langsung dicatat sebagai utang) */
function barangDatang(p) {
  const s = supOf(p.supplierId);
  stockDialog(
    'masuk',
    [],
    async () => {
      p.selesai = true;
      p.datangWaktu = Date.now();
      await saveMeta('pesananSupplier');
      if (currentView === 'supplier' || currentView === 'beranda') render();
    },
    { catatan: 'Kiriman ' + (s ? s.nama : 'sales'), supplierId: p.supplierId, isiPesanan: p.isi }
  );
}

/* ---------- halaman Supplier ---------- */
views.supplier = () => {
  const notaBuka = daftarNota()
    .filter(n => S._notaSemua || sisaNota(n) > 0)
    .sort((a, b) => (a.jatuhTempo || '9').localeCompare(b.jatuhTempo || '9') || a.waktu - b.waktu);
  const totalUtang = utangKeSupplier();
  const tempo7 = daftarNota()
    .filter(n => sisaNota(n) > 0 && n.jatuhTempo && hariDari(n.jatuhTempo) <= 7)
    .reduce((a, n) => a + sisaNota(n), 0);
  const datangHariIni = daftarSup().filter(s => s.aktif !== false && kunjunganDalam(s, 0, 1).length);
  const ag = agendaSupplier(7);
  const baris = x => {
    const n = hariDari(x.k);
    const s = x.s || {};
    const lewat = n < 0;
    let ikon, teks, aksi;
    if (x.jenis === 'datang') {
      ikon = '🚚';
      teks = `Sales <b>${esc(s.sales || s.nama)}</b>${s.sales ? ' (' + esc(s.nama) + ')' : ''} datang${s.barang ? `<div class="muted" style="font-size:13px">Bawa: ${esc(s.barang)}</div>` : ''}${utangKeSupplier(s.id) ? `<div class="muted" style="font-size:13px">Utang ke supplier ini Rp ${rp(utangKeSupplier(s.id))}</div>` : ''}`;
      aksi = `${waNumber(s.hp) ? `<button class="btn sm ghost wa" data-wa="${s.id}">💬 WA</button> ` : ''}<button class="btn sm ghost" data-psn="${s.id}">🗓️ Catat pesanan</button>`;
    } else if (x.jenis === 'barang') {
      ikon = '📦';
      teks = `Barang pesanan dari <b>${esc(s.nama || 'supplier')}</b> ${lewat ? 'belum datang' : 'dijadwalkan datang'}${x.p.isi ? `<div class="muted" style="font-size:13px">${esc(x.p.isi.replace(/\n/g, ', '))}</div>` : ''}`;
      aksi = `<button class="btn sm ok" data-dtg="${x.p.id}">📥 Sudah datang</button> <button class="btn sm ghost" data-pse="${x.p.id}">Ubah</button>`;
    } else {
      ikon = '💸';
      teks = `Jatuh tempo utang ke <b>${esc(s.nama || 'supplier')}</b>: <b>Rp ${rp(sisaNota(x.n))}</b>${x.n.noNota ? ` <span class="muted">(nota ${esc(x.n.noNota)})</span>` : ''}`;
      aksi = `<button class="btn sm ok" data-bayar="${x.n.id}">💸 Bayar</button>`;
    }
    return `<tr class="${lewat ? 'telat' : n === 0 ? 'hariini' : ''}"><td style="white-space:nowrap"><b>${tglPendek(x.k)}</b><div class="${lewat ? 'negtxt' : 'muted'}" style="font-size:13px">${kataHari(n)}</div></td><td style="font-size:20px">${ikon}</td><td>${teks}</td><td class="right" style="white-space:nowrap">${aksi}</td></tr>`;
  };
  $('#main').innerHTML =
    `<div class="card"><div class="row" style="margin-bottom:12px"><h2 class="grow" style="margin:0">🚚 Supplier, Sales &amp; Utang Toko</h2>
   <button class="btn bad" id="spNota">📒 Catat utang ke supplier</button><button class="btn ghost" id="spPesan">🗓️ Catat pesanan ke sales</button><button class="btn pri" id="spAdd">➕ Tambah supplier / sales</button></div>
   <div class="stats"><div class="stat"><div class="muted">Utang toko ke supplier</div><div class="v">Rp ${rp(totalUtang)}</div><div class="muted" style="font-size:12px">${daftarNota().filter(n => sisaNota(n) > 0).length} nota belum lunas</div></div>
   <div class="stat"><div class="muted">Jatuh tempo 7 hari ke depan</div><div class="v ${tempo7 ? 'negtxt' : ''}">Rp ${rp(tempo7)}</div></div>
   <div class="stat"><div class="muted">Sales datang hari ini</div><div class="v" style="font-size:20px">${datangHariIni.length ? datangHariIni.map(s => esc(s.sales || s.nama)).join(', ') : '-'}</div></div></div>
   <h3>🗓️ Agenda 7 hari ke depan</h3>
   <div class="tablewrap"><table class="zebra agenda"><tbody>${ag.map(baris).join('') || '<tr><td class="empty">Belum ada jadwal. Isi jadwal datang sales di daftar supplier, atau catat pesanan ke sales.</td></tr>'}</tbody></table></div>
   <div class="row" style="margin:18px 0 8px;align-items:center"><h3 class="grow" style="margin:0">📒 Utang toko ke supplier</h3><label class="chk" style="margin:0"><input type="checkbox" id="spSemua" ${S._notaSemua ? 'checked' : ''}> Tampilkan yang sudah lunas</label></div>
   <div class="tablewrap"><table class="zebra"><thead><tr><th>Supplier</th><th>Diterima</th><th class="hide-m">No. nota</th><th class="num">Total</th><th class="num">Sisa</th><th>Jatuh tempo</th><th></th></tr></thead><tbody>${
     notaBuka
       .map(n => {
         const sisa = sisaNota(n);
         const h = n.jatuhTempo ? hariDari(n.jatuhTempo) : null;
         return `<tr><td><b>${esc(namaSup(n.supplierId))}</b>${n.catatan ? `<div class="muted" style="font-size:13px">${esc(n.catatan)}</div>` : ''}</td><td>${tgl(n.waktu)}</td><td class="hide-m">${esc(n.noNota || '-')}</td><td class="num">${rp(n.total)}</td><td class="num">${sisa ? `<b>${rp(sisa)}</b>` : '<span class="badge ok">lunas</span>'}</td><td>${n.jatuhTempo ? `${tgl(tglKe(n.jatuhTempo))}${sisa ? `<div class="${h < 0 ? 'negtxt' : h <= 3 ? 'warntxt' : 'muted'}" style="font-size:13px">${kataHari(h)}</div>` : ''}` : '-'}</td><td class="right" style="white-space:nowrap">${sisa ? `<button class="btn sm ok" data-bayar="${n.id}">💸 Bayar</button> ` : ''}<button class="btn sm ghost" data-nota="${n.id}">Rincian</button></td></tr>`;
       })
       .join('') || '<tr><td colspan="7" class="empty">Tidak ada utang ke supplier. 👍</td></tr>'
   }</tbody></table></div>
   <h3 style="margin-top:18px">👥 Daftar supplier &amp; sales</h3>
   <div class="tablewrap"><table class="zebra"><thead><tr><th>Supplier</th><th>Sales &amp; No. HP</th><th>Jadwal datang</th><th class="num hide-m">Tempo</th><th class="num">Utang</th><th></th></tr></thead><tbody>${
     daftarSup()
       .slice()
       .sort((a, b) => (b.aktif !== false) - (a.aktif !== false) || a.nama.localeCompare(b.nama))
       .map(s => {
         const k = kunjunganBerikut(s);
         const u = utangKeSupplier(s.id);
         return `<tr class="${s.aktif === false ? 'nonaktif' : ''}"><td><b>${esc(s.nama)}</b>${s.barang ? `<div class="muted" style="font-size:13px">${esc(s.barang)}</div>` : ''}</td><td>${esc(s.sales || '-')}${s.hp ? `<div class="muted" style="font-size:13px">${esc(hpRapi(s.hp))}</div>` : ''}</td><td>${esc(jadwalTeks(s))}${k ? `<div class="muted" style="font-size:13px">berikutnya ${tglPendek(k)}</div>` : ''}</td><td class="num hide-m">${s.tempo ? s.tempo + ' hari' : 'tunai'}</td><td class="num">${u ? `<b>Rp ${rp(u)}</b>` : '<span class="muted">-</span>'}</td><td class="right" style="white-space:nowrap">${waNumber(s.hp) ? `<button class="btn sm ghost wa" data-wa="${s.id}">💬 WA</button> ` : ''}<button class="btn sm ghost" data-utg="${s.id}">📒 Utang</button> <button class="btn sm ghost" data-psn="${s.id}">🗓️ Pesan</button> <button class="btn sm ghost" data-spe="${s.id}">Ubah</button></td></tr>`;
       })
       .join('') ||
     '<tr><td colspan="6" class="empty">Belum ada supplier. Tekan ➕ Tambah supplier / sales.</td></tr>'
   }</tbody></table></div></div>`;
  $('#spAdd').onclick = () => editSupplier(null);
  $('#spNota').onclick = () => catatNotaDialog();
  $('#spPesan').onclick = () => pesananSupDialog();
  $('#spSemua').onchange = e => {
    S._notaSemua = e.target.checked;
    render();
  };
  const notaOf = id => daftarNota().find(n => n.id === id);
  $$('[data-bayar]').forEach(b => (b.onclick = () => bayarNotaDialog(notaOf(b.dataset.bayar))));
  $$('[data-nota]').forEach(b => (b.onclick = () => rincianNotaDialog(notaOf(b.dataset.nota))));
  $$('[data-wa]').forEach(b => (b.onclick = () => waSales(supOf(b.dataset.wa))));
  $$('[data-psn]').forEach(b => (b.onclick = () => pesananSupDialog({ supplierId: b.dataset.psn })));
  $$('[data-utg]').forEach(b => (b.onclick = () => catatNotaDialog({ supplierId: b.dataset.utg })));
  $$('[data-spe]').forEach(b => (b.onclick = () => editSupplier(supOf(b.dataset.spe))));
  $$('[data-dtg]').forEach(
    b => (b.onclick = () => barangDatang(daftarPesanSup().find(p => p.id === b.dataset.dtg)))
  );
  $$('[data-pse]').forEach(
    b => (b.onclick = () => pesananSupDialog(daftarPesanSup().find(p => p.id === b.dataset.pse)))
  );
};

/** Pengingat untuk Beranda (Perlu perhatian) */
function pengingatSupplier() {
  const out = [];
  const tempo = daftarNota().filter(n => sisaNota(n) > 0 && n.jatuhTempo && hariDari(n.jatuhTempo) <= 2);
  if (tempo.length) {
    const lewat = tempo.filter(n => hariDari(n.jatuhTempo) < 0).length;
    out.push({
      i: '💸',
      t: `Utang ke supplier jatuh tempo: <b>Rp ${rp(tempo.reduce((a, n) => a + sisaNota(n), 0))}</b>${lewat ? ` (${lewat} sudah lewat)` : ''}`,
      s: [...new Set(tempo.map(n => namaSup(n.supplierId)))].join(', '),
      go: () => go('supplier')
    });
  }
  const datang = daftarSup().filter(s => s.aktif !== false && kunjunganDalam(s, 0, 1).length);
  if (datang.length)
    out.push({
      i: '🚚',
      t: `Hari ini jadwal sales datang: <b>${datang.map(s => esc(s.sales || s.nama)).join(', ')}</b>`,
      s: 'Siapkan daftar kulakan dan uang untuk bayar.',
      go: () => go('supplier')
    });
  const brg = daftarPesanSup().filter(p => !p.selesai && p.datang && hariDari(p.datang) <= 0);
  if (brg.length)
    out.push({
      i: '📦',
      t: `<b>${brg.length}</b> pesanan barang dijadwalkan datang hari ini${brg.some(p => hariDari(p.datang) < 0) ? ' atau terlambat' : ''}`,
      s: 'Kalau sudah datang, tekan 📥 Sudah datang supaya stok bertambah.',
      go: () => go('supplier')
    });
  return out;
}
