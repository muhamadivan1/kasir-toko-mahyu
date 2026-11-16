/* ============ LAPORAN ============ */
let lapRange = 'today',
  lapKas = 'semua';
function statBox(label, v, sub, warna) {
  return `<div class="stat"><div class="muted">${label}</div><div class="v" ${warna ? `style="color:${warna}"` : ''}>${v < 0 ? '−' : ''}Rp ${rp(Math.abs(v))}</div>${sub ? `<div class="muted" style="font-size:12px">${sub}</div>` : ''}</div>`;
}
views.laporan = () => {
  const now = new Date();
  let a,
    b = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (lapRange === 'today') a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  else if (lapRange === 'yday') {
    a = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (lapRange === '7') a = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  else if (lapRange === 'month') a = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (lapRange === 'custom') {
    a = new Date(S._lapA || dkey(now));
    b = new Date(new Date(S._lapB || dkey(now)).getTime() + 86400000);
    a.setHours(0);
    b.setHours(0);
  }
  const A = a.getTime(),
    B = b.getTime();
  const ks = kasAktif();
  if (lapKas !== 'semua' && !ks.some(k => k.id === lapKas)) lapKas = 'semua';
  const R = rekapUang(A, B);
  const X = R[lapKas];
  const semua = lapKas === 'semua';
  const list = S.sales.filter(s => s.waktu >= A && s.waktu < B && (semua || rincianSale(s).kas[lapKas]));
  const ok = list.filter(s => !s.batal);
  const top = {};
  ok.forEach(s =>
    s.items.forEach(i => {
      if (i.layanan || (!semua && kasBaris(i) !== lapKas)) return;
      const k = i.nama + (i.isi > 1 ? ' (' + i.satuan + ')' : '');
      top[k] = top[k] || { nama: k, qty: 0, rp: 0 };
      top[k].qty += i.qty;
      top[k].rp += i.qty * i.harga;
    })
  );
  const topL = Object.values(top)
    .sort((x, y) => y.rp - x.rp)
    .slice(0, 15);
  // ringkasan layanan per jenis
  const lyn = {};
  ok.forEach(s =>
    s.items.forEach(i => {
      if (!i.layanan || (!semua && kasBaris(i) !== lapKas)) return;
      const L = LAYANAN[i.layanan] || { nama: i.layanan, ikon: '🧾' };
      const x = (lyn[i.layanan] = lyn[i.layanan] || {
        nama: L.ikon + ' ' + L.nama,
        n: 0,
        nominal: 0,
        laba: 0
      });
      x.n++;
      x.nominal += (i.lyn && i.lyn.nominal) || Math.abs(i.harga);
      x.laba += labaBaris(i);
    })
  );
  const lynL = Object.values(lyn).sort((x, y) => y.n - x.n);
  const keluar = S.kas
    .filter(e => e.jenis === 'keluar' && e.waktu >= A && e.waktu < B && (semua || e.kas === lapKas))
    .sort((x, y) => y.waktu - x.waktu);
  const hbNote = X.tanpaHB ? '*ada barang tanpa harga beli' : '';
  const stats =
    lapKas === 'brilink'
      ? [
          `<div class="stat"><div class="muted">Transaksi BRILink</div><div class="v">${X.trx}</div></div>`,
          statBox('Tarik tunai', X.tarik, 'uang diberikan ke pelanggan'),
          statBox('Transfer, setor & bayar', X.setor),
          statBox('Pendapatan admin', X.admin, X.modal ? 'potongan bank Rp ' + rp(X.modal) : ''),
          statBox('Pengeluaran', X.biaya),
          statBox('Laba bersih', X.bersih, '', 'var(--ok)')
        ]
      : [
          statBox(
            semua ? 'Penjualan (Warung + Material)' : 'Penjualan',
            semua ? X.penjualan : X.jual,
            X.nLyn && lapKas === 'warung' ? `termasuk layanan Rp ${rp(X.lynJual)}` : ''
          ),
          `<div class="stat"><div class="muted">Transaksi</div><div class="v">${X.trx}</div></div>`,
          statBox(
            'Laba kotor',
            X.laba,
            [
              semua && R.brilink.admin
                ? `termasuk admin BRILink Rp ${rp(R.brilink.admin - R.brilink.modal)}`
                : '',
              hbNote
            ]
              .filter(Boolean)
              .join(' · ')
          ),
          statBox('Pengeluaran toko', X.biaya, X.prive ? `di luar ambil untuk rumah Rp ${rp(X.prive)}` : ''),
          statBox('Laba bersih', X.bersih, '', 'var(--ok)'),
          (() => {
            // uang BRILink (tarik / setor) bukan uang masuk toko, jadi "Semua" = Warung + Material
            const W = R.warung,
              M = R.material;
            const tn = semua ? W.tunai + M.tunai : X.tunai,
              nn = semua ? W.non + M.non : X.non,
              bu = semua ? W.bayarUtang + M.bayarUtang : X.bayarUtang;
            return statBox(
              semua ? 'Uang masuk (Warung + Material)' : 'Uang masuk',
              tn + nn + bu,
              `tunai Rp ${rp(tn)} · QRIS/transfer Rp ${rp(nn)} · bayar utang Rp ${rp(bu)}`
            );
          })(),
          statBox('Utang baru', X.utang)
        ];
  $('#main').innerHTML = `<div class="tabs2">${[
    ['today', 'Hari ini'],
    ['yday', 'Kemarin'],
    ['7', '7 hari'],
    ['month', 'Bulan ini'],
    ['custom', 'Pilih tanggal']
  ]
    .map(([k, l]) => `<button data-r="${k}" class="${lapRange === k ? 'on' : ''}">${l}</button>`)
    .join('')}
   ${lapRange === 'custom' ? `<input type="date" id="la" value="${S._lapA || dkey(now)}" style="width:auto"><input type="date" id="lb" value="${S._lapB || dkey(now)}" style="width:auto">` : ''}<span class="grow"></span><button class="btn ghost" id="xls">⬇️ Unduh Excel</button></div>
   ${ks.length > 1 ? `<div class="tabs2 kastabs">${[{ id: 'semua', ikon: '📊', nama: 'Semua uang', warna: 'var(--pri)' }, ...ks].map(k => `<button data-lk="${k.id}" class="${lapKas === k.id ? 'on' : ''}" style="--kc:${k.warna}">${k.ikon} ${esc(k.nama)}</button>`).join('')}</div>` : ''}
   <div class="stats">${stats.join('')}</div>
   <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px" class="lapgrid">
    <div class="card"><h3>Daftar transaksi</h3><div class="tablewrap" style="max-height:60vh"><table><thead><tr><th>No</th><th>Waktu</th><th>Pelanggan</th><th>Bayar</th><th class="num">${semua ? 'Total' : 'Uang ' + esc(infoKas(lapKas).nama)}</th><th></th></tr></thead><tbody>${
      list
        .slice()
        .reverse()
        .map(s => {
          const v = semua ? null : rincianSale(s).kas[lapKas].uang;
          return `<tr style="${s.batal ? 'opacity:.5;text-decoration:line-through' : ''}"><td style="font-family:monospace;font-size:14px">${s.no}</td><td>${tglJam(s.waktu)}</td><td>${esc(s.customerNama || '-')} ${
            semua
              ? kasDalamSale(s)
                  .filter(k => k !== 'warung')
                  .map(k => kasPill(k))
                  .join(' ')
              : ''
          }</td><td>${metodeBadge(s.metode)}</td><td class="num"><b>${semua ? totalTeks(s) : `<span class="${v < 0 ? 'negtxt' : ''}">${v < 0 ? '−' : ''}${rp(Math.abs(v))}</span>`}</b></td><td class="right"><button class="btn sm ghost" data-d="${s.id}">Detail</button></td></tr>`;
        })
        .join('') || '<tr><td colspan="6" class="empty">Belum ada transaksi.</td></tr>'
    }</tbody></table></div></div>
    <div>
     ${lynL.length ? `<div class="card" style="margin-bottom:14px"><h3>Layanan</h3><table><tbody>${lynL.map(x => `<tr><td>${esc(x.nama)}<br><span class="muted" style="font-size:13px">${x.n} transaksi · nominal Rp ${rp(x.nominal)}</span></td><td class="num">untung<br><b>Rp ${rp(x.laba)}</b></td></tr>`).join('')}</tbody></table></div>` : ''}
     ${lapKas !== 'brilink' ? `<div class="card" style="margin-bottom:14px"><h3>Barang terlaris</h3><table><tbody>${topL.map((t, i) => `<tr><td>${i + 1}. ${esc(t.nama)}<br><span class="muted" style="font-size:13px">${rp(t.qty)} terjual</span></td><td class="num">${rp(t.rp)}</td></tr>`).join('') || '<tr><td class="empty">-</td></tr>'}</tbody></table></div>` : ''}
     <div class="card"><h3>Pengeluaran</h3><table><tbody>${
       keluar
         .slice(0, 50)
         .map(e => {
           const c = kategoriKeluar(e.kategori);
           return `<tr><td>${c.ikon} ${esc(c.nama)}${e.catatan ? `<br><span class="muted" style="font-size:13px">${esc(e.catatan)}</span>` : ''}<br><span class="muted" style="font-size:12px">${tglJam(e.waktu)} · ${esc(infoKas(e.kas).nama)}${c.stok ? ' · tidak mengurangi laba' : c.prive ? ' · bukan biaya toko' : ''}</span></td><td class="num">${rp(e.jumlah)}</td></tr>`;
         })
         .join('') || '<tr><td class="empty">Tidak ada pengeluaran.</td></tr>'
     }</tbody></table><div class="right" style="margin-top:8px"><button class="btn sm ghost" id="lapKeluar">➖ Catat pengeluaran</button></div></div>
    </div>
   </div>`;
  if (innerWidth < 900) $('.lapgrid').style.gridTemplateColumns = 'minmax(0, 1fr)';
  $$('[data-r]').forEach(
    x =>
      (x.onclick = () => {
        lapRange = x.dataset.r;
        render();
      })
  );
  $$('[data-lk]').forEach(
    x =>
      (x.onclick = () => {
        lapKas = x.dataset.lk;
        render();
      })
  );
  $('#lapKeluar').onclick = () => pengeluaranDialog(semua ? 'warung' : lapKas);
  $('#la') &&
    ($('#la').onchange = e => {
      S._lapA = e.target.value;
      render();
    });
  $('#lb') &&
    ($('#lb').onchange = e => {
      S._lapB = e.target.value;
      render();
    });
  $$('[data-d]').forEach(x => (x.onclick = () => saleDetail(S.sales.find(s => s.id === x.dataset.d))));
  $('#xls').onclick = () => unduhLaporanExcel(A, B);
};
function unduhLaporanExcel(A, B) {
  const R = rekapUang(A, B);
  const ks = kasAktif().map(k => k.id);
  const list = S.sales.filter(s => s.waktu >= A && s.waktu < B);
  const ok = list.filter(s => !s.batal);
  const wb = XLSX.utils.book_new();
  const baris = [
    ['Penjualan / pendapatan', 'jual'],
    ['Modal (harga beli / biaya bank)', 'modal'],
    ['Laba kotor', 'laba'],
    ['Pengeluaran toko', 'biaya'],
    ['Laba bersih', 'bersih'],
    ['Belanja barang dagangan', 'kulakan'],
    ['Ambil untuk rumah', 'prive'],
    ['Uang masuk tunai', 'tunai'],
    ['Uang masuk QRIS/transfer', 'non'],
    ['Utang baru', 'utang'],
    ['Bayar utang diterima', 'bayarUtang'],
    ['Layanan PojokBayar (jual)', 'lynJual'],
    ['Layanan PojokBayar (untung)', 'lynLaba'],
    ['BRILink tarik tunai', 'tarik'],
    ['BRILink transfer/setor', 'setor'],
    ['BRILink admin', 'admin']
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      baris.map(([l, f]) => ({
        Keterangan: l,
        ...Object.fromEntries(ks.map(k => [infoKas(k).nama, R[k][f] || 0])),
        Semua: R.semua[f] || 0
      }))
    ),
    'Ringkasan'
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      list.map(s => {
        const K = rincianSale(s).kas;
        return {
          No: s.no,
          Waktu: tglJam(s.waktu),
          Pelanggan: s.customerNama || '',
          Metode: s.metode,
          Subtotal: s.subtotal,
          Diskon: s.diskon,
          Total: s.total,
          ...Object.fromEntries(ks.map(k => ['Uang ' + infoKas(k).nama, K[k] ? K[k].uang : 0])),
          Dibayar: s.bayar,
          Utang: s.utang || 0,
          Kurang: s.kurang || 0,
          Status: s.batal ? 'BATAL' : 'OK'
        };
      })
    ),
    'Transaksi'
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      ok.flatMap(s =>
        s.items.map(i => ({
          No: s.no,
          Waktu: tglJam(s.waktu),
          Pelanggan: s.customerNama || '',
          Uang: infoKas(kasBaris(i)).nama,
          Barang: i.nama,
          Keterangan: i.layanan ? detailLayanan(i) : '',
          Jumlah: i.qty,
          Satuan: i.satuan || '',
          Harga: i.harga,
          Subtotal: i.qty * i.harga,
          HargaBeli: i.hargaBeli || 0,
          Untung: labaBaris(i)
        }))
      )
    ),
    'Detail Barang'
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      S.kas
        .filter(e => e.waktu >= A && e.waktu < B)
        .map(e => ({
          Waktu: tglJam(e.waktu),
          Uang: infoKas(e.kas).nama,
          Jenis: e.jenis,
          Keterangan: teksCatatan(e).t.replace(/<[^>]+>/g, ''),
          Jumlah: Number(e.jumlah ?? e.sisa) || 0,
          Ke: e.ke ? infoKas(e.ke).nama : ''
        }))
    ),
    'Catatan Uang'
  );
  XLSX.writeFile(wb, `laporan-${dkey(A)}_${dkey(B - 86400000)}.xlsx`);
}
/** Terima kekurangan uang dari transaksi yang kurang bayar */
function terimaKurangDialog(s, after) {
  const sisa = sisaKurang(s);
  const m = modal(
    `<h3>💵 Terima kekurangan</h3>
   <p class="muted" style="margin-top:0">Transaksi ${esc(s.no)} · ${tglJam(s.waktu)}${s.customerNama ? ' · ' + esc(s.customerNama) : ''}. Kekurangan yang belum dibayar: <b>Rp ${rp(sisa)}</b>.</p>
   <label>Uang yang diterima sekarang</label><input id="tkJ" inputmode="numeric" class="bignum" value="${rp(sisa)}" autofocus>
   <label class="chk"><input type="checkbox" id="tkPrn" ${S.meta.autoPrint !== false ? 'checked' : ''}> 🖨️ Cetak bukti terima</label>
   <div class="row actbar"><span class="grow"></span><button class="btn ghost" data-close>Batal</button><button class="btn ok" id="tkOk">✔ Simpan (Enter)</button></div>`
  );
  const ok = async () => {
    const j = Math.min(sisa, num($('#tkJ', m).value));
    if (!j) return toast('Isi jumlah uangnya', true);
    await terimaKurang(s, j);
    const lagi = sisaKurang(s);
    if ($('#tkPrn', m).checked)
      printBukti({
        judul: 'BUKTI TERIMA KEKURANGAN',
        waktu: Date.now(),
        ref: s.no,
        nama: s.customerNama,
        rows: [
          ['Kekurangan sebelumnya', rp(sisa)],
          ['Diterima', rp(j)],
          ['SISA KURANG', rp(lagi), true]
        ],
        sisa: lagi
      });
    m.close();
    toast(lagi ? `Dicatat ✔ Masih kurang Rp ${rp(lagi)}` : 'Kekurangan sudah lunas ✔');
    after && after();
  };
  $('#tkOk', m).onclick = ok;
  $('#tkJ', m).onfocus = e => e.target.select();
  m.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') {
      e.preventDefault();
      ok();
    }
  });
}
/** Daftar transaksi yang uangnya masih kurang */
function daftarKurangDialog() {
  const L = daftarKurang();
  const m = modal(
    `<h3>💸 Transaksi yang uangnya kurang</h3>
   <div class="tablewrap" style="max-height:60vh"><table><thead><tr><th>Waktu</th><th>Pembeli</th><th class="num">Total</th><th class="num">Kurang</th><th></th></tr></thead><tbody>${
     L.map(
       s =>
         `<tr><td>${tglJam(s.waktu)}<br><span class="muted" style="font-size:13px">${esc(s.no)}</span></td><td>${esc(namaPembeli(s))}</td><td class="num">${rp(s.total)}</td><td class="num"><b style="color:var(--bad)">${rp(sisaKurang(s))}</b></td><td class="right"><button class="btn sm ok" data-tk="${s.id}">💵 Terima</button></td></tr>`
     ).join('') || '<tr><td colspan="5" class="empty">Tidak ada. Semua sudah lunas 👍</td></tr>'
   }</tbody></table></div>
   <div class="row actbar"><span class="grow"></span><button class="btn ghost" data-close>Tutup</button></div>`,
    { wide: true }
  );
  $$('[data-tk]', m).forEach(
    b =>
      (b.onclick = () =>
        terimaKurangDialog(
          S.sales.find(s => s.id === b.dataset.tk),
          () => {
            m.close();
            render();
          }
        ))
  );
}
function saleDetail(s, after) {
  const rep_ = s.mengganti ? `<br>Pengganti transaksi ${esc(s.mengganti)}` : '';
  const by = s.digantiOleh ? ` · sudah diubah menjadi ${esc(s.digantiOleh)}` : '';
  const m = modal(
    `<h3>Transaksi ${esc(s.no)} ${s.batal ? `<span class="badge bad">${s.digantiOleh ? 'DIUBAH' : 'DIBATALKAN'}</span>` : ''}</h3><p class="muted" style="margin-top:0">${tglJam(s.waktu)} · ${esc(namaPembeli(s))} · ${METODE[s.metode] || s.metode} · harga ${tierPill(s.tier)}${by}${rep_}</p>
   <div class="tablewrap" style="max-height:45vh"><table><thead><tr><th>Barang</th><th class="num">Jumlah</th><th class="num">Harga</th><th class="num">Subtotal</th></tr></thead><tbody>${s.items.map(i => `<tr><td>${esc(i.nama)}${kasBaris(i) !== 'warung' ? ' ' + kasPill(kasBaris(i)) : ''}${i.layanan && detailLayanan(i) ? `<br><span class="muted" style="font-size:13px">${esc(detailLayanan(i))}</span>` : ''}${i.lyn && i.lyn.token ? `<br><b style="font-size:13px">Token: ${esc(i.lyn.token)}</b>` : ''}</td><td class="num">${String(i.qty).replace('.', ',')} ${esc(i.manual ? '' : i.satuan || '')}</td><td class="num">${i.harga < 0 ? '−' : ''}${rp(Math.abs(i.harga))}</td><td class="num">${i.harga < 0 ? '−' : ''}${rp(Math.abs(i.qty * i.harga))}</td></tr>`).join('')}
   ${s.diskon ? `<tr><td colspan="3" class="right">Diskon</td><td class="num">-${rp(s.diskon)}</td></tr>` : ''}${s.potonganPoin ? `<tr><td colspan="3" class="right">Tukar poin</td><td class="num">-${rp(s.potonganPoin)}</td></tr>` : ''}<tr><td colspan="3" class="right"><b>${s.total < 0 ? 'Uang diberikan ke pelanggan' : 'Total'}</b></td><td class="num"><b>${rp(Math.abs(s.total))}</b></td></tr></tbody></table></div>
   ${
     kasDalamSale(s).length > 1 || !rincianSale(s).kas.warung
       ? `<div class="hsum">${kasDalamSale(s)
           .map(k => {
             const v = rincianSale(s).kas[k].uang;
             return `<span>${kasPill(k)} <b>${v < 0 ? '−' : ''}Rp ${rp(Math.abs(v))}</b></span>`;
           })
           .join('')}</div>`
       : ''
   }
   ${
     !s.batal && sisaKurang(s) > 0
       ? `<div class="banner kurangbox row" style="margin-top:12px;gap:10px"><span class="grow">💸 Uangnya kurang <b>Rp ${rp(sisaKurang(s))}</b>${s.kurang > sisaKurang(s) ? ` (sudah dibayar Rp ${rp(s.kurang - sisaKurang(s))})` : ''}. Kalau kekurangannya sudah dibayar, tekan tombol ini.</span><button class="btn ok" id="kTerima">💵 Terima kekurangan</button></div>`
       : s.kurangBayar && !s.batal
         ? `<p class="muted" style="margin:10px 0 0">Uangnya kurang Rp ${rp(s.utang)}, dicatat sebagai utang <b>${esc(s.customerNama || '')}</b> (bayarnya di menu Pelanggan).</p>`
         : ''
   }
   <div class="row" style="margin-top:16px">
     <button class="btn pri" id="dup">📋 Duplikat ke kasir</button>
     ${!s.batal ? '<button class="btn ghost" id="edit">✏️ Ubah transaksi</button>' : ''}
     <button class="btn ghost" id="rp">🖨️ Cetak ulang</button>
     <span class="grow"></span>
     ${!s.batal ? '<button class="btn bad" id="void">Batalkan</button>' : ''}
     <button class="btn ghost" data-close>Tutup</button></div>
   <p class="muted" style="font-size:13px;margin:10px 0 0"><b>Duplikat</b> = buat transaksi baru berisi barang yang sama (harga terbaru), transaksi ini tetap ada. <b>Ubah</b> = perbaiki transaksi ini (salah barang/jumlah); transaksi lama otomatis dibatalkan setelah yang baru dibayar.</p>`,
    { wide: true }
  );
  $('#rp', m).onclick = () => printReceipt(s);
  $('#kTerima', m) &&
    ($('#kTerima', m).onclick = () =>
      terimaKurangDialog(s, () => {
        m.close();
        after && after();
      }));
  $('#dup', m).onclick = () => loadSaleToCart(s, 'dup');
  $('#edit') && ($('#edit', m).onclick = () => loadSaleToCart(s, 'edit'));
  $('#void') &&
    ($('#void', m).onclick = async () => {
      const pd = (s.poinDapat || 0) - (s.poinPakai || 0);
      const ps = s.customerId ? saldoPoin(s.customerId) - pd : 0;
      if (
        !(await confirmBox(
          'Batalkan transaksi ini? Stok barang akan dikembalikan.' +
            (s.items.some(i => i.layanan)
              ? ' Pulsa / token / BRILink yang sudah terlanjur diproses tidak ikut batal di aplikasinya.'
              : '') +
            (pd
              ? ` Poin ${pd > 0 ? '-' : '+'}${rp(Math.abs(pd))} juga dibatalkan${ps < 0 ? ` (poin pelanggan jadi minus ${rp(-ps)} karena sudah terpakai)` : ''}.`
              : ''),
          'Batalkan',
          true
        ))
      )
        return;
      s.batal = true;
      s.waktuBatal = Date.now();
      await save('sales', s);
      await hapusBayarUtangDalam(s);
      const t = [];
      for (const i of s.items) {
        const p = S.products.find(x => x.id === i.productId);
        if (p) {
          p.stok = r4((Number(p.stok) || 0) + qtyDasar(p, i));
          t.push(p);
        }
      }
      if (t.length) await DB.putMany('products', t);
      m.close();
      if (after) after();
      else render();
      toast('Transaksi dibatalkan');
    });
}
