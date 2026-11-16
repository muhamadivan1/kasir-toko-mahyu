/* ============ KAMERA (HP) ============ */
/** tanpaQR: hanya barcode garis, dipakai untuk mencari ulang kalau yang terbaca ternyata QR BPOM */
function zxReader(tanpaQR) {
  const Z = ZXing,
    F = Z.BarcodeFormat,
    h = new Map();
  h.set(Z.DecodeHintType.POSSIBLE_FORMATS, [
    F.EAN_13,
    F.EAN_8,
    F.UPC_A,
    F.UPC_E,
    F.CODE_128,
    F.CODE_39,
    F.ITF,
    ...(tanpaQR ? [] : [F.QR_CODE])
  ]);
  h.set(Z.DecodeHintType.TRY_HARDER, true);
  const r = new Z.MultiFormatReader();
  r.setHints(h);
  return r;
}
/** pakaiAturan: baca hanya jenis kode yang diatur di reader (decode() biasa membaca semua jenis) */
function zxDecodeCanvas(cv, reader, pakaiAturan) {
  try {
    const bmp = new ZXing.BinaryBitmap(
      new ZXing.HybridBinarizer(new ZXing.HTMLCanvasElementLuminanceSource(cv))
    );
    return (pakaiAturan ? reader.decodeWithState(bmp) : reader.decode(bmp)).getText();
  } catch (e) {
    return null;
  }
}
/** Baca satu gambar. Kalau yang terbaca QR BPOM, coba lagi khusus barcode garis di gambar yang sama. */
function zxBacaUtama(cv, reader, readerGaris) {
  const t = zxDecodeCanvas(cv, reader);
  if (!t || !jenisKodeAsing(t)) return t;
  return zxDecodeCanvas(cv, readerGaris, true) || t;
}
async function decodeBarcodeImage(file) {
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('Foto tidak bisa dibuka'));
    i.src = URL.createObjectURL(file);
  });
  if ('BarcodeDetector' in window) {
    try {
      const r = await new BarcodeDetector().detect(img);
      // QR BPOM dan barcode garis sering terfoto bersamaan: utamakan yang bukan QR BPOM
      if (r.length) return r.map(x => x.rawValue).find(t => !jenisKodeAsing(t)) || r[0].rawValue;
    } catch (e) {}
  }
  const reader = zxReader(),
    readerGaris = zxReader(true);
  let asing = null;
  for (const maxW of [1200, 800, 1800]) {
    for (const rot of [0, 90]) {
      const sc = Math.min(1, maxW / Math.max(img.width, img.height));
      const w = Math.round(img.width * sc),
        h = Math.round(img.height * sc);
      const cv = document.createElement('canvas');
      cv.width = rot ? h : w;
      cv.height = rot ? w : h;
      const cx = cv.getContext('2d');
      if (rot) {
        cx.translate(h / 2, w / 2);
        cx.rotate(Math.PI / 2);
        cx.drawImage(img, -w / 2, -h / 2, w, h);
      } else cx.drawImage(img, 0, 0, w, h);
      const t = zxBacaUtama(cv, reader, readerGaris);
      if (t && !jenisKodeAsing(t)) return t;
      if (t) asing = asing || t;
    }
  }
  if (asing) return asing; // hanya QR BPOM yang terbaca: jendela kamera yang menolaknya
  throw new Error('Barcode tidak terbaca. Foto lebih dekat, lurus, dan tidak silau, atau ketik angkanya.');
}
async function cameraScan() {
  const live = !!(window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  let stream = null,
    timer = null;
  const m = modal(
    `<h3>📷 Scan pakai kamera</h3>
   <div id="camLive" class="${live ? '' : 'hide'}"><video id="vid" playsinline muted style="max-height:50vh;object-fit:cover"></video><p class="muted" style="font-size:13px;margin:6px 0 0">Arahkan barcode ke tengah kamera dan tahan sebentar.</p></div>
   <div id="camMsg">${live ? '' : `<div class="banner">Kamera langsung tidak tersedia karena aplikasi dibuka dari <b>file</b> di HP. Browser hanya mengizinkan kamera langsung untuk aplikasi yang dibuka lewat alamat <b>https</b> (online).<br>Tetap bisa: tekan <b>📸 Foto barcode</b> di bawah.</div>`}</div>
   <div class="row" style="margin-top:10px"><button class="btn pri grow big" id="camPhoto">📸 Foto barcode</button><input type="file" accept="image/*" capture="environment" id="camFile" class="hide"><button class="btn ghost" data-close>Tutup</button></div>`,
    {
      onClose: () => {
        clearInterval(timer);
        stream && stream.getTracks().forEach(t => t.stop());
        focusScan();
      }
    }
  );
  let tolakTerakhir = 0;
  /** QR BPOM / QR situs ikut terbaca kamera: jendela tetap terbuka, kasir diminta mengarahkan ke barcode garis */
  const tolak = jenis => {
    if (Date.now() - tolakTerakhir < 2500) return;
    tolakTerakhir = Date.now();
    bunyiTolak();
    msg(
      `<div class="banner" style="background:#fdecec;border-color:#f3b4b4;color:#7f1d1d">${esc(PESAN_TOLAK[jenis] || PESAN_TOLAK.asing)}</div>`
    );
  };
  /** Dari beberapa kode yang terbaca sekaligus, ambil yang bukan QR BPOM */
  const pilihKode = list => list.find(t => !jenisKodeAsing(t));
  const got = code => {
    code = String(code).trim();
    const asing = jenisKodeAsing(code);
    if (asing) return tolak(asing);
    m.close();
    if (/TMPESAN1\|/.test(code) || /\n/.test(code)) {
      orderImport(code, 'qr');
      return;
    }
    const h = findBarcodeHit(code);
    if (h) addToCart(h.p, 1, h.unit);
    else {
      beep(false);
      unknownBarcode(code);
    }
  };
  const msg = h => {
    $('#camMsg', m).innerHTML = h;
  };
  $('#camPhoto', m).onclick = () => $('#camFile', m).click();
  $('#camFile', m).onchange = async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    msg('<p class="muted">Membaca barcode…</p>');
    try {
      got(await decodeBarcodeImage(f));
    } catch (err) {
      msg(
        `<div class="banner" style="background:#fdecec;border-color:#f3b4b4;color:#7f1d1d">❌ ${esc(err.message)}</div>`
      );
    }
  };
  if (!live) return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    if (!document.body.contains(m)) {
      stream.getTracks().forEach(t => t.stop());
      return;
    }
    const v = $('#vid', m);
    v.srcObject = stream;
    await v.play();
    if ('BarcodeDetector' in window) {
      const det = new BarcodeDetector();
      const loop = async () => {
        if (!document.body.contains(m)) return;
        try {
          const r = await det.detect(v);
          if (r.length) {
            const ok = pilihKode(r.map(x => x.rawValue));
            if (ok) return got(ok);
            tolak(jenisKodeAsing(r[0].rawValue)); // hanya QR BPOM yang terlihat: terus mencari
          }
        } catch (e) {}
        requestAnimationFrame(loop);
      };
      loop();
    } else {
      const reader = zxReader(),
        readerGaris = zxReader(true);
      const cv = document.createElement('canvas');
      timer = setInterval(() => {
        if (!v.videoWidth) return;
        const w = v.videoWidth,
          h = v.videoHeight;
        const cw = Math.round(w * 0.8),
          ch = Math.round(h * 0.6);
        cv.width = cw;
        cv.height = ch;
        cv.getContext('2d').drawImage(v, (w - cw) / 2, (h - ch) / 2, cw, ch, 0, 0, cw, ch);
        const t = zxBacaUtama(cv, reader, readerGaris);
        if (t) {
          if (jenisKodeAsing(t)) return tolak(jenisKodeAsing(t));
          clearInterval(timer);
          got(t);
        }
      }, 300);
    }
  } catch (e) {
    $('#camLive', m).classList.add('hide');
    const n = e && e.name;
    msg(
      `<div class="banner">${n === 'NotAllowedError' || n === 'SecurityError' ? `Izin kamera <b>ditolak</b>. Cara mengizinkan di Chrome HP: ketuk ikon di kiri alamat (🔒 / ⓘ / ⚙) → <b>Izin</b> atau <b>Setelan situs</b> → <b>Kamera</b> → <b>Izinkan</b>, lalu buka lagi. Kalau tetap tidak bisa, cek juga Setelan HP → Aplikasi → Chrome → Izin → Kamera.` : n === 'NotFoundError' || n === 'OverconstrainedError' ? 'Kamera tidak ditemukan di perangkat ini.' : n === 'NotReadableError' ? 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi kamera lain lalu coba lagi.' : 'Kamera tidak bisa dibuka: ' + esc(e.message || n)}<br>Sementara itu, pakai <b>📸 Foto barcode</b>.</div>`
    );
  }
}
