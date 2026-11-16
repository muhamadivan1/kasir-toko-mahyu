/* ============ DATABASE (IndexedDB, write-through) ============ */
/* versi 2 (22 Okt 2026): tambah store 'kas' untuk catatan uang (buka/tutup kasir, pengeluaran, pindah uang) */
const STORES = ['products', 'customers', 'sales', 'moves', 'payments', 'kas', 'meta'];
const DB_VERSI = 2;
const DB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('kasir_toko_mahyu', DB_VERSI);
      r.onupgradeneeded = () => {
        const d = r.result;
        STORES.forEach(s => {
          if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' });
        });
      };
      // tab kasir versi lama masih terbuka: pembaruan database menunggu tab itu ditutup
      r.onblocked = () => {
        if ($('#dbTunggu')) return;
        document.body.insertAdjacentHTML(
          'afterbegin',
          '<div id="dbTunggu" class="banner" style="margin:12px;font-size:18px">⏳ Ada tab <b>Kasir Toko Mahyu</b> lain yang masih terbuka. Tutup tab itu dulu, halaman ini akan lanjut sendiri.</div>'
        );
      };
      r.onsuccess = () => {
        this.db = r.result;
        const t = $('#dbTunggu');
        t && t.remove();
        // kalau nanti ada versi baru dibuka di tab lain, tab ini mengalah supaya pembaruan bisa jalan
        this.db.onversionchange = () => {
          this.db.close();
          toast('Aplikasi diperbarui di tab lain. Halaman dimuat ulang…');
          setTimeout(() => location.reload(), 1500);
        };
        res();
      };
      r.onerror = () => rej(r.error);
    });
  },
  tx(store, mode, fn) {
    return new Promise((res, rej) => {
      const t = this.db.transaction(store, mode);
      const st = t.objectStore(store);
      const out = fn(st);
      t.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  },
  all(s) {
    return this.tx(s, 'readonly', st => st.getAll());
  },
  put(s, o) {
    return this.tx(s, 'readwrite', st => {
      st.put(o);
    });
  },
  putMany(s, arr) {
    return this.tx(s, 'readwrite', st => {
      arr.forEach(o => st.put(o));
    });
  },
  del(s, id) {
    return this.tx(s, 'readwrite', st => {
      st.delete(id);
    });
  },
  clear(s) {
    return this.tx(s, 'readwrite', st => {
      st.clear();
    });
  }
};
const S = { products: [], customers: [], sales: [], moves: [], payments: [], kas: [], meta: {} };
const DEF_SETTINGS = {
  nama: 'TOKO MAHYU',
  alamat: 'Dusun Cikadu RT01 RW02, Desa Cikadu, Situraja',
  telp: '',
  footer: 'Terima kasih atas kunjungan Anda',
  lebarStruk: 72,
  barcodeSeq: 1,
  labelMode: 'thermal',
  labelW: 50,
  labelH: 30,
  kasir: '',
  halamanAwal: 'kasir'
};
const DEF_TIERS = [
  { id: 'umum', nama: 'Umum / Perorangan' },
  { id: 'warung', nama: 'Warung' }
];
/** Objek pengaturan bertingkat dengan nilai bawaan. Objeknya tetap sama (tidak diganti), jadi aman diubah langsung. */
function withDefaults(parent, key, def) {
  if (!parent[key] || typeof parent[key] !== 'object') parent[key] = {};
  const o = parent[key];
  for (const k of Object.keys(def))
    if (o[k] === undefined) o[k] = Array.isArray(def[k]) ? def[k].slice() : def[k];
  return o;
}
function settings() {
  return S.meta.settings;
}
function tiers() {
  return S.meta.tiers;
}
async function saveMeta(id) {
  await DB.put('meta', { id, value: S.meta[id] });
  markDirty();
}
async function save(store, obj) {
  if (store === 'products') {
    isiHargaWarungKosong(obj);
    isiHargaBeliKosong(obj);
  }
  const arr = S[store];
  const i = arr.findIndex(x => x.id === obj.id);
  if (i < 0) arr.push(obj);
  else arr[i] = obj;
  await DB.put(store, obj);
  markDirty();
}
async function remove(store, id) {
  S[store] = S[store].filter(x => x.id !== id);
  await DB.del(store, id);
  markDirty();
}
async function loadAll() {
  await DB.open();
  for (const s of STORES) {
    const rows = await DB.all(s);
    if (s === 'meta') {
      rows.forEach(r => (S.meta[r.id] = r.value));
    } else S[s] = rows;
  }
  if (!S.meta.settings) {
    S.meta.settings = { ...DEF_SETTINGS };
    await saveMeta('settings');
  }
  S.meta.settings = { ...DEF_SETTINGS, ...S.meta.settings };
  if (!S.meta.tiers) {
    S.meta.tiers = DEF_TIERS.slice();
    await saveMeta('tiers');
  }
  if (!S.meta.saleSeq) {
    S.meta.saleSeq = {};
  }
  {
    const st = S.meta.settings;
    let ch = false;
    for (const c of S.customers) {
      if (!c.kode) {
        let k;
        do {
          st.memberSeq = (Number(st.memberSeq) || 0) + 1;
          k = 'M' + String(st.memberSeq).padStart(4, '0');
        } while (S.customers.some(x => x.kode === k));
        c.kode = k;
        await DB.put('customers', c);
        ch = true;
      }
    }
    if (ch) await saveMeta('settings');
  }
  S.sales.sort((a, b) => a.waktu - b.waktu);
  S.kas.sort((a, b) => a.waktu - b.waktu);
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  } catch (e) {}
}
/** Data meta yang hanya untuk perangkat ini (rahasia / tidak bisa dipindah), tidak ikut backup */
const PRIVATE_META = ['backupHandle', 'aiKey', 'aiConf', 'ghConf', 'cadanganUpdate'];
function snapshot() {
  const o = { app: 'kasir-toko-mahyu', versi: 1, dibuat: new Date().toISOString() };
  STORES.forEach(s => {
    o[s] =
      s === 'meta'
        ? Object.entries(S.meta)
            .filter(([k]) => !PRIVATE_META.includes(k))
            .map(([id, value]) => ({ id, value }))
        : S[s];
  });
  return o;
}
async function restore(o) {
  if (!o || o.app !== 'kasir-toko-mahyu') throw new Error('File ini bukan backup Kasir Toko Mahyu');
  for (const s of STORES) {
    await DB.clear(s);
    const rows = (o[s] || []).filter(r => s !== 'meta' || !PRIVATE_META.includes(r.id));
    if (rows.length) await DB.putMany(s, rows);
  }
  for (const k of PRIVATE_META) if (S.meta[k]) await DB.put('meta', { id: k, value: S.meta[k] });
  location.reload();
}

/* ============ BACKUP ============ */
let dirtyTimer = null;
function markDirty() {
  S.meta._dirty = true;
  S.versiData = (S.versiData || 0) + 1; // penanda ada data berubah (untuk hitungan yang disimpan sementara)
  clearTimeout(dirtyTimer);
  dirtyTimer = setTimeout(autoBackup, 4000);
}
async function autoBackup() {
  const h = S.meta.backupHandle;
  if (!h) return siapkanBackupHarian();
  try {
    if ((await h.queryPermission({ mode: 'readwrite' })) !== 'granted') {
      showBackupBanner();
      return;
    }
    const w = await h.createWritable();
    await w.write(JSON.stringify(snapshot()));
    await w.close();
    S._bkFileOk = true;
    S.meta.lastBackup = Date.now();
    DB.put('meta', { id: 'lastBackup', value: S.meta.lastBackup });
  } catch (e) {
    console.warn(e);
    showBackupBanner();
  }
}
/* ---- Backup harian otomatis ke folder Download ----
 * Browser tidak mengizinkan aplikasi menulis ke file pilihan tanpa izin, dan izin itu bisa diminta lagi
 * setiap browser dibuka ulang. Supaya tidak perlu klik apa pun, kalau file pilihan belum berizin (atau belum
 * dipilih), backup diunduh sendiri ke folder Download: sekali sehari, dan hanya kalau ada data yang berubah
 * sejak backup terakhir. Unduhan dijalankan pada sentuhan / ketikan pertama (browser hanya mengizinkan
 * unduhan beruntun kalau dipicu pengguna). */
const backupHarianAktif = () => settings().backupUnduh !== false;
let _bkSiap = false;
function dataBerubahSejak(t) {
  return (
    S.sales.some(s => s.waktu > t) ||
    S.kas.some(e => !e.otomatis && e.waktu > t) ||
    S.payments.some(e => e.waktu > t) ||
    S.products.some(p => (p.diubah || 0) > t) ||
    S.customers.some(c => (c.diubah || c.ditagih || 0) > t)
  );
}
/** Tandai backup harian perlu dibuat: belum ada backup hari ini dan ada data yang berubah */
function siapkanBackupHarian() {
  if (!backupHarianAktif() || S._bkFileOk || !S.products.length) return false;
  const lb = S.meta.lastBackup || 0;
  _bkSiap = dkey(lb) !== dkey(Date.now()) && dataBerubahSejak(lb);
  return _bkSiap;
}
function jalankanBackupHarian() {
  if (!_bkSiap) return;
  _bkSiap = false;
  if (!backupHarianAktif() || S._bkFileOk) return;
  try {
    downloadBackup('💾 Backup otomatis hari ini tersimpan di folder Download');
  } catch (e) {
    console.warn(e);
  }
}
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, jalankanBackupHarian, true));
async function pickBackupFile() {
  if (!window.showSaveFilePicker) {
    toast('Browser ini belum mendukung backup otomatis. Pakai tombol Unduh Backup.', true);
    return;
  }
  try {
    const h = await window.showSaveFilePicker({
      suggestedName: 'backup-kasir-toko-mahyu.json',
      types: [{ description: 'Backup Kasir', accept: { 'application/json': ['.json'] } }]
    });
    S.meta.backupHandle = h;
    await DB.put('meta', { id: 'backupHandle', value: h });
    await autoBackup();
    toast('Backup otomatis aktif ✔');
    render();
  } catch (e) {}
}
function downloadBackup(pesan) {
  const b = new Blob([JSON.stringify(snapshot())], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = 'backup-kasir-toko-mahyu-' + dkey(Date.now()) + '.json';
  a.click();
  S.meta.lastBackup = Date.now();
  DB.put('meta', { id: 'lastBackup', value: S.meta.lastBackup });
  toast(pesan || 'Backup diunduh ✔');
}
function showBackupBanner() {
  S._bkFileOk = false;
  const baru = !S._needBackupPerm;
  S._needBackupPerm = true;
  // dengan backup harian otomatis tidak perlu spanduk izin: backup tetap jalan ke folder Download
  if (siapkanBackupHarian() || backupHarianAktif()) return;
  if (baru && currentView === 'kasir') render();
}
async function regrantBackup() {
  const h = S.meta.backupHandle;
  if (!h) return;
  try {
    if ((await h.requestPermission({ mode: 'readwrite' })) === 'granted') {
      S._needBackupPerm = false;
      S._bkFileOk = true;
      await autoBackup();
      toast('Backup otomatis aktif lagi ✔');
      render();
    }
  } catch (e) {}
}
