# 31 Okt (bagian 4): belanja + bayar utang lama tapi uangnya kurang -> tetap selesai & tercetak, sisa utang di struk.
# Semua transaksi bisa dicetak walau uang kurang (termasuk BRILink dan cara bayar Utang).
import os, asyncio, subprocess, time, json
from playwright.async_api import async_playwright
SS=os.environ.get('KASIR_TES_DATA','tests/data/')
srv=subprocess.Popen(['python3','-m','http.server','8833','-d','dist'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
BK=json.load(open(SS+'bk/backup.json'))
fails=[]
def cek(ok,msg):
    print(('OK   ' if ok else 'GAGAL ')+msg,flush=True)
    if not ok: fails.append(msg)
GULA="S.products.find(p=>p.nama==='GULA PUTIH CURAH 1 KG')"
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    pg=await b.new_page(viewport={'width':1366,'height':860});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.set_default_timeout(10000)
    await pg.goto('http://localhost:8833/index.html');await pg.wait_for_timeout(700)
    async with pg.expect_navigation():
        await pg.evaluate("o=>restore(o)",BK)
    await pg.wait_for_timeout(1800)
    await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove())")
    await pg.evaluate("()=>{window._cetak=[];printReceipt=s=>window._cetak.push(receiptHTML(s))}")
    await pg.click('nav button[data-v=kasir]');await pg.wait_for_timeout(300)
    await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove());S.meta.tundaBuka=dkey(Date.now());S.meta.autoPrint=true;render()");await pg.wait_for_timeout(200)
    last="S.sales[S.sales.length-1]"
    arus="(()=>{const a=dayStart(0),b=Date.now()+1;const r=arusUang('warung',a,b);return {jual:r.jual,utang:r.utang,total:r.total}})()"
    rek="(()=>{const R=rekapUang(dayStart(0),dayStart(1)).semua;return {bayarUtang:R.bayarUtang,utang:R.utang,laba:R.laba,tunai:R.tunai}})()"
    async def bayar(uang):
        await pg.keyboard.press('F12');await pg.wait_for_timeout(250)
        await pg.fill('#paid',str(uang));await pg.dispatch_event('#paid','input');await pg.wait_for_timeout(100)
    # ===== 1. pelanggan terdaftar: utang 5.000 di aplikasi, belanja + bayar utang lama, uangnya kurang 10.000
    await pg.evaluate("""(async()=>{await save('customers',{id:'cA',nama:'BU ENTIN',tier:'umum',telp:'',alamat:'',aktif:true});
      await save('payments',{id:'uA',jenis:'utang',customerId:'cA',waktu:Date.now()-5*864e5,jumlah:5000,kas:'warung',catatan:'dari buku'});
      cart.customerId='cA';render()})()""")
    await pg.wait_for_timeout(200)
    await pg.evaluate(f"addToCart({GULA},1)")
    await pg.click('#ulBtn');await pg.wait_for_timeout(200)
    cek(await pg.input_value('#ulJ')=='5.000','utang lama terisi otomatis 5.000 dari catatan pelanggan')
    await pg.keyboard.press('Enter');await pg.wait_for_timeout(200)
    t=await pg.evaluate("cartTotal()")
    tot=t['total'];gula=tot-5000
    a0=await pg.evaluate(arus);r0=await pg.evaluate(rek)
    await bayar(tot-10000)
    kb=await pg.inner_text('#kurangBox')
    cek('utang lama' in kb and 'Rp 10.000' in kb,'kotak kurang: utang lama dilunasi dulu, utang setelah ini Rp 10.000')
    cek('kurang Rp 10.000' in await pg.inner_text('#done'),'tombol: Selesai, kurang Rp 10.000')
    await pg.keyboard.press('Enter');await pg.wait_for_timeout(500)
    cek(await pg.locator('.modal #paid').count()==0,'transaksi tetap selesai (tidak ditolak)')
    s=json.loads(await pg.evaluate(f"JSON.stringify((s=>({{metode:s.metode,utang:s.utang,kb:s.kurangBayar,sisa:s.sisaUtangSetelah,bayar:s.bayar}}))({last}))"))
    cek(s['metode']=='utang' and s['kb'] and s['utang']==10000 and s['sisa']==10000,'tercatat: kurang 10.000 jadi utang, sisa utang 10.000 %s'%s)
    cek(await pg.evaluate("saldoUtang('cA')")==10000,'saldo utang BU ENTIN sekarang 10.000 (5.000 lama lunas, 10.000 baru)')
    st=await pg.evaluate("window._cetak.at(-1)") or ''
    cek(len(await pg.evaluate("window._cetak"))>=1 and 'KURANG' in st and 'BELUM LUNAS' in st,'struk tercetak: KURANG, BELUM LUNAS')
    cek('SISA UTANG BU ENTIN' in st and '10.000' in st and 'Bayar utang lama' in st,'struk menampilkan bayar utang lama & SISA UTANG 10.000')
    a1=await pg.evaluate(arus);r1=await pg.evaluate(rek)
    cek(a1['total']-a0['total']==tot-10000,'uang laci bertambah sesuai uang yang diterima (%s)'%(a1['total']-a0['total']))
    cek(a1['utang']-a0['utang']==5000 and a1['jual']-a0['jual']==gula-10000,'di laci: 5.000 bayar utang lama, sisanya penjualan')
    cek(r1['bayarUtang']-r0['bayarUtang']==5000 and r1['utang']-r0['utang']==10000,'laporan: bayar utang 5.000, utang baru 10.000')
    hb=await pg.evaluate(f"{GULA}.hargaBeli")
    cek(round(r1['laba']-r0['laba'])==gula-hb,'laba hanya dari barang, utang lama tidak menambah laba')
    # cetak ulang tetap sama
    st2=await pg.evaluate(f"receiptHTML({last})")
    cek('SISA UTANG BU ENTIN' in st2 and '10.000' in st2,'cetak ulang: sisa utang tetap tercetak')
    # ===== 2. uang lebih kecil dari utang lamanya sendiri
    await pg.evaluate("(async()=>{await save('payments',{id:'uB',jenis:'utang',customerId:'cA',waktu:Date.now(),jumlah:5000,kas:'warung'});cart.customerId='cA';render()})()")
    await pg.wait_for_timeout(200)
    sal0=await pg.evaluate("saldoUtang('cA')")
    await pg.evaluate(f"addToCart({GULA},1)")
    await pg.click('#ulBtn');await pg.wait_for_timeout(200);await pg.fill('#ulJ','5000');await pg.keyboard.press('Enter');await pg.wait_for_timeout(200)
    tot=await pg.evaluate("cartTotal().total")
    a0=await pg.evaluate(arus)
    await bayar(3000);await pg.keyboard.press('Enter');await pg.wait_for_timeout(500)
    a1=await pg.evaluate(arus)
    cek(a1['total']-a0['total']==3000 and a1['utang']-a0['utang']==3000 and a1['jual']-a0['jual']==0,'bayar 3.000 (< utang lama 5.000): laci +3.000, semuanya bayar utang')
    cek(await pg.evaluate("saldoUtang('cA')")==sal0+tot-5000-3000,'saldo utang benar (lama + belanja - uang diterima)')
    # ===== 3. tanpa nama, utang lama dari buku, uang kurang
    await pg.evaluate("resetCart();render()");await pg.wait_for_timeout(200)
    await pg.evaluate(f"addToCart({GULA},1)")
    await pg.click('#ulBtn');await pg.wait_for_timeout(200);await pg.fill('#ulJ','4000');await pg.keyboard.press('Enter');await pg.wait_for_timeout(200)
    tot=await pg.evaluate("cartTotal().total")
    await bayar(tot-6000);await pg.keyboard.press('Enter');await pg.wait_for_timeout(500)
    s=json.loads(await pg.evaluate(f"JSON.stringify((s=>({{kurang:s.kurang,cid:s.customerId}}))({last}))"))
    st=await pg.evaluate("window._cetak.at(-1)")
    cek(s['kurang']==6000 and not s['cid'],'tanpa nama: kurang 6.000 dicatat di transaksi')
    cek('SISA UTANG SEMUA' in st and '6.000' in st and 'BELUM LUNAS' in st,'struk tanpa nama: SISA UTANG SEMUA 6.000')
    # ===== 4. BRILink + uang kurang
    await pg.evaluate(f"addToCart({GULA},1)")
    await pg.evaluate("cart.items.push({layanan:'trfbri',lyn:{jenis:'trfbri',nominal:100000,admin:5000,arah:'masuk'},nama:'Transfer BRI',qty:1,harga:105000,kas:'brilink'});drawCart()")
    tot=await pg.evaluate("cartTotal().total")
    rw0=await pg.evaluate("arusUang('warung',dayStart(0),Date.now()+1).total");rb0=await pg.evaluate("arusUang('brilink',dayStart(0),Date.now()+1).total")
    await bayar(100000)
    cek('BRILink' not in await pg.inner_text('#kurangBox') or 'harus cukup' not in await pg.inner_text('#kurangBox'),'BRILink: tidak lagi "uangnya harus cukup"')
    await pg.keyboard.press('Enter');await pg.wait_for_timeout(500)
    rw1=await pg.evaluate("arusUang('warung',dayStart(0),Date.now()+1).total");rb1=await pg.evaluate("arusUang('brilink',dayStart(0),Date.now()+1).total")
    cek(await pg.locator('.modal #paid').count()==0 and await pg.evaluate(f"{last}.kurang")==tot-100000,'BRILink + uang kurang tetap selesai')
    cek(round((rw1-rw0)+(rb1-rb0))==100000,'uang laci Warung + BRILink bertambah tepat 100.000 (%s + %s)'%(rw1-rw0,rb1-rb0))
    cek('KURANG' in await pg.evaluate("window._cetak.at(-1)"),'struk BRILink kurang tercetak')
    # ===== 5. cara bayar Utang (📒) + utang lama -> boleh
    await pg.evaluate("(async()=>{await save('payments',{id:'uC',jenis:'utang',customerId:'cA',waktu:Date.now(),jumlah:7000,kas:'warung'});cart.customerId='cA';render()})()")
    await pg.wait_for_timeout(200)
    sal0=await pg.evaluate("saldoUtang('cA')")
    await pg.evaluate(f"addToCart({GULA},1)")
    await pg.click('#ulBtn');await pg.wait_for_timeout(200);await pg.fill('#ulJ','7000');await pg.keyboard.press('Enter');await pg.wait_for_timeout(200)
    tot=await pg.evaluate("cartTotal().total")
    await pg.keyboard.press('F12');await pg.wait_for_timeout(250);await pg.click('[data-mt=utang]');await pg.fill('#dp','2000');await pg.keyboard.press('Enter');await pg.wait_for_timeout(500)
    cek(await pg.locator('.modal #paid').count()==0,'cara bayar Utang + utang lama tidak ditolak')
    cek(await pg.evaluate("saldoUtang('cA')")==sal0+(tot-7000)-2000,'saldo = utang lama + belanja - DP')
    st=await pg.evaluate("window._cetak.at(-1)")
    cek('SISA UTANG BU ENTIN' in st,'struk utang + utang lama: sisa utang tercetak')
    # ===== 6. batal -> utang kembali seperti semula
    sal1=await pg.evaluate("saldoUtang('cA')")
    sid=await pg.evaluate(f"{last}.id")
    await pg.evaluate(f"saleDetail({last})");await pg.wait_for_timeout(200)
    await pg.click('.modal #void');await pg.wait_for_timeout(150);await pg.click('.modal [data-yes]');await pg.wait_for_timeout(400)
    cek(await pg.evaluate("saldoUtang('cA')")==sal0,'transaksi dibatalkan: utang kembali seperti sebelum transaksi')
    # ===== 7. transaksi lunas biasa tidak menampilkan baris sisa utang
    await pg.evaluate("resetCart();render()");await pg.wait_for_timeout(200)
    await pg.evaluate(f"addToCart({GULA},1)");tot=await pg.evaluate("cartTotal().total")
    await bayar(tot);await pg.keyboard.press('Enter');await pg.wait_for_timeout(400)
    st=await pg.evaluate("window._cetak.at(-1)")
    cek('SISA UTANG' not in st and 'STATUS: LUNAS' in st,'transaksi biasa lunas: struk tanpa baris sisa utang')
    cek(errs==[],'tanpa error JS %s'%errs)
    await b.close()
asyncio.run(main());srv.terminate()
print('GAGAL:', fails or 'tidak ada')
