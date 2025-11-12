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
  .eq('user_id', '39d5d08d-2deb-4b92-a650-ee10e70b7af1') // Gavin Cruz's user_id for testing        
  .limit(2)

if (barberError) throw barberError
console.log('Barber IDs:', barberData)

// This is going to run every 12am every second until last Monday of every month, effectively generating the report for the previous week
// CRON JOB ---- 0 0 * * 1 ----
Deno.serve(async (req) => {
  try {
    const now = new Date();
    let todaysDate = now.getDate();
    let monthIndex = now.getMonth();
    let selectedYear = now.getFullYear()

    let mondays_in_month = getMondaysInMonth(monthIndex, selectedYear);

    if (todaysDate == mondays_in_month[0]) {
      monthIndex = now.getMonth() - 1
      selectedYear = monthIndex < 0 ? now.getFullYear() - 1 : now.getFullYear()
      monthIndex = monthIndex < 0 ? 11 : monthIndex
    }

    let selectedMonth = monthNames[monthIndex]

    const BYPASS_TOKEN = Deno.env.get('BYPASS_TOKEN') ?? ''

    const url = `https://shearwork-web.vercel.app/api/openai/generate`
    const token = Deno.env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? ''
    // Create an array to hold all responses

    for (const barber of barberData) {
      let type = `monthly/${barber.barber_type}` 
      
      const response = await fetch(url, {
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

      const data = await response.json()
      console.log('Raw response:', data)
    }

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