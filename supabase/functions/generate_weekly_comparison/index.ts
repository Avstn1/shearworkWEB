// EDGE FUNCTION TESTED WITH SUPABASE CRON JOBS. FULLY FUNCTIONAL BUT ONLY FOR GAVIN. ONCE GREENLIT, WILL REMOVE THE USER_ID FILTER.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const now = new Date(); 

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const supabase = createClient(
    Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") ?? '', 
    Deno.env.get("SERVICE_ROLE_KEY") ?? '', 
)

// Get id if the role is a Barber
const { data: barberData, error: barberError } = await supabase
  .from('profiles')
  .select('user_id, full_name, barber_type') 
  .eq('role', 'Barber')  
  // .eq('user_id', '39d5d08d-2deb-4b92-a650-ee10e70b7af1') // Gavin Cruz's user_id for testing        

if (barberError) throw barberError
console.log('Barber IDs:', barberData)

// This is going to run every 12am every second until last Monday of every month, effectively generating the report for the previous week
// CRON JOB ---- 0 0 * * 1 ----
Deno.serve(async (req) => {
  try {
    const now = new Date();
    let todaysDate = 4 // now.getDate();
    let monthIndex = 7 // now.getMonth(); TEST FOR THE MONTH OF JULY
    let selectedYear = now.getFullYear()

    let mondays_in_month = getMondaysInMonth(monthIndex, selectedYear);

    if (todaysDate == mondays_in_month[0]) {
      monthIndex = monthIndex - 1
      selectedYear = monthIndex < 0 ? selectedYear - 1 : selectedYear
      monthIndex = monthIndex < 0 ? 11 : monthIndex
    }

    let selectedMonth = monthNames[monthIndex]

    const BYPASS_TOKEN = Deno.env.get('BYPASS_TOKEN') ?? ''

    const url = `https://shearwork-web.vercel.app/api/openai/generate`
    const token = Deno.env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? ''
    // Create an array to hold all responses

    console.log(`barberData length: ${barberData.length}`);
    console.log(`STARTING TO GENERATE. CURRENT TIME: ${new Date()}`);
    
    const CONCURRENCY_LIMIT = 100;

    async function fireWithConcurrency(items, limit) {
      let active = 0;
      let index = 0;

      return new Promise(resolve => {
        function next() {
          while (active < limit && index < items.length) {
            const barber = items[index++];
            active++;

            fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'x-vercel-protection-bypass': BYPASS_TOKEN
              },
              body: JSON.stringify({
                type: `weekly_comparison/${barber.barber_type}`,
                user_id: barber.user_id,
                month: selectedMonth,
                year: selectedYear,
                week_number: null,
              }),
            })
              .catch(err => console.error(`Error for ${barber.user_id}:`, err))
              .finally(() => {
                active--;
                next(); // trigger next when one finishes
              });
          }

          if (active === 0 && index >= items.length) resolve();
        }

        next();
      });
    }

    await fireWithConcurrency(barberData, CONCURRENCY_LIMIT);

    console.log(`All weekly comparison requests dispatched (with concurrency limit ${CONCURRENCY_LIMIT}).`);
    console.log(`GENERATION ENDED. CURRENT TIME: ${new Date()}`);

    return new Response(JSON.stringify({ }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    return new Response(String(err?.message ?? err), { status: 500 })
  }
})

function getMondaysInMonth(month: number, year: number): Date[] {
  const mondays: number[] = []
  const date = new Date(year, month, 1) 

  // Move to first Monday
  while (date.getDay() !== 1) {
    date.setDate(date.getDate() + 1)
  }

  // Collect all Mondays
  while (date.getMonth() === month) {
    mondays.push(date.getDate())
    date.setDate(date.getDate() + 7)
  }

  return mondays
}