/* ============ GLOBAL KEYS & START ============ */
document.addEventListener('keydown', e => {
  if (e.key === 'F2') {
    e.preventDefault();
    if (currentView !== 'kasir') go('kasir');
    focusScan();
  }
  if (e.key === 'F12' && currentView === 'kasir' && !$('.modal')) {
    e.preventDefault();
    openPay();
  }
  if (e.key === 'F8') {
    e.preventDefault();
    if (currentView !== 'kasir') go('kasir');
    if (!$('.modal')) layananDialog();
  }
  if (e.key === 'F9') {
    e.preventDefault();
    if (currentView !== 'kasir') go('kasir');
    toggleSuara();
  }
  if (e.key === 'F4' && !$('.modal')) {
    e.preventDefault();
    if (currentView !== 'kasir') go('kasir');
    historyDialog();
  }
  if (e.key === 'F1') {
    e.preventDefault();
    bantuanTombol();
  }
  if (e.key === 'F3') {
    e.preventDefault();
    if (currentView === 'kasir' && !$('.modal')) gantiHargaBerikut();
  }
  if (e.key === 'F10') {
    e.preventDefault();
    if (currentView === 'kasir' && !$('.modal')) kosongkanKeranjang();
  }
});
// Link pesanan ditempel di alamat tab kasir yang sedang terbuka
window.addEventListener('hashchange', () => {
  const m = location.hash.match(/^#pesan=([A-Za-z0-9_-]+)/);
  if (!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  terimaPesananLink('#pesan=' + m[1]);
});
window.addEventListener('beforeunload', e => {
  if (cart.items.length) {
    e.preventDefault();
    e.returnValue = '';
  }
});
(async () => {
  try {
    await loadAll();
  } catch (e) {
    document.body.innerHTML =
      '<div style="padding:30px;font-size:20px">Penyimpanan browser tidak bisa dibuka: ' +
      esc(e.message) +
      '<br>Pastikan bukan mode Incognito.</div>';
    return;
  }
  const notes = await runMigrations();
  await tikKasirOtomatis(true); // buka / tutup kasir otomatis sesuai jam toko
  setInterval(() => tikKasirOtomatis(false), 30e3);
  brand();
  go(settings().halamanAwal === 'beranda' ? 'beranda' : 'kasir');
  if (notes.length) showUpdateNotes(notes);
  await bukaPesananDariLink();
  setTimeout(autoPublishTick, 60e3);
  if (S.meta.backupHandle) {
    try {
      if ((await S.meta.backupHandle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
        S._needBackupPerm = true;
        if (!backupHarianAktif()) render();
      } else S._bkFileOk = true;
    } catch (e) {}
  }
  siapkanBackupHarian();
  setInterval(siapkanBackupHarian, 10 * 60e3); // hari berganti saat aplikasi tetap terbuka
  if ('serviceWorker' in navigator && location.protocol.startsWith('http'))
    navigator.serviceWorker.register('sw.js').catch(() => {});
})();
