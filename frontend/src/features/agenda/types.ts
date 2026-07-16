export interface ScheduleToday {
  id: string
  hari: string
  jam_mulai: string
  jam_selesai: string
  subject: { id: string; kode: string; nama: string }
  class: { id: string; tingkat: string; jurusan: string; rombel: string; label: string }
  agenda_hari_ini: { id: string; status: string } | null
  deadline_isi_agenda: string | null
}

// GK17: satu baris jadwal minggu berjalan, dengan tanggal konkret per hari (beda dari
// ScheduleToday yang cuma hari ini).
export interface ScheduleWeek {
  id: string
  hari: string
  tanggal: string
  jam_mulai: string
  jam_selesai: string
  subject: { id: string; kode: string; nama: string }
  class: { id: string; label: string }
}

// Sesi terjadwal yang BELUM diisi, mundur sampai batas waktu yang diatur admin —
// beda dari ScheduleToday (cuma hari ini) supaya jadwal yang telat diisi kemarin/H-2
// tetap kelihatan & bisa dipilih dari form "Isi Agenda", bukan cuma hari ini.
export interface AgendaPerluDiisi {
  // 'kokurikuler' = tagihan laporan harian fasilitator (schedule_id bukan uuid jadwal,
  // link-nya ke halaman Kokurikuler); default/absen = sesi agenda reguler.
  jenis?: 'reguler' | 'kokurikuler'
  schedule_id: string
  tanggal: string
  hari: string
  jam_mulai: string
  jam_selesai: string
  class_id: string
  kelas: string
  mapel: string
  deadline: string
  bisa_diisi: boolean
  jam_tersisa: number | null
}

export interface LearningObjective {
  id: string
  kode: string
  deskripsi: string
  urutan: number
  semester: string
  fase?: 'E' | 'F'
  aktif?: boolean
  updated_by?: string | null
  updated_at?: string | null
}

export interface StudentItem {
  id: string
  nis: string
  nama: string
  foto_url?: string | null
}

export interface StudentScore {
  student_id: string
  nama: string
  nis: string
  nilai: number
  catatan: string | null
}

export interface Agenda {
  id: string
  tanggal: string
  resume_kbm: string | null
  status: 'draft' | 'submitted'
  created_at: string
  updated_at: string
  schedule: {
    id: string
    hari: string
    jam_mulai: string
    jam_selesai: string
    subject: { id: string; kode: string; nama: string }
    class: { id: string; tingkat: string; jurusan: string; rombel: string; label: string }
  } | null
  learning_objectives: LearningObjective[]
  student_scores: StudentScore[]
}

export interface StudentScoreInput {
  student_id: string
  nilai: number
  catatan: string
}

export interface AgendaFormData {
  schedule_id: string
  tanggal: string
  resume_kbm: string
  learning_objective_ids: string[]
  status: 'draft' | 'submitted'
  // Nilai aktivitas TIDAK lagi diisi saat pengisian agenda (GK13) — dipindah ke
  // AgendaDetailPage sebagai langkah opsional terpisah ("Isi Nilai Aktivitas").
  student_scores?: StudentScoreInput[]
}
