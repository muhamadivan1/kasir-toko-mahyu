"""Membuat ikon PNG dari src/assets/logo.svg (cukup dijalankan sekali kalau logo berubah).

Hasil (disalin build.py ke dist/):
  src/assets/icon-512.png           ikon aplikasi (sudut membulat, latar transparan)
  src/assets/icon-maskable-512.png  ikon untuk HP Android (latar merah penuh, keranjang di tengah area aman)
Butuh Playwright + Chromium.
"""
import asyncio, os
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)


async def main():
    svg = open(P('src/assets/logo.svg'), encoding='utf-8').read()
    isi = svg.split('>', 1)[1].rsplit('</svg>', 1)[0]
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME') or None)
        pg = await b.new_page(viewport={'width': 512, 'height': 512})
        await pg.set_content(
            '<body style="margin:0;background:transparent">'
            + svg.replace('<svg ', '<svg width="512" height="512" ', 1)
            + '</body>'
        )
        await pg.screenshot(path=P('src/assets/icon-512.png'), omit_background=True)
        # maskable: latar merah penuh, keranjang dikecilkan ke 76% supaya aman dipotong bulat
        await pg.set_content(
            '<body style="margin:0;background:#d22222">'
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512">'
            '<rect width="100" height="100" fill="#d22222"/><g transform="translate(12 12) scale(0.76)">'
            + isi
            + '</g></svg></body>'
        )
        await pg.screenshot(path=P('src/assets/icon-maskable-512.png'))
        await b.close()
    print('ikon dibuat di src/assets/')


if __name__ == '__main__':
    asyncio.run(main())
