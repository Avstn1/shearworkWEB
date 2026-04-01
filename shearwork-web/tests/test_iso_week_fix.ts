/**
 * test_iso_week_fix.ts
 *
 * Compares three ISO week implementations:
 *   1. OLD  — the broken getCurrentISOWeek() from AutoNudgeImpact.tsx (client)
 *   2. NEW  — the fixed getCurrentISOWeek() that mirrors the server logic
 *   3. SRV  — the server-side getISOWeek() from update_sms_barber_success.ts
 *
 * Run:  npx tsx tests/test_iso_week_fix.ts
 */

// ─── 1. OLD client algorithm (broken) ────────────────────────────────────────

function oldGetCurrentISOWeek(fakeNow: Date): string {
  const now = new Date(fakeNow)
  const dayOfWeek = now.getDay()
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  const startOfYear = new Date(monday.getFullYear(), 0, 1)
  const weekNumber = Math.ceil(
    ((monday.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  )
  return `${monday.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`
}

// ─── 2. NEW client algorithm (fixed — mirrors server) ────────────────────────

function newGetCurrentISOWeek(fakeNow: Date): string {
  // In the real component this uses Intl.DateTimeFormat for Toronto tz.
  // For testing we accept the date directly (simulating "Toronto local time").
  const now = new Date(
    fakeNow.getFullYear(),
    fakeNow.getMonth(),
    fakeNow.getDate()
  )

  const day = now.getDay() || 7 // Mon=1 … Sun=7
  now.setDate(now.getDate() + 4 - day) // shift to Thursday

  const yearStart = new Date(now.getFullYear(), 0, 1)
  const weekNumber = Math.ceil(((+now - +yearStart) / 86400000 + 1) / 7)

  return `${now.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`
}

// ─── 3. SERVER algorithm (from update_sms_barber_success.ts) ─────────────────

function serverGetISOWeek(fakeNow: Date): string {
  // Server does: new Date(Intl.DateTimeFormat('en-CA', Toronto).format(date))
  // For testing we simulate that by just using the date parts directly.
  const now = new Date(
    fakeNow.getFullYear(),
    fakeNow.getMonth(),
    fakeNow.getDate()
  )

  const day = now.getDay() || 7
  now.setDate(now.getDate() + 4 - day)

  const yearStart = new Date(now.getFullYear(), 0, 1)
  const week = Math.ceil(((+now - +yearStart) / 86400000 + 1) / 7)
  const year = now.getFullYear()

  return `${year}-W${week.toString().padStart(2, '0')}`
}

// ─── Test cases ──────────────────────────────────────────────────────────────

interface TestCase {
  label: string
  date: Date
  expectedISOWeek: string // Known-correct ISO 8601 week
}

const testCases: TestCase[] = [
  // ── Standard mid-week dates ──
  {
    label: 'Wed 2026-03-25 (normal mid-week)',
    date: new Date(2026, 2, 25),
    expectedISOWeek: '2026-W13',
  },
  {
    label: 'Mon 2026-03-30 (Monday)',
    date: new Date(2026, 2, 30),
    expectedISOWeek: '2026-W14',
  },

  // ── Sunday — the day Austin's bug occurred ──
  {
    label: 'Sun 2026-03-29 (Sunday — Austin\'s bug scenario)',
    date: new Date(2026, 2, 29),
    expectedISOWeek: '2026-W13',
  },
  {
    label: 'Sun 2026-03-22',
    date: new Date(2026, 2, 22),
    expectedISOWeek: '2026-W12',
  },

  // ── Year boundary edge cases ──
  {
    label: 'Wed 2025-12-31 (belongs to 2026-W01)',
    date: new Date(2025, 11, 31),
    expectedISOWeek: '2026-W01',
  },
  {
    label: 'Thu 2026-01-01 (belongs to 2026-W01)',
    date: new Date(2026, 0, 1),
    expectedISOWeek: '2026-W01',
  },
  {
    label: 'Mon 2024-12-30 (belongs to 2025-W01)',
    date: new Date(2024, 11, 30),
    expectedISOWeek: '2025-W01',
  },
  {
    label: 'Sun 2024-12-29 (belongs to 2024-W52)',
    date: new Date(2024, 11, 29),
    expectedISOWeek: '2024-W52',
  },

  // ── Week 53 edge case (2020 had 53 weeks) ──
  {
    label: 'Thu 2020-12-31 (belongs to 2020-W53)',
    date: new Date(2020, 11, 31),
    expectedISOWeek: '2020-W53',
  },
  {
    label: 'Fri 2021-01-01 (still 2020-W53)',
    date: new Date(2021, 0, 1),
    expectedISOWeek: '2020-W53',
  },

  // ── More Sundays (high-risk day for the old algorithm) ──
  {
    label: 'Sun 2026-01-04',
    date: new Date(2026, 0, 4),
    expectedISOWeek: '2026-W01',
  },
  {
    label: 'Sun 2026-02-01',
    date: new Date(2026, 1, 1),
    expectedISOWeek: '2026-W05',
  },
  {
    label: 'Sun 2026-06-07',
    date: new Date(2026, 5, 7),
    expectedISOWeek: '2026-W23',
  },
]

// ─── Run tests ───────────────────────────────────────────────────────────────

console.log('='.repeat(90))
console.log('ISO WEEK ALGORITHM COMPARISON TEST')
console.log('='.repeat(90))
console.log('')
console.log(
  'OLD = broken client-side (AutoNudgeImpact.tsx before fix)'
)
console.log(
  'NEW = fixed client-side  (AutoNudgeImpact.tsx after fix)'
)
console.log(
  'SRV = server-side        (update_sms_barber_success.ts)'
)
console.log('')

let passed = 0
let failed = 0
const failures: string[] = []

for (const tc of testCases) {
  const old = oldGetCurrentISOWeek(tc.date)
  const fixed = newGetCurrentISOWeek(tc.date)
  const server = serverGetISOWeek(tc.date)

  const oldMatch = old === tc.expectedISOWeek
  const fixedMatch = fixed === tc.expectedISOWeek
  const serverMatch = server === tc.expectedISOWeek
  const clientServerAlign = fixed === server

  const status =
    fixedMatch && serverMatch && clientServerAlign ? '✅ PASS' : '❌ FAIL'

  if (status === '✅ PASS') {
    passed++
  } else {
    failed++
    failures.push(tc.label)
  }

  console.log(`${status}  ${tc.label}`)
  console.log(
    `        Expected: ${tc.expectedISOWeek}  |  OLD: ${old}${oldMatch ? '' : ' ⚠️  WRONG'}  |  NEW: ${fixed}${fixedMatch ? '' : ' ⚠️  WRONG'}  |  SRV: ${server}${serverMatch ? '' : ' ⚠️  WRONG'}  |  client=server: ${clientServerAlign ? 'yes' : '⚠️  NO'}`
  )

  if (!oldMatch) {
    console.log(
      `        ^ OLD algorithm returned ${old} instead of ${tc.expectedISOWeek} — this is the bug`
    )
  }
  console.log('')
}

console.log('='.repeat(90))
console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${testCases.length} tests`)
if (failures.length > 0) {
  console.log(`FAILURES:`)
  failures.forEach((f) => console.log(`  - ${f}`))
}
console.log('='.repeat(90))

process.exit(failed > 0 ? 1 : 0)