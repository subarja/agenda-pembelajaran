#!/usr/bin/env python3
"""Diagram versi PROYEKSI (font besar) — untuk paparan tayang ke murid."""
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Rectangle, Circle
import numpy as np, os

OUT = "/sessions/vibrant-inspiring-einstein/mnt/Ko Kurikuler/SAKOLA_WALUYA_XI_2026/05_GAMBAR/TAYANG"
os.makedirs(OUT, exist_ok=True)
plt.rcParams['font.family'] = 'DejaVu Sans'

TEKS='#2B4C4F'; TEKS2='#4A6670'
HIJAU='#1FA971'; HIJAU2='#D6F2E4'
KUNING='#F0B429'; KUNING2='#FFF3D6'
BIRU='#2E9BD6';  BIRU2='#DCEFFA'
KORAL='#F4756B'; KORAL2='#FDE6E4'
ORANYE='#F2903D';ORANYE2='#FDEBDA'
UNGU='#9B7BD4';  UNGU2='#EEE7FA'
FIG = (13.33, 6.6)   # rasio area gambar di slide

def save(n):
    plt.savefig(f'{OUT}/{n}', dpi=130, facecolor='white', bbox_inches='tight', pad_inches=0.12)
    plt.close()

# ═══ 1. SKOR 7 KEBIASAAN (font besar) ═══
fig, ax = plt.subplots(figsize=FIG)
keb = ['Gemar\nBelajar','Ber-\nolahraga','Ber-\nmasyarakat','Tidur\nCepat','Makan\nSehat','Ber-\nibadah','Bangun\nPagi']
sk  = [5.50, 5.92, 6.41, 6.41, 6.44, 7.34, 7.93]
col = [KORAL if s < 6.5 else ORANYE for s in sk]
b = ax.bar(keb, sk, color=col, edgecolor='white', linewidth=3, width=0.7)
for r, s in zip(b, sk):
    ax.text(r.get_x()+r.get_width()/2, s+0.2, f'{s:.2f}'.replace('.', ','),
            ha='center', fontweight='bold', size=26, color=TEKS)
ax.axhline(6.57, color=TEKS, ls='--', lw=2.5)
ax.text(6.45, 6.75, 'rata-rata sekolah 6,57', color=TEKS, size=17, fontweight='bold', ha='right')
ax.set_ylim(0, 10)
ax.set_yticks([0, 5, 10]); ax.tick_params(axis='y', labelsize=17, colors=TEKS2)
ax.tick_params(axis='x', labelsize=19, colors=TEKS)
for lbl in ax.get_xticklabels(): lbl.set_fontweight('bold')
ax.set_title('SKOR 7 KEBIASAAN — SMKN 2 CIMAHI   (dari 10)',
             size=26, fontweight='bold', color=TEKS, pad=22)
ax.spines[['top','right']].set_visible(False)
ax.grid(axis='y', alpha=0.2)
plt.tight_layout(); save('T_01_Skor_7KAIH.png')

# 2. ENAM PERAN MURID (2 baris x 3 kolom)
fig, ax = plt.subplots(figsize=FIG); ax.axis('off'); ax.set_xlim(0,14); ax.set_ylim(0,7)
ax.text(7, 6.6, 'ENAM PERAN — SETIAP ORANG PUNYA SATU', size=30, fontweight='bold', color=TEKS, ha='center')
ax.text(7, 6.15, 'Tidak ada penonton.', size=20, style='italic', color=TEKS2, ha='center')
P = [('KAPTEN TIM','6 orang','Jaga keutuhan & keselamatan\ntimmu di lapangan',HIJAU,HIJAU2),
     ('TIM WAKTU','2 orang','Pegang stopwatch.\nUmumkan sisa waktu',BIRU,BIRU2),
     ('TIM PIKET DATA','2 orang','Jaga PAPAN KARTU.\nSiapa yang masih di luar?',UNGU,UNGU2),
     ('TIM K3','2 orang','Cek alat & APD.\nBoleh SETOP pekerjaan!',KORAL,KORAL2),
     ('TIM DOKUMENTASI','2 orang','Foto & video.\nBefore – After',ORANYE,ORANYE2),
     ('TIM LOGISTIK','2 orang','Siapkan & bereskan alat.\nBeres = boleh bubar',KUNING,KUNING2)]
for i,(n,j,d,c1,c2) in enumerate(P):
    cc = i % 3; rr = i // 3
    x = 0.4 + cc*4.45
    y = 3.35 - rr*2.55
    ax.add_patch(FancyBboxPatch((x,y),4.15,2.3, boxstyle='round,pad=0.08',
                                facecolor=c2, edgecolor=c1, lw=3))
    ax.add_patch(Rectangle((x,y+1.62),4.15,0.68, facecolor=c1))
    ax.text(x+0.25, y+1.96, n, size=17, color='white', va='center', fontweight='bold')
    ax.text(x+3.90, y+1.96, j, size=14, color='white', va='center', ha='right')
    ax.text(x+2.07, y+0.78, d, size=17, color=TEKS, ha='center', va='center', linespacing=1.9)
ax.text(7, 0.35, '"Saya tidak sedang malas — saya sedang mempercayai kalian."',
        size=19, style='italic', color=TEKS, ha='center', fontweight='bold')
plt.tight_layout(); save('T_02_Enam_Peran.png')

# ═══ 3. PAPAN KARTU ═══
fig, ax = plt.subplots(figsize=FIG); ax.axis('off'); ax.set_xlim(0,14); ax.set_ylim(0,7)
ax.text(7, 6.5, 'PAPAN KARTU', size=34, fontweight='bold', color=TEKS, ha='center')
COLS = ['#E5484D','#2E9BD6','#1FA971','#F0B429','#9B7BD4','#F2903D']
ax.add_patch(FancyBboxPatch((1.5,2.5),11.0,3.5, boxstyle="round,pad=0.1",
                            facecolor='#F7FBF9', edgecolor=TEKS, lw=3))
for i in range(6):
    x = 2.35 + i*1.78
    ax.plot([x,x],[5.5,5.1], color='#8FA9A2', lw=4)
    ax.add_patch(Circle((x,5.0),0.11, facecolor='#8FA9A2'))
    if i < 4:
        ax.plot([x-0.4,x,x+0.4],[4.0,4.95,4.0], color=COLS[i], lw=7, solid_capstyle='round')
        ax.add_patch(FancyBboxPatch((x-0.5,3.15),1.0,0.85, boxstyle="round,pad=0.05",
                                    facecolor=COLS[i], edgecolor='white', lw=3))
        ax.text(x, 3.57, f'TIM\n{i+1}', size=14, color='white', ha='center', va='center',
                fontweight='bold', linespacing=1.4)
    else:
        ax.add_patch(FancyBboxPatch((x-0.55,3.15),1.1,1.6, boxstyle="round,pad=0.05",
                                    facecolor='white', edgecolor=COLS[i], lw=3, linestyle='--'))
        ax.text(x, 4.3, f'TIM {i+1}', size=14, color=COLS[i], ha='center', fontweight='bold')
        ax.text(x, 3.75, 'KOSONG', size=13, color=KORAL, ha='center', fontweight='bold')
        ax.text(x, 3.35, 'masih\ndi luar', size=12, color=TEKS2, ha='center', va='center', linespacing=1.4)
ax.text(7, 2.75, 'KAIT KOSONG  =  TIM ITU MASIH DI LUAR',
        size=22, color=TEKS, ha='center', fontweight='bold')
tiga = [('AMBIL KARTU','= berangkat', BIRU),
        ('KAIT KOSONG','= masih di luar', ORANYE),
        ('GANTUNG KARTU','= sudah pulang', HIJAU)]
for i,(a,b_,c) in enumerate(tiga):
    x = 1.5 + i*3.85
    ax.add_patch(FancyBboxPatch((x,0.5),3.5,1.5, boxstyle="round,pad=0.07",
                                facecolor='#F7FBF9', edgecolor=c, lw=3))
    ax.text(x+1.75, 1.5, a, size=17, color=c, ha='center', fontweight='bold')
    ax.text(x+1.75, 0.95, b_, size=17, color=TEKS, ha='center')
plt.tight_layout(); save('T_03_Papan_Kartu.png')

# ═══ 4. POHON AKAR MASALAH ═══
fig, ax = plt.subplots(figsize=FIG); ax.axis('off'); ax.set_xlim(0,14); ax.set_ylim(0,7)
ax.text(7, 6.55, 'POHON AKAR MASALAH', size=32, fontweight='bold', color=TEKS, ha='center')
for x in [3.4, 7.0, 10.6]:
    ax.add_patch(Circle((x,5.35),0.62, facecolor=KORAL))
    ax.text(x, 5.35, 'BUAH', size=16, color='white', ha='center', va='center', fontweight='bold')
ax.text(12.4, 5.35, 'akibat yang\nTERLIHAT', size=17, color=KORAL, va='center', fontweight='bold', linespacing=1.6)
ax.add_patch(Rectangle((6.4,2.9),1.2,2.1, facecolor='#A98467'))
ax.text(7.0, 3.95, 'BATANG', size=16, color='white', ha='center', va='center', fontweight='bold', rotation=90)
ax.annotate('', xy=(6.35,3.95), xytext=(3.1,3.95), arrowprops=dict(arrowstyle='-|>', lw=2.5, color='#A98467'))
ax.text(1.05, 3.95, 'MASALAHNYA', size=17, color='#8D6E63', va='center', fontweight='bold')
for x in [3.6, 7.0, 10.4]:
    ax.plot([7,x],[2.9,1.9], color='#8D6E63', lw=5)
    ax.add_patch(FancyBboxPatch((x-1.05,1.0),2.1,0.9, boxstyle="round,pad=0.06",
                                facecolor=HIJAU, edgecolor='white', lw=2))
    ax.text(x, 1.45, 'AKAR', size=17, color='white', ha='center', va='center', fontweight='bold')
ax.text(12.4, 1.45, 'penyebab\nSEBENARNYA', size=17, color=HIJAU, va='center', fontweight='bold', linespacing=1.6)
ax.plot([0.6,13.4],[0.72,0.72], color='#8D6E63', lw=5)
ax.text(7, 0.28, 'AKAR YANG BAIK BISA DIKERJAKAN.  AKAR YANG BURUK CUMA MENYALAHKAN ORANG.',
        size=18, color=TEKS, ha='center', fontweight='bold')
plt.tight_layout(); pass  # T_04 TIDAK DIPAKAI: dek memakai 04_Template_Pohon_Akar_Masalah.png buatan sekolah

# ═══ 5. PETA EMPATI ═══
fig, ax = plt.subplots(figsize=FIG); ax.axis('off'); ax.set_xlim(0,14); ax.set_ylim(0,7)
ax.text(7, 6.55, 'PETA EMPATI', size=34, fontweight='bold', color=TEKS, ha='center')
ax.text(7, 6.05, 'Isi berdasarkan apa yang kalian LIHAT & DENGAR — bukan tebakan.',
        size=18, style='italic', color=TEKS2, ha='center')
Q = [(0.6, 3.15, BIRU2, BIRU, '1.  APA YANG DIA KATAKAN', 'Kutipan PERSISNYA.\nDalam tanda kutip.'),
     (7.15, 3.15, HIJAU2, HIJAU, '2.  APA YANG DIA LAKUKAN', 'Yang kalian lihat\ndengan mata sendiri.'),
     (0.6, 0.35, ORANYE2, ORANYE, '3.  APA YANG DIA PIKIRKAN', 'Dari nada bicara\n& ekspresinya.'),
     (7.15, 0.35, KORAL2, KORAL, '4.  APA YANG DIA RASAKAN', 'Lelah? Kesal?\nPasrah? Bangga?')]
for x,y,fc,ec,j,h in Q:
    ax.add_patch(FancyBboxPatch((x,y),6.25,2.55, boxstyle="round,pad=0.08",
                                facecolor=fc, edgecolor=ec, lw=3))
    ax.text(x+0.35, y+2.1, j, size=20, color=ec, fontweight='bold')
    ax.text(x+0.35, y+1.0, h, size=18, color=TEKS, va='center', linespacing=1.8)
plt.tight_layout(); save('T_05_Peta_Empati.png')

# ═══ 6. MATRIKS PRIORITAS ═══
fig, ax = plt.subplots(figsize=FIG); ax.axis('off'); ax.set_xlim(0,14); ax.set_ylim(0,7)
ax.text(7, 6.55, 'MATRIKS PRIORITAS', size=32, fontweight='bold', color=TEKS, ha='center')
K = [(7.3,3.5,'#C8E6C9',HIJAU,'AMBIL YANG INI','dampak besar +\nbisa kami kerjakan'),
     (2.0,3.5,'#FFF3D6',KUNING,'PERSEMPIT DULU','dampak besar,\ntapi butuh waktu lama'),
     (7.3,0.7,'#FDEBDA',ORANYE,'BOLEH, TAPI\nKURANG BERARTI','mudah,\ntapi dampaknya kecil'),
     (2.0,0.7,'#FDE6E4',KORAL,'JANGAN DIAMBIL','sulit, dan\ndampaknya kecil')]
for x,y,fc,ec,j,h in K:
    ax.add_patch(FancyBboxPatch((x,y),5.0,2.55, boxstyle="round,pad=0.07",
                                facecolor=fc, edgecolor=ec, lw=3))
    ax.text(x+2.5, y+1.85, j, size=20, color=ec, ha='center', fontweight='bold', linespacing=1.4)
    ax.text(x+2.5, y+0.75, h, size=17, color=TEKS, ha='center', va='center', linespacing=1.8)
ax.annotate('', xy=(13.0,0.42), xytext=(1.6,0.42), arrowprops=dict(arrowstyle='-|>', lw=3, color=TEKS))
ax.text(7.3, 0.06, 'BISA KAMI KERJAKAN  (2 hari, tanpa mesin)  →',
        size=18, color=TEKS, ha='center', fontweight='bold')
ax.annotate('', xy=(1.6,6.1), xytext=(1.6,0.42), arrowprops=dict(arrowstyle='-|>', lw=3, color=TEKS))
ax.text(1.15, 3.4, 'DAMPAK  (banyak orang terbantu)  →',
        size=18, color=TEKS, rotation=90, va='center', fontweight='bold')
plt.tight_layout(); save('T_06_Matriks_Prioritas.png')

# ═══ 7. SEKTOR + GELOMBANG (versi murid, ringkas) ═══
fig, ax = plt.subplots(figsize=FIG); ax.axis('off'); ax.set_xlim(0,14); ax.set_ylim(0,7)
ax.text(7, 6.55, 'KENAPA KITA TIDAK TURUN BARENGAN?', size=30, fontweight='bold', color=TEKS, ha='center')
ax.add_patch(FancyBboxPatch((0.5,5.35),13.0,0.85, boxstyle="round,pad=0.07",
                            facecolor=KORAL2, edgecolor=KORAL, lw=3))
ax.text(7, 5.77, 'Kelas XI ada 16.  576 murid.  96 tim.  Kalau semua turun bareng — sekolah kacau.',
        size=20, color='#8C1046', ha='center', va='center', fontweight='bold')
ax.add_patch(FancyBboxPatch((0.5,1.6),6.35,3.4, boxstyle="round,pad=0.08",
                            facecolor=BIRU2, edgecolor=BIRU, lw=3))
ax.text(3.67, 4.5, 'SEKTOR', size=26, color=BIRU, ha='center', fontweight='bold')
ax.text(3.67, 3.1, 'Kelas kita punya\nWILAYAH SENDIRI.\n\nDilarang mengukur\ndi sektor kelas lain.',
        size=18, color=TEKS, ha='center', va='center', linespacing=1.9)
ax.add_patch(FancyBboxPatch((7.15,1.6),6.35,3.4, boxstyle="round,pad=0.08",
                            facecolor=ORANYE2, edgecolor=ORANYE, lw=3))
ax.text(10.32, 4.5, 'GELOMBANG', size=26, color=ORANYE, ha='center', fontweight='bold')
ax.text(10.32, 3.1, '8 kelas turun DULU.\n8 kelas di kelas.\n\nLalu BERTUKAR.',
        size=18, color=TEKS, ha='center', va='center', linespacing=1.9)
ax.add_patch(FancyBboxPatch((0.5,0.35),13.0,0.95, boxstyle="round,pad=0.07",
                            facecolor='#E8F5E9', edgecolor=HIJAU, lw=3))
ax.text(7, 0.82, 'Butuh data dari sektor kelas lain?  MINTA ke kelas itu.\nItulah gotong royong yang sebenarnya.',
        size=19, color='#15794F', ha='center', va='center', fontweight='bold', linespacing=1.7)
plt.tight_layout(); save('T_07_Sektor_Gelombang.png')

print('OK — 7 diagram versi proyeksi di', OUT)
for f in sorted(os.listdir(OUT)): print('  ', f)
