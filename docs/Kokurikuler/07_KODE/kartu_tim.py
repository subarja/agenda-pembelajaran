#!/usr/bin/env python3
"""KARTU TIM — pengganti Papan Kalung.
Hasil:
  05_GAMBAR/16_Papan_Kartu.png            (versi dokumen guru)
  05_GAMBAR/TAYANG/T_03_Papan_Kartu.png   (versi proyeksi, font besar)
  05_GAMBAR/17_Lembar_Cetak_Kartu_Tim.png (siap cetak/fotokopi A4)
"""
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Rectangle
import os

BASE = "/sessions/vibrant-inspiring-einstein/mnt/Ko Kurikuler/SAKOLA_WALUYA_XI_2026/05_GAMBAR"
TAY  = BASE + "/TAYANG"
os.makedirs(TAY, exist_ok=True)
plt.rcParams['font.family'] = 'DejaVu Sans'

TEKS='#2B4C4F'; TEKS2='#4A6670'; NAVY='#1F3864'
HIJAU='#1FA971'; KORAL='#F4756B'; BIRU='#2E9BD6'; KUNING='#F0B429'
COLS = ['#E5484D','#2E9BD6','#1FA971','#F0B429','#9B7BD4','#F2903D']


def kartu(ax, x, y, w, h, warna, judul, isi, sz_j, sz_i, kosong=False):
    """Satu kartu tim. kosong=True -> slot ditinggal (tim sedang di luar)."""
    if kosong:
        ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle='round,pad=0.05',
                                    facecolor='white', edgecolor=warna, lw=2.5, linestyle='--'))
        ax.text(x+w/2, y+h*0.62, judul, size=sz_j, color=warna, ha='center', fontweight='bold')
        ax.text(x+w/2, y+h*0.28, isi, size=sz_i, color=KORAL, ha='center', fontweight='bold')
    else:
        ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle='round,pad=0.05',
                                    facecolor=warna, edgecolor='white', lw=2.5))
        ax.text(x+w/2, y+h*0.62, judul, size=sz_j, color='white', ha='center', fontweight='bold')
        ax.text(x+w/2, y+h*0.28, isi, size=sz_i, color='white', ha='center')


def papan(fname, figsize, S):
    """S = kamus ukuran font, supaya versi dokumen & versi tayang pakai kode yang sama."""
    fig, ax = plt.subplots(figsize=figsize); ax.axis('off')
    ax.set_xlim(0, 14); ax.set_ylim(0, 7)

    ax.text(7, 6.55, 'PAPAN KARTU', size=S['j'], fontweight='bold', color=TEKS, ha='center')
    ax.text(7, 6.10, 'Enam kartu, satu papan. Guru cukup MELIHAT — tidak menandatangani apa pun.',
            size=S['sub'], style='italic', color=TEKS2, ha='center')

    # papan
    ax.add_patch(FancyBboxPatch((1.3, 2.75), 11.4, 3.05, boxstyle='round,pad=0.1',
                                facecolor='#F7FBF9', edgecolor=TEKS, lw=2.5))
    ax.text(7, 5.52, 'PAPAN KARTU   ·   KELAS XI ................', size=S['hdr'],
            fontweight='bold', color=TEKS, ha='center')

    for i in range(6):
        x = 1.72 + i*1.83
        if i < 4:
            kartu(ax, x, 3.62, 1.5, 1.72, COLS[i], f'TIM\n{i+1}', 'ADA', S['kj'], S['ki'])
        else:
            kartu(ax, x, 3.62, 1.5, 1.72, COLS[i], f'TIM {i+1}', 'SLOT\nKOSONG', S['kj'], S['ki'], kosong=True)

    ax.text(7, 3.14, 'SLOT KOSONG  =  TIM ITU SEDANG DI LUAR KELAS',
            size=S['ket'], color=TEKS, ha='center', va='center', fontweight='bold')

    tiga = [('BERANGKAT', 'Kapten AMBIL\nkartu timnya.\nSlot jadi kosong.', BIRU),
            ('DI LAPANGAN', 'Kartu DIBAWA\nKapten. Itu\nidentitas timmu.', KUNING),
            ('PULANG', 'KEMBALIKAN kartu\nke slotnya.\nBelum kembali =\nbelum pulang.', HIJAU)]
    for i, (a, b, c) in enumerate(tiga):
        x = 1.3 + i*3.9
        ax.add_patch(FancyBboxPatch((x, 0.45), 3.6, 1.95, boxstyle='round,pad=0.07',
                                    facecolor='#F7FBF9', edgecolor=c, lw=2.5))
        ax.add_patch(Rectangle((x, 1.88), 3.6, 0.52, facecolor=c))
        ax.text(x+1.8, 2.14, a, size=S['bj'], color='white', ha='center', va='center', fontweight='bold')
        ax.text(x+1.8, 1.15, b, size=S['bi'], color=TEKS, ha='center', va='center', linespacing=1.7)

    plt.tight_layout()
    plt.savefig(fname, dpi=140, facecolor='white', bbox_inches='tight', pad_inches=0.12)
    plt.close()


# versi dokumen guru (lebih kecil)
papan(f'{BASE}/16_Papan_Kartu.png', (13, 6.6),
      dict(j=24, sub=13, hdr=14, kj=13, ki=11, ket=15, bj=14, bi=11))
# versi proyeksi ke murid (font besar)
papan(f'{TAY}/T_03_Papan_Kartu.png', (13.33, 6.6),
      dict(j=34, sub=17, hdr=18, kj=17, ki=14, ket=21, bj=19, bi=13.5))

# ═══════════ LEMBAR CETAK KARTU TIM (A4, 6 kartu) ═══════════
fig, ax = plt.subplots(figsize=(8.27, 11.69)); ax.axis('off')
ax.set_xlim(0, 10); ax.set_ylim(0, 14)

ax.text(5, 13.55, 'KARTU TIM  —  SAKOLA WALUYA', size=17, fontweight='bold', color=NAVY, ha='center')
ax.text(5, 13.15, 'Cetak / fotokopi 1 lembar per kelas  ·  gunting  ·  laminating atau tempel di karton',
        size=9.5, style='italic', color=TEKS2, ha='center')
ax.text(5, 12.82, 'Simpan di PAPAN KARTU di depan kelas. Diurus Tim Piket Data — bukan guru.',
        size=9.5, style='italic', color=TEKS2, ha='center')

W, H = 4.3, 2.55
for i in range(6):
    cc, rr = i % 2, i // 2
    x = 0.55 + cc*4.85
    y = 9.75 - rr*2.85

    ax.add_patch(FancyBboxPatch((x, y), W, H, boxstyle='round,pad=0.05',
                                facecolor='white', edgecolor=COLS[i], lw=2.0, linestyle=(0, (6, 3))))
    ax.add_patch(Rectangle((x+0.1, y+H-0.72), W-0.2, 0.64, facecolor=COLS[i]))
    ax.text(x+0.3, y+H-0.40, f'TIM {i+1}', size=15, color='white', va='center', fontweight='bold')
    ax.text(x+W-0.3, y+H-0.40, 'SAKOLA WALUYA', size=7.5, color='white', va='center', ha='right')

    yy = y + H - 1.10
    for lbl in ['KELAS', 'SEKTOR / TUJUAN', 'KEMBALI PUKUL']:
        ax.text(x+0.28, yy, lbl, size=8, color=TEKS2, va='center', fontweight='bold')
        ax.plot([x+1.85, x+W-0.28], [yy-0.07, yy-0.07], color='#B9C9C6', lw=1)
        yy -= 0.47

    ax.text(x+W/2, y+0.16, 'DIBAWA KAPTEN TIM  ·  KEMBALIKAN KE PAPAN',
            size=7.8, color='#8A6208', ha='center', va='center', fontweight='bold')

ax.add_patch(FancyBboxPatch((0.55, 0.35), 9.15, 3.15, boxstyle='round,pad=0.07',
                            facecolor='#F7FBF9', edgecolor=NAVY, lw=1.8))
ax.text(0.95, 3.16, 'ATURAN KARTU  (dibacakan Hari 1, ditempel di dinding)',
        size=11, fontweight='bold', color=NAVY, va='center')
aturan = [
    '1.  BERANGKAT — Kapten Tim mengambil kartu timnya dari papan. Slot menjadi kosong.',
    '2.  DI LUAR — Kartu dibawa Kapten. Ditanya Marshal atau guru piket? Tunjukkan kartunya.',
    '3.  PULANG — Kartu dikembalikan ke slotnya. Kartu belum kembali = tim belum pulang.',
    '4.  Guru TIDAK menandatangani apa pun. Izin melekat pada SEKTOR dari Koordinator.',
    '5.  Kartu hilang: tim tidak boleh keluar sampai kartu penggantinya dibuat.',
]
yy = 2.66
for t in aturan:
    ax.text(0.95, yy, t, size=9.3, color=TEKS, va='center')
    yy -= 0.47

plt.tight_layout()
plt.savefig(f'{BASE}/17_Lembar_Cetak_Kartu_Tim.png', dpi=170, facecolor='white',
            bbox_inches='tight', pad_inches=0.15)
plt.close()

print("OK - papan kartu + lembar cetak")
