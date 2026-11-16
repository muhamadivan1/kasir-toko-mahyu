"""Membuat src/data/barcode-indonesia.tsv (barcode <TAB> nama barang) untuk daftar barcode bawaan kasir.

Sumber: github.com/wpangestu/list-barcode-product-indonesia ("List barcode 1000 Product.xlsx"),
yang menurut README-nya boleh dipakai sesuai kebutuhan. Hanya barcode dengan digit cek yang benar yang dipakai.
Pemakaian: python3 tools/barcode_lokal.py "List barcode 1000 Product.xlsx"
"""
import os, re, sys
import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def cek_digit(kode):
    """EAN-13 / EAN-8 / UPC-A: digit terakhir harus cocok dengan hitungan."""
    if not re.fullmatch(r'\d{8}|\d{12}|\d{13}', kode):
        return False
    d = [int(c) for c in kode]
    badan, cek = d[:-1], d[-1]
    # bobot 3 untuk digit ganjil dari kanan (tanpa digit cek)
    total = sum(x * (3 if i % 2 == 0 else 1) for i, x in enumerate(reversed(badan)))
    return (10 - total % 10) % 10 == cek


def rapikan(nama):
    n = re.sub(r'\s+', ' ', str(nama or '')).strip().upper()
    n = re.sub(r'(\d)\s*M$', r'\1 ML', n)  # "100M" di ujung = 100 ML (terpotong di data asli)
    return n


def main(path):
    wb = openpyxl.load_workbook(path, read_only=True)
    hasil, buang = {}, 0
    for ws in wb:
        for r in ws.iter_rows(values_only=True):
            if not r or r[0] is None or not r[1]:
                continue
            kode = str(r[0]).strip().split('.')[0]
            if not cek_digit(kode):
                buang += 1
                continue
            hasil.setdefault(kode, rapikan(r[1]))
    out = os.path.join(ROOT, 'src', 'data', 'barcode-indonesia.tsv')
    with open(out, 'w', encoding='utf-8') as f:
        for kode in sorted(hasil):
            f.write(f'{kode}\t{hasil[kode]}\n')
    print(out, len(hasil), 'barcode,', buang, 'dibuang (digit cek salah)')


if __name__ == '__main__':
    main(sys.argv[1])
