#!/usr/bin/env python3
"""Aset visual SAKOLA WALUYA — SMKN 2 Cimahi."""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Rectangle, Circle, FancyArrowPatch
import numpy as np
import os

OUT = "/sessions/vibrant-inspiring-einstein/mnt/Ko Kurikuler/SAKOLA_WALUYA_XI_2026/05_GAMBAR"
os.makedirs(OUT, exist_ok=True)

NAVY = '#1F3864'; BLUE = '#2E74B5'; GOLD = '#BF8F00'; GRN = '#2E7D32'
ROSE = '#AD1457'; ORG = '#C55A11'; GREY = '#595959'; LIGHT = '#E8F0FA'

plt.rcParams['font.family'] = 'DejaVu Sans'


# ---------- 1. RADAR TEMPLATE (kosong, untuk dicetak) ----------
def radar_template(filename, title, data=None, label=None, color=BLUE):
    labels = ['Bangun\nPagi', 'Beribadah', 'Berolahraga', 'Makan Sehat\n& Bergizi',
              'Gemar\nBelajar', 'Bermasyarakat', 'Tidur\nCepat']
    N = len(labels)
    ang = [n / float(N) * 2 * np.pi for n in range(N)]
    ang += ang[:1]

    fig, ax = plt.subplots(figsize=(8, 8), subplot_kw=dict(polar=True))
    ax.set_theta_offset(np.pi / 2)
    ax.set_theta_direction(-1)
    ax.set_xticks(ang[:-1])
    ax.set_xticklabels(labels, size=12, fontweight='bold', color=NAVY)
    ax.set_ylim(0, 10)
    ax.set_yticks([2, 4, 6, 8, 10])
    ax.set_yticklabels(['2', '4', '6', '8', '10'], size=9, color=GREY)
    ax.grid(color='#B0BEC5', linewidth=0.9)
    ax.spines['polar'].set_color('#B0BEC5')

    if data:
        v = data + data[:1]
        ax.plot(ang, v, color=color, linewidth=2.5, label=label)
        ax.fill(ang, v, color=color, alpha=0.18)
        for a, val in zip(ang[:-1], data):
            ax.text(a, val + 0.55, f'{val}', ha='center', size=10,
                    fontweight='bold', color=color)
        if label:
            ax.legend(loc='upper right', bbox_to_anchor=(1.22, 1.10), fontsize=10)

    ax.set_title(title, size=16, fontweight='bold', color=NAVY, pad=32)
    plt.tight_layout()
    plt.savefig(f'{OUT}/{filename}', dpi=160, bbox_inches='tight', facecolor='white')
    plt.close()


radar_template('01_Radar_Kebiasaan_KOSONG.png',
               'RADAR KEBIASAANKU\n(isi sendiri: beri titik pada skormu, lalu hubungkan)')
radar_template('02_Radar_Skor_SMKN2_Cimahi.png',
               'SKOR 7 KEBIASAAN — SMKN 2 CIMAHI\nRapor Pendidikan 2025',
               data=[7.93, 7.34, 5.92, 6.44, 5.50, 6.41, 6.41],
               label='SMKN 2 Cimahi (rata-rata 6,57)', color=ROSE)


# ---------- 2. BAR CHART SKOR 7 KAIH ----------
fig, ax = plt.subplots(figsize=(11, 6))
keb = ['Gemar\nBelajar', 'Berolahraga', 'Bermasyarakat', 'Tidur\nCepat',
       'Makan Sehat\n& Bergizi', 'Beribadah', 'Bangun\nPagi']
sk = [5.50, 5.92, 6.41, 6.41, 6.44, 7.34, 7.93]
cols = ['#C62828' if s < 6.5 else '#EF6C00' for s in sk]
bars = ax.bar(keb, sk, color=cols, edgecolor='white', linewidth=2, width=0.68)
for b, s in zip(bars, sk):
    ax.text(b.get_x() + b.get_width() / 2, s + 0.13, f'{s:.2f}'.replace('.', ','),
            ha='center', fontweight='bold', size=13, color=NAVY)
ax.axhline(6.57, color=NAVY, ls='--', lw=2)
ax.text(6.55, 6.72, 'Rata-rata sekolah 6,57', color=NAVY, size=10,
        fontweight='bold', ha='right')
ax.set_ylim(0, 10)
ax.set_ylabel('Skor (skala 0–10)', size=12, fontweight='bold', color=NAVY)
ax.set_title('TUJUH KEBIASAAN ANAK INDONESIA HEBAT — SMKN 2 CIMAHI\n'
             'Rapor Pendidikan 2025 · MERAH = KURANG',
             size=15, fontweight='bold', color=NAVY, pad=18)
ax.spines[['top', 'right']].set_visible(False)
ax.tick_params(colors=NAVY, labelsize=10)
ax.grid(axis='y', alpha=0.25)
plt.tight_layout()
plt.savefig(f'{OUT}/03_Grafik_Skor_7KAIH.png', dpi=160, facecolor='white')
plt.close()


# ---------- 3. POSTER 5 ZONA (A3 portrait) ----------
ZONA = [
    ('Z1', 'CAI &\nKABERSIHAN', 'Air & Sanitasi', '#0277BD',
     'Indeks Sanitasi sekolah kita:',
     '30', 'dari 100  —  KURANG',
     'Air. Toilet. Wastafel. Sabun.\nBisakah kita perbaiki?',
     'Rapor Pendidikan 2025 · E.7.2'),
    ('Z2', 'DAHAR\nSEHAT', 'MBG, Gizi & Sampah Makanan', '#EF6C00',
     'Skor Makan Sehat & Bergizi kita:',
     '6,44', 'dari 10  —  KURANG',
     'Setiap hari kita makan MBG bersama.\nTapi berapa yang terbuang?\nApa yang sebenarnya kita makan?',
     'Rapor Pendidikan 2025 · D.19.4'),
    ('Z3', 'BETAH\nDIAJAR', 'Gemar Belajar & Tidur Cepat', '#6A1B9A',
     'Skor Gemar Belajar kita:',
     '5,50', 'dari 10  —  TERENDAH',
     'Kenapa belajar terasa berat?\nKenapa kita selalu mengantuk?\n(Skor Tidur Cepat: 6,41 — KURANG)',
     'Rapor Pendidikan 2025 · D.19.5 & D.19.7'),
    ('Z4', 'AWAK\nBUGAR', 'Bergerak & Bugar', '#2E7D32',
     'Skor Berolahraga kita:',
     '5,92', 'dari 10  —  KURANG',
     'Kita duduk 7 jam sehari.\nBadan kita protes.\nApa yang bisa kita ubah?',
     'Rapor Pendidikan 2025 · D.19.3'),
    ('Z5', 'SAKOLA AMAN\n& SOMEAH', 'Aman, Ramah & Setara', '#AD1457',
     'Murid yang terpapar rokok/miras/narkoba:',
     '30%', 'dan perundungan MENINGKAT',
     'Kesejahteraan psikologis kita: 59,30\n(peringkat menengah BAWAH)\n\nBagaimana caranya sekolah ini\njadi tempat yang aman untuk semua?',
     'Rapor Pendidikan 2025 · D.4.1, D.4.4, D.4.10'),
]

for code, nama, sub, warna, lead, angka, satuan, tanya, sumber in ZONA:
    fig = plt.figure(figsize=(11.7, 16.5))          # A3 portrait
    ax = fig.add_axes([0, 0, 1, 1]); ax.axis('off')
    ax.set_xlim(0, 10); ax.set_ylim(0, 14)

    ax.add_patch(Rectangle((0, 11.9), 10, 2.1, color=warna))
    ax.text(0.55, 13.15, code, size=50, fontweight='bold', color='white', va='center')
    lines = nama.split('\n')
    if len(lines) == 1:
        ax.text(2.05, 13.15, lines[0], size=30, fontweight='bold',
                color='white', va='center')
    else:
        ax.text(2.05, 13.52, lines[0], size=27, fontweight='bold',
                color='white', va='center')
        ax.text(2.05, 12.80, lines[1], size=27, fontweight='bold',
                color='white', va='center')
    ax.text(9.45, 12.25, sub.upper(), size=12, color='white', alpha=0.92,
            va='center', ha='right')

    ax.text(5, 11.1, 'ZONA AKSI WALUYA', size=13, color=GREY,
            ha='center', fontweight='bold')
    ax.text(5, 10.2, lead, size=17, color=NAVY, ha='center')
    ax.text(5, 8.3, angka, size=110, fontweight='bold', color=warna, ha='center', va='center')
    ax.text(5, 6.9, satuan, size=19, fontweight='bold', color='#C62828', ha='center')

    ax.add_patch(FancyBboxPatch((0.9, 3.5), 8.2, 2.75,
                                boxstyle="round,pad=0.18", linewidth=2.5,
                                edgecolor=warna, facecolor='#F7F9FC'))
    ax.text(5, 4.9, tanya, size=19, color=NAVY, ha='center', va='center',
            linespacing=1.75)

    ax.text(5, 2.6, 'Ngamimitian ti Diri, Mere Mangpaat pikeun Sakola',
            size=15, style='italic', color=warna, ha='center', fontweight='bold')
    ax.text(5, 1.95, 'SAKOLA WALUYA  ·  Kokurikuler Kelas XI  ·  15–21 Juli 2026',
            size=12, color=GREY, ha='center')
    ax.plot([1.5, 8.5], [1.55, 1.55], color='#C9D3DD', lw=1.5)
    ax.text(5, 1.1, 'CAGEUR  ·  BAGEUR  ·  BENER  ·  PINTER  ·  SINGER',
            size=13, fontweight='bold', color=NAVY, ha='center')
    ax.text(5, 0.55, f'Sumber: {sumber}  |  SMK Negeri 2 Cimahi',
            size=9, color=GREY, ha='center')

    plt.savefig(f'{OUT}/10_Poster_{code}_{nama.replace(chr(10), "_").replace(" ", "")}.png',
                dpi=110, facecolor='white')
    plt.close()


# ---------- 4. POHON AKAR MASALAH (template) ----------
fig, ax = plt.subplots(figsize=(11.7, 8.3))
ax.axis('off'); ax.set_xlim(0, 12); ax.set_ylim(0, 9)
ax.text(6, 8.5, 'POHON AKAR MASALAH', size=22, fontweight='bold',
        color=NAVY, ha='center')
ax.text(6, 8.0, 'Gunakan teknik 5× KENAPA. Berhenti hanya kalau akarnya BISA DIKERJAKAN.',
        size=11, style='italic', color=GREY, ha='center')

for i, x in enumerate([2.6, 6.0, 9.4]):
    ax.add_patch(Circle((x, 6.7), 0.85, color='#C62828', alpha=0.85))
    ax.text(x, 6.7, 'BUAH', size=12, fontweight='bold', color='white',
            ha='center', va='center')
ax.text(11.4, 6.7, 'Akibat yang\nTERLIHAT', size=10, color='#C62828',
        fontweight='bold', va='center')

ax.add_patch(Rectangle((5.45, 3.4), 1.1, 3.0, color='#8D6E63'))
ax.text(6.0, 4.9, 'BATANG\n=\nMASALAH', size=11, fontweight='bold',
        color='white', ha='center', va='center', linespacing=1.6)

for x, ang in [(3.0, 200), (6.0, 270), (9.0, 340)]:
    ax.plot([6, x], [3.4, 1.9], color='#5D4037', lw=4)
    ax.add_patch(FancyBboxPatch((x - 1.15, 1.0), 2.3, 0.95,
                                boxstyle="round,pad=0.1",
                                facecolor='#66BB6A', edgecolor='#2E7D32', lw=2))
    ax.text(x, 1.48, 'AKAR', size=12, fontweight='bold', color='white',
            ha='center', va='center')
ax.text(0.35, 1.48, 'Penyebab\nSEBENARNYA', size=10, color=GRN,
        fontweight='bold', va='center')
ax.plot([0.5, 11.5], [0.75, 0.75], color='#8D6E63', lw=3)
ax.text(6, 0.35, 'Akar yang baik BISA DIKERJAKAN. Akar yang buruk hanya MENYALAHKAN ORANG.',
        size=11, style='italic', color=NAVY, ha='center', fontweight='bold')
plt.tight_layout()
plt.savefig(f'{OUT}/04_Template_Pohon_Akar_Masalah.png', dpi=150, facecolor='white')
plt.close()


# ---------- 5. MATRIKS PRIORITAS ----------
fig, ax = plt.subplots(figsize=(10, 8))
ax.set_xlim(0, 10); ax.set_ylim(0, 10)
ax.add_patch(Rectangle((5, 5), 5, 5, facecolor='#C8E6C9', edgecolor='white', lw=3))
ax.add_patch(Rectangle((0, 5), 5, 5, facecolor='#FFF9C4', edgecolor='white', lw=3))
ax.add_patch(Rectangle((5, 0), 5, 5, facecolor='#FFE0B2', edgecolor='white', lw=3))
ax.add_patch(Rectangle((0, 0), 5, 5, facecolor='#FFCDD2', edgecolor='white', lw=3))
ax.text(7.5, 8.0, 'KANDIDAT UTAMA', size=15, fontweight='bold',
        color='#1B5E20', ha='center')
ax.text(7.5, 7.2, 'Ambil yang ini', size=11, color='#1B5E20', ha='center')
ax.text(2.5, 8.0, 'BUTUH WAKTU LEBIH', size=14, fontweight='bold',
        color='#F57F17', ha='center')
ax.text(2.5, 7.2, 'Persempit dulu', size=11, color='#F57F17', ha='center')
ax.text(7.5, 3.0, 'BOLEH, TAPI\nKURANG BERARTI', size=13, fontweight='bold',
        color='#E65100', ha='center', linespacing=1.6)
ax.text(2.5, 3.0, 'JANGAN DIAMBIL', size=14, fontweight='bold',
        color='#B71C1C', ha='center')
ax.annotate('', xy=(10.4, 0), xytext=(0, 0),
            arrowprops=dict(arrowstyle='-|>', lw=2.5, color=NAVY))
ax.annotate('', xy=(0, 10.4), xytext=(0, 0),
            arrowprops=dict(arrowstyle='-|>', lw=2.5, color=NAVY))
ax.text(5, -0.75, 'BISA KAMI KERJAKAN  →  (dengan keahlian & waktu 2 hari)',
        size=12, fontweight='bold', color=NAVY, ha='center')
ax.text(-0.75, 5, 'DAMPAK  →  (banyak orang terbantu)', size=12,
        fontweight='bold', color=NAVY, rotation=90, va='center')
ax.set_title('MATRIKS PRIORITAS MASALAH', size=19, fontweight='bold',
             color=NAVY, pad=16)
ax.axis('off')
plt.tight_layout()
plt.savefig(f'{OUT}/05_Template_Matriks_Prioritas.png', dpi=150,
            facecolor='white', bbox_inches='tight')
plt.close()


# ---------- 6. PETA EMPATI ----------
fig, ax = plt.subplots(figsize=(11, 8))
ax.set_xlim(0, 10); ax.set_ylim(0, 9); ax.axis('off')
ax.text(5, 8.55, 'PETA EMPATI', size=22, fontweight='bold', color=NAVY, ha='center')
ax.text(5, 8.05, 'Narasumber: ..............................................  '
                 'Perannya: ..............................................',
        size=11, color=GREY, ha='center')
quad = [
    (0.4, 4.1, '#E3F2FD', '#1565C0', '1.  APA YANG DIA KATAKAN',
     'Kutipan persisnya. Dalam tanda kutip.'),
    (5.2, 4.1, '#E8F5E9', '#2E7D32', '2.  APA YANG DIA LAKUKAN',
     'Yang kamu lihat dengan matamu sendiri.'),
    (0.4, 0.5, '#FFF3E0', '#EF6C00', '3.  APA YANG DIA PIKIRKAN',
     'Dari nada bicara & ekspresinya.'),
    (5.2, 0.5, '#FCE4EC', '#AD1457', '4.  APA YANG DIA RASAKAN',
     'Lelah? Kesal? Pasrah? Bangga?'),
]
for x, y, fc, ec, judul, hint in quad:
    ax.add_patch(FancyBboxPatch((x, y), 4.4, 3.3, boxstyle="round,pad=0.08",
                                facecolor=fc, edgecolor=ec, lw=2.5))
    ax.text(x + 0.25, y + 3.0, judul, size=13, fontweight='bold', color=ec)
    ax.text(x + 0.25, y + 2.62, hint, size=9, style='italic', color=GREY)
ax.add_patch(Circle((5.0, 4.05), 0.55, facecolor='white', edgecolor=NAVY, lw=2.5, zorder=5))

plt.tight_layout()
plt.savefig(f'{OUT}/06_Template_Peta_Empati.png', dpi=150, facecolor='white')
plt.close()


# ---------- 7. ALUR 5 HARI ----------
fig, ax = plt.subplots(figsize=(15, 6.2))
ax.set_xlim(0, 15); ax.set_ylim(0, 6); ax.axis('off')
ax.text(7.5, 5.65, 'SAKOLA WALUYA — ALUR 5 HARI', size=21,
        fontweight='bold', color=NAVY, ha='center')
ax.text(7.5, 5.2, 'Ngamimitian ti Diri, Mere Mangpaat pikeun Sakola',
        size=12, style='italic', color=GREY, ha='center')
hari = [
    ('HARI 1', 'RABU\n15 Juli', 'CAGEUR', 'KENALI\nDIRI', GRN),
    ('HARI 2', 'KAMIS\n16 Juli', 'BENER', 'CARI\nFAKTA', GOLD),
    ('HARI 3', 'JUMAT\n17 Juli', 'BAGEUR', 'RASAKAN\n& PILIH', ROSE),
    ('HARI 4', 'SENIN\n20 Juli', 'PINTER', 'RANCANG\n& BUAT', NAVY),
    ('HARI 5', 'SELASA\n21 Juli', 'SINGER', 'BERTINDAK\n& BERBAGI', ORG),
]
for i, (h, tgl, nilai, fokus, col) in enumerate(hari):
    x = 0.5 + i * 2.9
    ax.add_patch(FancyBboxPatch((x, 1.0), 2.5, 3.6, boxstyle="round,pad=0.08",
                                facecolor=col, edgecolor='white', lw=2))
    ax.text(x + 1.25, 4.25, h, size=11, color='white', ha='center', alpha=0.85)
    ax.text(x + 1.25, 3.72, tgl, size=11, color='white', ha='center',
            fontweight='bold', linespacing=1.4)
    ax.plot([x + 0.35, x + 2.15], [3.25, 3.25], color='white', lw=1.2, alpha=0.6)
    ax.text(x + 1.25, 2.72, nilai, size=17, color='white', ha='center',
            fontweight='bold')
    ax.text(x + 1.25, 1.75, fokus, size=12, color='white', ha='center',
            linespacing=1.5)
    if i < 4:
        ax.annotate('', xy=(x + 2.85, 2.8), xytext=(x + 2.55, 2.8),
                    arrowprops=dict(arrowstyle='-|>', lw=2.5, color=GREY))
ax.text(7.5, 0.45, 'MEMAHAMI  →  MENGAPLIKASI  →  MEREFLEKSI'
                   '     |     28 JP + 5 sesi Pembiasaan Pagi (Apel + MBG)',
        size=11, color=NAVY, ha='center', fontweight='bold')
plt.tight_layout()
plt.savefig(f'{OUT}/07_Alur_5_Hari.png', dpi=150, facecolor='white')
plt.close()


# ---------- 8. PEMETAAN PANCAWALUYA ----------
fig, ax = plt.subplots(figsize=(14, 8))
ax.set_xlim(0, 14); ax.set_ylim(0, 8); ax.axis('off')
ax.text(7, 7.55, 'PEMETAAN: PANCAWALUYA × 7 KAIH × 8 DIMENSI PROFIL LULUSAN',
        size=17, fontweight='bold', color=NAVY, ha='center')
ax.text(7, 7.1, 'Setiap nilai diikat pada kebiasaan, dimensi, dan indikator rapor '
                'yang lemah — tidak ada yang mengambang',
        size=10, style='italic', color=GREY, ha='center')
rows = [
    ('CAGEUR', 'Waluya Raga', 'Bangun Pagi · Berolahraga\nMakan Sehat · Tidur Cepat',
     'Kesehatan\nKemandirian', 'D.19.1/3/4/7 KURANG\nWellbeing 59,30', GRN),
    ('BENER', 'Waluya Budhi', 'Gemar Belajar',
     'Penalaran Kritis', 'D.1.3 Metode 56,79\nNumerasi turun', GOLD),
    ('BAGEUR', 'Waluya Rasa', 'Bermasyarakat · Beribadah',
     'Kolaborasi\nKeimanan', 'Gotong Royong 54,70\n(TURUN 3,09)', ROSE),
    ('PINTER', 'Waluya Hirup', 'Gemar Belajar',
     'Komunikasi\nKewargaan', 'Gemar Belajar 5,50\n(TERENDAH)', NAVY),
    ('SINGER', 'Waluya Karsa', '(pengikat semua\nmenjadi AKSI)',
     'Kreativitas\nKemandirian', 'Kreativitas 54,31\n(TERENDAH)', ORG),
]
hdr = ['NILAI', 'ASPEK WALUYA', '7 KEBIASAAN (KAIH)',
       'DIMENSI PROFIL LULUSAN', 'CELAH RAPOR YANG DISASAR']
xs = [0.3, 2.5, 4.7, 8.0, 10.6]
ws = [2.0, 2.0, 3.1, 2.4, 3.1]
for x, w, h in zip(xs, ws, hdr):
    ax.add_patch(Rectangle((x, 6.2), w, 0.62, facecolor=NAVY))
    ax.text(x + w / 2, 6.51, h, size=9, color='white', ha='center',
            va='center', fontweight='bold')
for i, (nilai, asp, keb, dim, rap, col) in enumerate(rows):
    y = 5.15 - i * 1.05
    ax.add_patch(Rectangle((xs[0], y), ws[0], 0.95, facecolor=col))
    ax.text(xs[0] + ws[0] / 2, y + 0.475, nilai, size=13, color='white',
            ha='center', va='center', fontweight='bold')
    for j, txt in enumerate([asp, keb, dim, rap], start=1):
        ax.add_patch(Rectangle((xs[j], y), ws[j], 0.95,
                               facecolor='#F5F7FA' if i % 2 == 0 else 'white',
                               edgecolor='#C9D3DD'))
        ax.text(xs[j] + ws[j] / 2, y + 0.475, txt, size=8.5, ha='center',
                va='center', color=NAVY, linespacing=1.5,
                fontweight='bold' if j == 4 else 'normal')
ax.text(7, 0.25, 'Falsafah pengikat: SILIH ASIH · SILIH ASAH · SILIH ASUH',
        size=12, fontweight='bold', color=NAVY, ha='center', style='italic')
plt.tight_layout()
plt.savefig(f'{OUT}/08_Pemetaan_Pancawaluya.png', dpi=150, facecolor='white')
plt.close()


# ---------- 9. JADWAL HARIAN ----------
fig, ax = plt.subplots(figsize=(12, 7.5))
ax.set_xlim(0, 12); ax.set_ylim(0, 8); ax.axis('off')
ax.text(6, 7.55, 'JADWAL HARIAN — SAKOLA WALUYA', size=19,
        fontweight='bold', color=NAVY, ha='center')
ax.text(6, 7.12, 'Hari 1, 2, 4, 5  (Hari 3 / Jumat berakhir pukul 11.00)',
        size=11, style='italic', color=GREY, ha='center')
sched = [
    ('06.30–06.45', "15'", 'APEL PENGONDISIAN', 'Bangun Pagi · Beribadah', '#2E7D32'),
    ('06.45–07.30', "45'", 'MBG BERSAMA + NGARIUNG', 'Makan Sehat · Bermasyarakat', '#43A047'),
    ('07.30–07.45', "15'", 'PEMANTIK / ENERGIZER', 'Membuka fokus', '#90A4AE'),
    ('07.45–09.15', "2 JP", 'SESI 1', 'Inti kegiatan', '#2E74B5'),
    ('09.15–09.30', "15'", 'JEDA GERAK & SNACK', 'Berolahraga (wajib berdiri!)', '#EF6C00'),
    ('09.30–11.00', "2 JP", 'SESI 2', 'Inti kegiatan', '#2E74B5'),
    ('11.00–11.45', "1 JP", 'SESI 3', 'Konsolidasi / produksi', '#1F3864'),
    ('11.45–12.00', "15'", 'REFLEKSI & JURNAL WALUYA', 'Gemar Belajar (refleksi)', '#6A1B9A'),
]
for i, (jam, dur, ag, ket, col) in enumerate(sched):
    y = 6.35 - i * 0.78
    ax.add_patch(FancyBboxPatch((0.3, y), 11.4, 0.66, boxstyle="round,pad=0.03",
                                facecolor=col, alpha=0.14, edgecolor=col, lw=1.6))
    ax.add_patch(Rectangle((0.3, y), 0.14, 0.66, facecolor=col))
    ax.text(0.75, y + 0.33, jam, size=11, fontweight='bold', color=NAVY, va='center')
    ax.text(2.55, y + 0.33, dur, size=10, color=GREY, va='center')
    ax.text(3.5, y + 0.33, ag, size=11.5, fontweight='bold', color=col, va='center')
    ax.text(7.9, y + 0.33, ket, size=10, color=GREY, va='center', style='italic')
ax.text(6, 0.15, '270 menit inti = 6 JP  ·  Total 28 JP dari kuota 144 JP kokurikuler kelas XI',
        size=11, fontweight='bold', color=NAVY, ha='center')
plt.savefig(f'{OUT}/09_Jadwal_Harian.png', dpi=150, facecolor='white')
plt.close()

print("SELESAI ->", OUT)
