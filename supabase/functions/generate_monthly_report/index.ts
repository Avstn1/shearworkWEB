// supabase/functions/generate_monthly_report/index.ts

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

if (barberError) throw barberError
console.log('Barber IDs:', barberData)

// This is going to run every 12am on the first day of the month, effectively generating the report for the previous month
// CRON JOB ---- 0 0 1 * * ----
Deno.serve(async (req) => {
  try {
    let prevMonthIndex = now.getMonth() - 1
    let selectedYear = prevMonthIndex < 0 ? now.getFullYear() - 1 : now.getFullYear()
    prevMonthIndex = prevMonthIndex < 0 ? 11 : prevMonthIndex
    let selectedMonth = monthNames[prevMonthIndex]

    const BYPASS_TOKEN = Deno.env.get('BYPASS_TOKEN') ?? ''

    const url = `https://shearwork-web.vercel.app/api/openai/generate`
    const token = Deno.env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? ''
    // Create an array to hold all responses

    console.log(`STARTING TO GENERATE FOR ${barberData.length} BARBERS. CURRENT TIME: ${new Date()}`);
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
                type: `monthly/${barber.barber_type}`,
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

    console.log(`All requests dispatched (with concurrency limit ${CONCURRENCY_LIMIT}).`);
    console.log(`GENERATION ENDED. CURRENT TIME: ${new Date()}`);

    return new Response(JSON.stringify({ }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    return new Response(String(err?.message ?? err), { status: 500 })
  }
})

