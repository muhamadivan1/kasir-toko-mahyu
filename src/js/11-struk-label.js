/* ============ STRUK & LABEL PRINT ============ */
function printHTML(html, css) {
  let f = $('#prframe');
  if (f) f.remove();
  f = document.createElement('iframe');
  f.id = 'prframe';
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  const d = f.contentDocument;
  d.open();
  d.write(
    `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${html}</body></html>`
  );
  d.close();
  // Setelah dialog cetak ditutup, kursor dikembalikan ke kolom scan / pencarian
  const back = () => {
    window.focus();
    refocusSoon(30);
  };
  f.contentWindow.addEventListener('afterprint', back);
  setTimeout(() => {
    f.contentWindow.focus();
    f.contentWindow.print();
    back();
  }, 350);
}
function receiptHTML(s) {
  const st = settings();
  const sisaK = sisaKurang(s);
  const lunas = !s.batal && !(s.utang > 0) && !(sisaK > 0);
  const tagih = s.utang > 0 ? s.utang : sisaK;
  let qr = '';
  // QR hanya dicetak kalau uang bayarnya tidak diisi (hemat kertas)
  if (st.qris && st.qrisStruk !== false && !s.batal && s.total > 0 && !s.tanpaQR) {
    try {
      if (tagih > 0)
        qr = `<div class="hr"></div><div class="c">Scan QRIS untuk bayar ${s.utang > 0 && !s.kurangBayar ? 'utang' : 'kekurangan'}<br><b>Rp ${rp(tagih)}</b></div><div class="qr">${qrImg(qrisDynamic(st.qris.payload, tagih), 4)}</div>`;
      else
        qr = `<div class="hr"></div><div class="c">Bayar non-tunai pakai QRIS</div><div class="qr">${qrImg(st.qris.payload, 4)}</div>`;
      qr += `<div class="c" style="font-size:10px">${esc(st.qris.nama)}</div>`;
    } catch (e) {}
  }
  return `<div class="c"><div class="b big">${esc(st.nama)}</div>${st.alamat ? `<div>${esc(st.alamat)}</div>` : ''}${st.telp ? `<div>HP/WA: ${esc(st.telp)}</div>` : ''}</div>
  <div class="hr"></div>
  <div class="r"><span>No</span><span>${esc(s.no)}</span></div><div class="r"><span>Tanggal</span><span>${tglJam(s.waktu)}</span></div>
  <div class="r"><span>Kasir</span><span>${esc(s.kasir || st.kasir || '-')}</span></div>
  ${s.customerNama ? `<div class="r"><span>${s.customerKode ? 'Member' : 'Pelanggan'}</span><span>${esc(s.customerNama)}${s.customerKode ? ' (' + esc(s.customerKode) + ')' : ''}</span></div>` : ''}
  ${s.tier && s.tier !== 'umum' ? `<div class="r"><span>Harga</span><span>${esc(tierName(s.tier))}</span></div>` : ''}
  ${s.catatan ? `<div>Catatan: ${esc(s.catatan)}</div>` : ''}
  <div class="hr"></div>
  ${s.items.map(barisStruk).join('')}
  <div class="hr"></div>
  ${s.diskon || s.potonganPoin ? `<div class="r"><span>Subtotal</span><span>${rp(s.subtotal)}</span></div>${s.diskon ? `<div class="r"><span>Diskon</span><span>-${rp(s.diskon)}</span></div>` : ''}${s.potonganPoin ? `<div class="r"><span>Tukar ${rp(s.poinPakai)} poin</span><span>-${rp(s.potonganPoin)}</span></div>` : ''}` : ''}
  ${
    s.total < 0
      ? `<div class="r b big"><span>DITERIMA PELANGGAN</span><span>${rp(-s.total)}</span></div>`
      : `<div class="r b big"><span>TOTAL</span><span>${rp(s.total)}</span></div>${
          s.kurangBayar
            ? `<div class="r"><span>Uang diterima</span><span>${rp(s.bayar)}</span></div><div class="r b big"><span>KURANG</span><span>${rp(s.utang)}</span></div><div class="c">(dicatat sebagai utang ${esc(s.customerNama || '')})</div>`
            : s.metode === 'utang'
              ? `<div class="r"><span>Dibayar</span><span>${rp(s.bayar)}</span></div><div class="r b"><span>Sisa utang</span><span>${rp(s.utang)}</span></div>`
              : s.kurang > 0
                ? `<div class="r"><span>Uang diterima</span><span>${rp(s.bayar)}</span></div><div class="r b big"><span>KURANG</span><span>${rp(s.kurang)}</span></div>${sisaK < s.kurang ? `<div class="r"><span>Kekurangan sudah dibayar</span><span>${rp(s.kurang - sisaK)}</span></div>${sisaK ? `<div class="r b"><span>Sisa kurang</span><span>${rp(sisaK)}</span></div>` : ''}` : ''}`
                : `<div class="r"><span>Bayar (${METODE[s.metode] || 'Tunai'})</span><span>${rp(s.bayar)}</span></div>${s.metode === 'tunai' ? `<div class="r"><span>Kembali</span><span>${rp(s.kembali)}</span></div>` : ''}`
        }`
  }
  <div class="status">${s.batal ? '*** DIBATALKAN ***' : s.total < 0 ? 'STATUS: SELESAI' : lunas ? 'STATUS: LUNAS' : 'STATUS: BELUM LUNAS'}</div>
  ${barisSisaUtang(s, sisaK)}
  ${!s.batal && s.poinSaldo !== undefined ? `<div class="hr"></div>${s.poinDapat ? `<div class="r"><span>Poin didapat</span><span>+${rp(s.poinDapat)}</span></div>` : ''}${s.poinPakai ? `<div class="r"><span>Poin dipakai</span><span>-${rp(s.poinPakai)}</span></div>` : ''}<div class="r b"><span>Total poin</span><span>${rp(s.poinSaldo)}</span></div>` : ''}
  ${qr}
  <div class="hr"></div><div class="c">${esc(st.footer)}</div><div style="height:12mm"></div>`;
}
/** Sisa utang semuanya setelah transaksi ini: pelanggan terdaftar (semua catatan utangnya),
 *  atau pembeli tanpa nama yang membayar utang lama tapi uangnya kurang */
function barisSisaUtang(s, sisaK) {
  if (s.batal || s.total < 0) return '';
  if (s.sisaUtangSetelah !== undefined)
    return `<div class="hr"></div><div class="r b"><span>SISA UTANG ${esc(s.customerNama || '')}</span><span>${rp(s.sisaUtangSetelah)}</span></div><div class="c">${s.sisaUtangSetelah > 0 ? '(semua utang setelah transaksi ini)' : 'Utang sudah LUNAS, terima kasih'}</div>`;
  if ((s.items || []).some(i => i.utangLama) && sisaK > 0)
    return `<div class="hr"></div><div class="r b"><span>SISA UTANG SEMUA</span><span>${rp(sisaK)}</span></div><div class="c">(utang lama dibayar dulu, sisanya dari belanja ini)</div>`;
  return '';
}
/** Satu baris barang / layanan di struk */
function barisStruk(i) {
  if (i.utangLama)
    return `<div class="r"><span>Bayar utang lama${i.catatan ? ' (' + esc(i.catatan) + ')' : ''}</span><span>${rp(i.harga * i.qty)}</span></div>`;
  if (i.layanan) {
    const d = i.lyn || {};
    const det = detailLayanan(i);
    return `<div>${esc(i.nama)}</div><div class="r"><span>&nbsp;&nbsp;${esc(det)}</span><span>${i.harga < 0 ? '-' : ''}${rp(Math.abs(i.harga * i.qty))}</span></div>${d.token ? `<div class="tok">TOKEN: ${esc(d.token)}</div>` : ''}`;
  }
  return `<div>${esc(i.nama)}</div><div class="r"><span>&nbsp;&nbsp;${String(i.qty).replace('.', ',')}${i.satuan && !i.manual ? ' ' + esc(i.satuan) : ''} x ${rp(i.harga)}</span><span>${rp(i.qty * i.harga)}</span></div>`;
}
function cssStruk() {
  const w = Number(settings().lebarStruk) || 72;
  return `@page{size:${w}mm auto;margin:0}body{margin:0;padding:2mm 3mm;width:${w}mm;box-sizing:border-box;font-family:Arial,sans-serif;font-size:11px;color:#000}.c{text-align:center}.b{font-weight:700}.big{font-size:14px}.r{display:flex;justify-content:space-between;gap:6px}.hr{border-top:1px dashed #000;margin:4px 0}.status{border:1.5px solid #000;text-align:center;font-weight:800;font-size:13px;padding:3px;margin:6px 0 2px}.qr{width:36mm;margin:2mm auto 1mm}.qr img{width:100%;height:auto;image-rendering:pixelated}.tok{font-weight:800;font-size:13px;margin:1px 0 3px;word-break:break-all}`;
}
function printReceipt(s) {
  printHTML(receiptHTML(s), cssStruk());
}
/** Struk kecil untuk bukti pembayaran (bayar utang, terima kekurangan).
 *  o = { judul, waktu, nama, ref, rows: [[label, nilai, besar]], sisa, catatan } */
function buktiBayarHTML(o) {
  const st = settings();
  return `<div class="c"><div class="b big">${esc(st.nama)}</div>${st.alamat ? `<div>${esc(st.alamat)}</div>` : ''}${st.telp ? `<div>HP/WA: ${esc(st.telp)}</div>` : ''}</div>
  <div class="hr"></div><div class="c b big">${esc(o.judul)}</div>
  <div class="r"><span>Tanggal</span><span>${tglJam(o.waktu)}</span></div>
  ${o.ref ? `<div class="r"><span>Transaksi</span><span>${esc(o.ref)}</span></div>` : ''}
  ${o.nama ? `<div class="r"><span>Pelanggan</span><span>${esc(o.nama)}</span></div>` : ''}
  <div class="hr"></div>
  ${o.rows.map(([l, v, besar]) => `<div class="r${besar ? ' b big' : ''}"><span>${esc(l)}</span><span>${v}</span></div>`).join('')}
  <div class="status">${o.sisa > 0 ? 'STATUS: BELUM LUNAS' : 'STATUS: LUNAS'}</div>
  ${o.catatan ? `<div>Catatan: ${esc(o.catatan)}</div>` : ''}
  <div class="hr"></div><div class="c">${esc(st.footer)}</div><div style="height:12mm"></div>`;
}
function printBukti(o) {
  printHTML(buktiBayarHTML(o), cssStruk());
}
function barcodeSVG(code, opt = {}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const fmt = /^\d{13}$/.test(code) && ean13check(code.slice(0, 12)) == code[12] ? 'EAN13' : 'CODE128';
  try {
    JsBarcode(svg, code, {
      format: fmt,
      displayValue: true,
      fontSize: opt.fontSize || 14,
      height: opt.height || 40,
      margin: 2,
      width: opt.width || 1.6
    });
  } catch (e) {
    JsBarcode(svg, code, {
      format: 'CODE128',
      height: opt.height || 40,
      margin: 2,
      fontSize: opt.fontSize || 14
    });
  }
  return svg.outerHTML;
}
function printLabels(list) {
  // list: [{p,qty,tier}]
  const st = settings();
  const thermal = st.labelMode === 'thermal';
  const items = [];
  list.forEach(x => {
    for (let i = 0; i < x.qty; i++) items.push(x);
  });
  const cell = x =>
    `<div class="lb"><div class="n">${esc(x.p.nama)}</div>${x.showPrice ? `<div class="p">Rp ${rp(priceOf(x.p, x.tier || 'umum'))}</div>` : ''}<div class="bc">${barcodeSVG(x.p.barcode, { height: thermal ? 32 : 34 })}</div></div>`;
  if (thermal) {
    const W = Number(st.labelW) || 50,
      H = Number(st.labelH) || 30;
    printHTML(
      items.map(cell).join(''),
      `@page{size:${W}mm ${H}mm;margin:0}body{margin:0;font-family:Arial,sans-serif}.lb{width:${W}mm;height:${H}mm;box-sizing:border-box;padding:1.5mm;overflow:hidden;page-break-after:always;text-align:center}.n{font-size:9px;font-weight:700;line-height:1.1;max-height:2.3em;overflow:hidden}.p{font-size:12px;font-weight:800}.bc svg{max-width:100%;height:auto;max-height:${H - 11}mm}`
    );
  } else
    printHTML(
      `<div class="g">${items.map(cell).join('')}</div>`,
      `@page{size:A4;margin:8mm}body{margin:0;font-family:Arial,sans-serif}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:2mm}.lb{border:1px dashed #bbb;height:36mm;box-sizing:border-box;padding:2mm;text-align:center;overflow:hidden;break-inside:avoid}.n{font-size:10px;font-weight:700;line-height:1.15;max-height:2.4em;overflow:hidden}.p{font-size:13px;font-weight:800}.bc svg{max-width:100%;height:auto;max-height:22mm}`
    );
}

/** Label harga rak, seperti di supermarket: ditempel di depan rak / tempat barang.
 *  list: [{p, qty}], opt: { tier, satuanLain, warung, tanggal, kertas: 'a4' | 'struk' } */
function labelRakHTML(x, opt) {
  const st = settings();
  const p = x.p;
  const h = priceOf(p, opt.tier || 'umum');
  const lain = opt.satuanLain
    ? unitsOf(p)
        .filter(u => !u.base)
        .map(
          u =>
            `${esc(u.nama)} (isi ${String(r4(u.isi)).replace('.', ',')}) Rp ${rp(priceUnit(p, u.nama, opt.tier || 'umum'))}`
        )
    : [];
  const w = opt.warung && (opt.tier || 'umum') !== 'warung' ? priceOf(p, 'warung') : 0;
  return `<div class="tag"><div class="tk"><span>${esc(st.nama || '')}</span><span>${opt.tanggal ? new Date().toLocaleDateString('id-ID') : ''}</span></div>
  <div class="nm">${esc(p.nama)}</div>
  <div class="hg"><span class="rp">Rp</span><span class="v">${rp(h)}</span><span class="st">/${esc(p.satuan || 'PCS')}</span></div>
  ${lain.length || w ? `<div class="ex">${lain.map(t => `<span>${t}</span>`).join('')}${w ? `<span>Warung Rp ${rp(w)}</span>` : ''}</div>` : ''}</div>`;
}
const CSS_LABEL_RAK = `.tag{border:1.6px solid #000;border-radius:2mm;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;break-inside:avoid;page-break-inside:avoid;background:#fff}
.tag .tk{background:#000;color:#fff;font-size:8.5px;font-weight:700;padding:.8mm 2mm;display:flex;justify-content:space-between;gap:2mm;white-space:nowrap;overflow:hidden}
.tag .nm{font-size:11.5px;font-weight:800;line-height:1.15;padding:1.2mm 2mm 0;max-height:2.4em;overflow:hidden}
.tag .hg{flex:1;display:flex;align-items:center;justify-content:center;padding:0 2mm;white-space:nowrap}
.tag .hg .rp{font-size:13px;font-weight:800;margin-right:1mm;align-self:flex-start;margin-top:2.2mm}
.tag .hg .v{font-size:32px;font-weight:900;letter-spacing:-.5px;line-height:1}
.tag .hg .st{font-size:11px;font-weight:700;margin-left:1mm;align-self:flex-end;margin-bottom:2.4mm}
.tag .ex{font-size:9px;font-weight:700;padding:0 2mm 1.2mm;display:flex;flex-wrap:wrap;justify-content:center;gap:0 3mm}`;
function printLabelRak(list, opt) {
  const items = [];
  list.forEach(x => {
    for (let i = 0; i < x.qty; i++) items.push(x);
  });
  const html = items.map(x => labelRakHTML(x, opt)).join('');
  if (opt.kertas === 'struk') {
    const w = Number(settings().lebarStruk) || 72;
    printHTML(
      `<div class="col">${html}</div>`,
      `@page{size:${w}mm auto;margin:0}body{margin:0;font-family:Arial,sans-serif;color:#000}.col{width:${w}mm;padding:2mm 3mm;box-sizing:border-box}.tag{height:34mm;margin-bottom:5mm}${CSS_LABEL_RAK}`
    );
  } else
    printHTML(
      `<div class="g">${html}</div>`,
      `@page{size:A4;margin:8mm}body{margin:0;font-family:Arial,sans-serif;color:#000}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm}.tag{height:38mm}${CSS_LABEL_RAK}`
    );
}
