# 4 Nov 2026: isi satuan yang benar (1 RCG minuman sachet = 10 PCS, SETENGAH = 5 PCS),
# pembetulan data lama yang terlanjur berdasar SETENGAH, dialog Tambah satuan baru, daftar satuan di keranjang.
import os, asyncio, subprocess, time, json
from playwright.async_api import async_playwright
SS=os.environ.get('KASIR_TES_DATA','tests/data/')
srv=subprocess.Popen(['python3','-m','http.server','8835','-d','dist'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
BK=json.load(open(SS+'bk/backup.json'))
fails=[]
def cek(ok,msg):
    print(('OK   ' if ok else 'GAGAL ')+msg,flush=True)
    if not ok: fails.append(msg)
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    pg=await b.new_page(viewport={'width':1366,'height':860});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.set_default_timeout(10000)
    await pg.goto('http://localhost:8835/index.html');await pg.wait_for_timeout(700)
    async with pg.expect_navigation():
        await pg.evaluate("o=>restore(o)",BK)
    await pg.wait_for_timeout(1800)
    notes=await pg.evaluate("[...document.querySelectorAll('.modal')].map(m=>m.innerText).join(' ')")
    cek('Pilihan satuan di keranjang' in notes,'catatan pembaruan: daftar satuan Ganti / Tambah')
    cek('Isi satuan' not in notes or 'dibetulkan' not in notes,'data toko 31 Okt: tidak ada barang yang diubah (tidak ada salah isi)')
    await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove())")
    await pg.click('nav button[data-v=kasir]');await pg.wait_for_timeout(300)
    await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove());S.meta.tundaBuka=dkey(Date.now());render()");await pg.wait_for_timeout(200)
    # ===== A. data salah seperti hasil dialog lama: SETENGAH ditambah sebagai satuan lebih KECIL dari PCS (1 PCS = 2 SETENGAH)
    await pg.evaluate("""(async()=>{
      const p={id:'kSalah',nama:'KOPI MIX TES 20 GR',kategori:'KOPI',satuan:'PCS',harga:{umum:2000,warung:1800},hargaBeli:1600,stok:50,minStok:5,aktif:true,barcode:'8990000000017',alias:'',
        units:[{nama:'RCG',isi:10,harga:{umum:17500,warung:17000},hargaBeli:16000,barcode:''}],unitScan:'PCS'};
      p.units.push({nama:'SETENGAH',isi:0.5,harga:{umum:9000},hargaBeli:0,barcode:''});
      rebaseToSmallest(p); await save('products',p);
      const t=Date.now();
      await save('sales',{id:'sk0',no:'T-K0',waktu:t-9e6,items:[{productId:'kSalah',nama:p.nama,satuan:'PCS',isi:1,dasar:'PCS',harga:2000,hargaBeli:1600,qty:3}],total:6000,bayar:6000,metode:'tunai'});
      await save('sales',{id:'sk1',no:'T-K1',waktu:t-5e6,items:[{productId:'kSalah',nama:p.nama,satuan:'PCS',isi:2,dasar:'SETENGAH',harga:2000,hargaBeli:1600,qty:1},
                                                            {productId:'kSalah',nama:p.nama,satuan:'RCG',isi:20,dasar:'SETENGAH',harga:17500,hargaBeli:16000,qty:1},
                                                            {productId:'kSalah',nama:p.nama,satuan:'SETENGAH',isi:1,dasar:'SETENGAH',harga:9000,hargaBeli:800,qty:2}],total:37500,bayar:37500,metode:'tunai'});
      await save('sales',{id:'sk2',no:'T-K2',waktu:t-4e6,batal:true,items:[{productId:'kSalah',nama:p.nama,satuan:'SETENGAH',isi:1,dasar:'SETENGAH',harga:9000,hargaBeli:800,qty:1}],total:9000,bayar:9000,metode:'tunai'});
      p.stok=100-2-20-2; await save('products',p);
      await save('moves',{id:'mk1',waktu:t-3e6,productId:'kSalah',nama:p.nama,jenis:'masuk',qty:20,sebelum:56,sesudah:76,catatan:''});
      S.meta.held=[...(S.meta.held||[]),{id:'hk',waktu:t,cart:{items:[{productId:'kSalah',nama:p.nama,satuan:'SETENGAH',isi:1,dasar:'SETENGAH',harga:9000,hargaBeli:800,qty:1}],tier:'umum'}}];
      await saveMeta('held');
      // minuman sachet dengan RCG isi 20 PCS (salah ketik), sudah pernah terjual 1 RCG
      const q={id:'kDua',nama:'MINUMAN SERBUK TES',kategori:'MINUMAN',satuan:'PCS',harga:{umum:1000},hargaBeli:800,stok:100,minStok:0,aktif:true,barcode:'',alias:'',units:[{nama:'RCG',isi:20,harga:{umum:9500},hargaBeli:0,barcode:''}]};
      await save('products',q);
      await save('sales',{id:'sk3',no:'T-K3',waktu:t-2e6,items:[{productId:'kDua',nama:q.nama,satuan:'RCG',isi:20,dasar:'PCS',harga:9500,hargaBeli:16000,qty:1}],total:9500,bayar:9500,metode:'tunai'});
      // bukan minuman: sampo sachet 1 RCG = 12 PCS, dan kental manis 1 RCG = 6 PCS -> tidak diubah
      await save('products',{id:'kSampo',nama:'SAMPO SACHET TES',kategori:'SAMPO & PERAWATAN RAMBUT',satuan:'PCS',harga:{umum:1000},stok:24,minStok:0,aktif:true,barcode:'',alias:'',units:[{nama:'RCG',isi:12,harga:{umum:11000},barcode:''}]});
      await save('products',{id:'kSkm',nama:'SUSU KENTAL MANIS SACHET TES',kategori:'SUSU',satuan:'PCS',harga:{umum:1500},stok:12,minStok:0,aktif:true,barcode:'',alias:'',units:[{nama:'RCG',isi:6,harga:{umum:8500},barcode:''}]});
    })()""")
    P="S.products.find(p=>p.id==='kSalah')"
    s0=json.loads(await pg.evaluate(f"JSON.stringify((p=>({{s:p.satuan,t:teksIsiSatuan(p),stok:p.stok}}))({P}))"))
    cek(s0['s']=='SETENGAH' and '1 RCG = 20 SETENGAH' in s0['t'] and '1 PCS = 2 SETENGAH' in s0['t'],'data salah tersusun seperti di toko: %s'%s0['t'])
    rk=await pg.evaluate("['kSalah','kDua','kSampo','kSkm'].map(id=>!!rencanaSatuan(S.products.find(p=>p.id===id)))")
    cek(rk==[True,True,False,False],'dikenali perlu dibetulkan: kopi (SETENGAH) & minuman (RCG 20), sampo & kental manis tidak %s'%rk)
    # jalankan pembaruan data (seperti saat aplikasi baru dibuka)
    await pg.evaluate("()=>{delete settings().migrasi.satuan4}")
    nt=await pg.evaluate("runMigrations().then(n=>n.join(' '))")
    cek('KOPI MIX TES 20 GR' in nt and 'MINUMAN SERBUK TES' in nt and 'SAMPO' not in nt,'catatan pembaruan menyebut barang yang dibetulkan')
    cek('sebelumnya 1 RCG = 20 SETENGAH' in nt,'catatan menulis hitungan sebelumnya')
    a=json.loads(await pg.evaluate(f"JSON.stringify((p=>({{s:p.satuan,u:p.units,h:p.harga,hb:p.hargaBeli,stok:p.stok,min:p.minStok,t:teksIsiSatuan(p),bc:p.barcode}}))({P}))"))
    print('  sesudah:',a['t'],'| stok',a['stok'],'| units',[(u['nama'],u['isi'],u['harga'],u['hargaBeli']) for u in a['u']])
    cek(a['s']=='PCS' and a['t']=='1 RCG = 10 PCS, 1 SETENGAH = 5 PCS','isi benar: 1 RCG = 10 PCS, 1 SETENGAH = 5 PCS')
    cek(a['h'].get('umum')==2000 and a['hb']==1600 and a['bc']=='8990000000017','harga & barcode per PCS kembali seperti semula')
    st=next(u for u in a['u'] if u['nama']=='SETENGAH');rc=next(u for u in a['u'] if u['nama']=='RCG')
    cek(st['harga'].get('umum')==9000 and rc['harga'].get('umum')==17500,'harga yang diketik sendiri tetap: SETENGAH 9.000, RCG 17.500')
    cek(await pg.evaluate(f"hbUnit({P},'SETENGAH')")==8000,'modal SETENGAH dihitung ulang: 5 x 1.600 = 8.000 (bukan 800)')
    # stok: 76 SETENGAH-lama = 38 PCS, lalu 2 SETENGAH yang dulu hanya mengurangi 1 PCS seharusnya 10 PCS -> 29
    cek(a['stok']==29 and a['min']==5,'stok dihitung ulang: 29 PCS (38 dikurangi kekurangan 9 dari penjualan SETENGAH)')
    it=json.loads(await pg.evaluate("JSON.stringify(S.sales.filter(s=>/^sk[0-2]$/.test(s.id)).flatMap(s=>s.items.map(i=>[s.id,i.satuan,i.isi,i.dasar])))"))
    cek(it==[['sk0','PCS',1,'PCS'],['sk1','PCS',1,'PCS'],['sk1','RCG',10,'PCS'],['sk1','SETENGAH',5,'PCS'],['sk2','SETENGAH',5,'PCS']],'riwayat penjualan memakai isi yang benar %s'%it)
    mv=json.loads(await pg.evaluate("JSON.stringify((m=>[m.qty,m.sebelum,m.sesudah])(S.moves.find(m=>m.id==='mk1')))"))
    cek(mv==[10,28,38],'riwayat stok diubah ke PCS %s'%mv)
    hk=json.loads(await pg.evaluate("JSON.stringify((S.meta.held.find(h=>h.id==='hk').cart.items[0]))"))
    cek(hk['isi']==5 and hk['dasar']=='PCS','keranjang tunda ikut: SETENGAH isi 5 PCS')
    d=json.loads(await pg.evaluate("JSON.stringify((q=>({u:q.units,stok:q.stok,t:teksIsiSatuan(q)}))(S.products.find(p=>p.id==='kDua')))"))
    cek(d['t']=='1 RCG = 10 PCS' and d['u'][0]['harga'].get('umum')==9500 and d['stok']==110,'minuman sachet: 1 RCG = 10 PCS, harga RCG tetap, stok +10 dari 1 RCG yang dulu dihitung 20')
    cek(await pg.evaluate("['kSampo','kSkm'].map(id=>teksIsiSatuan(S.products.find(p=>p.id===id))).join('|')")=='1 RCG = 12 PCS|1 RCG = 6 PCS','sampo (12) dan kental manis (6) tidak disentuh')
    cek(await pg.evaluate("!rencanaSatuan(S.products.find(p=>p.id==='kSalah')) && !rencanaSatuan(S.products.find(p=>p.id==='kDua'))"),'setelah dibetulkan tidak dianggap salah lagi')
    # batalkan penjualan 1 RCG setelah dibetulkan -> stok kembali 10 PCS
    await pg.evaluate("saleDetail(S.sales.find(s=>s.id==='sk3'))");await pg.wait_for_timeout(200)
    await pg.click('.modal #void');await pg.wait_for_timeout(150);await pg.click('.modal [data-yes]');await pg.wait_for_timeout(400)
    cek(await pg.evaluate("S.products.find(p=>p.id==='kDua').stok")==120,'batal 1 RCG mengembalikan 10 PCS (bukan 20): 110 jadi 120')
    await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove());go('kasir')");await pg.wait_for_timeout(300)
    # ===== B. daftar satuan di keranjang
    await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove());resetCart();render()");await pg.wait_for_timeout(150)
    await pg.evaluate(f"addToCart({P},1,'SETENGAH')");await pg.wait_for_timeout(150)
    op=await pg.evaluate("[...document.querySelectorAll('#cart select.unitsel option')].map(o=>(o.disabled?'-':o.value)+'='+o.textContent)")
    print('  pilihan:',op)
    cek(op[0]=='PCS=PCS' and op[1]=='SETENGAH=SETENGAH (isi 5 PCS)' and op[2]=='RCG=RCG (isi 10 PCS)','pilihan satuan: PCS, SETENGAH (isi 5 PCS), RCG (isi 10 PCS)')
    cek(op[-2].startswith('__ganti=✏️ Ganti satuan SETENGAH') and op[-1].startswith('__add=➕ Tambah satuan'),'dua pilihan di bawah: ✏️ Ganti dan ➕ Tambah')
    cek(await pg.evaluate("cart.items[0].harga")==9000 and await pg.evaluate("cart.items[0].isi")==5,'1 SETENGAH: harga 9.000, mengurangi stok 5 PCS')
    await pg.select_option('#cart select.unitsel','__add');await pg.wait_for_timeout(250)
    cek(await pg.locator('.modal #qn').count()==1 and await pg.input_value('#cart select.unitsel')=='SETENGAH','➕ Tambah membuka jendela tambah satuan, pilihan di keranjang kembali')
    await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.close())");await pg.wait_for_timeout(100)
    await pg.select_option('#cart select.unitsel','__ganti');await pg.wait_for_timeout(250)
    cek(await pg.locator('.modal .satpick').count()==1,'✏️ Ganti membuka jendela ganti satuan')
    await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.close())");await pg.wait_for_timeout(100)
    # ===== C. dialog Tambah satuan yang baru
    await pg.evaluate("(async()=>{await save('products',{id:'kTiga',nama:'KOPI SUSU TES',kategori:'KOPI',satuan:'PCS',harga:{umum:1500,warung:1400},hargaBeli:1200,stok:40,minStok:0,aktif:true,barcode:'',alias:'',units:[]})})()")
    K3="S.products.find(p=>p.id==='kTiga')"
    await pg.evaluate(f"quickUnitDialog({K3},()=>{{}})");await pg.wait_for_timeout(250)
    cek(await pg.input_value('#qn')=='RCG' and await pg.input_value('#qd')=='besar' and await pg.input_value('#qi')=='10' and await pg.input_value('#qr')=='PCS','RCG untuk kopi sachet: langsung terisi 1 RCG = 10 PCS')
    cek('1 RCG = 10 PCS' in await pg.inner_text('#qarti'),'tertulis "Artinya: 1 RCG = 10 PCS"')
    cek('15.000' in await pg.get_attribute('[data-qt=umum]','placeholder'),'harga RCG kosong = otomatis 15.000')
    await pg.click('#qok');await pg.wait_for_timeout(300)
    u3=json.loads(await pg.evaluate(f"JSON.stringify({K3}.units)"))
    cek(len(u3)==1 and u3[0]['nama']=='RCG' and u3[0]['isi']==10 and u3[0]['harga']['umum']==15000,'RCG tersimpan isi 10, harga 15.000')
    await pg.evaluate(f"quickUnitDialog({K3},()=>{{}})");await pg.wait_for_timeout(250)
    await pg.select_option('#qn','SETENGAH');await pg.wait_for_timeout(100)
    cek(await pg.input_value('#qd')=='kecil' and await pg.input_value('#qr')=='RCG' and await pg.input_value('#qi')=='2','SETENGAH: langsung terisi 1 RCG = 2 SETENGAH')
    ar=await pg.inner_text('#qarti')
    cek('1 SETENGAH = 5 PCS' in ar and '1 RCG = 2 SETENGAH' in ar,'tertulis "Artinya: 1 SETENGAH = 5 PCS", 1 RCG = 2 SETENGAH')
    # cara yang dulu salah: 1 PCS = 2 SETENGAH -> diperingatkan dan ditanya
    await pg.select_option('#qr','PCS');await pg.wait_for_timeout(100)
    ar=await pg.inner_text('#qarti')
    cek('1 PCS = 2 SETENGAH' in ar and 'seharusnya 5 PCS' in ar,'kalau diisi 1 PCS = 2 SETENGAH: muncul peringatan "seharusnya 5 PCS"')
    await pg.fill('[data-qt=umum]','8000');await pg.click('#qok');await pg.wait_for_timeout(250)
    cek('seharusnya 5 PCS' in await pg.evaluate("[...document.querySelectorAll('.modal')].map(m=>m.innerText).join(' ')"),'disimpan: ditanya dulu (setengah renceng seharusnya 5 PCS)')
    await pg.click('.modal [data-no]');await pg.wait_for_timeout(150)
    cek(len(json.loads(await pg.evaluate(f"JSON.stringify({K3}.units)")))==1,'pilih Tidak: belum tersimpan')
    await pg.select_option('#qr','RCG');await pg.fill('#qi','2');await pg.dispatch_event('#qi','input');await pg.click('#qok');await pg.wait_for_timeout(300)
    cek(await pg.evaluate(f"teksIsiSatuan({K3})")=='1 RCG = 10 PCS, 1 SETENGAH = 5 PCS' and await pg.evaluate(f"{K3}.satuan")=='PCS','SETENGAH tersimpan isi 5 PCS, satuan dasar tetap PCS')
    cek(await pg.evaluate(f"priceUnit({K3},'SETENGAH','umum')")==8000,'harga SETENGAH 8.000 seperti diketik')
    # isi sama dengan satuan yang sudah ada ditolak
    await pg.evaluate(f"quickUnitDialog({K3},()=>{{}})");await pg.wait_for_timeout(250)
    await pg.select_option('#qn','PACK');await pg.select_option('#qd','besar');await pg.select_option('#qr','PCS');await pg.fill('#qi','10');await pg.dispatch_event('#qi','input')
    cek('sama dengan RCG' in await pg.inner_text('#qarti'),'isi sama dengan RCG: diperingatkan')
    await pg.click('#qok');await pg.wait_for_timeout(200)
    cek('sama dengan RCG' in await pg.inner_text('#toast') and len(json.loads(await pg.evaluate(f"JSON.stringify({K3}.units)")))==2,'isi sama dengan RCG ditolak')
    await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.close())")
    # ===== D. pesanan "setengah renceng" -> 1 SETENGAH
    r=json.loads(await pg.evaluate(f"JSON.stringify(pakaiSetengah({{pid:'kTiga',qty:0.5,unitSel:'RCG',teks:'kopi susu tes'}}))"))
    cek(r['qty']==1 and r['unitSel']=='SETENGAH','pesanan setengah renceng jadi 1 SETENGAH (harga setengah)')
    bd=json.loads(await pg.evaluate("JSON.stringify(BacaDaftar.baca('setengah renceng kopi susu tes').baris.map(b=>[b.qty,b.unit]))"))
    cek(bd==[[0.5,'RCG']],'tulisan "setengah renceng" terbaca 0,5 RCG %s'%bd)
    # ===== E. halaman produk: filter & tombol betulkan
    await pg.evaluate("(async()=>{const p={id:'kEmpat',nama:'KOPI LAIN TES',kategori:'KOPI',satuan:'PCS',harga:{umum:1500},hargaBeli:1200,stok:20,minStok:0,aktif:true,barcode:'',alias:'',units:[{nama:'RCG',isi:10,harga:{umum:14000},barcode:''},{nama:'SETENGAH',isi:2,harga:{umum:7000},barcode:''}]};await save('products',p)})()")
    await pg.evaluate("prodFilter.b='isisat';go('produk')");await pg.wait_for_timeout(500)
    cek(await pg.locator('[data-fixu=kEmpat]').count()==1,'Produk: filter "Isi satuan belum benar" menampilkan barang yang salah')
    await pg.click('[data-fixu=kEmpat]');await pg.wait_for_timeout(200)
    bx=await pg.inner_text('.modal .box')
    cek('1 SETENGAH = 2 PCS' in bx and '1 SETENGAH = 5 PCS' in bx,'jendela Betulkan: sekarang 2 PCS, seharusnya 5 PCS')
    await pg.click('#bsOk');await pg.wait_for_timeout(300)
    cek(await pg.evaluate("teksIsiSatuan(S.products.find(p=>p.id==='kEmpat'))")=='1 RCG = 10 PCS, 1 SETENGAH = 5 PCS','dibetulkan dari halaman Produk')
    # form produk: SETENGAH diisi salah -> ditawari dibetulkan setelah simpan
    await pg.evaluate("prodFilter.b='';editProduct(S.products.find(p=>p.id==='kEmpat'))");await pg.wait_for_timeout(300)
    await pg.evaluate("()=>{const r=[...document.querySelectorAll('.modal .urow')].find(x=>x.querySelector('[data-un]').value==='SETENGAH');r.querySelector('[data-ui]').value='3'}")
    await pg.click('#fsave');await pg.wait_for_timeout(400)
    cek(await pg.locator('#bsOk').count()==1,'form produk: SETENGAH diisi 3 PCS -> langsung ditawari dibetulkan')
    await pg.click('#bsOk');await pg.wait_for_timeout(300)
    cek(await pg.evaluate("teksIsiSatuan(S.products.find(p=>p.id==='kEmpat'))")=='1 RCG = 10 PCS, 1 SETENGAH = 5 PCS','setelah Betulkan: 5 PCS')
    cek(not errs,'tidak ada error halaman %s'%errs[:3])
    await b.close()
asyncio.run(main())
srv.terminate()
print('\nGAGAL:',len(fails));[print(' -',f) for f in fails]
