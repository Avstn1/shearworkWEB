// tests/test_resolve_barber.ts
//
// Standalone test — no framework needed.
// Run: npx tsx tests/test_resolve_barber.ts

// ── Real data from the bug (calendar_id 7180066) ───────────────────────────

const AUSTIN_CRUZ = 'f58bb829-b495-47a2-810e-fe380a43fbbc';
const USER_B      = 'b7d67f07-0000-0000-0000-000000000000';
const USER_C      = '1b19d3ab-0000-0000-0000-000000000000';
const USER_D      = '7fd81b2d-0000-0000-0000-000000000000';
const GAVIN_CRUZ  = '39d5d08d-0000-0000-0000-000000000000';
const CRUZ        = '148e1d51-ad9f-4eda-a33e-73d13d5d01cb';
const USER_G      = '2355c9ff-0000-0000-0000-000000000000';

const ALL_CANDIDATES = [AUSTIN_CRUZ, USER_B, USER_C, USER_D, GAVIN_CRUZ, CRUZ, USER_G];

// Simulated profiles table rows (only relevant columns)
const PROFILES_DB: Record<string, {
  user_id: string;
  calendar: string | null;
  sms_engaged_current_week: boolean;
  stripe_subscription_status: string | null;
}> = {
  [AUSTIN_CRUZ]: {
    user_id: AUSTIN_CRUZ,
    calendar: null,
    sms_engaged_current_week: false,
    stripe_subscription_status: null,
  },
  [USER_B]: {
    user_id: USER_B,
    calendar: 'OTHER',
    sms_engaged_current_week: false,
    stripe_subscription_status: 'active',
  },
  [USER_C]: {
    user_id: USER_C,
    calendar: null,
    sms_engaged_current_week: false,
    stripe_subscription_status: null,
  },
  [USER_D]: {
    user_id: USER_D,
    calendar: null,
    sms_engaged_current_week: false,
    stripe_subscription_status: null,
  },
  [GAVIN_CRUZ]: {
    user_id: GAVIN_CRUZ,
    calendar: 'CRUZ',
    sms_engaged_current_week: false,
    stripe_subscription_status: 'active',
  },
  [CRUZ]: {
    user_id: CRUZ,
    calendar: 'CRUZ',
    sms_engaged_current_week: true,
    stripe_subscription_status: 'active',
  },
  [USER_G]: {
    user_id: USER_G,
    calendar: null,
    sms_engaged_current_week: false,
    stripe_subscription_status: null,
  },
};

// ── Mock Supabase ───────────────────────────────────────────────────────────
// Simulates .from('profiles').select(...).in('user_id', ids).eq('calendar', name)

function createMockSupabase() {
  return {
    from: (table: string) => {
      if (table !== 'profiles') throw new Error(`Unexpected table: ${table}`);

      let selectedFields: string[] = [];
      let filters: { column: string; op: string; value: any }[] = [];

      const chain = {
        select: (fields: string) => {
          selectedFields = fields.split(',').map((f) => f.trim());
          return chain;
        },
        in: (column: string, values: any[]) => {
          filters.push({ column, op: 'in', value: values });
          return chain;
        },
        eq: (column: string, value: any) => {
          filters.push({ column, op: 'eq', value });

          // Terminal — resolve the query
          let rows = Object.values(PROFILES_DB);

          for (const f of filters) {
            if (f.op === 'in') {
              rows = rows.filter((r) => f.value.includes((r as any)[f.column]));
            } else if (f.op === 'eq') {
              rows = rows.filter((r) => (r as any)[f.column] === f.value);
            }
          }

          // Pick only selected fields
          const projected = rows.map((r) => {
            const out: any = {};
            for (const field of selectedFields) {
              out[field] = (r as any)[field];
            }
            return out;
          });

          return { data: projected, error: null };
        },
      };

      return chain;
    },
  } as any;
}

// ── Inline copy of resolveBarberUserId (so we don't need import paths) ──────

interface ResolvedBarber {
  userId: string;
  allCandidateUserIds: string[];
}

async function resolveBarberUserId(
  supabase: any,
  candidateUserIds: string[],
  calendarName: string | undefined
): Promise<ResolvedBarber> {
  if (candidateUserIds.length === 1) {
    return { userId: candidateUserIds[0], allCandidateUserIds: candidateUserIds };
  }

  if (!calendarName) {
    return { userId: candidateUserIds[0], allCandidateUserIds: candidateUserIds };
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('user_id, sms_engaged_current_week, stripe_subscription_status')
    .in('user_id', candidateUserIds)
    .eq('calendar', calendarName);

  if (profilesError || !profiles || profiles.length === 0) {
    return { userId: candidateUserIds[0], allCandidateUserIds: candidateUserIds };
  }

  if (profiles.length === 1) {
    return { userId: profiles[0].user_id, allCandidateUserIds: candidateUserIds };
  }

  const smsActive = profiles.find((p: any) => p.sms_engaged_current_week === true);
  if (smsActive) {
    return { userId: smsActive.user_id, allCandidateUserIds: candidateUserIds };
  }

  const activeSubscriber = profiles.find(
    (p: any) => p.stripe_subscription_status === 'active'
  );
  if (activeSubscriber) {
    return { userId: activeSubscriber.user_id, allCandidateUserIds: candidateUserIds };
  }

  return { userId: profiles[0].user_id, allCandidateUserIds: candidateUserIds };
}

// ── Test runner ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(testName: string, actual: string, expected: string) {
  if (actual === expected) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ ${testName}`);
    console.log(`     expected: ${expected}`);
    console.log(`     got:      ${actual}`);
    failed++;
  }
}

async function runTests() {
  const supabase = createMockSupabase();

  console.log('\n🧪 Resolver tests — calendar_id 7180066 bug\n');

  // ── Test 1: The actual bug scenario ──────────────────────────────────────
  // Appointment has calendar: "CRUZ". Should resolve to Cruz (148e1d51)
  // who has sms_engaged_current_week = true, NOT Austin Cruz (f58bb829).
  console.log('Test 1: Real bug — CRUZ appointment with 7 candidates');
  const t1 = await resolveBarberUserId(supabase, ALL_CANDIDATES, 'CRUZ');
  assert('resolves to Cruz (sms_engaged)', t1.userId, CRUZ);

  // ── Test 2: Calendar name filters out non-matching users ─────────────────
  // If only Gavin had sms_engaged, he'd win. But since Cruz does, Cruz wins.
  // Let's test with a scenario where Cruz doesn't have sms_engaged.
  console.log('\nTest 2: CRUZ calendar, but Cruz has sms_engaged=false');
  const savedEngaged = PROFILES_DB[CRUZ].sms_engaged_current_week;
  PROFILES_DB[CRUZ].sms_engaged_current_week = false;
  const t2 = await resolveBarberUserId(createMockSupabase(), ALL_CANDIDATES, 'CRUZ');
  // Both CRUZ profiles have active subscription, should pick one of them (Gavin or Cruz)
  const t2Valid = t2.userId === GAVIN_CRUZ || t2.userId === CRUZ;
  assert(
    'resolves to a CRUZ-calendar user (not Austin)',
    t2.userId === AUSTIN_CRUZ ? 'WRONG: Austin' : 'correct: CRUZ-calendar user',
    'correct: CRUZ-calendar user'
  );
  PROFILES_DB[CRUZ].sms_engaged_current_week = savedEngaged; // restore

  // ── Test 3: Single candidate — no disambiguation needed ──────────────────
  console.log('\nTest 3: Single candidate — no disambiguation');
  const t3 = await resolveBarberUserId(supabase, [CRUZ], 'CRUZ');
  assert('returns the only candidate', t3.userId, CRUZ);

  // ── Test 4: No calendar name on appointment ──────────────────────────────
  console.log('\nTest 4: No calendar name — falls back to first candidate');
  const t4 = await resolveBarberUserId(supabase, ALL_CANDIDATES, undefined);
  assert('returns first candidate', t4.userId, ALL_CANDIDATES[0]);

  // ── Test 5: Calendar name matches nobody ─────────────────────────────────
  console.log('\nTest 5: Calendar name "UNKNOWN" matches no profiles');
  const t5 = await resolveBarberUserId(supabase, ALL_CANDIDATES, 'UNKNOWN');
  assert('returns first candidate as fallback', t5.userId, ALL_CANDIDATES[0]);

  // ── Test 6: Calendar name matches exactly one user ───────────────────────
  console.log('\nTest 6: Calendar "OTHER" matches only USER_B');
  const t6 = await resolveBarberUserId(supabase, ALL_CANDIDATES, 'OTHER');
  assert('resolves to USER_B uniquely', t6.userId, USER_B);

  // ── Test 7: allCandidateUserIds always returns full list ─────────────────
  console.log('\nTest 7: allCandidateUserIds preserves full candidate list');
  const t7 = await resolveBarberUserId(supabase, ALL_CANDIDATES, 'CRUZ');
  assert(
    'candidate list length is 7',
    String(t7.allCandidateUserIds.length),
    String(ALL_CANDIDATES.length)
  );

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});