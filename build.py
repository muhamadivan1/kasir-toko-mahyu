"""Build Kasir Toko Mahyu.

Menggabungkan sumber di src/ menjadi satu file HTML mandiri (bisa jalan offline):
  src/index.template.html  -> kerangka halaman kasir
  src/css/*.css            -> gaya tampilan
  src/shared/*.js          -> kode bersama kasir & halaman pesan (mesin pencarian)
  src/js/*.js              -> kode aplikasi kasir (urutan sesuai nama file)
  src/pesan/*              -> halaman pesan pelanggan (pesan.html)
  src/data/barcode-indonesia.tsv -> daftar barcode bawaan (nama barang otomatis saat scan)
  lib/*                    -> pustaka pihak ketiga (barcode, excel, QR)
  src/assets/logo.svg       -> logo toko (ikon tab + logo di kepala halaman), ikon PNG dari tools/buat_ikon.py
Hasil di dist/: index.html, pesan.html, manifest.json, sw.js, icon.png, icon-maskable.png
"""
import base64, glob, json, os, shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
P = lambda *a: os.path.join(ROOT, *a)
read = lambda p: open(P(p), encoding='utf-8').read()


def safe(js):
    """Cegah '</script' di dalam kode yang disisipkan ke tag <script>."""
    return js.replace('</script', '<\\/script')


LIBS = {
    'JSBARCODE': 'lib/jsbarcode/dist/JsBarcode.all.min.js',
    'XLSX': 'lib/xlsx/dist/xlsx.mini.min.js',
    'QRGEN': 'lib/qrcode-generator/dist/qrcode.js',
    'JSQR': 'lib/jsqr/dist/jsQR.js',
    'ZXING': 'lib/zxing/umd/index.min.js',
}


def concat(pattern):
    out = []
    for f in sorted(glob.glob(P(pattern))):
        out.append(f'/* ===== {os.path.relpath(f, P("src"))} ===== */\n' + open(f, encoding='utf-8').read())
    return '\n'.join(out)


def logo_uri():
    """Logo toko (src/assets/logo.svg) sebagai data URI: ikon tab & logo di kepala halaman, tetap jalan offline."""
    return 'data:image/svg+xml;base64,' + base64.b64encode(read('src/assets/logo.svg').strip().encode('utf-8')).decode()


def pesan_template():
    """Halaman pesan pelanggan, QR & katalog masih berupa tempat kosong (/*__QRGEN__*/, /*__EMBED__*/)."""
    html = read('src/pesan/pesan.template.html').replace('__LOGO_URI__', logo_uri())
    html = html.replace('/*__CSS__*/', read('src/pesan/pesan.css'))
    html = html.replace('/*__APP__*/', safe(concat('src/shared/*.js') + '\n' + read('src/pesan/pesan.js')))
    return html


def build_kasir():
    html = read('src/index.template.html').replace('__LOGO_URI__', logo_uri())
    html = html.replace('/*__CSS__*/', concat('src/css/*.css'))
    # pustaka dulu, supaya tempat kosong di dalam template pesan & kode aplikasi tidak ikut terganti
    for k, path in LIBS.items():
        html = html.replace(f'/*__{k}__*/', safe(read(path)))
    # template halaman pesan ikut disimpan di kasir (untuk pratinjau & file mandiri tanpa hosting)
    html = html.replace('/*__PESAN_TPL__*/', safe('window.PESAN_TPL=' + json.dumps(pesan_template()) + ';'))
    # daftar barcode bawaan (barcode <TAB> nama), untuk mengisi nama barang baru tanpa internet
    html = html.replace('/*__BARCODE__*/', safe('window.BARCODE_LOKAL=' + json.dumps(read('src/data/barcode-indonesia.tsv')) + ';'))
    html = html.replace('/*__APP__*/', safe(concat('src/shared/*.js') + '\n' + concat('src/js/*.js')))
    return html


def build_pesan():
    html = pesan_template()
    html = html.replace('/*__QRGEN__*/', safe(read(LIBS['QRGEN'])))
    html = html.replace('/*__EMBED__*/', '')
    return html


def main():
    os.makedirs(P('dist'), exist_ok=True)
    kasir = build_kasir()
    open(P('dist/index.html'), 'w', encoding='utf-8').write(kasir)
    pesan = build_pesan()
    open(P('dist/pesan.html'), 'w', encoding='utf-8').write(pesan)
    json.dump({"name": "Kasir Toko Mahyu", "short_name": "Kasir Mahyu", "start_url": "./index.html", "display": "standalone",
               "background_color": "#f3f5f9", "theme_color": "#1d4e89",
               "icons": [{"src": "icon.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
                         {"src": "icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]},
              open(P('dist/manifest.json'), 'w'), indent=1)
    open(P('dist/sw.js'), 'w').write(read('src/sw.js'))
    shutil.copyfile(P('src/assets/icon-512.png'), P('dist/icon.png'))
    shutil.copyfile(P('src/assets/icon-maskable-512.png'), P('dist/icon-maskable.png'))
    print('index.html', len(kasir), '| pesan.html', len(pesan))


if __name__ == '__main__':
    main()
