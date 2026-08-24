// Sample trainings seeded for brand-new accounts. Dates are computed relative
// to "today" at seed time (not hardcoded) — a fixed past date (e.g. 2024-08-31)
// would already be hundreds of days overdue by the time a new account signs
// up, immediately spamming a new user with false past-due penalties and the
// app-wide recommitment popup on their very first login.
export function daysFromToday(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

export function buildSampleTrainings() {
  return [
    { id: 1, title: 'Lean Manufacturing Fundamentals',    category: 'Lean',        duration: '4h',   dueDate: daysFromToday(-40), completed: true,  completedDate: daysFromToday(-60), mandatory: true  },
    { id: 2, title: 'Effective Coaching Skills',          category: 'Leadership',  duration: '2h',   dueDate: daysFromToday(20),  completed: false, mandatory: true  },
    { id: 3, title: 'Safety & OSHA Compliance',           category: 'Safety',      duration: '3h',   dueDate: daysFromToday(-50), completed: true,  completedDate: daysFromToday(-70), mandatory: true  },
    { id: 4, title: 'Emotional Intelligence for Leaders', category: 'Soft Skills', duration: '1.5h', dueDate: daysFromToday(45),  completed: false, mandatory: false },
    { id: 5, title: 'Data-Driven Decision Making',        category: 'Analytics',   duration: '3h',   dueDate: daysFromToday(35),  completed: false, mandatory: false },
    { id: 6, title: 'Root Cause Analysis Techniques',     category: 'Quality',     duration: '2h',   dueDate: daysFromToday(10),  completed: false, mandatory: true  },
    { id: 7, title: 'DISC Personality Profiling',         category: 'Soft Skills', duration: '1h',   dueDate: daysFromToday(50),  completed: false, mandatory: false },
    { id: 8, title: 'Visual Management Principles',       category: 'Lean',        duration: '2h',   dueDate: daysFromToday(-35), completed: true,  completedDate: daysFromToday(-55), mandatory: false },
  ];
}
