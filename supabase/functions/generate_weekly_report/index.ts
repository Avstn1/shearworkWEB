// EDGE FUNCTION TESTED WITH SUPABASE CRON JOBS. FULLY FUNCTIONAL BUT ONLY FOR GAVIN. ONCE GREENLIT, WILL REMOVE THE USER_ID FILTER.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

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

// This is going to run every 12am every Monday, effectively generating the report for the previous week
// CRON JOB ---- 0 0 * * 1 ----
Deno.serve(async (req) => {
  try {
    // Report generation
    const now = new Date();
    let todaysDate = 14 // now.getDate();
    let selectedMonth = 6 // now.getMonth();  TEST FOR JULY 16TH
    let selectedYear = now.getFullYear();

    // console.log('Today is:', todaysDate, monthNames[selectedMonth], selectedYear);

    let mondays_in_month = getMondaysInMonth(selectedMonth, selectedYear); // [ex. Nov: [3, 10, 17, 24]]
    let week_number_to_generate_report = mondays_in_month.indexOf(todaysDate);
    // console.log('Mondays in month:', mondays_in_month, 'Week number to generate report:', week_number_to_generate_report);
    
    if ((todaysDate == mondays_in_month[0])) { // If today's date is the first Monday of the month...
      if ((selectedMonth - 1) < 0) {// If the current month is January, go back one year
        selectedYear = (selectedYear - 1);
        // console.log('First month of the year detected. Adjusting year to:', selectedYear);
      }

      selectedMonth = (selectedMonth - 1) < 0 ? 11 : (selectedMonth - 1); // If current month is January, set month to December, else go back one month
      // console.log('First Monday of the month detected. Adjusting month to:', selectedMonth);

      console.log(monthNames[selectedMonth], selectedYear);
      mondays_in_month = getMondaysInMonth(selectedMonth, selectedYear); // Get mondays for the previous month
      console.log('Mondays in previous month:', mondays_in_month);
      week_number_to_generate_report = mondays_in_month.length; 
    }
    

    console.log(`Generating report for ${monthNames[selectedMonth]} ${selectedYear} at week number ${week_number_to_generate_report}`);
    
    const url = `https://shearwork-web.vercel.app/api/openai/generate`
    const token = Deno.env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? ''

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
                'x-vercel-protection-bypass': Deno.env.get('BYPASS_TOKEN')
              },
              body: JSON.stringify({
                type: `weekly/${barber.barber_type}`,
                user_id: barber.user_id,
                month: monthNames[selectedMonth],
                year: selectedYear,
                week_number: week_number_to_generate_report,
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

    console.log(`All weekly requests dispatched (with concurrency limit ${CONCURRENCY_LIMIT}).`);
    console.log(`GENERATION ENDED. CURRENT TIME: ${new Date()}`);

    return new Response(JSON.stringify({  }), { // data
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    return new Response(String(err?.message ?? err), { status: 500 })
  }
})

function getMondaysInMonth(month: number, year: number): number[] {
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