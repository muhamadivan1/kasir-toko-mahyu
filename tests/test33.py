# 3 Nov 2026: ganti satuan dari keranjang (PCS -> RCG tanpa konversi) dan tolak QR BPOM saat scan.
import os, asyncio, subprocess, time, json
from playwright.async_api import async_playwright
SS=os.environ.get('KASIR_TES_DATA','tests/data/')
srv=subprocess.Popen(['python3','-m','http.server','8834','-d','dist'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
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
    await pg.goto('http://localhost:8834/index.html');await pg.wait_for_timeout(700)
    async with pg.expect_navigation():
        await pg.evaluate("o=>restore(o)",BK)
    await pg.wait_for_timeout(1800)
    notes=await pg.evaluate("[...document.querySelectorAll('.modal')].map(m=>m.innerText).join(' ')")
    cek('Satuan salah pilih' in notes and 'QR BPOM' in notes,'catatan pembaruan menjelaskan ganti satuan & QR BPOM')
    await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove())")
    await pg.click('nav button[data-v=kasir]');await pg.wait_for_timeout(300)
    await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove());S.meta.tundaBuka=dkey(Date.now());render()");await pg.wait_for_timeout(200)
    nmodal="document.querySelectorAll('.modal').length"
    # ================= A. GANTI SATUAN =================
    pid=await pg.evaluate("""(()=>{const ids=new Set(S.sales.flatMap(s=>(s.items||[]).filter(i=>i.dasar==='PCS'&&!i.layanan).map(i=>i.productId)));
      const p=S.products.find(p=>p.aktif!==false&&!(p.units||[]).length&&p.satuan==='PCS'&&ids.has(p.id)&&/[A-Z] PCS$/.test(p.nama));return p&&p.id})()""")
    cek(bool(pid),'ada barang satu satuan PCS yang pernah terjual')
    P=f"S.products.find(p=>p.id==='{pid}')"
    a0=json.loads(await pg.evaluate(f"JSON.stringify((p=>({{nama:p.nama,harga:p.harga,stok:p.stok,n:S.sales.reduce((a,s)=>a+(s.items||[]).filter(i=>i.productId===p.id).length,0)}}))({P}))"))
    print('  barang:',a0['nama'],'riwayat',a0['n'])
    await pg.evaluate(f"addToCart({P},2)");await pg.wait_for_timeout(150)
    o1=await pg.evaluate("[...document.querySelectorAll('#cart select.unitsel option')].map(o=>o.value)")
    cek(o1[0]=='PCS' and '__ganti' in o1 and '__add' in o1,'barang satu satuan: daftar satuan berisi PCS, Ganti, Tambah %s'%o1)
    await pg.select_option('#cart select.unitsel','__ganti');await pg.wait_for_timeout(200)
    cek(await pg.locator('.modal .satpick').count()==1,'jendela Ganti satuan terbuka')
    cek(await pg.locator('.modal .satpick [data-sl=PCS]').count()==0,'satuan yang sedang dipakai tidak ditawarkan')
    cek(await pg.is_checked('#gsNama'),'nama berakhiran PCS: "ganti juga di nama" tercentang')
    await pg.click('.modal [data-sl=RCG]');await pg.wait_for_timeout(100)
    pv=await pg.inner_text('#gsPrev')
    cek('RCG' in pv and 'per RCG' in pv,'pratinjau: harga per RCG, stok dalam RCG (%s)'%pv.replace('\n',' / '))
    await pg.click('#gsOk');await pg.wait_for_timeout(400)
    a1=json.loads(await pg.evaluate(f"JSON.stringify((p=>({{nama:p.nama,satuan:p.satuan,harga:p.harga,stok:p.stok,units:p.units||[]}}))({P}))"))
    cek(a1['satuan']=='RCG' and a1['units']==[],'satuan barang sekarang RCG, tanpa satuan tambahan')
    cek(a1['nama']==a0['nama'][:-3]+'RCG','nama ikut berganti: %s'%a1['nama'])
    cek(a1['harga']==a0['harga'] and a1['stok']==a0['stok'],'harga dan stok tidak berubah')
    it=json.loads(await pg.evaluate("JSON.stringify(cart.items[0])"))
    cek(it['satuan']=='RCG' and it['dasar']=='RCG' and it['qty']==2 and it['nama']==a1['nama'],'keranjang ikut: 2 RCG, nama baru')
    cek(await pg.input_value('#cart select.unitsel')=='RCG','daftar satuan di keranjang sekarang RCG')
    h=json.loads(await pg.evaluate(f"JSON.stringify(S.sales.flatMap(s=>(s.items||[]).filter(i=>i.productId==='{pid}')).map(i=>[i.satuan,i.dasar||'']))"))
    cek(len(h)==a0['n'] and all(x[0]=='RCG' and x[1] in ('RCG','') for x in h),'riwayat penjualan ikut memakai RCG (%d baris)'%len(h))
    cek('Satuan diganti' in await pg.inner_text('#toast'),'pesan: Satuan diganti PCS → RCG')
    # tersimpan ke database (muat ulang)
    await pg.reload();await pg.wait_for_timeout(1500)
    await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove())")
    r=json.loads(await pg.evaluate(f"JSON.stringify((p=>[p.satuan,p.nama])({P}))"))
    hs=json.loads(await pg.evaluate(f"JSON.stringify(S.sales.flatMap(s=>(s.items||[]).filter(i=>i.productId==='{pid}')).map(i=>i.satuan))"))
    cek(r[0]=='RCG' and all(x=='RCG' for x in hs),'setelah dibuka ulang tetap RCG (produk & riwayat)')
    await pg.click('nav button[data-v=kasir]');await pg.wait_for_timeout(300)
    await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove());resetCart();render()");await pg.wait_for_timeout(200)
    # --- saran dari nama: "KOPI TEST MIX RCG" satuan PCS
    await pg.evaluate("(async()=>{await save('products',{id:'tKopi',nama:'KOPI TEST MIX RCG',satuan:'PCS',harga:{umum:1500,warung:1500},hargaBeli:1200,stok:10,minStok:0,aktif:true,barcode:'',alias:'',kategori:'KOPI',units:[]})})()")
    await pg.evaluate("addToCart(S.products.find(p=>p.id==='tKopi'),1)");await pg.wait_for_timeout(150)
    await pg.select_option('#cart select.unitsel','__ganti');await pg.wait_for_timeout(200)
    cek('Di nama barang tertulis RCG' in await pg.inner_text('.modal .satsaran'),'saran: di nama barang tertulis RCG')
    cek(await pg.evaluate("document.querySelector('.modal [data-sl=RCG]').classList.contains('on')"),'tombol RCG sudah terpilih')
    cek(await pg.locator('#gsNama').count()==0,'nama tidak berakhiran PCS: tidak ada centang ganti nama')
    await pg.keyboard.press('Enter');await pg.wait_for_timeout(400)
    cek(await pg.evaluate("S.products.find(p=>p.id==='tKopi').satuan")=='RCG' and await pg.evaluate(nmodal)==0,'cukup tekan Enter: satuan jadi RCG')
    # --- ukuran di nama ("MC 6 PCS"): centang ganti nama tidak otomatis
    await pg.evaluate("(async()=>{await save('products',{id:'tMir',nama:'MIRANDA TEST MC 6 PCS',satuan:'PCS',harga:{umum:5000},stok:3,minStok:0,aktif:true,barcode:'',alias:'',kategori:'',units:[]})})()")
    await pg.evaluate("gantiSatuanDialog(S.products.find(p=>p.id==='tMir'),'PCS')");await pg.wait_for_timeout(200)
    cek(await pg.locator('#gsNama').count()==1 and not await pg.is_checked('#gsNama'),'"MC 6 PCS" (ukuran): ganti nama tidak dicentang otomatis')
    await pg.click('.modal [data-sl=PACK]');await pg.click('#gsOk');await pg.wait_for_timeout(300)
    cek(await pg.evaluate("(p=>p.satuan+'|'+p.nama)(S.products.find(p=>p.id==='tMir'))")=='PACK|MIRANDA TEST MC 6 PCS','satuan PACK, nama tetap')
    # --- satuan Lainnya diketik
    await pg.evaluate("gantiSatuanDialog(S.products.find(p=>p.id==='tMir'),'PACK')");await pg.wait_for_timeout(200)
    await pg.click('.modal [data-sl=__lain]');await pg.fill('#gsLain','toples');await pg.wait_for_timeout(50)
    cek('TOPLES' in await pg.inner_text('#gsPrev'),'satuan ketik sendiri tampil besar (TOPLES)')
    await pg.click('#gsOk');await pg.wait_for_timeout(300)
    cek(await pg.evaluate("S.products.find(p=>p.id==='tMir').satuan")=='TOPLES','satuan ketik sendiri tersimpan')
    # --- barang banyak satuan: LIFEBUOY PCS + PACK isi 4
    L="S.products.find(p=>p.nama==='LIFEBUOY')"
    l0=json.loads(await pg.evaluate(f"JSON.stringify((p=>({{s:p.satuan,u:p.units,us:p.unitScan,sa:p.satuanAwal}}))({L}))"))
    print('  lifebuoy:',l0)
    await pg.evaluate("resetCart();render()");await pg.wait_for_timeout(150)
    await pg.evaluate(f"addToCart({L},1,'PACK')");await pg.wait_for_timeout(150)
    opts=await pg.evaluate("[...document.querySelectorAll('#cart select.unitsel option')].map(o=>o.value+'='+o.textContent)")
    cek(any(o.startswith('__ganti=') and 'PACK' in o for o in opts) and any(o.startswith('__add=') for o in opts),'banyak satuan: pilihan "Ganti satuan PACK" dan "Tambah satuan"')
    harga0=await pg.evaluate("cart.items[0].harga")
    await pg.select_option('#cart select.unitsel','__ganti');await pg.wait_for_timeout(250)
    cek(await pg.inner_text('.modal .satlama')=='PACK','jendela mengganti satuan yang sedang dipilih (PACK)')
    await pg.click('.modal [data-sl=__lain]');await pg.fill('#gsLain','PAK');await pg.click('#gsOk');await pg.wait_for_timeout(300)
    l1=json.loads(await pg.evaluate(f"JSON.stringify((p=>({{s:p.satuan,u:p.units,us:p.unitScan,sa:p.satuanAwal}}))({L}))"))
    cek(l1['s']=='PCS' and l1['u'][0]['nama']=='PAK' and l1['u'][0]['isi']==4,'PACK jadi PAK, isi tetap 4 PCS')
    cek(l1['us']==('PAK' if l0['us']=='PACK' else l0['us']) and l1['sa']==('PAK' if l0['sa']=='PACK' else l0['sa']),'satuan scan & satuan awal ikut berganti')
    ci=json.loads(await pg.evaluate("JSON.stringify(cart.items[0])"))
    cek(ci['satuan']=='PAK' and ci['harga']==harga0,'keranjang: 1 PAK, harga sama')
    cek(await pg.evaluate(f"qtyDasar({L},{{qty:1}})")==4,'transaksi lama tanpa catatan satuan tetap dihitung 4 PCS')
    # ganti ke satuan yang sudah ada ditolak
    await pg.evaluate(f"gantiSatuanDialog({L},'PCS')");await pg.wait_for_timeout(200)
    cek(await pg.locator('.modal .satpick [data-sl=PAK]').count()==0,'satuan yang sudah ada tidak ditawarkan')
    await pg.click('.modal [data-sl=__lain]');await pg.fill('#gsLain','PAK');await pg.click('#gsOk');await pg.wait_for_timeout(200)
    cek('sudah ada' in await pg.inner_text('#toast') and await pg.evaluate(f"{L}.satuan")=='PCS','ganti ke satuan yang sudah ada (PAK) ditolak')
    await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.close())")
    # --- Tambah satuan dengan isi 1 -> ditawari ganti nama
    await pg.evaluate("(async()=>{await save('products',{id:'tSabun',nama:'SABUN TEST',satuan:'PCS',harga:{umum:3000},stok:5,minStok:0,aktif:true,barcode:'',alias:'',kategori:'',units:[]})})()")
    await pg.evaluate("resetCart();addToCart(S.products.find(p=>p.id==='tSabun'),1)");await pg.wait_for_timeout(150)
    await pg.evaluate("quickUnitDialog(S.products.find(p=>p.id==='tSabun'),n=>{window._qn=n;drawCart()})");await pg.wait_for_timeout(200)
    await pg.select_option('#qn','BKS');await pg.fill('#qi','1');await pg.fill('[data-qt=umum]','3000');await pg.click('#qok');await pg.wait_for_timeout(250)
    cek('Isi 1 berarti satuannya sama' in await pg.evaluate("[...document.querySelectorAll('.modal')].map(m=>m.innerText).join(' ')"),'isi 1: ditanya "ganti satuan PCS jadi BKS?"')
    await pg.click('.modal [data-yes]');await pg.wait_for_timeout(350)
    cek(await pg.evaluate("(p=>p.satuan+'|'+(p.units||[]).length)(S.products.find(p=>p.id==='tSabun'))")=='BKS|0' and await pg.evaluate("cart.items[0].satuan")=='BKS','setuju: satuan jadi BKS, tidak ada satuan dobel 1 = 1')
    # --- form produk: ganti satuan dasar -> riwayat ikut
    pid2=await pg.evaluate("""(()=>{const ids=new Set(S.sales.flatMap(s=>(s.items||[]).filter(i=>i.dasar==='PCS'&&!i.layanan).map(i=>i.productId)));
      const p=S.products.find(p=>p.aktif!==false&&!(p.units||[]).length&&p.satuan==='PCS'&&ids.has(p.id)&&p.id!=='%s');return p&&p.id})()"""%pid)
    await pg.evaluate(f"editProduct(S.products.find(p=>p.id==='{pid2}'))");await pg.wait_for_timeout(300)
    await pg.select_option('#fs','KLG');await pg.click('#fsave');await pg.wait_for_timeout(400)
    h2=json.loads(await pg.evaluate(f"JSON.stringify(S.sales.flatMap(s=>(s.items||[]).filter(i=>i.productId==='{pid2}')).map(i=>i.satuan))"))
    cek(await pg.evaluate(f"S.products.find(p=>p.id==='{pid2}').satuan")=='KLG' and h2 and all(x=='KLG' for x in h2),'form produk: satuan dasar diganti, riwayat ikut KLG')
    # --- halaman produk punya tautan ganti
    await pg.click('nav button[data-v=produk]');await pg.wait_for_timeout(500)
    cek(await pg.locator('[data-gsu]').count()>0,'halaman Produk: tautan ✏️ ganti satuan')
    await pg.click('nav button[data-v=kasir]');await pg.wait_for_timeout(300)
    await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove());resetCart();render()");await pg.wait_for_timeout(200)
    # ================= B. TOLAK QR BPOM =================
    async def scan(teks,delay=4,enter=True):
        await pg.focus('#scan')
        await pg.keyboard.type(teks,delay=delay)
        if enter: await pg.keyboard.press('Enter')
        await pg.wait_for_timeout(120)
    async def bersih(label):
        n=await pg.evaluate("cart.items.length");m=await pg.evaluate(nmodal);v=await pg.input_value('#scan')
        return n==0 and m==0 and v==''
    for teks,label in [('MD 224510001234','QR BPOM pangan "MD 224510001234"'),
                       ('ML 863709001234','QR BPOM pangan impor "ML ..."'),
                       ('(90)MD224510001234(91)271231','QR BPOM format GS1 "(90)MD...(91)..."'),
                       ('90MD224510001234','QR BPOM tanpa kurung "90MD..."'),
                       ('NA18201234567','kosmetik "NA1820..."'),
                       ('BPOM RI MD 224510001234','tulisan "BPOM RI ..."'),
                       ('https://cekbpom.pom.go.id/produk/abc','QR alamat situs cekbpom')]:
        await pg.evaluate("resetCart();render()");await pg.wait_for_timeout(120)
        await scan(teks)
        ok=await bersih(label);t=await pg.inner_text('#toast')
        cek(ok and ('QR BPOM' in t or 'alamat situs' in t),'ditolak: %s (toast: %s)'%(label,t[:40]))
        await pg.wait_for_timeout(600)
    # isi QR dengan beberapa baris (scanner mengirim Enter di tengah)
    await pg.evaluate("resetCart();render()");await pg.wait_for_timeout(120)
    await scan('MD 224510001234');await scan('EXP 27-12-2031 BATCH A12B')
    cek(await bersih('multi'),'QR BPOM berisi beberapa baris: semua sisanya ikut dibuang, tidak ada jendela')
    cls=await pg.evaluate("document.querySelector('#scan').className")
    cek('scantolak' in cls,'kolom scan berkedip merah')
    await pg.wait_for_timeout(700)
    # kode huruf tak dikenal dari scanner
    await pg.evaluate("resetCart();render()")
    await scan('XQ7ZK29PLM44')
    cek(await bersih('asing') and 'bukan barcode barang' in await pg.inner_text('#toast'),'kode huruf hasil scanner yang tidak dikenal ditolak tanpa jendela')
    await pg.wait_for_timeout(700)
    # yang tetap jalan
    bc=await pg.evaluate("S.products.find(p=>p.aktif!==false&&/^\\d{13}$/.test(p.barcode)&&priceOf(p,'umum')).barcode")
    await pg.evaluate("resetCart();render()");await scan(bc)
    cek(await pg.evaluate("cart.items.length")==1,'barcode angka (%s) tetap masuk keranjang'%bc)
    k2=await pg.evaluate("(p=>p&&p.barcode2.find(x=>/[a-z]/i.test(x)))(S.products.find(p=>p.aktif!==false&&(p.barcode2||[]).some(x=>/^[a-z]+$/i.test(x)&&x.length>=6)&&priceOf(p,'umum')))")
    await pg.evaluate("resetCart();render()");await scan(k2)
    cek(await pg.evaluate("cart.items.length")==1,'kode huruf yang tersimpan di barang ("%s") tetap masuk walau diketik cepat'%k2)
    await pg.evaluate("resetCart();render()")
    await scan('gula putih',delay=130)
    cek(await pg.evaluate("cart.items.length")==1,'ketikan tangan "gula putih" + Enter tetap memasukkan barang')
    await pg.evaluate("(async()=>{await save('customers',{id:'cM',nama:'MEMBER TES',kode:'M0099',tier:'umum',aktif:true})})()")
    await pg.evaluate("resetCart();render()");await scan('M0099')
    cek(await pg.evaluate("cart.customerId")=='cM','scan kartu member M0099 tetap jalan')
    cek(await pg.evaluate("jenisKodeAsing('https://tokomahyu.github.io/pesan.html#pesan=abc')+jenisKodeAsing('TMPESAN1|x')")=='','link & QR pesanan pelanggan tidak ditolak')
    biasa=['minyak 2 l','susu 1 ltr','ml 250','sd','na','tr 12','md','telur 1/2 kg','8992761002010','sampo sachet 10 ml']
    hasil=await pg.evaluate("l=>l.map(jenisKodeAsing)",biasa)
    cek(all(x=='' for x in hasil),'ketikan biasa tidak dianggap QR BPOM %s'%hasil)
    # kolom barcode di form produk
    await pg.evaluate("resetCart();render();editProduct(null)");await pg.wait_for_timeout(300)
    await pg.focus('#fb');await pg.keyboard.type('MD 224510001234',delay=4);await pg.keyboard.press('Enter');await pg.wait_for_timeout(150)
    cek(await pg.input_value('#fb')=='','form produk: QR BPOM tidak masuk ke kolom barcode')
    await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.close())");await pg.wait_for_timeout(700)
    # kamera: foto berisi QR BPOM saja / QR BPOM + barcode garis
    mk="""async(arg)=>{const [isiQR,ean]=arg;const cv=document.createElement('canvas');cv.width=900;cv.height=380;const c=cv.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,900,380);
      const q=qrcode(0,'M');q.addData(isiQR);q.make();const im=new Image();im.src=q.createDataURL(8,4);await im.decode();c.drawImage(im,20,20);
      if(ean){const b=document.createElement('canvas');JsBarcode(b,ean,{format:'EAN13',width:3,height:160});c.drawImage(b,420,60);}
      const blob=await new Promise(r=>cv.toBlob(r,'image/png'));const f=new File([blob],'foto.png',{type:'image/png'});
      const inp=document.querySelector('#camFile');const dt=new DataTransfer();dt.items.add(f);inp.files=dt.files;inp.dispatchEvent(new Event('change'));}"""
    await pg.evaluate("resetCart();render()");await pg.wait_for_timeout(150)
    await pg.evaluate("()=>{cameraScan()}");await pg.wait_for_timeout(600)
    await pg.evaluate(mk,['MD 224510001234',None]);await pg.wait_for_timeout(2500)
    cm=await pg.inner_text('#camMsg')
    cek('QR BPOM' in cm and await pg.evaluate(nmodal)==1 and await pg.evaluate("cart.items.length")==0,'kamera: foto QR BPOM ditolak, jendela kamera tetap terbuka')
    await pg.evaluate(mk,['MD 224510001234',bc]);await pg.wait_for_timeout(3000)
    cek(await pg.evaluate("cart.items.length")==1 and await pg.evaluate("cart.items[0].productId")==await pg.evaluate(f"findBarcode('{bc}').id"),'kamera: foto QR BPOM + barcode garis -> barang dari barcode garis masuk')
    cek(not errs,'tidak ada error halaman %s'%errs[:3])
    await b.close()
asyncio.run(main())
srv.terminate()
print('\nGAGAL:',len(fails));[print(' -',f) for f in fails]
