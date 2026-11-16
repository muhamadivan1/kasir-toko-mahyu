/* ============ BERANDA ============ */
function dayStart(off = 0) {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate() + off).getTime();
}
/** Ringkasan penjualan satu rentang waktu. Penjualan = Warung + Material (uang BRILink bukan penjualan). */
function sumDay(a, b) {
  const R = rekapUang(a, b);
  const l = S.sales.filter(s => !s.batal && s.waktu >= a && s.waktu < b);
  return {
    l,
    R,
    omzet: R.semua.penjualan,
    trx: l.length,
    laba: R.semua.laba,
    bersih: R.semua.bersih,
    utang: R.semua.utang,
    bayarUtang: R.semua.bayarUtang
  };
}
function isRugi(p) {
  const hb = Number(p.hargaBeli) || 0;
  if (!hb) return false;
  return tiers().some(t => {
    const v = (p.harga || {})[t.id];
    return v && Number(v) <= hb;
  });
}
function deltaTxt(now, prev) {
  if (!prev) return now ? '<span class="muted">kemarin belum ada penjualan</span>' : '';
  const d = Math.round(((now - prev) / prev) * 100);
  return `<span style="color:${d >= 0 ? 'var(--ok)' : 'var(--bad)'};font-weight:700">${d >= 0 ? '▲' : '▼'} ${Math.abs(d)}%</span> <span class="muted">dibanding kemarin (Rp ${rp(prev)})</span>`;
}
function salesChart(days) {
  const data = [];
  for (let i = days - 1; i >= 0; i--) {
    const a = dayStart(-i),
      b = dayStart(-i + 1);
    const d = sumDay(a, b);
    data.push({ t: a, v: d.omzet, n: d.trx });
  }
  const W = innerWidth < 700 ? 380 : 720,
    H = innerWidth < 700 ? 220 : 230,
    L = innerWidth < 700 ? 44 : 58,
    R = 10,
    T = 26,
    B = 34,
    pw = W - L - R,
    ph = H - T - B;
  const mx = Math.max(...data.map(d => d.v), 1);
  const step =
    [1e3, 2e3, 5e3, 1e4, 2e4, 5e4, 1e5, 2e5, 5e5, 1e6, 2e6, 5e6, 1e7, 2e7, 5e7].find(s => mx / s <= 4) || 1e8;
  const top = Math.ceil(mx / step) * step;
  const y = v => T + ph - (v / top) * ph;
  const bw = pw / days;
  const barW = Math.min(30, bw - 6);
  const hari = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const fmtK = v =>
    v >= 1e6
      ? (v / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' jt'
      : v >= 1e3
        ? v / 1e3 + ' rb'
        : String(v);
  let g = '';
  for (let v = 0; v <= top; v += step) {
    g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#e6eaf0" stroke-width="1"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#6b7686">${fmtK(v)}</text>`;
  }
  const bars = data
    .map((d, i) => {
      const cx = L + bw * i + bw / 2,
        x = cx - barW / 2,
        h = Math.max(0, T + ph - y(d.v)),
        r = Math.min(4, h, barW / 2);
      const yy = T + ph - h;
      const dt = new Date(d.t);
      const today = i === days - 1;
      const path =
        h > 0
          ? `<path d="M${x},${T + ph} V${yy + r} Q${x},${yy} ${x + r},${yy} H${x + barW - r} Q${x + barW},${yy} ${x + barW},${yy + r} V${T + ph} Z" fill="${today ? '#1d4e89' : '#6f9bd1'}"/>`
          : '';
      return `<g class="bar" data-i="${i}">${path}<rect x="${L + bw * i}" y="${T}" width="${bw}" height="${ph}" fill="transparent"/>
      <text x="${cx}" y="${H - B + 16}" text-anchor="middle" font-size="11" fill="${today ? '#1b2430' : '#6b7686'}" font-weight="${today ? 700 : 400}">${dt.getDate()}</text>
      ${days <= 14 || i % 2 === 0 ? `<text x="${cx}" y="${H - B + 29}" text-anchor="middle" font-size="10" fill="#9aa3b1">${today ? 'hari ini' : hari[dt.getDay()]}</text>` : ''}
      ${today && d.v ? `<text x="${cx}" y="${yy - 6}" text-anchor="middle" font-size="11" font-weight="700" fill="#1b2430">${fmtK(d.v)}</text>` : ''}</g>`;
    })
    .join('');
  return {
    svg: `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Penjualan ${days} hari terakhir" style="display:block">${g}<line x1="${L}" x2="${W - R}" y1="${T + ph}" y2="${T + ph}" stroke="#c9d1dc"/>${bars}</svg>`,
    data
  };
}
views.beranda = () => {
  const t = sumDay(dayStart(0), dayStart(1)),
    y = sumDay(dayStart(-1), dayStart(0)),
    w = sumDay(dayStart(-6), dayStart(1)),
    mo = sumDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime(), dayStart(1));
  // barang dari daftar barcode yang belum dicek tidak dihitung di peringatan stok & harga (punya baris sendiri)
  const dariDaftar = S.products.filter(p => p.aktif !== false && p.dariDaftar).length;
  const kurangL = daftarKurang();
  const aktif = S.products.filter(p => p.aktif !== false && !p.dariDaftar);
  const minus = aktif.filter(p => Number(p.stok) < 0).length,
    habis = aktif.filter(p => Number(p.stok) === 0).length,
    tipis = aktif.filter(p => Number(p.stok) > 0 && Number(p.stok) <= Number(p.minStok || 0)).length;
  const rugi = aktif.filter(isRugi),
    noHarga = aktif.filter(p => !priceOf(p, 'umum')).length,
    noBc = aktif.filter(p => !p.barcode).length,
    noHb = aktif.filter(p => !Number(p.hargaBeli)).length;
  const piutang = S.customers
    .map(c => ({ c, s: saldoUtang(c.id) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s);
  const totPiutang = piutang.reduce((a, x) => a + x.s, 0);
  const top = {};
  w.l.forEach(s =>
    s.items.forEach(i => {
      if (i.layanan) return;
      const k = i.nama + (i.isi > 1 ? ' (' + i.satuan + ')' : '');
      top[k] = top[k] || { n: k, q: 0, v: 0 };
      top[k].q += i.qty;
      top[k].v += i.qty * i.harga;
    })
  );
  const topL = Object.values(top)
    .sort((a, b) => b.v - a.v)
    .slice(0, 8);
  const lb = S.meta.lastBackup;
  const held = (S.meta.held || []).length;
  const hariIni = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const chart = salesChart(innerWidth < 700 ? 7 : 14);
  const nOrder = ordersPending().filter(o => o.id !== cart.orderId).length;
  const nCekW = aktif.filter(perluCekWarung).length;
  const katalogBasi = ghSiap() && katalogPerluUpdate();
  const U = uangConf();
  const blmTutup = belumTutup();
  const nKulakan = jumlahPerluKulakan();
  // utang pelanggan yang sudah lebih dari 14 hari dan belum ditagih dalam 7 hari terakhir
  const nUtangLama = S.customers.filter(
    c => saldoUtang(c.id) > 0 && umurUtang(c.id) >= 14 && !(c.ditagih && Date.now() - c.ditagih < 7 * 864e5)
  ).length;
  const att = [
    U.ingatBuka &&
      !kasirOtoAktif() &&
      !bukaHariIni() &&
      S.products.length > 0 && {
        i: '☀️',
        t: '<b>Belum buka kasir hari ini</b>',
        s: 'Hitung uang awal di tiap laci supaya sore nanti bisa dicocokkan.',
        go: () => {
          go('uang');
          bukaKasirDialog();
        }
      },
    blmTutup.length &&
      !kasirOtoAktif() &&
      new Date().getHours() >= 17 && {
        i: '🌙',
        t: '<b>Belum tutup kasir</b>',
        s: 'Hitung uang di laci ' + blmTutup.map(k => infoKas(k).nama).join(', ') + ' lalu cocokkan.',
        go: () => {
          go('uang');
          tutupKasirDialog();
        }
      },
    nKulakan && {
      i: '🛒',
      t: `<b>${nKulakan}</b> barang laku perlu dibeli lagi`,
      s: 'Lihat daftar kulakan: jumlah belinya sudah dihitung dari penjualan.',
      go: () => {
        go('stok');
        kulakanDialog();
      }
    },
    ...pengingatSupplier(),
    nUtangLama && {
      i: '📒',
      t: `<b>${nUtangLama}</b> pelanggan punya utang lebih dari 2 minggu`,
      s: 'Bisa ditagih lewat WhatsApp: menu Pelanggan, tombol 💬 Tagih.',
      go: () => {
        S._custUtang = true;
        go('pelanggan');
      }
    },
    nOrder && {
      i: '📥',
      t: `<b>${nOrder}</b> pesanan pelanggan belum diproses`,
      s: 'Pesanan dari WhatsApp / link pesan yang tersimpan.',
      go: () => {
        go('kasir');
        ordersDialog();
      }
    },
    nCekW && {
      i: '⚙',
      t: `<b>${nCekW}</b> harga warung diisi otomatis, perlu dicek`,
      s: 'Tinggal lihat sekilas dan tandai ✔ kalau sudah benar.',
      go: () => {
        go('produk');
        cekWarungDialog(render);
      }
    },
    katalogBasi && {
      i: '☁️',
      t: 'Katalog pesan online belum diperbarui',
      s: 'Ada perubahan barang atau harga yang belum terlihat oleh pelanggan.',
      go: () => {
        S._setTab = 'online';
        go('pengaturan');
      }
    },
    minus && {
      i: '📉',
      t: `<b>${minus}</b> barang stoknya minus`,
      s: 'Stok tercatat lebih sedikit dari yang terjual. Lakukan hitung ulang stok.',
      go: () => {
        S._stokFilter = 'neg';
        go('stok');
      }
    },
    habis && {
      i: '📦',
      t: `<b>${habis}</b> barang stoknya 0`,
      s: 'Cek apakah benar habis atau belum dihitung.',
      go: () => {
        S._stokFilter = 'low';
        go('stok');
      }
    },
    tipis && {
      i: '⚠️',
      t: `<b>${tipis}</b> barang hampir habis`,
      s: 'Sudah di bawah batas stok menipis.',
      go: () => {
        S._stokFilter = 'low';
        go('stok');
      }
    },
    rugi.length && {
      i: '🔻',
      t: `<b>${rugi.length}</b> barang harga jualnya ≤ harga beli`,
      s:
        'Dijual tanpa untung atau rugi: ' +
        rugi
          .slice(0, 3)
          .map(p => esc(p.nama))
          .join(', ') +
        (rugi.length > 3 ? ', …' : ''),
      go: () => {
        S._prodFilter = 'rugi';
        go('produk');
      }
    },
    noHarga && {
      i: '🏷️',
      t: `<b>${noHarga}</b> barang belum ada harga jual`,
      s: 'Di kasir akan diminta mengisi harganya dulu.',
      go: () => {
        S._prodFilter = 'noh';
        go('produk');
      }
    },
    noBc && {
      i: '🔢',
      t: `<b>${noBc}</b> barang belum ada barcode`,
      s: 'Pasangkan dengan scan di kasir, atau buat & cetak label toko.',
      go: () => {
        S._prodFilter = 'nob';
        go('produk');
      }
    },
    noHb && {
      i: '💰',
      t: `<b>${noHb}</b> barang belum ada harga beli`,
      s: 'Laba jadi tidak akurat untuk barang ini.',
      go: () => {
        S._prodFilter = 'nohb';
        go('produk');
      }
    },
    kurangL.length && {
      i: '💸',
      t: `<b>${kurangL.length}</b> transaksi uangnya kurang, total <b>Rp ${rp(kurangL.reduce((a, s) => a + sisaKurang(s), 0))}</b>`,
      s: 'Kalau kekurangannya sudah dibayar, buka lalu tekan Terima.',
      go: () => daftarKurangDialog()
    },
    dariDaftar && {
      i: '📥',
      t: `<b>${dariDaftar}</b> barang dari daftar barcode belum dicek`,
      s: 'Belum ada harganya. Isi saat barangnya di-scan, atau nonaktifkan yang tidak dijual.',
      go: () => {
        S._prodFilter = 'daftar';
        go('produk');
      }
    },
    held && {
      i: '⏸',
      t: `<b>${held}</b> transaksi masih ditunda`,
      s: 'Selesaikan atau hapus di halaman Kasir.',
      go: () => go('kasir')
    },
    (!S.meta.backupHandle || !S._bkFileOk) &&
      (!lb || Date.now() - lb > (backupHarianAktif() ? 3 : 1) * 86400000) && {
        i: '💾',
        t: lb ? 'Belum backup sejak ' + tglJam(lb) : 'Belum pernah backup',
        s: 'Data hanya tersimpan di perangkat ini.',
        go: () => go('pengaturan')
      }
  ].filter(Boolean);
  $('#main').innerHTML = `
  <div class="row" style="margin-bottom:12px"><h2 class="grow" style="margin:0">Beranda <span class="muted" style="font-size:16px;font-weight:400">· ${hariIni}</span></h2><button class="btn pri big" id="toKasir">🛒 Buka Kasir</button></div>
  <div class="stats">
    <div class="stat"><div class="muted">Penjualan hari ini</div><div class="v">Rp ${rp(t.omzet)}</div><div style="font-size:13px;margin-top:4px">${deltaTxt(t.omzet, y.omzet)}</div>${t.R.material.jual ? `<div class="muted" style="font-size:13px;margin-top:2px">🏪 Warung Rp ${rp(t.R.warung.jual)} · 🧱 Material Rp ${rp(t.R.material.jual)}</div>` : ''}${t.R.brilink.trx ? `<div class="muted" style="font-size:13px;margin-top:2px">🏦 BRILink ${t.R.brilink.trx} transaksi · admin Rp ${rp(t.R.brilink.admin)}</div>` : ''}</div>
    <div class="stat"><div class="muted">Transaksi hari ini</div><div class="v">${t.trx}</div><div class="muted" style="font-size:13px;margin-top:4px">${t.trx ? 'rata-rata Rp ' + rp(t.omzet / t.trx) + ' per transaksi' : 'belum ada transaksi'}</div></div>
    <div class="stat"><div class="muted">Perkiraan laba hari ini</div><div class="v">Rp ${rp(t.laba)}</div><div class="muted" style="font-size:13px;margin-top:4px">${t.R.semua.biaya ? `laba bersih Rp ${rp(t.bersih)} (setelah pengeluaran Rp ${rp(t.R.semua.biaya)})` : 'dari harga beli yang tercatat'}</div></div>
    <div class="stat link" id="toUang"><div class="muted">Uang seharusnya di laci</div>${kasAktif()
      .map(k => {
        const p = posisiUang(k.id);
        return `<div class="row laciline"><span>${k.ikon} ${esc(k.nama)}</span><span class="grow"></span><b class="${p.saldo < 0 ? 'negtxt' : ''}">Rp ${p.saldo < 0 ? '−' : ''}${rp(Math.abs(p.saldo))}</b></div>`;
      })
      .join(
        ''
      )}<div class="muted" style="font-size:13px;margin-top:4px">${bukaHariIni() ? 'dihitung dari uang awal saat buka kasir' : 'belum buka kasir, dihitung dari 0'} · lihat 💰 Uang</div></div>
    <div class="stat"><div class="muted">Piutang warung (belum dibayar)</div><div class="v" style="color:${totPiutang ? 'var(--bad)' : 'inherit'}">Rp ${rp(totPiutang)}</div><div class="muted" style="font-size:13px;margin-top:4px">${piutang.length} pelanggan${kurangL.length ? ` · uang kurang Rp ${rp(kurangL.reduce((a, s) => a + sisaKurang(s), 0))}` : ''}${t.utang ? ` · utang baru hari ini Rp ${rp(t.utang)}` : ''}</div></div>
  </div>
  <div style="display:grid;grid-template-columns:3fr 2fr;gap:14px;align-items:start" class="bgrid">
    <div class="card"><div class="row"><h3 class="grow" style="margin:0">Penjualan ${chart.data.length} hari terakhir</h3><span class="muted" style="font-size:14px">7 hari: <b style="color:var(--ink)">Rp ${rp(w.omzet)}</b> · bulan ini: <b style="color:var(--ink)">Rp ${rp(mo.omzet)}</b></span></div>
      <div style="position:relative;margin-top:8px" id="chartBox">${chart.svg}<div id="ctip" class="hide" style="position:absolute;pointer-events:none;background:#1b2430;color:#fff;border-radius:8px;padding:8px 10px;font-size:13px;white-space:nowrap;transform:translate(-50%,-100%)"></div></div>
      <details style="margin-top:6px"><summary class="muted" style="cursor:pointer;font-size:13px">Lihat sebagai tabel</summary><table style="margin-top:6px"><thead><tr><th>Tanggal</th><th class="num">Transaksi</th><th class="num">Penjualan</th></tr></thead><tbody>${chart.data
        .slice()
        .reverse()
        .map(d => `<tr><td>${tgl(d.t)}</td><td class="num">${d.n}</td><td class="num">${rp(d.v)}</td></tr>`)
        .join('')}</tbody></table></details>
    </div>
    <div class="card"><h3>Perlu perhatian</h3>${att.length ? att.map((a, i) => `<div class="row att" data-a="${i}" style="padding:10px 6px;border-bottom:1px solid var(--line);cursor:pointer;align-items:flex-start;flex-wrap:nowrap"><span style="font-size:22px">${a.i}</span><div class="grow"><div>${a.t}</div><div class="muted" style="font-size:13px">${a.s}</div></div><span class="muted">›</span></div>`).join('') : '<div class="empty">✅ Semua aman.</div>'}</div>
    <div class="card"><h3>Barang terlaris 7 hari</h3><table><tbody>${topL.map((x, i) => `<tr><td>${i + 1}. ${esc(x.n)}<br><span class="muted" style="font-size:13px">${rp(x.q)} terjual</span></td><td class="num">Rp ${rp(x.v)}</td></tr>`).join('') || '<tr><td class="empty">Belum ada penjualan minggu ini.</td></tr>'}</tbody></table></div>
    <div class="card"><h3>Utang terbesar</h3><table><tbody>${
      piutang
        .slice(0, 6)
        .map(
          x =>
            `<tr><td><b>${esc(x.c.nama)}</b></td><td class="num"><span class="badge bad" style="font-size:14px">Rp ${rp(x.s)}</span></td></tr>`
        )
        .join('') || '<tr><td class="empty">Tidak ada utang. 👍</td></tr>'
    }</tbody></table>
      <h3 style="margin-top:16px">Transaksi terakhir</h3><table><tbody>${
        S.sales
          .filter(s => !s.batal)
          .sort((x, y) => y.waktu - x.waktu)
          .slice(0, 5)
          .map(
            s =>
              `<tr><td>${tglJam(s.waktu)}<br><span class="muted" style="font-size:13px">${esc(namaPembeli(s))}</span> ${tierPill(s.tier)}</td><td>${metodeBadge(s.metode)}</td><td class="num"><b>${totalTeks(s)}</b></td></tr>`
          )
          .join('') || '<tr><td class="empty">Belum ada.</td></tr>'
      }</tbody></table></div>
  </div>`;
  if (innerWidth < 900) $('.bgrid').style.gridTemplateColumns = 'minmax(0, 1fr)';
  $('#toKasir').onclick = () => go('kasir');
  $('#toUang').onclick = () => go('uang');
  $$('.att').forEach(el => (el.onclick = () => att[+el.dataset.a].go()));
  const tip = $('#ctip'),
    box = $('#chartBox');
  $$('#chartBox .bar').forEach(g => {
    g.onmouseenter = g.ontouchstart = () => {
      const d = chart.data[+g.dataset.i];
      const r = g.getBoundingClientRect(),
        br = box.getBoundingClientRect();
      tip.innerHTML = `<b>${new Date(d.t).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}</b><br>Rp ${rp(d.v)} · ${d.n} transaksi`;
      tip.style.left = r.left - br.left + r.width / 2 + 'px';
      tip.style.top = '4px';
      tip.classList.remove('hide');
    };
    g.onmouseleave = () => tip.classList.add('hide');
  });
};
