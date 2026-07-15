import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Rectangle, Circle
OUT="/sessions/vibrant-inspiring-einstein/mnt/Ko Kurikuler/SAKOLA_WALUYA_XI_2026/05_GAMBAR"
NAVY='#1F3864';GREY='#595959';RED='#C62828';BIRU='#2E74B5';JING='#C55A11'
plt.rcParams['font.family']='DejaVu Sans'

# --- 14. SEKTOR + GELOMBANG ---
fig,ax=plt.subplots(figsize=(14,8));ax.axis('off');ax.set_xlim(0,14);ax.set_ylim(0,8)
ax.text(7,7.55,'16 KELAS PARALEL — SEKTOR + GELOMBANG',size=20,fontweight='bold',color=NAVY,ha='center')
ax.text(7,7.12,'576 murid · 96 tim. Dua lapis pengaman agar sekolah tidak kacau.',size=11,style='italic',color=GREY,ha='center')

ax.add_patch(FancyBboxPatch((0.3,6.05),13.4,0.85,boxstyle="round,pad=0.05",facecolor='#FDE8EF',edgecolor=RED,lw=2))
ax.text(7,6.47,'TANPA PENGATURAN: 96 tim serentak berebut toilet & wastafel yang jumlahnya tetap,\ndan Pak Caraka diwawancarai puluhan kali dalam 90 menit.',
        size=11,color='#8C1046',ha='center',va='center',fontweight='bold',linespacing=1.6)

# --- Lapis 1 ---
ax.add_patch(FancyBboxPatch((0.3,1.95),6.5,3.85,boxstyle="round,pad=0.06",facecolor='#E8F0FA',edgecolor=BIRU,lw=2.5))
ax.text(3.55,5.42,'LAPIS 1 — SEKTOR EKSKLUSIF',size=14,color=NAVY,ha='center',fontweight='bold')
ax.text(3.55,5.02,'Tiap kelas punya objek data SENDIRI',size=10,color=GREY,ha='center',style='italic')
sek=[('Z1 · 4 kelas','Toilet & wastafel Blok A / B / C / D'),
     ('Z2 · 3 kelas','Kantin · Sisa MBG · Distribusi MBG'),
     ('Z3 · 3 kelas','Ruang kelas · Perpustakaan · Ritme tidur'),
     ('Z4 · 3 kelas','Lapangan · Aktivitas fisik · Koridor'),
     ('Z5 · 3 kelas','Titik rawan Lt.1 · Lt.2 · Papan pengaduan')]
for i,(z,d) in enumerate(sek):
    y=4.60-i*0.40
    ax.text(0.62,y,z,size=9.5,color=NAVY,fontweight='bold',va='center')
    ax.text(2.45,y,d,size=9,color='#2B3A47',va='center')
ax.plot([0.62,6.5],[2.55,2.55],color='#B0C4DE',lw=1)
ax.text(3.55,2.25,'Butuh data sektor lain? MINTA ke kelas itu.\nItulah gotong royong yang sebenarnya.',
        size=9.5,color=BIRU,ha='center',va='center',style='italic',fontweight='bold',linespacing=1.5)

# --- Lapis 2 ---
ax.add_patch(FancyBboxPatch((7.2,1.95),6.5,3.85,boxstyle="round,pad=0.06",facecolor='#FCE4D6',edgecolor=JING,lw=2.5))
ax.text(10.45,5.42,'LAPIS 2 — SISTEM GELOMBANG',size=14,color=NAVY,ha='center',fontweight='bold')
ax.text(10.45,5.02,'Tidak semua turun lapangan bersamaan',size=10,color=GREY,ha='center',style='italic')
ax.add_patch(Rectangle((7.6,4.05),2.6,0.75,facecolor=BIRU))
ax.text(8.9,4.42,'GELOMBANG BIRU\n8 kelas',size=10,color='white',ha='center',va='center',fontweight='bold',linespacing=1.4)
ax.add_patch(Rectangle((10.6,4.05),2.6,0.75,facecolor=JING))
ax.text(11.9,4.42,'GELOMBANG JINGGA\n8 kelas',size=10,color='white',ha='center',va='center',fontweight='bold',linespacing=1.4)
ax.text(8.9,3.62,'Lapangan DULU',size=9.5,color=BIRU,ha='center',fontweight='bold')
ax.text(11.9,3.62,'Di kelas DULU',size=9.5,color=JING,ha='center',fontweight='bold')
ax.annotate('',xy=(11.9,3.25),xytext=(8.9,3.25),arrowprops=dict(arrowstyle='<|-|>',lw=2,color=GREY))
ax.text(10.45,2.95,'lalu BERTUKAR',size=9.5,color=GREY,ha='center',style='italic')
ax.plot([7.5,13.4],[2.55,2.55],color='#E0B090',lw=1)
ax.text(10.45,2.25,'Saat kelas lain di lapangan,\nkelasmu bekerja di dalam kelas.',
        size=9.5,color=JING,ha='center',va='center',style='italic',fontweight='bold',linespacing=1.5)

ax.add_patch(FancyBboxPatch((0.3,1.05),13.4,0.65,boxstyle="round,pad=0.04",facecolor='#E8F5E9',edgecolor='#2E7D32',lw=2))
ax.text(7,1.37,'HASILNYA: maksimal 8 kelas (48 tim) di lapangan pada satu waktu — tersebar di 8 wilayah berbeda.',
        size=12,color='#1B5E20',ha='center',va='center',fontweight='bold')
ax.text(7,0.5,'NGAJUGJUG: narasumber TIDAK dikumpulkan. Mereka tetap bekerja. MURID yang menghampiri —\nhanya 3 orang delegasi, hanya 10 menit, hanya pada slot terjadwal. Beban tiap narasumber: 20 menit sehari.',
        size=10.5,color=NAVY,ha='center',va='center',fontweight='bold',linespacing=1.7)
plt.tight_layout();plt.savefig(f'{OUT}/14_Sektor_dan_Gelombang_16_Kelas.png',dpi=150,facecolor='white');plt.close()

# --- 15. NGAJUGJUG ---
fig,ax=plt.subplots(figsize=(13,7.5));ax.axis('off');ax.set_xlim(0,13);ax.set_ylim(0,7.5)
ax.text(6.5,7.05,'NGAJUGJUG — MENGHAMPIRI NARASUMBER',size=20,fontweight='bold',color=NAVY,ha='center')
ax.text(6.5,6.6,'Narasumber TIDAK dikumpulkan. Mereka tetap bekerja. Murid yang mendatangi mereka di tempat kerjanya.',size=11,style='italic',color=GREY,ha='center')
ax.add_patch(FancyBboxPatch((0.3,5.15),12.4,1.05,boxstyle="round,pad=0.05",facecolor='#FDE8EF',edgecolor=RED,lw=2))
ax.text(6.5,5.68,'MASALAHNYA: 96 tim × 3 narasumber = Pak Caraka diwawancarai puluhan kali dalam 90 menit.\nDi hari kedua, beliau akan menolak — dan kita kehilangan jantung kegiatan ini.',
        size=11.5,color='#8C1046',ha='center',va='center',fontweight='bold',linespacing=1.7)
k=[('01','KUOTA KERAS','8 narasumber. Tiap narasumber didatangi\nhanya 2 KELAS (1 Biru + 1 Jingga).\nBeban total: 20 MENIT sehari.','#0277BD'),
   ('02','DELEGASI 3 ORANG','Bukan seluruh tim, bukan seluruh kelas.\n1 Kapten + 1 pencatat + 1 dokumentasi.\nHasilnya dibagikan ke kelas setelah kembali.','#2E7D32'),
   ('03','MAKSIMAL 10 MENIT','Tim Waktu yang mengingatkan.\nLewat 10 menit = PAMIT,\napa pun kondisinya.','#6A1B9A'),
   ('04','BOLEH DITOLAK','Sibuk / menolak / tidak ada di tempat?\nJANGAN DIPAKSA. Catat, kembali ke POS, lapor.\nMenerima penolakan dengan sopan juga BAGEUR.','#AD1457')]
for i,(n,t,d,col) in enumerate(k):
    x=0.3+i*3.15
    ax.add_patch(FancyBboxPatch((x,2.05),2.95,2.75,boxstyle="round,pad=0.06",facecolor='#F5F7FA',edgecolor=col,lw=2))
    ax.add_patch(Circle((x+0.42,4.42),0.28,facecolor=col))
    ax.text(x+0.42,4.42,n,size=10,color='white',ha='center',va='center',fontweight='bold')
    ax.text(x+0.85,4.42,t,size=11,color=col,va='center',fontweight='bold')
    ax.text(x+1.47,3.35,d,size=9,color='#2B3A47',ha='center',va='center',linespacing=1.7)
ax.add_patch(FancyBboxPatch((0.3,0.75),12.4,1.05,boxstyle="round,pad=0.05",facecolor='#FFF6E0',edgecolor='#BF8F00',lw=2))
ax.text(6.5,1.28,'H-1 (KAMIS 16 JULI): Koordinator MENEMUI setiap narasumber. Memberi tahu mereka akan didatangi 2 kelas, jam berapa.\nMENEMPELKAN KARTU JADWAL di tempat kerjanya. TANPA INI, mereka akan merasa diserbu — dan menolak.',
        size=11,color='#6B5200',ha='center',va='center',fontweight='bold',linespacing=1.7)
plt.tight_layout();plt.savefig(f'{OUT}/15_Ngajugjug_Narasumber.png',dpi=150,facecolor='white');plt.close()
print("OK 2 gambar")
