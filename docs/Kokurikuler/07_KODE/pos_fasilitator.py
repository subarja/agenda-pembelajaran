#!/usr/bin/env python3
"""12_Sistem_Pos_Fasilitator.png — dibangun ulang. Tanpa tumpang tindih."""
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Circle
import numpy as np, os

OUT = "/sessions/vibrant-inspiring-einstein/mnt/Ko Kurikuler/SAKOLA_WALUYA_XI_2026/05_GAMBAR"
plt.rcParams['font.family'] = 'DejaVu Sans'

NAVY='#1F3864'; TEKS='#2B4C4F'; TEKS2='#4A6670'
BIRU='#2E9BD6'; BIRU2='#DCEFFA'
HIJAU='#1FA971'; HIJAU2='#D6F2E4'
KORAL='#E5484D'; KORAL2='#FDE6E4'
UNGU='#9B7BD4'; UNGU2='#EEE7FA'
KUNING='#F0B429'; KUNING2='#FFF3D6'

fig, ax = plt.subplots(figsize=(13.5, 8.4)); ax.axis('off')
ax.set_xlim(0, 100); ax.set_ylim(0, 62)

# ── judul
ax.text(50, 59.6, 'SISTEM POS FASILITATOR', size=25, fontweight='bold', color=NAVY, ha='center', va='center')
ax.text(50, 56.6, 'Cara SATU guru mengawasi 6 tim yang menyebar  (Hari 2 & Hari 3)',
        size=12.5, style='italic', color=TEKS2, ha='center', va='center')

# ── pita peringatan (kotak sendiri, tidak menempel apa pun)
ax.add_patch(FancyBboxPatch((7, 52.0), 86, 3.4, boxstyle='round,pad=0.25',
                            facecolor=KORAL2, edgecolor=KORAL, lw=1.6))
ax.text(50, 53.7, 'JANGAN ikut berkeliling bersama SATU tim — 5 tim lain akan tanpa pengawasan.',
        size=12.5, fontweight='bold', color=KORAL, ha='center', va='center')

# ── POS di tengah
CX, CY, R = 50, 33.5, 8.6
ax.add_patch(Circle((CX, CY), R, facecolor=NAVY))
ax.text(CX, CY + 1.9, 'POS', size=24, fontweight='bold', color='white', ha='center', va='center')
ax.text(CX, CY - 1.6, 'GURU\nMENETAP', size=12.5, color='#BCD2E8', ha='center', va='center', linespacing=1.5)

# ── 6 tim: dua kolom mengapit POS (grid tetap, tidak mungkin bertumpuk)
BW, BH = 22.0, 7.6
ROWS = [44.6, 33.5, 22.4]                 # tiga baris
LX, RX = 15.0, 85.0                       # pusat kolom kiri & kanan
TIM = [
    ('TIM 1', 'Toilet lantai 1', LX, ROWS[0]),
    ('TIM 2', 'Wastafel lt. 2',  RX, ROWS[0]),
    ('TIM 3', 'Kantin',          RX, ROWS[1]),
    ('TIM 4', 'Tempat sampah',   RX, ROWS[2]),
    ('TIM 5', 'Lapangan',        LX, ROWS[2]),
    ('TIM 6', 'Lorong kelas',    LX, ROWS[1]),
]
for nama, lok, bx, by in TIM:
    # garis penghubung: dari tepi kotak (sisi menghadap POS) ke tepi lingkaran
    kanan = bx > CX
    sx = bx + BW/2 if not kanan else bx - BW/2
    dx, dy = CX - sx, CY - by
    L = np.hypot(dx, dy)
    ex, ey = CX - dx/L*(R+0.3), CY - dy/L*(R+0.3)
    ax.plot([sx, ex], [by, ey], color='#AFC3C9', lw=1.8, ls=(0, (5, 3)), zorder=1)

    ax.add_patch(FancyBboxPatch((bx-BW/2, by-BH/2), BW, BH, boxstyle='round,pad=0.25',
                                facecolor=BIRU2, edgecolor=BIRU, lw=1.8, zorder=2))
    ax.text(bx, by + 1.6, nama, size=13, fontweight='bold', color=NAVY, ha='center', va='center', zorder=3)
    ax.text(bx, by - 1.7, lok,  size=11.5, color=TEKS, ha='center', va='center', zorder=3)

# ── tiga aturan pos (di bawah, terpisah jauh)
BAR = [
    ('KARTU TIM',            'Kapten mengambil kartu timnya sebelum berangkat. Kartu dibawa sebagai identitas tim di lapangan.', HIJAU, HIJAU2),
    ('PAPAN KARTU',          'Dijaga TIM PIKET DATA (murid). SLOT KOSONG = tim masih di luar. Guru cukup MELIHAT, tidak tanda tangan.', UNGU, UNGU2),
    ('LAPOR BALIK 20 MENIT', 'Kapten datang ke Pos atau kirim WA grup kelas. TELAT KEMBALI = kartu ditahan, tidak turun lagi hari itu.', KORAL, KORAL2),
]
y = 13.0
for judul, isi, c, c2 in BAR:
    ax.add_patch(FancyBboxPatch((4, y), 92, 3.9, boxstyle='round,pad=0.2',
                                facecolor=c2, edgecolor=c, lw=1.5))
    ax.add_patch(FancyBboxPatch((4.6, y+0.35), 22.5, 3.2, boxstyle='round,pad=0.15',
                                facecolor=c, edgecolor=c, lw=0))
    ax.text(15.85, y+1.95, judul, size=11.5, fontweight='bold', color='white', ha='center', va='center')
    ax.text(29.5, y+1.95, isi, size=9.6, color=TEKS, ha='left', va='center')
    y -= 4.6

ax.text(50, 1.4, 'Guru boleh berkeliling maksimal 5 menit — hanya ke lokasi yang MASIH TERLIHAT dari Pos.',
        size=11, style='italic', color=TEKS2, ha='center', va='center')

plt.savefig(f'{OUT}/12_Sistem_Pos_Fasilitator.png', dpi=150, facecolor='white',
            bbox_inches='tight', pad_inches=0.18)
plt.close()
print("OK 12_Sistem_Pos_Fasilitator.png")
