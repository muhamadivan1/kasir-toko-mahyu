# 15 Nov 2026: buka & tutup kasir otomatis (05.00 / 21.00), backup harian tanpa klik, warna menu aktif & hover.
import os, asyncio, subprocess, time, json, copy
from playwright.async_api import async_playwright
SS=os.environ.get('KASIR_TES_DATA','tests/data/')
srv=subprocess.Popen(['python3','-m','http.server','8837','-d','dist'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
BK=json.load(open(SS+'bk2/backup.json'))
# data toko dengan otomatis dimatikan dulu, supaya uang sebelum & sesudah bisa dibandingkan
BK0=copy.deepcopy(BK)
for m in BK0['meta']:
    if m['id']=='settings': m['value'].setdefault('uang',{})['otomatis']=False
fails=[]
def cek(ok,msg):
    print(('OK   ' if ok else 'GAGAL ')+msg,flush=True)
    if not ok: fails.append(msg)
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    cx=await b.new_context(viewport={'width':1366,'height':860},timezone_id='Asia/Jakarta',accept_downloads=True)
    await cx.clock.install(time='2026-11-15T12:44:00+07:00')
    pg=await cx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    dl=[];pg.on('download',lambda d:dl.append(d))
    pg.set_default_timeout(10000)
    await pg.goto('http://localhost:8837/index.html');await pg.wait_for_timeout(700)
    async with pg.expect_navigation():
        await pg.evaluate("o=>restore(o)",BK0)
    await pg.wait_for_timeout(2500)
    await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove())")
    jam=await pg.evaluate("new Date().toTimeString()")
    cek(jam.startswith('12:4'),'jam tes: Minggu 15 Nov 12.44 WIB (%s)'%jam[:8])
    saldo="JSON.stringify(Object.fromEntries(kasAktif().map(k=>[k.id,Math.round(posisiUang(k.id).saldo)])))"
    s0=json.loads(await pg.evaluate(saldo))
    pt0=json.loads(await pg.evaluate("JSON.stringify(Object.fromEntries(kasAktif().map(k=>{const p=patokanUang(k.id);return [k.id,p?[p.e.jenis,new Date(p.waktu).toLocaleString('id-ID')]:null]})))"))
    print('  uang sebelum:',s0,'| catatan terakhir:',pt0)
    await pg.evaluate("go('kasir')");await pg.wait_for_timeout(300)
    cek(await pg.locator('#bukaNow').count()==1,'otomatis dimatikan: spanduk "Belum buka kasir" masih ada (cara lama)')
    # ===== nyalakan otomatis (bawaan versi baru)
    n0=await pg.evaluate("S.kas.length")
    await pg.evaluate("(async()=>{uangConf().otomatis=true;await saveMeta('settings');await tikKasirOtomatis(true);render()})()");await pg.wait_for_timeout(400)
    baru=json.loads(await pg.evaluate(f"JSON.stringify(S.kas.slice({n0}).map(e=>[e.jenis,e.kas,new Date(e.waktu).toLocaleString('id-ID'),e.jenis==='buka'?e.jumlah:e.sisa,!!e.otomatis]))"))
    for x in baru: print('   ',x)
    tut=[x for x in baru if x[0]=='tutup'];buk=[x for x in baru if x[0]=='buka']
    terbuka=[k for k,v in pt0.items() if v and v[0]=='buka']
    cek(len(tut)==len(terbuka) and all('21.00' in x[2] for x in tut),'laci yang terakhir masih terbuka (%s) ditutup otomatis pada jam 21.00 hari itu'%terbuka)
    cek(sorted(x[1] for x in buk)==sorted(s0.keys()) and all('15/11/2026' in x[2] and x[4] for x in buk),'hari ini semua laci dibuka otomatis (%d laci)'%len(buk))
    s1=json.loads(await pg.evaluate(saldo))
    cek(s1==s0,'uang seharusnya di laci tidak berubah oleh buka / tutup otomatis %s'%s1)
    cek(await pg.locator('#bukaNow').count()==0 and await pg.locator('#bkGrant').count()==0,'halaman Kasir: tidak ada spanduk "Belum buka kasir" dan "Aktifkan backup"')
    cek(await pg.evaluate("bukaHariIni()") and len(json.loads(await pg.evaluate("JSON.stringify(belumTutup())")))==len(s0),'status: sudah buka hari ini')
    n1=await pg.evaluate("S.kas.length")
    await pg.evaluate("tikKasirOtomatis(true)");await pg.wait_for_timeout(200)
    cek(await pg.evaluate("S.kas.length")==n1,'dijalankan lagi: tidak dobel')
    await pg.evaluate("go('beranda')");await pg.wait_for_timeout(500)
    att=await pg.evaluate("[...document.querySelectorAll('.att')].map(a=>a.innerText).join(' | ')")
    cek('Belum buka kasir' not in att and 'Belum tutup kasir' not in att,'Beranda: tidak ada pengingat buka / tutup kasir')
    await pg.evaluate("go('uang')");await pg.wait_for_timeout(500)
    cek('Buka kasir otomatis' in await pg.inner_text('#main'),'halaman Uang: tertulis "Buka kasir otomatis"')
    # ===== transaksi lalu jam 21.00: tutup otomatis saat aplikasi tetap terbuka
    await pg.evaluate("go('kasir')");await pg.wait_for_timeout(300)
    await pg.evaluate("()=>{window._cetak=[];printReceipt=s=>window._cetak.push(1)}")
    await pg.evaluate("addToCart(S.products.find(p=>p.nama==='GULA PUTIH CURAH 1 KG'),2)")
    tot=await pg.evaluate("cartTotal().total")
    await pg.keyboard.press('F12');await pg.wait_for_timeout(300);await pg.fill('#paid',str(tot));await pg.dispatch_event('#paid','input');await pg.keyboard.press('Enter');await pg.wait_for_timeout(500)
    await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove())")
    s2=json.loads(await pg.evaluate(saldo))
    cek(s2['warung']==s1['warung']+tot,'jual tunai %d: uang laci Warung bertambah'%tot)
    await cx.clock.fast_forward('08:16:30');await pg.wait_for_timeout(600)   # 21.00.30
    n2=await pg.evaluate("S.kas.length")
    t2=json.loads(await pg.evaluate("JSON.stringify(S.kas.filter(e=>e.jenis==='tutup'&&e.otomatis&&e.waktu>=dayStart(0)).map(e=>[e.kas,new Date(e.waktu).toLocaleTimeString('id-ID'),e.sisa,e.selisih]))"))
    print('   tutup 21.00:',t2)
    cek(len(t2)==len(s0) and all(x[1].startswith('21.00') and x[3]==0 for x in t2),'jam 21.00: semua laci ditutup otomatis, selisih 0')
    cek(dict((x[0],x[2]) for x in t2)==s2 and json.loads(await pg.evaluate(saldo))==s2,'uang tutup = uang menurut catatan, posisi uang tetap')
    cek(await pg.evaluate("belumTutup().length")==0,'status laci: sudah tutup')
    await cx.clock.fast_forward('00:30:00');await pg.wait_for_timeout(300)
    cek(await pg.evaluate("S.kas.length")==n2,'setelah jam tutup tidak dibuka lagi')
    # jual setelah jam tutup tetap bisa dan tetap tercatat
    await pg.evaluate("addToCart(S.products.find(p=>p.nama==='GULA PUTIH CURAH 1 KG'),1)")
    t1=await pg.evaluate("cartTotal().total")
    await pg.keyboard.press('F12');await pg.wait_for_timeout(300);await pg.fill('#paid',str(t1));await pg.dispatch_event('#paid','input');await pg.keyboard.press('Enter');await pg.wait_for_timeout(500)
    await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove())")
    s3=json.loads(await pg.evaluate(saldo))
    cek(s3['warung']==s2['warung']+t1,'jual setelah jam tutup: tetap bisa, uang laci ikut bertambah')
    # ===== besok pagi: sebelum 05.00 belum buka, 05.00 buka sendiri
    await cx.clock.fast_forward('07:00:00');await pg.wait_for_timeout(400)   # 04.31 Senin
    cek(not await pg.evaluate("bukaHariIni()"),'Senin 04.31: belum dibuka')
    await cx.clock.fast_forward('00:30:00');await pg.wait_for_timeout(500)   # 05.01
    b3=json.loads(await pg.evaluate("JSON.stringify(S.kas.filter(e=>e.jenis==='buka'&&e.waktu>=dayStart(0)).map(e=>[e.kas,e.jumlah]))"))
    cek(dict(b3)==s3,'Senin 05.01: dibuka otomatis, uang awal = uang kemarin malam %s'%dict(b3))
    cek('dibuka otomatis' in await pg.inner_text('#toast'),'ada pesan singkat "Kasir dibuka otomatis"')
    # ===== aplikasi tertutup dua hari, dibuka lagi siang
    await cx.clock.fast_forward('55:00:00')   # Rabu 12.01
    await pg.reload();await pg.wait_for_timeout(2000)
    await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove())")
    k=json.loads(await pg.evaluate("JSON.stringify(S.kas.filter(e=>e.kas==='warung'&&e.otomatis).slice(-3).map(e=>[e.jenis,new Date(e.waktu).toLocaleString('id-ID')]))"))
    print('   setelah libur:',k)
    cek(k[-2][0]=='tutup' and '16/11/2026' in k[-2][1] and '21.00' in k[-2][1] and k[-1][0]=='buka' and '18/11/2026' in k[-1][1],'dibuka lagi Rabu: Senin ditutup jam 21.00, Rabu dibuka otomatis')
    cek(json.loads(await pg.evaluate(saldo))==s3,'uang tetap sama setelah libur')
    # ===== pengaturan jam
    await pg.evaluate("go('pengaturan')");await pg.wait_for_timeout(300)
    await pg.evaluate("()=>{const b=[...document.querySelectorAll('.setnav button')].find(x=>/Uang/.test(x.textContent));b&&b.click()}");await pg.wait_for_timeout(300)
    cek(await pg.input_value('#uJb')=='05:00' and await pg.input_value('#uJt')=='21:00' and await pg.is_checked('#uO'),'Pengaturan → Uang: otomatis aktif, jam 05:00 dan 21:00')
    await pg.fill('#uJb','22:00');await pg.click('#uSave');await pg.wait_for_timeout(200)
    cek('Jam tutup harus' in await pg.inner_text('#toast'),'jam buka lebih malam dari jam tutup ditolak')
    await pg.fill('#uJb','06:30');await pg.click('#uSave');await pg.wait_for_timeout(300)
    cek(await pg.evaluate("uangConf().jamBuka")=='06:30','jam buka bisa diganti (06:30)')
    await pg.evaluate("(async()=>{uangConf().jamBuka='05:00';await saveMeta('settings')})()")
    # ===== backup harian tanpa klik
    await pg.evaluate("go('kasir')");await pg.wait_for_timeout(300)
    await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove())")
    await pg.wait_for_timeout(500)
    nama=[d.suggested_filename for d in dl]
    print('   unduhan otomatis sejauh ini:',nama)
    # Minggu: tombol pertama yang ditekan -> backup hari Minggu. Rabu: klik pertama -> backup hari Rabu.
    cek(nama==['backup-kasir-toko-mahyu-2026-11-15.json','backup-kasir-toko-mahyu-2026-11-18.json'],'backup terunduh sendiri: 1 file hari Minggu, 1 file hari Rabu, tanpa menekan tombol backup')
    path=await dl[-1].path();isi=json.load(open(path))
    cek(isi.get('app')=='kasir-toko-mahyu' and len(isi['products'])==len(BK['products']) and len(isi['sales'])==len(BK['sales'])+2,'isi backup lengkap (produk & penjualan terbaru)')
    cek(not any(m['id'] in ('backupHandle','aiKey','aiConf','ghConf','cadanganUpdate') for m in isi['meta']),'kunci rahasia tidak ikut di backup')
    cek(not await pg.evaluate("siapkanBackupHarian()"),'hari yang sama, tidak ada perubahan: tidak mengunduh lagi')
    await pg.evaluate("(async()=>{await save('customers',{id:'cZ',nama:'TES',tier:'umum',aktif:true,diubah:Date.now()+1000})})()")
    await cx.clock.fast_forward('00:00:10');await pg.wait_for_timeout(300)
    await pg.click('#scan');await pg.wait_for_timeout(400)
    cek(len(dl)==2,'ada perubahan di hari yang sama: tetap 1 file per hari')
    await cx.clock.fast_forward('19:05:00');await pg.wait_for_timeout(500)   # Kamis 07.06
    async with pg.expect_download() as di:
        await pg.click('#scan')
    d2=await di.value
    cek(d2.suggested_filename=='backup-kasir-toko-mahyu-2026-11-19.json','besoknya: sentuhan pertama mengunduh backup hari itu (%s)'%d2.suggested_filename)
    cek('folder Download' in await pg.inner_text('#toast'),'pesan: backup tersimpan di folder Download')
    # file pilihan yang belum diizinkan browser: tidak ada spanduk, backup harian yang jalan
    await pg.evaluate("()=>{S.meta.backupHandle={name:'backup.json',queryPermission:async()=>'prompt',requestPermission:async()=>'denied'};S._bkFileOk=false}")
    await pg.evaluate("autoBackup()");await pg.wait_for_timeout(200)
    await pg.evaluate("render()");await pg.wait_for_timeout(200)
    cek(await pg.locator('#bkGrant').count()==0 and await pg.evaluate("S._needBackupPerm")==True,'file pilihan belum diizinkan: tidak ada spanduk "Aktifkan backup"')
    await pg.evaluate("go('pengaturan')");await pg.wait_for_timeout(300)
    await pg.evaluate("()=>{const b=[...document.querySelectorAll('.setnav button')].find(x=>/Data|Backup/.test(x.textContent));b&&b.click()}");await pg.wait_for_timeout(300)
    cek(await pg.locator('#bkU').count()==1 and await pg.is_checked('#bkU') and await pg.locator('#bkIzin').count()==1,'Pengaturan → Data: backup harian aktif, ada tombol "Izinkan lagi" untuk file pilihan')
    await pg.uncheck('#bkU');await pg.wait_for_timeout(300)
    await pg.evaluate("go('kasir')");await pg.wait_for_timeout(300)
    cek(await pg.locator('#bkGrant').count()==1,'backup harian dimatikan: spanduk izin kembali seperti dulu')
    await pg.evaluate("(async()=>{settings().backupUnduh=true;delete S.meta.backupHandle;await saveMeta('settings');render()})()");await pg.wait_for_timeout(300)
    # ===== warna menu
    warna=lambda sel:pg.evaluate("s=>getComputedStyle(document.querySelector(s)).backgroundColor",sel)
    cek(await warna('nav button.on')=='rgb(255, 255, 255)' and await pg.evaluate("getComputedStyle(document.querySelector('nav button.on')).color")=='rgb(210, 34, 34)','menu yang sedang dibuka: latar putih, tulisan biru tua')
    await pg.hover('nav button[data-v=produk]');await pg.wait_for_timeout(150)
    cek(await warna('nav button[data-v=produk]')=='rgb(210, 34, 34)','menu yang ditunjuk mouse: merah')
    await pg.screenshot(path=SS+'w1_nav.png',clip={'x':0,'y':0,'width':1366,'height':330})
    await pg.hover('#payBtn');await pg.wait_for_timeout(150)
    cek('rgb(210, 34, 34)' in await pg.evaluate("getComputedStyle(document.querySelector('#payBtn')).boxShadow"),'tombol yang ditunjuk mouse: bingkai kuning')
    await pg.screenshot(path=SS+'w2_btn.png',clip={'x':960,'y':60,'width':406,'height':420})
    w=await pg.evaluate("[document.querySelector('nav').scrollWidth,document.querySelector('nav').clientWidth]")
    cek(w[0]<=w[1],'menu atas tidak meluap %s'%w)
    cek(not errs,'tidak ada error halaman %s'%errs[:3])
    await b.close()
asyncio.run(main())
srv.terminate()
print('\nGAGAL:',len(fails));[print(' -',f) for f in fails]
