import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Rectangle, Circle
OUT = "/sessions/vibrant-inspiring-einstein/mnt/Ko Kurikuler/SAKOLA_WALUYA_XI_2026/05_GAMBAR"
NAVY='#1F3864'; GREY='#595959'; GRN='#2E7D32'; RED='#C62828'; ROSE='#AD1457'
plt.rcParams['font.family']='DejaVu Sans'

# ---- 11. STRUKTUR PERAN MURID ----
fig, ax = plt.subplots(figsize=(14,8)); ax.axis('off'); ax.set_xlim(0,14); ax.set_ylim(0,8)
ax.text(7,7.5,'STRUKTUR PERAN MURID — PENGGANTI "GURU KEDUA"',size=19,fontweight='bold',color=NAVY,ha='center')
ax.text(7,7.05,'Wali kelas sendirian. Enam pekerjaan yang biasanya dipegang guru kedua diserahkan kepada murid.',size=11,style='italic',color=GREY,ha='center')
ax.add_patch(FancyBboxPatch((5.2,5.5),3.6,1.1,boxstyle="round,pad=0.08",facecolor=NAVY,edgecolor='white',lw=2))
ax.text(7,6.05,'WALI KELAS\n(satu-satunya fasilitator)',size=13,color='white',ha='center',va='center',fontweight='bold',linespacing=1.5)
peran=[('KAPTEN TIM','6 orang','Keselamatan &\nkeutuhan tim.\nPegang Kartu Izin\nJelajah. Lapor\ntiap 20 menit.',GRN),
('TIM WAKTU','2 orang','Stopwatch.\nUmumkan sisa\nwaktu. Guru tidak\nlagi mengurus\nwaktu.','#0277BD'),
('TIM PIKET DATA','2 orang','Jaga PAPAN POS:\nsiapa berangkat,\nke mana, sudah\nkembali atau\nbelum.','#6A1B9A'),
('TIM K3','2 orang','Cek APD & alat.\nBERWENANG\nMENGHENTIKAN\nkerja tak aman.\nSemua wajib patuh.',RED),
('TIM DOKUMENTASI','2 orang','Foto & video.\nPenanggung jawab\nfoto BEFORE-AFTER\nHari 5.','#EF6C00'),
('TIM LOGISTIK','2 orang','Siapkan & bereskan\nalat/bahan. Kelas\ntak bubar sebelum\nmereka bilang\nberes.','#00838F')]
for i,(n,j,d,col) in enumerate(peran):
    x=0.45+i*2.22
    ax.plot([7,x+0.95],[5.5,4.6],color='#C9D3DD',lw=1.5,zorder=0)
    ax.add_patch(FancyBboxPatch((x,1.2),1.9,3.4,boxstyle="round,pad=0.06",facecolor='#F5F7FA',edgecolor=col,lw=2))
    ax.add_patch(Rectangle((x,4.05),1.9,0.55,facecolor=col))
    ax.text(x+0.95,4.32,n,size=9.5,color='white',ha='center',va='center',fontweight='bold')
    ax.text(x+0.95,3.75,j,size=9,color=col,ha='center',fontweight='bold')
    ax.text(x+0.95,2.55,d,size=8.5,color='#2B3A47',ha='center',va='center',linespacing=1.6)
ax.text(7,0.55,'"Minggu ini saya sendirian. Kalau kalian menunggu saya mengatur segalanya, kita tidak akan selesai.\nSaya tidak sedang malas — saya sedang mempercayai kalian."',
        size=11,style='italic',color=NAVY,ha='center',fontweight='bold',linespacing=1.6)
plt.tight_layout(); plt.savefig(f'{OUT}/11_Struktur_Peran_Murid.png',dpi=150,facecolor='white'); plt.close()

# ---- 12. POS FASILITATOR ----
# DIPINDAHKAN ke pos_fasilitator.py (versi lama bertumpuk & masih memakai 'Kartu Izin Jelajah').

# ---- 13. ALAT BOLEH vs DILARANG ----
fig, ax = plt.subplots(figsize=(13,7.5)); ax.axis('off'); ax.set_xlim(0,13); ax.set_ylim(0,7.5)
ax.text(6.5,7.05,'PRODUKSI KARYA TANPA BENGKEL',size=20,fontweight='bold',color=NAVY,ha='center')
ax.text(6.5,6.6,'Wali kelas sendirian & belum tentu guru produktif jurusan itu. Semua dikerjakan DI KELAS.',size=11,style='italic',color=GREY,ha='center')
ax.add_patch(FancyBboxPatch((0.3,1.5),6.05,4.75,boxstyle="round,pad=0.08",facecolor='#E8F5E9',edgecolor=GRN,lw=2.5))
ax.text(3.3,5.85,'BOLEH',size=17,color='#1B5E20',ha='center',fontweight='bold')
ax.text(3.3,5.5,'(diawasi TIM K3 — murid)',size=9.5,color='#1B5E20',ha='center',style='italic')
ax.text(0.6,3.5,'Gunting · cutter · gergaji tangan kecil\nObeng · tang · palu kecil · amplas · meteran\nLem putih · double tape busa · cable ties · stapler\n\nKardus tebal · pipa PVC · kayu ringan / triplek\nBotol & kemasan bekas · kertas & karton\n\nLaptop & HP\n(Canva · CapCut · Tinkercad · Wokwi — gratis)',
        size=11,color='#2B3A47',va='center',linespacing=1.8)
ax.add_patch(FancyBboxPatch((6.65,1.5),6.05,4.75,boxstyle="round,pad=0.08",facecolor='#FDE8EF',edgecolor=RED,lw=2.5))
ax.text(9.65,5.85,'DILARANG MUTLAK',size=17,color='#B71C1C',ha='center',fontweight='bold')
ax.text(9.65,5.5,'tanpa kecuali',size=9.5,color='#B71C1C',ha='center',style='italic')
ax.text(6.95,3.5,'Mesin bubut · frais · gerinda\nLas (semua jenis) · bor listrik · kompresor\nGergaji mesin · menyolder · listrik 220V\n\nNaOH · asam kuat · bahan korosif\nBahan mudah terbakar · api & pemanasan\nReaksi kimia eksotermik\n\nBekerja di ketinggian lebih dari 1 meter',
        size=11,color='#2B3A47',va='center',linespacing=1.8)
ax.add_patch(FancyBboxPatch((0.3,0.25),12.4,0.95,boxstyle="round,pad=0.05",facecolor='#FFF6E0',edgecolor='#BF8F00',lw=1.8))
ax.text(6.5,0.72,'Butuh mesin?  →  Purwarupa SKALA 1:1 dari kardus/PVC + GAMBAR KERJA LENGKAP, diserahkan RESMI ke Wakasek Sarpras\ndi Gelar Karya untuk difabrikasi kemudian. Penyerahan resmi itu TETAP dihitung sebagai AKSI NYATA.',
        size=11,color='#6B5200',ha='center',va='center',fontweight='bold',linespacing=1.7)
plt.tight_layout(); plt.savefig(f'{OUT}/13_Alat_Boleh_Dilarang.png',dpi=150,facecolor='white'); plt.close()
print("OK 3 gambar baru")
