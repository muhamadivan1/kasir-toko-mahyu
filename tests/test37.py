# 15 Nov 2026 (2): warna merah / putih sesuai logo, suara membacakan total & kembalian (bisa on / off)
import os, asyncio, subprocess, time, json
from playwright.async_api import async_playwright
SS=os.environ.get('KASIR_TES_DATA','tests/data/')
srv=subprocess.Popen(['python3','-m','http.server','8838','-d','dist'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
BK=json.load(open(SS+'bk2/backup.json'))
fails=[]
def cek(ok,msg):
    print(('OK   ' if ok else 'GAGAL ')+msg,flush=True)
    if not ok: fails.append(msg)
STUB="""()=>{window._ucap=[];window.SpeechSynthesisUtterance=function(t){this.text=t};
 Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{speak:u=>window._ucap.push(u.text),cancel(){},getVoices:()=>[]}})}"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    pg=await b.new_page(viewport={'width':1366,'height':860});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.add_init_script("("+STUB+")()")
    await pg.goto('http://localhost:8838/index.html');await pg.wait_for_timeout(700)
    async with pg.expect_navigation():
        await pg.evaluate("o=>restore(o)",BK)
    await pg.wait_for_timeout(2500)
    notes=await pg.evaluate("[...document.querySelectorAll('.modal')].map(m=>m.innerText).join(' ')")
    cek('Suara membacakan' in notes and 'tulisan merah' in notes,'catatan pembaruan: suara & warna merah')
    await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove());go('kasir')");await pg.wait_for_timeout(300)
    tb=[(n,await pg.evaluate("n=>terbilang(n)",n)) for n in [0,7,11,15,25,100,115,1000,1500,2000,25500,38000,100000,1250000,2000000]]
    print('  ',tb)
    cek(dict(tb)=={0:'nol',7:'tujuh',11:'sebelas',15:'lima belas',25:'dua puluh lima',100:'seratus',115:'seratus lima belas',1000:'seribu',1500:'seribu lima ratus',2000:'dua ribu',25500:'dua puluh lima ribu lima ratus',38000:'tiga puluh delapan ribu',100000:'seratus ribu',1250000:'satu juta dua ratus lima puluh ribu',2000000:'dua juta'},'angka dibaca benar dalam bahasa Indonesia')
    cek(await pg.inner_text('#bacaBtn')=='🔇' and not await pg.evaluate("suaraBacaOn()"),'awalnya suara mati (tombol 🔇)')
    G="S.products.find(p=>p.nama==='GULA PUTIH CURAH 1 KG')"
    async def jual(uang):
        await pg.evaluate(f"addToCart({G},2)");tot=await pg.evaluate("cartTotal().total")
        await pg.keyboard.press('F12');await pg.wait_for_timeout(300)
        await pg.fill('#paid',str(uang(tot)));await pg.dispatch_event('#paid','input');await pg.keyboard.press('Enter');await pg.wait_for_timeout(500)
        await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove())")
        return tot
    await pg.evaluate("()=>{window._cetak=[];printReceipt=s=>0}")
    await jual(lambda t:t+5000)
    cek(await pg.evaluate("window._ucap.length")==0,'suara mati: tidak ada yang dibacakan')
    await pg.click('#bacaBtn');await pg.wait_for_timeout(200)
    cek(await pg.inner_text('#bacaBtn')=='🔊' and await pg.evaluate("suaraBacaOn()") and 'NYALA' in await pg.inner_text('#toast'),'tekan tombol: suara nyala (🔊)')
    cek(await pg.evaluate("window._ucap.at(-1)")=='Suara kasir menyala','saat dinyalakan berbunyi "Suara kasir menyala"')
    await pg.evaluate("window._ucap=[]")
    tot=await jual(lambda t:t+12000)
    u=await pg.evaluate("window._ucap")
    print('  ',u)
    cek(u[0]==('Totalnya '+await pg.evaluate("n=>terbilang(n)",tot)+' rupiah'),'buka jendela bayar: "Totalnya ... rupiah"')
    cek(u[-1]=='Kembaliannya dua belas ribu rupiah','selesai: "Kembaliannya dua belas ribu rupiah"')
    await pg.evaluate("window._ucap=[]");await jual(lambda t:t)
    cek(await pg.evaluate("window._ucap.at(-1)")=='Uangnya pas. Terima kasih','uang pas: "Uangnya pas. Terima kasih"')
    await pg.evaluate("window._ucap=[]");await jual(lambda t:t-3000)
    cek(await pg.evaluate("window._ucap.at(-1)")=='Uangnya kurang tiga ribu rupiah','uang kurang: "Uangnya kurang tiga ribu rupiah"')
    await pg.reload();await pg.wait_for_timeout(1500);await pg.evaluate("document.querySelectorAll('.modal').forEach(m=>m.remove());go('kasir')");await pg.wait_for_timeout(300)
    cek(await pg.inner_text('#bacaBtn')=='🔊','pilihan nyala tetap tersimpan setelah aplikasi dibuka ulang')
    await pg.click('#bacaBtn');await pg.wait_for_timeout(200)
    cek(await pg.inner_text('#bacaBtn')=='🔇' and 'MATI' in await pg.inner_text('#toast'),'tekan lagi: suara mati')
    # pengaturan
    await pg.evaluate("go('pengaturan')");await pg.wait_for_timeout(400)
    cek(await pg.locator('#bcOn').count()==1 and not await pg.is_checked('#bcOn'),'Pengaturan → Toko & Struk: kotak Suara membacakan')
    await pg.evaluate("window._ucap=[]");await pg.click('#bcTes');await pg.wait_for_timeout(100)
    cek('Kembaliannya empat ribu lima ratus rupiah' in (await pg.evaluate("window._ucap.at(-1)") or ''),'tombol Coba suara berbunyi walau suara mati')
    await pg.check('#bcOn');await pg.select_option('#bcRate','0.8');await pg.click('#bcSave');await pg.wait_for_timeout(200)
    cek(await pg.evaluate("suaraBacaOn() && settings().bacakanCepat===0.8"),'Simpan: nyala, kecepatan Pelan')
    # warna
    await pg.evaluate("go('kasir')");await pg.wait_for_timeout(300)
    css=lambda sel,prop:pg.evaluate("([s,p])=>getComputedStyle(document.querySelector(s))[p]",[sel,prop])
    cek(await css('nav button.on','backgroundColor')=='rgb(255, 255, 255)' and await css('nav button.on','color')=='rgb(210, 34, 34)','menu yang dibuka: putih, tulisan merah logo')
    await pg.hover('nav button[data-v=produk]');await pg.wait_for_timeout(150)
    cek(await css('nav button[data-v=produk]','backgroundColor')=='rgb(210, 34, 34)' and await css('nav button[data-v=produk]','color')=='rgb(255, 255, 255)','menu yang ditunjuk: merah logo, tulisan putih')
    await pg.screenshot(path=SS+'r1_nav.png',clip={'x':0,'y':0,'width':1366,'height':330})
    await pg.hover('#payBtn');await pg.wait_for_timeout(150)
    cek('rgb(210, 34, 34)' in await css('#payBtn','boxShadow'),'tombol yang ditunjuk: bingkai merah')
    cek(not await pg.evaluate("[...document.styleSheets].some(s=>{try{return [...s.cssRules].some(r=>r.cssText.includes('255, 201, 60'))}catch(e){return false}})"),'tidak ada lagi warna kuning')
    w=await pg.evaluate("[document.querySelector('nav').scrollWidth,document.querySelector('nav').clientWidth]")
    cek(w[0]<=w[1],'menu atas tidak meluap')
    cek(not errs,'tidak ada error halaman %s'%errs[:3])
    await b.close()
asyncio.run(main())
srv.terminate()
print('\nGAGAL:',len(fails));[print(' -',f) for f in fails]
