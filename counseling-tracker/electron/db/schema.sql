CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    school_year TEXT,           -- 학년도 (예: '2026')
    grade INTEGER,               -- 학년
    class_no INTEGER,            -- 반
    number INTEGER,              -- 번호
    pinned BOOLEAN DEFAULT 0,
    active BOOLEAN DEFAULT 1,
    archived_year TEXT
);

CREATE TABLE IF NOT EXISTS consult_types (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT
);

CREATE TABLE IF NOT EXISTS quick_templates (
    id INTEGER PRIMARY KEY,
    type_id INTEGER REFERENCES consult_types(id),
    text TEXT
);

CREATE TABLE IF NOT EXISTS consult_records (
    id INTEGER PRIMARY KEY,
    student_id INTEGER REFERENCES students(id),
    type_id INTEGER REFERENCES consult_types(id),
    record_date DATE NOT NULL,
    content TEXT,
    state_score INTEGER,
    follow_up_needed BOOLEAN DEFAULT 0,
    follow_up_done BOOLEAN DEFAULT 0,
    next_appointment DATE,
    referred_to TEXT,
    reflected_in_nice BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- 예약(캘린더). consult_records.next_appointment는 레거시 필드로, 이 테이블이 예약의 단일 소스다.
CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY,
    student_id INTEGER REFERENCES students(id),
    appt_date DATE NOT NULL,
    start_time TEXT NOT NULL,      -- 'HH:MM'
    end_time TEXT NOT NULL,        -- 'HH:MM'
    note TEXT,
    record_id INTEGER REFERENCES consult_records(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
