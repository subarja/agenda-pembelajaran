import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Rectangle, Circle
import numpy as np
OUT="/sessions/vibrant-inspiring-einstein/mnt/Ko Kurikuler/SAKOLA_WALUYA_XI_2026/05_GAMBAR"
import os; os.makedirs(OUT,exist_ok=True)
NAVY='#1F3864';GREY='#595959';RED='#C62828';GRN='#2E7D32'
plt.rcParams['font.family']='DejaVu Sans'
COLS=['#E53935','#1E88E5','#43A047','#FDD835','#8E24AA','#FB8C00']

fig,ax=plt.subplots(figsize=(13,8));ax.axis('off');ax.set_xlim(0,13);ax.set_ylim(0,8)
ax.text(6.5,7.5,'PAPAN KARTU',size=24,fontweight='bold',color=NAVY,ha='center')
ax.text(6.5,7.0,'Pengganti Kartu Izin Jelajah — GURU TIDAK MENANDATANGANI APA PUN',size=13,color=RED,ha='center',fontweight='bold')

# papan
ax.add_patch(FancyBboxPatch((1.4,3.0),10.2,3.4,boxstyle="round,pad=0.1",facecolor='#F5F7FA',edgecolor=NAVY,lw=3))
ax.text(6.5,6.05,'PAPAN KARTU  ·  XI ...................',size=15,fontweight='bold',color=NAVY,ha='center')
ax.plot([1.9,11.1],[5.75,5.75],color='#B0BEC5',lw=1.5)
for i in range(6):
    x=2.25+i*1.55
    # kait
    ax.plot([x,x],[5.5,5.15],color='#757575',lw=3)
    ax.add_patch(Circle((x,5.05),0.12,facecolor='#757575'))
    if i<4:  # kartu tergantung = tim di kelas
        ax.plot([x-0.35,x,x+0.35],[4.15,5.0,4.15],color=COLS[i],lw=5,solid_capstyle='round')
        ax.add_patch(FancyBboxPatch((x-0.42,3.55),0.84,0.62,boxstyle="round,pad=0.04",facecolor=COLS[i],edgecolor='white',lw=2))
        ax.text(x,3.86,f'TIM\n{i+1}',size=10,color='white',ha='center',va='center',fontweight='bold',linespacing=1.3)
    else:    # kait kosong = tim di luar
        ax.add_patch(FancyBboxPatch((x-0.5,3.55),1.0,1.35,boxstyle="round,pad=0.04",facecolor='white',edgecolor=COLS[i],lw=2,linestyle='--'))
        ax.text(x,4.45,f'TIM {i+1}',size=10,color=COLS[i],ha='center',fontweight='bold')
        ax.text(x,3.95,'KOSONG',size=9,color=RED,ha='center',fontweight='bold')
        ax.text(x,3.68,'(masih\ndi luar)',size=8,color=GREY,ha='center',va='center',linespacing=1.3)
    ax.text(x,3.25,f'Tim {i+1}',size=9,color=GREY,ha='center')

ax.text(6.5,2.65,'KAIT KOSONG  =  TIM ITU MASIH DI LUAR.  Guru cukup MELIHAT papan.',
        size=14,color=NAVY,ha='center',fontweight='bold')

# 3 langkah
langkah=[('1','TIM BERANGKAT','Ambil kartu timmu\ndari kait. PAKAI.','#1E88E5'),
         ('2','TIM DI LAPANGAN','Kaitnya kosong.\nGuru tahu kalian di luar.','#FB8C00'),
         ('3','TIM PULANG','GANTUNG KEMBALI\nkartu di kaitnya.','#43A047')]
for i,(n,t,d,col) in enumerate(langkah):
    x=1.4+i*3.5
    ax.add_patch(FancyBboxPatch((x,0.9),3.2,1.4,boxstyle="round,pad=0.06",facecolor='#F5F7FA',edgecolor=col,lw=2))
    ax.add_patch(Circle((x+0.4,1.95),0.24,facecolor=col))
    ax.text(x+0.4,1.95,n,size=12,color='white',ha='center',va='center',fontweight='bold')
    ax.text(x+0.78,1.95,t,size=11,color=col,va='center',fontweight='bold')
    ax.text(x+1.6,1.4,d,size=10,color='#2B3A47',ha='center',va='center',linespacing=1.6)

ax.add_patch(FancyBboxPatch((0.3,0.05),12.4,0.65,boxstyle="round,pad=0.04",facecolor='#FFF6E0',edgecolor='#BF8F00',lw=1.8))
ax.text(6.5,0.37,'Izin menjelajah sudah melekat pada SEKTOR yang ditetapkan Koordinator — BUKAN pada tanda tangan wali kelas.',
        size=11.5,color='#6B5200',ha='center',va='center',fontweight='bold')
plt.tight_layout();plt.savefig(f'{OUT}/16_Papan_Kartu.png',dpi=150,facecolor='white');plt.close()
print("OK papan kartu")
