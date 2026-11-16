# Kategori baru + filter Produk baru, diuji dengan backup asli toko (660 barang aktif)
import os, asyncio, subprocess, time, json, sys
from playwright.async_api import async_playwright
srv=subprocess.Popen(['python3','-m','http.server','8793','-d','dist'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
SS=os.environ.get('KASIR_TES_DATA','tests/data/')
BK=json.load(open(SS+'bk/backup.json'))
fails=[]
def cek(ok,msg):
    print(('OK   ' if ok else 'GAGAL ')+msg)
    if not ok: fails.append(msg)
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    ctx=await b.new_context(viewport={'width':1366,'height':860})
    pg=await ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8793/index.html');await pg.wait_for_timeout(700)
    async with pg.expect_navigation():
        await pg.evaluate("o=>restore(o)",BK)
    await pg.wait_for_timeout(1500)
    notes=await pg.evaluate("[...document.querySelectorAll('.modal .notes li')].map(l=>l.innerText)")
    print('pemberitahuan:');[print('  -',n) for n in notes]
    cek(any('Kategori barang dirapikan' in n for n in notes),'pemberitahuan kategori muncul')
    await pg.screenshot(path=SS+'kat_notes.png')
    hasil=json.loads(await pg.evaluate("""JSON.stringify((()=>{
      const A=S.products.filter(p=>p.aktif!==false);const by={};
      for(const p of A) by[p.kategori||'']=(by[p.kategori||'']||0)+1;
      const bukan=A.filter(p=>!isKategoriStandar(p.kategori)).map(p=>p.nama+' ['+p.kategori+']');
      const nm=n=>(S.products.find(p=>p.nama===n)||{}).kategori;
      return {by, bukan, revisi:S.products.filter(p=>p.revisiHarga).length, flag:settings().migrasi.kategori29,
        cadangan:S.meta.cadanganUpdate&&S.meta.cadanganUpdate.langkah,
        contoh:['TABUNG GAS 3 KG','KOREK API KAYU PACK','KIWI SEMIR BROWN 17.5 ML PCS','LE MINERALE 600 ML BTL','CALADINE POWDER ORIGINAL 60G PCS','LAVENDA FRESH CITRUS RCG 8 ML','MILKU MARIE BISKUIT 200 GR PCS','GARUDA PILUS SAPI PANGGANG 9 GR RCG','SEMEN','LEM TANGIT PARALON','MAGNUM BINTANG','BERAS 1KG','TELON CAP LANG 15 ML BTL','KOPIKO COFFEE CANDY 175 GR PACK','DETTOL CAIR ANTISEPTIK 100 ML PCS','TISU TESSA FACIAL','HOT IN CREAM 60 ML PCS','PANTHER'].map(n=>n+' -> '+nm(n))};
    })())"""))
    for k,v in sorted(hasil['by'].items(),key=lambda x:-x[1]): print(f'  {v:4d}  {k}')
    cek(len(hasil['by'])==23,'jumlah kategori dipakai = 23 (sekarang %d)'%len(hasil['by']))
    cek(not hasil['bukan'],'semua barang aktif di kategori standar '+str(hasil['bukan'][:5]))
    cek(hasil['by'].get('LAIN-LAIN')==12,'LAIN-LAIN hanya 12 barang yang jenisnya belum jelas')
    cek(hasil['revisi']==0,'tanda revisi 13 Okt dihapus')
    cek(hasil['flag']==1 and 'kategori29' in (hasil['cadangan'] or []),'migrasi tercatat + cadangan sebelum pembaruan ada')
    for c in hasil['contoh']: print('   ',c)
    exp={'TABUNG GAS 3 KG':'SEMBAKO','KOREK API KAYU PACK':'KEBUTUHAN RUMAH','LE MINERALE 600 ML BTL':'MINUMAN','CALADINE POWDER ORIGINAL 60G PCS':'OBAT','SEMEN':'MATERIAL BANGUNAN','MAGNUM BINTANG':'ROKOK','KOPIKO COFFEE CANDY 175 GR PACK':'SNACK & BISKUIT','TELON CAP LANG 15 ML BTL':'BAYI & ANAK'}
    for n,k in exp.items(): cek(any(c==n+' -> '+k for c in hasil['contoh']),n+' -> '+k)
    # tombol Periksa di pemberitahuan -> Produk dengan filter LAIN-LAIN
    await pg.click('.modal [data-note=kategori]');await pg.wait_for_timeout(400)
    rows=await pg.locator('#pt tr').count();pb=await pg.evaluate("$('#pb').value")
    cek(pb=='nok' and rows==12,f'Periksa -> filter nok, {rows} baris')
    print('  ',await pg.evaluate("[...document.querySelectorAll('#pt tr td.c-nm b')].map(b=>b.innerText).join(', ')"))
    await pg.screenshot(path=SS+'kat_lain.png')
    opsi=await pg.evaluate("[...document.querySelectorAll('#pb > option, #pb optgroup')].map(o=>o.tagName==='OPTGROUP'?'## '+o.label+': '+[...o.children].map(c=>c.textContent).join(' | '):o.textContent)")
    print('filter:');[print('  ',o) for o in opsi]
    cek(not any('13 Okt' in o for o in opsi),'filter usang (revisi 13 Okt) hilang')
    cek(any('Paling laku' in o for o in opsi) and any('Tidak laku' in o for o in opsi),'filter laku / tidak laku ada')
    kat=await pg.evaluate("[...document.querySelectorAll('#pk option')].map(o=>o.textContent)")
    print('kategori:',kat)
    cek(kat[1].startswith('🍚 SEMBAKO'),'urutan kategori seperti rak (Sembako dulu)')
    # paling laku: urut menurun
    await pg.select_option('#pb','laris');await pg.wait_for_timeout(200)
    laris=await pg.evaluate("(()=>{const c=lakuPerProduk(30).laku;return produkList().slice(0,8).map(p=>p.nama+'='+c[p.id])})()")
    print('paling laku:',laris)
    vals=[float(x.split('=')[1]) for x in laris]
    cek(vals==sorted(vals,reverse=True) and len(vals)>0,'paling laku urut menurun')
    # kategori ROKOK -> hitungan filter ikut
    await pg.select_option('#pb','');await pg.select_option('#pk','ROKOK');await pg.wait_for_timeout(200)
    semua=await pg.evaluate("$('#pb option').textContent");rows=await pg.evaluate("produkList().length")
    cek(semua=='Semua barang (120)' and rows==120,'pilih ROKOK: '+semua)
    await pg.select_option('#pk','');await pg.wait_for_timeout(100)
    # preset dari Beranda tetap jalan
    await pg.evaluate("S._prodFilter='nob';go('produk')");await pg.wait_for_timeout(200)
    cek(await pg.evaluate("$('#pb').value")=='nob','preset Beranda (belum ada barcode) tetap jalan')
    await pg.evaluate("S._prodFilter='revisi';go('produk')");await pg.wait_for_timeout(200)
    cek(await pg.evaluate("$('#pb').value")=='' and await pg.evaluate("produkList().length")==660,'preset lama revisi -> Semua barang, tidak kosong')
    await pg.screenshot(path=SS+'kat_produk.png')
    # form tambah produk: kategori & laci ditebak dari nama
    await pg.click('#addP');await pg.wait_for_timeout(200)
    async def ketik(n):
        await pg.fill('.modal #fn',n);await pg.dispatch_event('.modal #fn','input');await pg.wait_for_timeout(80)
        return await pg.evaluate("[$('.modal #fk').value, ($('.modal [data-fk].on')||{}).dataset?.fk]")
    for n,k in [('INDOMIE GORENG JUMBO','MIE, SOUN & BUBUR'),('SEMEN TIGA RODA 50 KG','MATERIAL BANGUNAN'),('GULA PASIR 1 KG','SEMBAKO'),('CHARM SAFE NIGHT','PEMBALUT & KEWANITAAN')]:
        r=await ketik(n);cek(r[0]==k,f'form: {n} -> {r}')
    r=await ketik('SEMEN TIGA RODA 50 KG');cek(r[1]=='material','semen -> laci material')
    r=await ketik('GULA PASIR 1 KG');cek(r[1]=='warung','gula -> laci warung lagi')
    await pg.select_option('.modal #fk','KOPI');r=await ketik('SABUN LIFEBUOY');cek(r[0]=='KOPI','kategori yang dipilih sendiri tidak ditimpa')
    await pg.screenshot(path=SS+'kat_form.png')
    await pg.click('.modal [data-close]');await pg.wait_for_timeout(150)
    # tambah cepat dari barcode
    await pg.evaluate("tambahCepatDialog({barcode:'8999999000017',nama:'SUNSILK HIJAB REFRESH 70 ML',sumber:'tes'})");await pg.wait_for_timeout(200)
    cek(await pg.evaluate("$('.modal #fk').value")=='SAMPO & PERAWATAN RAMBUT','tambah cepat: kategori ditebak')
    await pg.click('.modal [data-close]');await pg.wait_for_timeout(150)
    # pencarian prioritas tidak berubah aneh
    for q in ['kopi','gula','minyak','beras','garam']:
        print('  cari',q,':',await pg.evaluate(f"searchProducts('{q}',6).map(p=>p.nama).join(' | ')"))
    top=await pg.evaluate("searchProducts('kopi',1)[0].nama");cek('TOP KOPI GULA AREN' not in top,'cari kopi: '+top)
    top=await pg.evaluate("searchProducts('beras',1)[0].nama");cek(top=='BERAS 1KG','cari beras: '+top)
    # katalog halaman pesan
    k=await pg.evaluate("(()=>{const k=katalogData();return k.kat.map((c,i)=>k.ki[i]+' '+c)})()")
    print('katalog pesan:',k[:6],'...')
    cek(k[0]=='🍚 SEMBAKO','katalog pesan urut seperti rak, ada ikon')
    # Pengaturan > Harga & kategori
    await pg.click('nav button[data-v=pengaturan]');await pg.click('[data-st=harga]');await pg.wait_for_timeout(250)
    await pg.evaluate("document.getElementById('cKat').scrollIntoView()")
    print('tombol pilah:',await pg.inner_text('#kOto'))
    await pg.evaluate("document.querySelector('.katinfo').open=true")
    await pg.screenshot(path=SS+'kat_set.png')
    # pilah otomatis: buat 2 barang tanpa kategori lalu pilah
    await pg.evaluate("""(async()=>{await save('products',{id:'tz1',nama:'ROYCO AYAM 8 GR',kategori:'',harga:{umum:500},stok:0,aktif:true});
      await save('products',{id:'tz2',nama:'PERMEN KARET YOSAN',kategori:'MAINAN',harga:{umum:500},stok:0,aktif:true});render();})()""")
    await pg.wait_for_timeout(250)
    print('tombol pilah:',await pg.inner_text('#kOto'))
    await pg.click('#kOto');await pg.wait_for_timeout(150);await pg.click('.modal [data-yes]');await pg.wait_for_timeout(300)
    r=await pg.evaluate("['tz1','tz2'].map(i=>S.products.find(p=>p.id===i).kategori)")
    cek(r==['BUMBU DAPUR','SNACK & BISKUIT'],'pilah otomatis: '+str(r))
    # import Fastmart: kategori sudah rapi tidak ditimpa, barang baru ditebak
    await pg.click('[data-st=data]')
    async with pg.expect_file_chooser() as fc: await pg.click('#ifm')
    await (await fc.value).set_files('dist/produk_toko_mahyu_barcode.xlsx');await pg.wait_for_timeout(400);await pg.click('#oGo');await pg.wait_for_timeout(1800)
    await pg.click('.modal [data-close]')
    r=json.loads(await pg.evaluate("JSON.stringify((()=>{const A=S.products.filter(p=>p.aktif!==false);return {n:A.length,bukan:A.filter(p=>!isKategoriStandar(p.kategori)).map(p=>p.nama+' ['+p.kategori+']').slice(0,8),gas:(S.products.find(p=>p.nama==='TABUNG GAS 3 KG')||{}).kategori}})())"))
    print('setelah import ulang Fastmart:',r)
    cek(r['gas']=='SEMBAKO','import ulang tidak menimpa kategori yang sudah rapi')
    cek(not r['bukan'],'barang hasil import juga masuk kategori standar')
    # tampilan HP
    await pg.set_viewport_size({'width':390,'height':844});await pg.click('nav button[data-v=produk]');await pg.wait_for_timeout(250)
    ov=await pg.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth")
    cek(ov<=0,'HP: tidak ada geser ke samping (%d)'%ov)
    await pg.screenshot(path=SS+'kat_hp.png')
    cek(not errs,'tanpa error JS '+str(errs[:3]))
    await b.close()
  srv.terminate()
  print('\nGAGAL:',fails if fails else 'tidak ada')
asyncio.run(main())
