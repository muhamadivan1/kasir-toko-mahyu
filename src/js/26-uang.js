/* ============ HALAMAN UANG ============
 * Buka kasir (hitung uang awal) → jualan → catat pengeluaran → tutup kasir (hitung, lihat selisih).
 * Setiap laci (Warung, BRILink, Material) dihitung sendiri-sendiri.
 */
let uangRange = 'today';
function rentangUang(r) {
  const now = new Date();
  if (r === 'yday') return [dayStart(-1), dayStart(0), 'Kemarin'];
  if (r === '7') return [dayStart(-6), dayStart(1), '7 hari terakhir'];
  if (r === 'month')
    return [new Date(now.getFullYear(), now.getMonth(), 1).getTime(), dayStart(1), 'Bulan ini'];
  return [dayStart(0), dayStart(1), 'Hari ini'];
}
const jamMenit = t => {
  const d = new Date(t);
  return pad(d.getHours()) + '.' + pad(d.getMinutes());
};
/** Baris rincian di kartu laci. Nilai minus ditulis dengan tanda − */
function barisUang(label, v, kuat) {
  return `<tr><td>${label}</td><td class="num ${v < 0 ? 'negtxt' : ''}">${kuat ? '<b>' : ''}${v < 0 ? '−' : ''}${rp(Math.abs(v))}${kuat ? '</b>' : ''}</td></tr>`;
}
function keteranganPatokan(p) {
  if (!p.patokan) return 'Uang awal <span class="muted">(belum buka kasir, dihitung dari 0)</span>';
  const e = p.patokan.e;
  const hari = p.patokan.waktu >= dayStart(0) ? 'jam ' + jamMenit(e.waktu) : tglJam(e.waktu);
  return e.jenis === 'buka' ? `Uang awal (buka ${hari})` : `Sisa di laci (tutup ${hari})`;
}
function kartuLaci(k, p, r) {
  const saldo = SALDO.filter(x => x.kas === k.id)
    .map(x => {
      const ps = posisiUang(x.id);
      return `<div class="saldorow"><span>${x.ikon} ${esc(x.nama)}</span><b>${!ps ? '<span class="muted" title="Tekan ✔ Samakan lalu isi saldo dari aplikasi">belum diisi</span>' : ps.saldo < 0 ? `<span class="negtxt" title="Saldo kurang, isi saldo dulu">⚠️ Rp −${rp(-ps.saldo)}</span>` : 'Rp ' + rp(ps.saldo)}</b>
        <span class="saldobtn">${x.id === 'pb' ? `<button class="btn sm ghost" data-pindah="warung>pb">➕ Isi saldo</button>` : `<button class="btn sm ghost" data-pindah="brilink>rek">⬆️ Setor ke bank</button><button class="btn sm ghost" data-pindah="rek>brilink">⬇️ Ambil dari bank</button>`}<button class="btn sm ghost" data-sama="${x.id}">✔ Samakan</button></span></div>`;
    })
    .join('');
  const tutup = belumTutup().includes(k.id);
  return `<div class="kascard" style="--kc:${k.warna}">
    <div class="kashead"><span class="kasic">${k.ikon}</span><b>Uang ${esc(k.nama)}</b><span class="grow"></span>${bukaHariIni(k.id) ? (tutup ? '<span class="badge ok">buka</span>' : '<span class="badge">sudah tutup</span>') : '<span class="badge warn">belum buka</span>'}</div>
    <div class="muted" style="font-size:14px">Seharusnya ada di laci sekarang</div>
    <div class="kasv ${p.saldo < 0 ? 'negtxt' : ''}">Rp ${p.saldo < 0 ? '−' : ''}${rp(Math.abs(p.saldo))}</div>
    <table class="kast"><tbody>
      ${barisUang(keteranganPatokan(p), p.awal)}
      ${p.jual ? barisUang('+ Penjualan tunai', p.jual) : ''}
      ${p.setor ? barisUang('+ Uang diterima (transfer, setor, bayar)', p.setor) : ''}
      ${p.tarik ? barisUang('− Tarik tunai diberikan', -p.tarik) : ''}
      ${p.utang ? barisUang('+ Bayar utang / kekurangan', p.utang) : ''}
      ${p.masuk ? barisUang('+ Uang masuk lain', p.masuk) : ''}
      ${p.keluar ? barisUang('− Pengeluaran', -p.keluar) : ''}
      ${p.pindahMasuk ? barisUang('+ Pindahan dari uang lain', p.pindahMasuk) : ''}
      ${p.pindahKeluar ? barisUang('− Dipindah ke uang lain', -p.pindahKeluar) : ''}
    </tbody></table>
    ${r.non ? `<div class="kasnote">📱 QRIS / transfer hari ini <b>Rp ${rp(r.non)}</b> (tidak ada di laci)</div>` : ''}
    ${r.utang ? `<div class="kasnote">📒 Utang baru hari ini <b>Rp ${rp(r.utang)}</b></div>` : ''}
    ${saldo}
    <div class="kaslaba">Laba kotor hari ini <b>Rp ${rp(r.laba)}</b>${r.biaya ? ` · biaya Rp ${rp(r.biaya)}` : ''}</div>
    <div class="row" style="margin-top:8px"><button class="btn sm ghost grow" data-keluar="${k.id}">➖ Pengeluaran</button><button class="btn sm ghost grow" data-tutup="${k.id}">🌙 Tutup laci ini</button></div>
  </div>`;
}
function teksCatatan(e) {
  const j = Number(e.jumlah) || 0;
  switch (e.jenis) {
    case 'buka':
      return {
        t: e.otomatis ? '☀️ Buka kasir otomatis (uang menurut catatan)' : '☀️ Buka kasir (uang awal)',
        v: j,
        netral: true
      };
    case 'tutup':
      if (e.otomatis)
        return { t: '🌙 Tutup kasir otomatis (uang tidak dihitung ulang)', v: e.sisa, netral: true };
      return {
        t: `🌙 Tutup kasir · dihitung Rp ${rp(e.dihitung)} · ${e.selisih ? (e.selisih > 0 ? 'lebih' : 'kurang') + ' Rp ' + rp(Math.abs(e.selisih)) : 'pas ✔'}${e.diambil ? ' · disimpan Rp ' + rp(e.diambil) : ''}`,
        v: e.sisa,
        netral: true
      };
    case 'keluar': {
      const c = kategoriKeluar(e.kategori);
      return { t: `${c.ikon} ${esc(c.nama)}${e.catatan ? ' · ' + esc(e.catatan) : ''}`, v: -j };
    }
    case 'masuk':
      return { t: `➕ Uang masuk${e.catatan ? ' · ' + esc(e.catatan) : ''}`, v: j };
    case 'pindah':
      return {
        t: `🔁 ${esc(namaKas(e.kas))} → ${esc(namaKas(e.ke))}${e.catatan ? ' · ' + esc(e.catatan) : ''}`,
        v: j,
        netral: true
      };
    case 'saldo':
      return {
        t: `✔ Samakan saldo${e.sebelum !== undefined && e.sebelum !== null ? ' (catatan aplikasi Rp ' + rp(e.sebelum) + ')' : ''}`,
        v: j,
        netral: true
      };
  }
  return { t: esc(e.jenis), v: j };
}
views.uang = () => {
  const ks = kasAktif();
  const R = rekapUang(dayStart(0), dayStart(1));
  const [a, b, judul] = rentangUang(uangRange);
  const RR = uangRange === 'today' ? R : rekapUang(a, b);
  const blm = belumTutup();
  const hariIni = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
  const catatan = S.kas
    .filter(e => e.waktu >= a && e.waktu < b)
    .sort((x, y) => y.waktu - x.waktu)
    .slice(0, 300);
  const laci = ks.map(k => k.id);
  $('#main').innerHTML = `
  <div class="row uanghead" style="margin-bottom:12px"><h2 class="grow" style="margin:0">💰 Uang toko <span class="muted" style="font-size:16px;font-weight:400">· ${hariIni}</span></h2>
    <button class="btn ${bukaHariIni() ? 'ghost' : 'pri'}" id="uBuka">☀️ Buka kasir</button>
    <button class="btn ${blm.length ? 'pri' : 'ghost'}" id="uTutup">🌙 Tutup kasir</button></div>
  <div class="row" style="margin-bottom:12px">
    <button class="btn" id="uKeluar">➖ Catat pengeluaran</button>
    <button class="btn ghost" id="uMasuk">➕ Uang masuk lain</button>
    <button class="btn ghost" id="uPindah">🔁 Pindah uang</button>
    <button class="btn ghost" id="uCetak">🖨️ Cetak laporan hari ini</button>
  </div>
  <div class="kasgrid">${ks.map(k => kartuLaci(k, posisiUang(k.id), R[k.id])).join('')}</div>
  <div class="tabs2" style="margin-top:16px">${[
    ['today', 'Hari ini'],
    ['yday', 'Kemarin'],
    ['7', '7 hari'],
    ['month', 'Bulan ini']
  ]
    .map(([k, l]) => `<button data-ur="${k}" class="${uangRange === k ? 'on' : ''}">${l}</button>`)
    .join('')}</div>
  <div class="uanggrid">
   <div class="card"><h3>📊 Laba bersih · ${judul}</h3>
    <div class="tablewrap" style="max-height:none"><table class="labatab"><thead><tr><th></th>${laci.map(k => `<th class="num">${infoKas(k).ikon} ${esc(infoKas(k).nama)}</th>`).join('')}${laci.length > 1 ? '<th class="num">Semua</th>' : ''}</tr></thead><tbody>
    ${[
      ['Penjualan / pendapatan', 'jual'],
      ['− Modal (harga beli)', 'modal', -1],
      ['= Laba kotor', 'laba', 1, true],
      ['− Pengeluaran toko', 'biaya', -1],
      ['= Laba bersih', 'bersih', 1, true]
    ]
      .map(
        ([l, f, sg, kuat]) =>
          `<tr class="${kuat ? 'kuat' : ''}"><td>${l}</td>${[...laci, ...(laci.length > 1 ? ['semua'] : [])]
            .map(k => {
              const v = (RR[k][f] || 0) * (sg === -1 ? -1 : 1);
              return `<td class="num ${v < 0 ? 'negtxt' : ''}">${v < 0 ? '−' : ''}${rp(Math.abs(v))}</td>`;
            })
            .join('')}</tr>`
      )
      .join('')}
    </tbody></table></div>
    <div class="muted" style="font-size:13px;margin-top:8px;line-height:1.6">
      ${RR.warung.nLyn ? `📲 Layanan PojokBayar: ${RR.warung.nLyn} transaksi, untung Rp ${rp(RR.warung.lynLaba)}.<br>` : ''}
      ${RR.brilink && RR.brilink.trx ? `🏦 BRILink: tarik tunai Rp ${rp(RR.brilink.tarik)}, transfer/setor Rp ${rp(RR.brilink.setor)}, admin Rp ${rp(RR.brilink.admin)}.<br>` : ''}
      ${RR.semua.kulakan ? `🛒 Belanja barang dagangan Rp ${rp(RR.semua.kulakan)} (tidak mengurangi laba, karena modal barang sudah dihitung dari harga beli).<br>` : ''}
      ${RR.semua.prive ? `🏠 Diambil untuk keperluan rumah Rp ${rp(RR.semua.prive)} (bukan biaya toko).<br>` : ''}
      ${RR.semua.tanpaHB ? '⚠️ Ada barang terjual yang belum punya harga beli, labanya jadi terlalu besar.' : ''}
    </div>
   </div>
   <div class="card"><h3>📒 Catatan uang · ${judul}</h3>
    <div class="tablewrap" style="max-height:52vh"><table class="zebra"><thead><tr><th>Waktu</th><th>Uang</th><th>Keterangan</th><th class="num">Jumlah</th><th></th></tr></thead><tbody>${
      catatan
        .map(e => {
          const x = teksCatatan(e);
          return `<tr><td style="white-space:nowrap">${uangRange === 'today' ? jamMenit(e.waktu) : tglJam(e.waktu)}</td><td>${kasPill(e.kas)}</td><td>${x.t}</td><td class="num ${!x.netral && x.v < 0 ? 'negtxt' : ''}">${!x.netral && x.v < 0 ? '−' : ''}${rp(Math.abs(x.v))}</td><td class="right"><button class="btn sm ghost" data-hapus="${e.id}" title="Hapus catatan ini">🗑️</button></td></tr>`;
        })
        .join('') || '<tr><td colspan="5" class="empty">Belum ada catatan uang.</td></tr>'
    }</tbody></table></div>
   </div>
  </div>`;
  $('#uBuka').onclick = () => bukaKasirDialog();
  $('#uTutup').onclick = () => tutupKasirDialog();
  $('#uKeluar').onclick = () => pengeluaranDialog();
  $('#uMasuk').onclick = () => uangMasukDialog();
  $('#uPindah').onclick = () => pindahUangDialog();
  $('#uCetak').onclick = () => cetakLaporanUang();
  $$('[data-keluar]').forEach(x => (x.onclick = () => pengeluaranDialog(x.dataset.keluar)));
  $$('[data-tutup]').forEach(x => (x.onclick = () => tutupKasirDialog(x.dataset.tutup)));
  $$('[data-pindah]').forEach(x => {
    const [d, k] = x.dataset.pindah.split('>');
    x.onclick = () => pindahUangDialog(d, k);
  });
  $$('[data-sama]').forEach(x => (x.onclick = () => samakanSaldoDialog(x.dataset.sama)));
  $$('[data-ur]').forEach(
    x =>
      (x.onclick = () => {
        uangRange = x.dataset.ur;
        render();
      })
  );
  $$('[data-hapus]').forEach(
    x =>
      (x.onclick = async () => {
        const e = S.kas.find(y => y.id === x.dataset.hapus);
        if (!e) return;
        if (
          !(await confirmBox('Hapus catatan ini? ' + teksCatatan(e).t.replace(/<[^>]+>/g, ''), 'Hapus', true))
        )
          return;
        await remove('kas', e.id);
        toast('Catatan dihapus');
        render();
      })
  );
};

/* ---- buka kasir ---- */
function bukaKasirDialog() {
  const ks = kasAktif();
  const m = modal(
    `<h3>☀️ Buka kasir</h3>
   <p class="muted" style="margin-top:0">Hitung uang yang ada di tiap laci sekarang (uang kembalian / modal awal). Angka ini jadi patokan untuk dicocokkan waktu tutup kasir.</p>
   ${ks
     .map(k => {
       const p = posisiUang(k.id);
       const kira = p.patokan ? Math.max(0, Math.round(p.saldo)) : 0;
       return `<div class="kasinput" style="--kc:${k.warna}"><label>${k.ikon} Uang di laci <b>${esc(k.nama)}</b>${p.patokan ? ` <span class="muted">(menurut catatan: Rp ${rp(p.saldo)})</span>` : ''}</label><input data-kb="${k.id}" inputmode="numeric" class="bignum" value="${kira ? rp(kira) : ''}" placeholder="0"></div>`;
     })
     .join('')}
   <div class="row actbar"><span class="grow"></span><button class="btn ghost" data-close>Batal</button><button class="btn pri" id="bkOk">☀️ Buka kasir</button></div>`,
    { onClose: focusMain }
  );
  const ok = async () => {
    const t = Date.now();
    for (const i of $$('[data-kb]', m))
      await catatUang({ jenis: 'buka', kas: i.dataset.kb, jumlah: num(i.value), waktu: t });
    m.close();
    toast('Kasir dibuka ✔ Selamat berjualan');
    render();
  };
  $('#bkOk', m).onclick = ok;
  $$('input', m).forEach(
    i =>
      (i.onkeydown = e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const all = $$('input', m);
          const n = all[all.indexOf(i) + 1];
          n ? n.focus() : ok();
        }
      })
  );
}

/* ---- tutup kasir ---- */
function tutupKasirDialog(fokus) {
  const ks = kasAktif().filter(k => !fokus || k.id === fokus);
  const pos = Object.fromEntries(ks.map(k => [k.id, posisiUang(k.id)]));
  const m = modal(
    `<h3>🌙 Tutup kasir${fokus ? ' · laci ' + esc(infoKas(fokus).nama) : ''}</h3>
   <p class="muted" style="margin-top:0">Hitung uang di laci, lalu isi. Selisihnya langsung terlihat. Laci yang tidak dihitung boleh dikosongkan.</p>
   ${ks
     .map(
       k => `<div class="tutbox" style="--kc:${k.warna}">
     <div class="row tuthead"><span>${k.ikon} <b>Laci ${esc(k.nama)}</b></span><span class="grow"></span><span>Seharusnya <b>Rp ${rp(pos[k.id].saldo)}</b></span></div>
     <div class="grid3"><div><label>Uang dihitung</label><input data-h="${k.id}" inputmode="numeric" class="bignum" placeholder="hitung…"></div>
     <div><label>Disimpan / dibawa pulang</label><input data-a="${k.id}" inputmode="numeric" placeholder="0"></div>
     <div><label>Sisa di laci untuk besok</label><div class="tutsisa" data-sisa="${k.id}">-</div></div></div>
     <div class="tutsel" data-sel="${k.id}"></div></div>`
     )
     .join('')}
   <label>Catatan (opsional)</label><input id="tcat" placeholder="contoh: uang kurang karena kembalian salah">
   <label><input type="checkbox" id="tprn" ${S.meta.cetakTutup !== false ? 'checked' : ''}> Cetak laporan tutup kasir</label>
   <div class="row actbar"><span class="grow"></span><button class="btn ghost" data-close>Batal</button><button class="btn pri" id="tOk">🌙 Simpan &amp; tutup</button></div>`,
    { wide: true, onClose: focusMain }
  );
  const hitung = id => {
    const h = $(`[data-h="${id}"]`, m),
      a = $(`[data-a="${id}"]`, m);
    const sel = $(`[data-sel="${id}"]`, m),
      sisa = $(`[data-sisa="${id}"]`, m);
    if (!h.value.trim()) {
      sel.innerHTML = '';
      sisa.textContent = '-';
      return;
    }
    const d = num(h.value),
      ambil = num(a.value);
    const s = Math.round(d - pos[id].saldo);
    sel.innerHTML =
      s === 0
        ? '<span class="pas">✔ Pas, uangnya cocok</span>'
        : s > 0
          ? `<span class="lebih">Lebih Rp ${rp(s)}</span>`
          : `<span class="kurang">Kurang Rp ${rp(-s)}</span>`;
    sisa.textContent = 'Rp ' + rp(d - ambil);
    sisa.classList.toggle('negtxt', d - ambil < 0);
  };
  ks.forEach(k => {
    $(`[data-h="${k.id}"]`, m).oninput = () => hitung(k.id);
    $(`[data-a="${k.id}"]`, m).oninput = () => hitung(k.id);
  });
  $('#tOk', m).onclick = async () => {
    const isi = ks.filter(k => $(`[data-h="${k.id}"]`, m).value.trim());
    if (!isi.length) return toast('Isi uang yang dihitung, minimal satu laci', true);
    for (const k of isi) {
      const d = num($(`[data-h="${k.id}"]`, m).value),
        a = num($(`[data-a="${k.id}"]`, m).value);
      if (a > d)
        return toast(`Uang yang disimpan di laci ${k.nama} lebih besar dari uang yang dihitung`, true);
    }
    const t = Date.now();
    const cat = $('#tcat', m).value.trim();
    const hasil = [];
    for (const k of isi) {
      const d = num($(`[data-h="${k.id}"]`, m).value),
        a = num($(`[data-a="${k.id}"]`, m).value);
      const sh = Math.round(pos[k.id].saldo);
      hasil.push(
        await catatUang({
          jenis: 'tutup',
          kas: k.id,
          waktu: t,
          seharusnya: sh,
          dihitung: d,
          selisih: d - sh,
          diambil: a,
          sisa: d - a,
          catatan: cat
        })
      );
    }
    S.meta.cetakTutup = $('#tprn', m).checked;
    saveMeta('cetakTutup');
    m.close();
    if (S.meta.cetakTutup) cetakLaporanUang(hasil);
    const kurang = hasil.filter(e => e.selisih < 0);
    toast(
      kurang.length
        ? 'Kasir ditutup. Ada uang kurang: ' +
            kurang.map(e => infoKas(e.kas).nama + ' Rp ' + rp(-e.selisih)).join(', ')
        : 'Kasir ditutup ✔',
      kurang.length > 0
    );
    render();
  };
}

/* ---- pengeluaran & uang masuk ---- */
function pilihKasHTML(sel, list = kasAktif()) {
  return `<div class="kaspick">${list.map(k => `<button type="button" data-pk="${k.id}" class="${k.id === sel ? 'on' : ''}" style="--kc:${k.warna}">${k.ikon} ${esc(k.nama)}</button>`).join('')}</div>`;
}
function pasangPilihKas(m, cb) {
  $$('[data-pk]', m).forEach(
    b =>
      (b.onclick = () => {
        $$('[data-pk]', m).forEach(x => x.classList.toggle('on', x === b));
        cb(b.dataset.pk);
      })
  );
}
function pengeluaranDialog(kas = 'warung', preset = {}, after) {
  let k = kas,
    kat = preset.kategori || '';
  const m = modal(
    `<h3>➖ Catat pengeluaran</h3>
   <label>Uangnya diambil dari laci</label>${pilihKasHTML(k)}
   <label>Untuk apa</label><div class="katpick">${KATEGORI_KELUAR.map(c => `<button type="button" data-c="${c.id}" class="${c.id === kat ? 'on' : ''}">${c.ikon} ${esc(c.nama)}</button>`).join('')}</div>
   <div class="grid2"><div><label>Jumlah (Rp)</label><input id="kj" inputmode="numeric" class="bignum" value="${preset.jumlah ? rp(preset.jumlah) : ''}"></div><div><label>Keterangan (opsional)</label><input id="kc" value="${esc(preset.catatan || '')}" placeholder="contoh: bayar listrik toko"></div></div>
   <p class="hint" id="khint"></p>
   <div class="row actbar"><span class="grow"></span><button class="btn ghost" data-close>Batal</button><button class="btn pri" id="kok">💾 Simpan</button></div>`,
    { onClose: focusMain }
  );
  const hint = () => {
    const c = kat && kategoriKeluar(kat);
    $('#khint', m).innerHTML = !c
      ? ''
      : c.stok
        ? '🛒 Belanja barang dagangan tidak mengurangi laba (modalnya sudah dihitung dari harga beli barang yang terjual). Kalau barangnya sudah datang, lebih baik dicatat lewat <b>Stok → Barang masuk</b> supaya stok ikut bertambah.'
        : c.prive
          ? '🏠 Uang untuk keperluan rumah tidak dihitung sebagai biaya toko, tapi uang di laci tetap berkurang.'
          : 'Pengeluaran ini mengurangi laba bersih toko.';
  };
  hint();
  pasangPilihKas(m, x => (k = x));
  $$('[data-c]', m).forEach(
    b =>
      (b.onclick = () => {
        kat = b.dataset.c;
        $$('[data-c]', m).forEach(x => x.classList.toggle('on', x === b));
        hint();
        $('#kj', m).focus();
      })
  );
  const ok = async () => {
    const j = num($('#kj', m).value);
    if (!kat) return toast('Pilih dulu untuk apa', true);
    if (!(j > 0)) return toast('Isi jumlahnya', true);
    const c = kategoriKeluar(kat);
    const e = { jenis: 'keluar', kas: k, jumlah: j, kategori: kat, catatan: $('#kc', m).value.trim() };
    if (c.prive) e.prive = true;
    if (c.stok) e.stok = true;
    await catatUang(e);
    m.close();
    toast(`Pengeluaran Rp ${rp(j)} dari laci ${infoKas(k).nama} dicatat ✔`);
    after ? after() : render();
  };
  $('#kok', m).onclick = ok;
  $$('input', m).forEach(
    i =>
      (i.onkeydown = e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          ok();
        }
      })
  );
  setTimeout(() => $('#kj', m).focus(), 40);
}
function uangMasukDialog(kas = 'warung') {
  let k = kas;
  const m = modal(
    `<h3>➕ Uang masuk lain</h3><p class="muted" style="margin-top:0">Uang yang masuk ke laci tapi bukan dari penjualan, misal tambah modal / uang kembalian dari rumah.</p>
   <label>Masuk ke laci</label>${pilihKasHTML(k)}
   <div class="grid2"><div><label>Jumlah (Rp)</label><input id="mj" inputmode="numeric" class="bignum"></div><div><label>Keterangan</label><input id="mc" placeholder="contoh: tambah uang kembalian"></div></div>
   <div class="row actbar"><span class="grow"></span><button class="btn ghost" data-close>Batal</button><button class="btn pri" id="mok">💾 Simpan</button></div>`,
    { onClose: focusMain }
  );
  pasangPilihKas(m, x => (k = x));
  const ok = async () => {
    const j = num($('#mj', m).value);
    if (!(j > 0)) return toast('Isi jumlahnya', true);
    await catatUang({ jenis: 'masuk', kas: k, jumlah: j, catatan: $('#mc', m).value.trim() });
    m.close();
    toast('Uang masuk dicatat ✔');
    render();
  };
  $('#mok', m).onclick = ok;
  $$('input', m).forEach(
    i =>
      (i.onkeydown = e => {
        if (e.key === 'Enter') ok();
      })
  );
  setTimeout(() => $('#mj', m).focus(), 40);
}

/* ---- pindah uang antar laci / saldo ---- */
function pindahUangDialog(dari = '', ke = '') {
  const semua = [...kasAktif(), ...saldoAktif()];
  const preset = [
    ['warung', 'pb', '📲 Isi saldo PojokBayar dari laci Warung'],
    ['brilink', 'rek', '⬆️ Setor uang laci BRILink ke rekening'],
    ['rek', 'brilink', '⬇️ Ambil uang rekening BRILink ke laci'],
    ['warung', 'brilink', '🔁 Pinjamkan uang Warung ke laci BRILink'],
    ['brilink', 'warung', '🔁 Kembalikan uang BRILink ke laci Warung']
  ].filter(([d, k]) => semua.some(x => x.id === d) && semua.some(x => x.id === k));
  const opt = sel =>
    semua
      .map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${x.ikon} ${esc(x.nama)}</option>`)
      .join('');
  const m = modal(
    `<h3>🔁 Pindah uang</h3><p class="muted" style="margin-top:0">Untuk uang yang berpindah antar laci atau ke saldo. Uang tidak hilang, jadi tidak mengubah laba.</p>
   ${preset.length ? `<div class="katpick">${preset.map(([d, k, l]) => `<button type="button" data-pre="${d}>${k}" class="${d === dari && k === ke ? 'on' : ''}">${l}</button>`).join('')}</div>` : ''}
   <div class="grid2"><div><label>Dari</label><select id="pd">${opt(dari || 'warung')}</select></div><div><label>Ke</label><select id="pk2">${opt(ke || (semua[1] || semua[0]).id)}</select></div></div>
   <div class="grid2"><div><label>Jumlah (Rp)</label><input id="pj" inputmode="numeric" class="bignum"></div><div><label>Keterangan (opsional)</label><input id="pc"></div></div>
   <div class="row actbar"><span class="grow"></span><button class="btn ghost" data-close>Batal</button><button class="btn pri" id="pok">💾 Simpan</button></div>`,
    { onClose: focusMain }
  );
  $$('[data-pre]', m).forEach(
    b =>
      (b.onclick = () => {
        const [d, k] = b.dataset.pre.split('>');
        $('#pd', m).value = d;
        $('#pk2', m).value = k;
        $$('[data-pre]', m).forEach(x => x.classList.toggle('on', x === b));
        $('#pj', m).focus();
      })
  );
  const ok = async () => {
    const d = $('#pd', m).value,
      k = $('#pk2', m).value,
      j = num($('#pj', m).value);
    if (d === k) return toast('Dari dan ke tidak boleh sama', true);
    if (!(j > 0)) return toast('Isi jumlahnya', true);
    await catatUang({ jenis: 'pindah', kas: d, ke: k, jumlah: j, catatan: $('#pc', m).value.trim() });
    m.close();
    toast(`Rp ${rp(j)} dipindah: ${infoKas(d).nama} → ${infoKas(k).nama} ✔`);
    render();
  };
  $('#pok', m).onclick = ok;
  $$('input', m).forEach(
    i =>
      (i.onkeydown = e => {
        if (e.key === 'Enter') ok();
      })
  );
  setTimeout(() => $('#pj', m).focus(), 40);
}
function samakanSaldoDialog(id) {
  const x = infoKas(id);
  const p = posisiUang(id);
  const m = modal(
    `<h3>✔ Samakan ${esc(x.nama)}</h3>
   <p class="muted" style="margin-top:0">Lihat saldo di ${id === 'pb' ? 'aplikasi PojokBayar' : 'mesin / aplikasi BRILink'}, lalu ketik di sini. Mulai sekarang kasir menghitung saldonya sendiri dari transaksi yang dicatat.</p>
   ${p ? `<p>Menurut catatan kasir: <b>Rp ${rp(p.saldo)}</b></p>` : ''}
   <label>Saldo sebenarnya sekarang (Rp)</label><input id="sj" inputmode="numeric" class="bignum">
   <div class="row actbar"><span class="grow"></span><button class="btn ghost" data-close>Batal</button><button class="btn pri" id="sok">💾 Simpan</button></div>`,
    { onClose: focusMain }
  );
  const ok = async () => {
    const v = $('#sj', m).value.trim();
    if (!v) return toast('Isi saldonya', true);
    await catatUang({ jenis: 'saldo', kas: id, jumlah: num(v), sebelum: p ? Math.round(p.saldo) : null });
    m.close();
    toast(x.nama + ' disamakan ✔');
    render();
  };
  $('#sok', m).onclick = ok;
  $('#sj', m).onkeydown = e => {
    if (e.key === 'Enter') ok();
  };
  setTimeout(() => $('#sj', m).focus(), 40);
}

/* ---- laporan harian di printer struk ---- */
function cetakLaporanUang(tutup) {
  const st = settings();
  const R = rekapUang(dayStart(0), dayStart(1));
  const ks = kasAktif();
  const tt = tutup || [];
  const r = (l, v, b) =>
    `<div class="r ${b ? 'b' : ''}"><span>${l}</span><span>${v < 0 ? '-' : ''}${rp(Math.abs(v))}</span></div>`;
  const keluar = S.kas.filter(e => e.jenis === 'keluar' && e.waktu >= dayStart(0));
  const html = `<div class="c"><div class="b big">${esc(st.nama)}</div><div>${tt.length ? 'LAPORAN TUTUP KASIR' : 'LAPORAN UANG HARI INI'}</div><div>${tglJam(Date.now())}</div></div>
  ${ks
    .map(k => {
      const x = R[k.id];
      const p = posisiUang(k.id);
      const e = tt.find(y => y.kas === k.id);
      return `<div class="hr"></div><div class="b">${esc(k.nama.toUpperCase())}</div>
      ${k.id === 'brilink' ? r('Tarik tunai', x.tarik) + r('Transfer, setor & bayar', x.setor) + r('Pendapatan admin', x.admin) : r('Penjualan', x.jual) + (x.nLyn ? r('  termasuk layanan', x.lynJual) : '')}
      ${r('Laba kotor', x.laba)}${x.biaya ? r('Pengeluaran toko', -x.biaya) : ''}${x.non ? r('QRIS / transfer', x.non) : ''}${x.utang ? r('Utang baru', x.utang) : ''}
      ${e ? r('Seharusnya di laci', e.seharusnya) + r('Uang dihitung', e.dihitung, true) + r(e.selisih ? (e.selisih > 0 ? 'LEBIH' : 'KURANG') : 'Selisih', e.selisih, true) + (e.diambil ? r('Disimpan / dibawa', e.diambil) : '') + r('Sisa di laci', e.sisa) : r('Seharusnya di laci', Math.round(p.saldo), true)}`;
    })
    .join('')}
  ${keluar.length ? `<div class="hr"></div><div class="b">PENGELUARAN</div>${keluar.map(e => r(esc(kategoriKeluar(e.kategori).nama + (e.catatan ? ' (' + e.catatan + ')' : '')) + ' [' + esc(infoKas(e.kas).nama) + ']', -e.jumlah)).join('')}` : ''}
  <div class="hr"></div>${r('LABA BERSIH', R.semua.bersih, true)}
  ${tt.length && tt[0].catatan ? `<div>Catatan: ${esc(tt[0].catatan)}</div>` : ''}<div style="height:12mm"></div>`;
  const w = Number(st.lebarStruk) || 72;
  printHTML(
    html,
    `@page{size:${w}mm auto;margin:0}body{margin:0;padding:2mm 3mm;width:${w}mm;box-sizing:border-box;font-family:Arial,sans-serif;font-size:11px;color:#000}.c{text-align:center}.b{font-weight:700}.big{font-size:14px}.r{display:flex;justify-content:space-between;gap:6px}.hr{border-top:1px dashed #000;margin:4px 0}`
  );
}

/* ---- memilih barang toko material ---- */
function pilihMaterialDialog(after) {
  if (uangConf().material === false)
    return toast('Aktifkan dulu uang Material di Pengaturan → Uang & Layanan', true);
  const aktif = S.products.filter(p => p.aktif !== false);
  const pilih = new Set(aktif.filter(p => kasProduk(p) === 'material').map(p => p.id));
  const saran = aktif.filter(p => p.kas === undefined && tebakMaterial(p) && !pilih.has(p.id));
  const m = modal(
    `<h3>🧱 Barang toko material</h3>
   <p class="muted" style="margin-top:0">Uang penjualan barang yang dicentang masuk ke laci <b>Material</b>, terpisah dari uang Warung. Cari barangnya, lalu centang.</p>
   <div class="row"><input id="mq" class="grow" placeholder="Cari barang… (contoh: semen, pasir, paku)" autocomplete="off"><label class="inl"><input type="checkbox" id="mOnly"> hanya yang dicentang</label></div>
   <div class="row" style="margin:8px 0"><span class="grow" id="mInfo"></span>${saran.length ? `<button class="btn sm ghost" id="mSaran">⚡ Centang ${saran.length} tebakan otomatis</button>` : ''}</div>
   <div class="tablewrap" style="max-height:50vh"><table class="zebra"><tbody id="mList"></tbody></table></div>
   <div class="row actbar"><span class="grow"></span><button class="btn ghost" data-close>Batal</button><button class="btn pri" id="mOk">💾 Simpan</button></div>`,
    { wide: true }
  );
  const info = () => ($('#mInfo', m).innerHTML = `<b>${pilih.size}</b> barang masuk uang Material`);
  const draw = () => {
    const q = $('#mq', m).value.trim();
    let l = q
      ? searchProducts(q, 100000)
      : aktif
          .slice()
          .sort(
            (a, b) =>
              pilih.has(b.id) - pilih.has(a.id) ||
              tebakMaterial(b) - tebakMaterial(a) ||
              a.nama.localeCompare(b.nama)
          );
    if ($('#mOnly', m).checked) l = l.filter(p => pilih.has(p.id));
    info();
    $('#mList', m).innerHTML =
      l
        .slice(0, 300)
        .map(
          p =>
            `<tr><td style="width:44px"><input type="checkbox" data-mp="${p.id}" ${pilih.has(p.id) ? 'checked' : ''}></td><td><b>${esc(p.nama)}</b> <span class="muted" style="font-size:13px">${esc(p.kategori || '')}</span>${tebakMaterial(p) && !pilih.has(p.id) ? ' <span class="badge warn">mungkin material</span>' : ''}</td></tr>`
        )
        .join('') || '<tr><td class="empty">Tidak ada barang.</td></tr>';
    $$('[data-mp]', m).forEach(
      c =>
        (c.onchange = () => {
          c.checked ? pilih.add(c.dataset.mp) : pilih.delete(c.dataset.mp);
          info();
        })
    );
  };
  $('#mq', m).oninput = draw;
  $('#mOnly', m).onchange = draw;
  $('#mSaran', m) &&
    ($('#mSaran', m).onclick = () => {
      saran.forEach(p => pilih.add(p.id));
      draw();
    });
  $('#mOk', m).onclick = async () => {
    const ubah = [];
    for (const p of aktif) {
      const mau = pilih.has(p.id) ? 'material' : 'warung';
      if (p.kas !== mau && (mau === 'material' || p.kas === 'material' || tebakMaterial(p))) {
        p.kas = mau;
        p.diubah = Date.now();
        ubah.push(p);
      }
    }
    if (ubah.length) {
      await DB.putMany('products', ubah);
      markDirty();
      lupakanRincian();
    }
    m.close();
    toast(`Tersimpan ✔ ${pilih.size} barang masuk uang Material`);
    after ? after() : render();
  };
  draw();
  setTimeout(() => $('#mq', m).focus(), 40);
}
