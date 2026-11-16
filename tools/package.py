"""Membuat paket zip siap pakai & siap hosting dari hasil build (dist/)."""
import os, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
TOP = 'Kasir_Toko_Mahyu/'
LIBS = ['lib/jsbarcode/dist/JsBarcode.all.min.js', 'lib/xlsx/dist/xlsx.mini.min.js',
        'lib/qrcode-generator/dist/qrcode.js', 'lib/jsqr/dist/jsQR.js', 'lib/zxing/umd/index.min.js']


def main():
    out = P('Kasir_Toko_Mahyu.zip')
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        add = lambda src, dst: z.write(P(src), TOP + dst)
        # dipakai langsung di PC (offline)
        add('dist/index.html', 'index.html')
        add('dist/PANDUAN.txt', 'PANDUAN.txt')
        add('dist/produk_toko_mahyu_barcode.xlsx', 'produk_toko_mahyu_barcode.xlsx')
        # isi situs untuk hosting (diunggah ke folder public di GitHub)
        for f in ['index.html', 'pesan.html', 'manifest.json', 'sw.js', 'icon.png', 'icon-maskable.png']:
            add('dist/' + f, 'public/' + f)
        add('src/_headers', 'public/_headers')
        # kode sumber
        for f in ['README.md', 'build.py', 'tools/package.py', 'tools/barcode_lokal.py', 'tools/buat_ikon.py', 'tools/.prettierrc.json', *LIBS]:
            add(f, 'kode-sumber/' + f)
        for d, _, files in os.walk(P('src')):
            for f in sorted(files):
                full = os.path.join(d, f)
                add(os.path.relpath(full, ROOT), 'kode-sumber/' + os.path.relpath(full, ROOT))
    print(out, os.path.getsize(out) // 1024, 'KB')


if __name__ == '__main__':
    main()
