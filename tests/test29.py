# 31 Okt: status BELUM LUNAS, utang lama di transaksi, catat utang, kotak angka saja, label harga rak, QR hemat
import os, asyncio, subprocess, time, json
from playwright.async_api import async_playwright
srv=subprocess.Popen(['python3','-m','http.server','8798','-d','dist'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
SS=os.environ.get('KASIR_TES_DATA','tests/data/')
BK=json.load(open(SS+'bk/backup.json'))
fails=[]
def cek(ok,msg):
    print(('OK   ' if ok else 'GAGAL ')+msg)
    if not ok: fails.append(msg)
GULA="S.products.find(p=>p.nama==='GULA PUTIH CURAH 1 KG')"
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    ctx=await b.new_context(viewport={'width':1366,'height':860})
    pg=await ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8798/index.html');await pg.wait_for_timeout(700)
    async with pg.expect_navigation():
        await pg.evaluate("o=>restore(o)",BK)
    await pg.wait_for_timeout(2000)
    notes=await pg.evaluate("[...document.querySelectorAll('.modal .notes li')].map(l=>l.innerText)")
    cek(any('Utang lama' in n for n in notes) and any('Label harga rak' in n for n in notes),'pemberitahuan versi 31 Okt')
    await pg.click('.modal [data-close]')
    # QRIS toko diisi supaya bisa dicek QR di struk
    await pg.evaluate("settings().qris={payload:'00020101021126570011ID.DANA.WWW011893600915300000000102090000000010303UMI51440014ID.CO.QRIS.WWW0215ID10200000000000303UMI5204581253033605802ID5911TOKO MAHYU6007SUMEDAN61054535062070703A016304ABCD',nama:'TOKO MAHYU'};saveMeta('settings')")
    await pg.evaluate("()=>{window._cetak=[];printReceipt=s=>window._cetak.push(receiptHTML(s))}")
    await pg.click('nav button[data-v=kasir]');await pg.wait_for_timeout(200)
    if await pg.locator('#bukaNanti').count(): await pg.click('#bukaNanti');await pg.wait_for_timeout(150)
    async def bayar(uang=None, nama=None):
        await pg.keyboard.press('F12');await pg.wait_for_timeout(250)
        if uang is not None:
            await pg.fill('#paid',str(uang));await pg.dispatch_event('#paid','input')
        if nama: await pg.fill('#kName',nama)
        await pg.keyboard.press('Enter');await pg.wait_for_timeout(450)
    last="S.sales[S.sales.length-1]"
    # ---- QR: uang tidak diisi -> ada QR; diisi -> tidak ada
    await pg.evaluate(f"addToCart({GULA},1)");await bayar()
    st=await pg.evaluate("window._cetak.at(-1)");cek('class="qr"' in st,'uang bayar kosong -> struk tetap ada QR')
    await pg.evaluate(f"addToCart({GULA},1)");await bayar(50000)
    st=await pg.evaluate("window._cetak.at(-1)");cek('class="qr"' not in st and 'Kembali' in st,'uang diisi -> struk tanpa QR')
    await pg.evaluate(f"addToCart({GULA},1)");await pg.keyboard.press('F12');await pg.wait_for_timeout(200);await pg.click('.modal [data-q]');await pg.keyboard.press('Enter');await pg.wait_for_timeout(400)
    st=await pg.evaluate("window._cetak.at(-1)");cek('class="qr"' not in st,'tombol Uang pas -> struk tanpa QR')
    # ---- uang kurang -> BELUM LUNAS
    await pg.evaluate(f"addToCart({GULA},1)");tot=await pg.evaluate("cartTotal().total");await bayar(tot-2000)
    st=await pg.evaluate("window._cetak.at(-1)")
    cek('STATUS: BELUM LUNAS' in st and 'KURANG BAYAR' not in st and 'KURANG' in st,'uang kurang -> STATUS: BELUM LUNAS (baris KURANG tetap ada)')
    cek('class="qr"' not in st,'uang kurang tapi diisi -> tanpa QR')
    # ---- utang lama tanpa nama: 95.000 + 5.000 = 100.000
    await pg.evaluate("resetCart();render()");await pg.wait_for_timeout(150)
    if await pg.locator('#bukaNanti').count(): await pg.click('#bukaNanti');await pg.wait_for_timeout(150)
    await pg.evaluate("cart.items.push({productId:'manual-x',manual:true,nama:'BELANJA',satuan:'PCS',harga:95000,hargaBeli:80000,qty:1,kas:'warung'});drawCart()")
    await pg.click('#ulBtn');await pg.wait_for_timeout(200)
    await pg.keyboard.type('5000');await pg.wait_for_timeout(50)
    v=await pg.input_value('#ulJ');cek(v=='5.000','kotak angka diberi titik ribuan: '+v)
    await pg.keyboard.press('Enter');await pg.wait_for_timeout(200)
    tot=await pg.evaluate("cartTotal().total");cek(tot==100000,'total jadi 100.000')
    await pg.screenshot(path=SS+'u_keranjang.png')
    await bayar(100000)
    r=json.loads(await pg.evaluate(f"JSON.stringify((s=>({{total:s.total,K:rincianSale(s).kas.warung,pj:penjualanSale(s),isi:ringkasIsi(s)}}))({last}))"))
    print('   rincian:',{k:r['K'][k] for k in ['uang','jual','tunai','bayarUtang','laba']},'penjualan',r['pj'],r['isi'])
    cek(r['total']==100000 and r['K']['tunai']==100000 and r['K']['bayarUtang']==5000 and r['pj']==95000 and r['K']['laba']==15000,'laci +100.000, penjualan 95.000, bayar utang 5.000, laba tidak ikut utang')
    st=await pg.evaluate("window._cetak.at(-1)");cek('Bayar utang lama' in st,'struk: baris Bayar utang lama')
    rk=json.loads(await pg.evaluate("JSON.stringify((R=>({jual:R.warung.jual,tunai:R.warung.tunai,bu:R.warung.bayarUtang}))(rekapUang(dayStart(0),dayStart(1))))"))
    print('   rekap hari ini warung:',rk)
    # ---- catat utang dari buku (Pelanggan) lalu dibayar lewat transaksi
    await pg.click('nav button[data-v=pelanggan]');await pg.wait_for_timeout(250)
    await pg.click('#utBtn');await pg.wait_for_timeout(200)
    await pg.fill('#unNama','bu entin');await pg.fill('#unJ','12000');await pg.dispatch_event('#unJ','input');await pg.keyboard.press('Enter');await pg.wait_for_timeout(400)
    sal=await pg.evaluate("saldoUtang(matchCustomer('BU ENTIN').id)");cek(sal==12000,'catat utang dari buku: BU ENTIN Rp 12.000')
    await pg.check('#cUt');await pg.wait_for_timeout(200)
    rows=await pg.evaluate("[...document.querySelectorAll('#main tbody tr')].map(r=>r.innerText.split('\\t')[1])")
    cek('BU ENTIN' in ' '.join(rows),'filter hanya yang punya utang: '+str(rows[:4]))
    await pg.screenshot(path=SS+'u_pelanggan.png')
    arus0=await pg.evaluate("arusUang('warung',dayStart(0)-1,Date.now()+1).utang")
    await pg.click('nav button[data-v=kasir]');await pg.wait_for_timeout(200)
    if await pg.locator('#bukaNanti').count(): await pg.click('#bukaNanti');await pg.wait_for_timeout(150)
    await pg.fill('#custName','BU ENTIN') if await pg.locator('#custName').count() else None
    await pg.evaluate("cart.customerId=matchCustomer('BU ENTIN').id;render()");await pg.wait_for_timeout(200)
    await pg.evaluate(f"addToCart({GULA},1)");await pg.click('#ulBtn');await pg.wait_for_timeout(200)
    ban=await pg.inner_text('.modal');cek('12.000' in ban and await pg.input_value('#ulJ')=='12.000','utang tercatat langsung terisi 12.000')
    await pg.keyboard.press('Enter');await pg.wait_for_timeout(200)
    await bayar(50000)
    sal=await pg.evaluate("saldoUtang(matchCustomer('BU ENTIN').id)");cek(sal==0,'utang BU ENTIN lunas lewat transaksi')
    arus1=await pg.evaluate("arusUang('warung',dayStart(0)-1,Date.now()+1).utang")
    cek(arus1-arus0==12000,f'uang laci: bayar utang dihitung sekali ({arus1-arus0})')
    # batalkan transaksi -> utangnya kembali
    await pg.evaluate(f"saleDetail({last})");await pg.wait_for_timeout(200)
    await pg.click('.modal #void');await pg.wait_for_timeout(150);await pg.click('.modal [data-yes]');await pg.wait_for_timeout(400)
    sal=await pg.evaluate("saldoUtang(matchCustomer('BU ENTIN').id)");cek(sal==12000,'transaksi dibatalkan -> utang kembali 12.000')
    # utang lama tidak boleh dicampur uang kurang / utang
    await pg.evaluate("resetCart();render()");await pg.wait_for_timeout(150)
    if await pg.locator('#bukaNanti').count(): await pg.click('#bukaNanti');await pg.wait_for_timeout(150)
    await pg.evaluate(f"addToCart({GULA},1)");await pg.click('#ulBtn');await pg.wait_for_timeout(150);await pg.keyboard.type('3000');await pg.keyboard.press('Enter');await pg.wait_for_timeout(150)
    await pg.keyboard.press('F12');await pg.wait_for_timeout(200);await pg.fill('#paid','1000');await pg.dispatch_event('#paid','input');await pg.keyboard.press('Enter');await pg.wait_for_timeout(300)
    # sejak 31 Okt (bagian 4): tetap selesai, kekurangannya jadi utang, struk menulis SISA UTANG
    cek(await pg.locator('.modal #paid').count()==0,'ada utang lama + uang kurang -> tetap selesai')
    await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove());resetCart();render()")
    # ---- kotak angka saja
    if await pg.locator('#bukaNanti').count(): await pg.click('#bukaNanti');await pg.wait_for_timeout(150)
    await pg.click('nav button[data-v=produk]');await pg.wait_for_timeout(200);await pg.click('#addP');await pg.wait_for_timeout(200)
    await pg.click('.modal [data-bt=umum]');await pg.keyboard.type('12a.5,0x00');await pg.wait_for_timeout(50)
    v=await pg.input_value('.modal [data-bt=umum]');cek(v=='12.500','huruf/titik/koma ditolak, angka diberi titik: '+v)
    await pg.click('.modal #fhb');await pg.keyboard.type('9000');v=await pg.input_value('.modal #fhb');cek(v=='9.000','harga beli: '+v)
    await pg.click('.modal [data-close]')
    # ---- label harga rak
    await pg.evaluate("prodFilter.sel=new Set(S.products.filter(p=>/^(TELUR AYAM 1 KG|SAMPOERNA MILD 16|GULA PUTIH CURAH 1 KG)$/.test(p.nama)).map(p=>p.id));go('produk')");await pg.wait_for_timeout(250)
    await pg.evaluate("()=>{window._rak=null;printHTML=(h,c)=>{window._rak=h}}")
    await pg.click('#lblBtn');await pg.wait_for_timeout(250)
    cek(await pg.locator('.modal [data-lj=rak].on').count()==1,'label harga rak jadi pilihan pertama')
    await pg.screenshot(path=SS+'u_labelrak.png')
    await pg.click('.modal #lgo');await pg.wait_for_timeout(300)
    h=await pg.evaluate("window._rak||''")
    cek(h.count('class="tag"')==3 and '26.000' in h and 'SLOP' in h,'label rak tercetak 3 buah, ada harga & satuan lain')
    await pg.click('.modal [data-close]')
    # filter harga berubah
    await pg.evaluate("(()=>{const p=S.products.find(p=>p.nama==='GULA PUTIH CURAH 1 KG');editProduct(p,null,()=>{})})()");await pg.wait_for_timeout(200)
    await pg.fill('.modal [data-bt=umum]','19.000');await pg.dispatch_event('.modal [data-bt=umum]','input');await pg.click('.modal #fsave');await pg.wait_for_timeout(300)
    n=await pg.evaluate("S.products.filter(p=>Number(p.hargaDiubah)>Date.now()-7*864e5).map(p=>p.nama)")
    cek('GULA PUTIH CURAH 1 KG' in n,'filter Harga berubah 7 hari berisi barang yang baru diganti '+str(n[:3]))
    cek(not errs,'tanpa error JS '+str(errs[:3]))
    await b.close()
  srv.terminate()
  print('\nGAGAL:',fails if fails else 'tidak ada')
asyncio.run(main())
