export interface ScheduleToday {
  id: string
  hari: string
  jam_mulai: string
  jam_selesai: string
  subject: { id: string; kode: string; nama: string }
  class: { id: string; tingkat: string; jurusan: string; rombel: string; label: string }
  agenda_hari_ini: { id: string; status: string } | null
}

export interface LearningObjective {
  id: string
  kode: string
  deskripsi: string
  urutan: number
  semester: string
  updated_by?: string | null
  updated_at?: string | null
}

export interface StudentItem {
  id: string
  nis: string
  nama: string
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
  student_scores: StudentScoreInput[]
}
