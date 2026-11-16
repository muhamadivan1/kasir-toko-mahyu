/* ============ DAFTAR HADIAH POIN MEMBER ============
 * Hadiah yang bisa ditukar member dengan poin (misal: Gula 1 kg = 150 poin).
 * Data: S.meta.rewards = [{ id, nama, poin, stok ('' = tidak terbatas), aktif, pid, satuan }]
 * - pid (opsional): hadiah diambil dari stok produk toko, jadi stok produk ikut berkurang.
 * - Penukaran dicatat di customer.poinLog dengan jumlah negatif.
 */
function rewards() {
  if (!Array.isArray(S.meta.rewards)) S.meta.rewards = [];
  return S.meta.rewards;
}
function rewardsAktif() {
  return rewards()
    .filter(r => r.aktif !== false)
    .sort((a, b) => a.poin - b.poin || a.nama.localeCompare(b.nama));
}
function rewardStokHabis(r) {
  return r.stok !== '' && r.stok !== undefined && r.stok !== null && Number(r.stok) <= 0;
}
function rewardStokTxt(r) {
  return r.stok === '' || r.stok === undefined || r.stok === null ? 'tidak terbatas' : `sisa ${rp(r.stok)}`;
}
async function saveRewards() {
  await saveMeta('rewards');
}

/* ---- kelola daftar hadiah (dipakai di Pengaturan & halaman Pelanggan) ---- */
function rewardsTableHTML() {
  const L = rewards()
    .slice()
    .sort((a, b) => a.poin - b.poin);
  return `<div class="tablewrap" style="max-height:48vh"><table class="zebra"><thead><tr><th>Hadiah</th><th class="num">Poin</th><th class="num">Senilai</th><th>Stok hadiah</th><th></th></tr></thead><tbody>${
    L.map(
      r => `<tr class="${r.aktif === false ? 'off' : ''}"><td><b>${esc(r.nama)}</b>${r.pid ? `<div class="pmeta muted">📦 diambil dari stok produk${r.satuan ? ' (' + esc(r.satuan) + ')' : ''}</div>` : ''}${r.aktif === false ? ' <span class="badge">nonaktif</span>' : ''}</td>
      <td class="num"><b style="color:#8a5a00">${rp(r.poin)}</b></td><td class="num muted">Rp ${rp(r.poin * loy().nilai)}</td>
      <td>${rewardStokHabis(r) ? '<span class="badge bad">habis</span>' : esc(rewardStokTxt(r))}</td>
      <td class="right"><button class="btn sm ghost" data-rw="${r.id}">Ubah</button></td></tr>`
    ).join('') ||
    '<tr><td colspan="5" class="empty">Belum ada hadiah. Tambahkan misalnya: Gula 1 kg, Minyak 1 liter, Mie 1 dus.</td></tr>'
  }</tbody></table></div>`;
}
function bindRewardsTable(root, after) {
  $$('[data-rw]', root).forEach(
    b =>
      (b.onclick = () =>
        rewardEditDialog(
          rewards().find(r => r.id === b.dataset.rw),
          after
        ))
  );
}
function rewardsDialog() {
  const m = modal(
    `<h3>🎁 Daftar hadiah poin</h3><p class="muted" style="margin-top:0">Member menukar poin dengan hadiah di bawah ini. 1 poin = Rp ${rp(loy().nilai)} (bisa diubah di Pengaturan → Member &amp; Hadiah).</p>
   <div id="rwT">${rewardsTableHTML()}</div>
   <div class="row actbar"><button class="btn pri" id="rwAdd">➕ Tambah hadiah</button><button class="btn ghost" id="rwPrint">🖨️ Cetak daftar hadiah</button><span class="grow"></span><button class="btn ghost" data-close>Tutup</button></div>`,
    { wide: true }
  );
  const redraw = () => {
    $('#rwT', m).innerHTML = rewardsTableHTML();
    bindRewardsTable(m, redraw);
  };
  bindRewardsTable(m, redraw);
  $('#rwAdd', m).onclick = () => rewardEditDialog(null, redraw);
  $('#rwPrint', m).onclick = printRewardCatalog;
}
function rewardEditDialog(r, after) {
  const isNew = !r;
  r = r ? { ...r } : { id: uid(), nama: '', poin: '', stok: '', aktif: true, pid: '', satuan: '' };
  const linked = () => S.products.find(p => p.id === r.pid);
  const m = modal(
    `<h3>${isNew ? '➕ Tambah hadiah' : 'Ubah hadiah'}</h3>
   <label>Nama hadiah *</label><input id="rn" value="${esc(r.nama)}" placeholder="contoh: GULA PASIR 1 KG" autofocus>
   <div class="grid2"><div><label>Poin yang dibutuhkan *</label><input id="rp" inputmode="numeric" value="${r.poin ? rp(r.poin) : ''}"><div class="pmeta muted" id="rpv"></div></div>
   <div><label>Jumlah hadiah tersedia</label><input id="rs" inputmode="numeric" value="${r.stok === '' || r.stok == null ? '' : r.stok}" placeholder="kosong = tidak terbatas"></div></div>
   <label>Ambil dari stok produk toko? (opsional)</label>
   <div class="row" style="flex-wrap:nowrap"><div class="grow" id="rpl">${linked() ? `<b>${esc(linked().nama)}</b>` : '<span class="muted">Tidak (hadiah di luar barang dagangan)</span>'}</div><button class="btn sm ghost" id="rpick">🔍 Pilih produk</button><button class="btn sm bad ${r.pid ? '' : 'hide'}" id="runlink">✕</button></div>
   <div id="rsat"></div>
   <label><input type="checkbox" id="ra" ${r.aktif !== false ? 'checked' : ''}> Hadiah aktif (bisa ditukar)</label>
   <div class="row actbar">${isNew ? '' : '<button class="btn bad" id="rdel">Hapus</button>'}<span class="grow"></span><button class="btn ghost" data-close>Batal</button><button class="btn pri" id="rok">💾 Simpan</button></div>`
  );
  const drawLink = () => {
    const p = linked();
    $('#rpl', m).innerHTML = p
      ? `<b>${esc(p.nama)}</b> <span class="muted">· stok ${fmtStok(p)}</span>`
      : '<span class="muted">Tidak (hadiah di luar barang dagangan)</span>';
    $('#runlink', m).classList.toggle('hide', !p);
    $('#rsat', m).innerHTML =
      p && unitsOf(p).length > 1
        ? `<label>Satuan yang diberikan</label><select id="rsu">${unitsOf(p)
            .map(
              u =>
                `<option ${u.nama === (r.satuan || unitScanOf(p)) ? 'selected' : ''}>${esc(u.nama)}</option>`
            )
            .join('')}</select>`
        : '';
  };
  const showVal = () => ($('#rpv', m).textContent = `senilai Rp ${rp(num($('#rp', m).value) * loy().nilai)}`);
  $('#rp', m).oninput = showVal;
  showVal();
  drawLink();
  $('#rpick', m).onclick = () =>
    findPicker($('#rn', m).value, p => {
      r.pid = p.id;
      r.satuan = unitScanOf(p);
      if (!$('#rn', m).value.trim()) $('#rn', m).value = p.nama;
      drawLink();
    });
  $('#runlink', m).onclick = () => {
    r.pid = '';
    r.satuan = '';
    drawLink();
  };
  const ok = async () => {
    r.nama = $('#rn', m).value.trim().toUpperCase();
    r.poin = Math.floor(num($('#rp', m).value));
    const sv = $('#rs', m).value.trim();
    r.stok = sv === '' ? '' : Math.max(0, Math.floor(num(sv)));
    r.aktif = $('#ra', m).checked;
    if ($('#rsu', m)) r.satuan = $('#rsu', m).value;
    if (!r.nama) return toast('Isi nama hadiah', true);
    if (!(r.poin > 0)) return toast('Isi jumlah poin', true);
    const L = rewards();
    const i = L.findIndex(x => x.id === r.id);
    if (i < 0) L.push(r);
    else L[i] = r;
    await saveRewards();
    m.close();
    toast('Hadiah disimpan ✔');
    after && after();
  };
  $('#rok', m).onclick = ok;
  m.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      e.preventDefault();
      ok();
    }
  });
  $('#rdel', m) &&
    ($('#rdel', m).onclick = async () => {
      if (!(await confirmBox('Hapus hadiah ' + r.nama + '?', 'Hapus', true))) return;
      S.meta.rewards = rewards().filter(x => x.id !== r.id);
      await saveRewards();
      m.close();
      after && after();
    });
}

/* ---- tukar hadiah ---- */
function redeemDialog(c, after) {
  if (!c) return;
  const sal = saldoPoin(c.id);
  const L = rewardsAktif();
  if (!L.length) {
    toast('Daftar hadiah masih kosong. Tambahkan dulu di Pengaturan → Member & Hadiah.', true);
    return rewardsDialog();
  }
  const m = modal(
    `<h3>🎁 Tukar hadiah · ${esc(c.nama)}</h3>
   <div class="poinbox" style="margin-bottom:10px"><div class="row" style="justify-content:space-between"><span>Poin dimiliki ${c.kode ? `<span class="muted" style="font-size:12px">${esc(c.kode)}</span>` : ''}</span><b style="font-size:24px">${rp(sal)}</b></div></div>
   <div class="rwgrid">${L.map(r => {
     const kurang = r.poin > sal,
       habis = rewardStokHabis(r);
     return `<button class="rwcard" data-rd="${r.id}" ${kurang || habis ? 'disabled' : ''}><b>${esc(r.nama)}</b><span class="rwp">${rp(r.poin)} poin</span><small>${habis ? 'stok hadiah habis' : kurang ? `kurang ${rp(r.poin - sal)} poin` : rewardStokTxt(r)}</small></button>`;
   }).join('')}</div>
   <div class="row actbar"><button class="btn ghost" id="rdList">⚙ Kelola daftar hadiah</button><span class="grow"></span><button class="btn ghost" data-close>Tutup</button></div>`,
    { wide: true }
  );
  $('#rdList', m).onclick = () => {
    m.close();
    rewardsDialog();
  };
  $$('[data-rd]', m).forEach(
    b =>
      (b.onclick = async () => {
        const r = rewards().find(x => x.id === b.dataset.rd);
        if (!(await confirmBox(`Tukar ${rp(r.poin)} poin dengan ${r.nama}?`, '🎁 Tukar'))) return;
        const res = await redeemReward(c, r);
        if (!res) return;
        m.close();
        toast(`🎁 ${r.nama} ditukar. Sisa poin ${rp(res.sisa)}`);
        const pm = modal(
          `<h3>✔ Hadiah ditukar</h3><p style="font-size:18px">${esc(c.nama)} menukar <b>${rp(r.poin)} poin</b> dengan <b>${esc(r.nama)}</b>.<br>Sisa poin: <b>${rp(res.sisa)}</b></p>
         <div class="row actbar"><span class="grow"></span><button class="btn ghost" data-close>Tutup</button><button class="btn pri" id="rsPrint" autofocus>🖨️ Cetak bukti</button></div>`
        );
        $('#rsPrint', pm).onclick = () => {
          printRewardSlip(c, r, res.sisa);
          pm.close();
        };
        after && after();
      })
  );
}
async function redeemReward(c, r) {
  const sal = saldoPoin(c.id);
  if (r.poin > sal || rewardStokHabis(r)) {
    toast(r.poin > sal ? 'Poin tidak cukup' : 'Stok hadiah habis', true);
    return null;
  }
  const now = Date.now();
  c.poinLog = [
    ...(c.poinLog || []),
    { waktu: now, jumlah: -r.poin, catatan: 'Tukar hadiah: ' + r.nama, hadiahId: r.id }
  ];
  await save('customers', c);
  if (r.stok !== '' && r.stok != null) {
    r.stok = Math.max(0, Number(r.stok) - 1);
    await saveRewards();
  }
  const p = r.pid && S.products.find(x => x.id === r.pid);
  if (p) {
    const before = Number(p.stok) || 0;
    const q = qtyDasar(p, { qty: 1, isi: unitByName(p, r.satuan || p.satuan).isi, dasar: p.satuan });
    p.stok = r4(before - q);
    await save('products', p);
    await save('moves', {
      id: uid(),
      waktu: now,
      productId: p.id,
      nama: p.nama,
      jenis: 'hadiah',
      qty: -q,
      sebelum: before,
      sesudah: p.stok,
      catatan: 'Hadiah poin untuk ' + c.nama
    });
  }
  return { sisa: saldoPoin(c.id) };
}
function printRewardSlip(c, r, sisa) {
  const st = settings();
  const w = Number(st.lebarStruk) || 72;
  printHTML(
    `<div class="c b big">${esc(st.nama)}</div><div class="c">BUKTI TUKAR HADIAH</div><div class="hr"></div>
    <div class="r"><span>Tanggal</span><span>${tglJam(Date.now())}</span></div><div class="r"><span>Member</span><span>${esc(c.nama)}${c.kode ? ' (' + esc(c.kode) + ')' : ''}</span></div>
    <div class="hr"></div><div class="b big">${esc(r.nama)}</div><div class="r"><span>Poin ditukar</span><span>-${rp(r.poin)}</span></div><div class="r b"><span>Sisa poin</span><span>${rp(sisa)}</span></div>
    <div class="hr"></div><div class="c">Terima kasih sudah menjadi member</div><div style="height:10mm"></div>`,
    `@page{size:${w}mm auto;margin:0}body{margin:0;padding:2mm 3mm;width:${w}mm;box-sizing:border-box;font-family:Arial,sans-serif;font-size:11px;color:#000}.c{text-align:center}.b{font-weight:700}.big{font-size:14px}.r{display:flex;justify-content:space-between;gap:6px}.hr{border-top:1px dashed #000;margin:4px 0}`
  );
}
function printRewardCatalog() {
  const st = settings();
  const w = Number(st.lebarStruk) || 72;
  const L = rewardsAktif();
  if (!L.length) return toast('Belum ada hadiah aktif', true);
  printHTML(
    `<div class="c b big">${esc(st.nama)}</div><div class="c b">🎁 HADIAH POIN MEMBER</div><div class="c">Belanja Rp ${rp(loy().perRp)} = 1 poin</div><div class="hr"></div>
    ${L.map(r => `<div class="r"><span>${esc(r.nama)}</span><span class="b">${rp(r.poin)} poin</span></div>`).join('')}
    <div class="hr"></div><div class="c">Tanyakan poin Anda ke kasir</div><div style="height:10mm"></div>`,
    `@page{size:${w}mm auto;margin:0}body{margin:0;padding:2mm 3mm;width:${w}mm;box-sizing:border-box;font-family:Arial,sans-serif;font-size:12px;color:#000}.c{text-align:center}.b{font-weight:700}.big{font-size:15px}.r{display:flex;justify-content:space-between;gap:6px;padding:1.5mm 0;border-bottom:1px dotted #999}.hr{border-top:1px dashed #000;margin:4px 0}`
  );
}
