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
  .select('user_id, full_name') 
  .eq('role', 'Barber')  
  .eq('user_id', '39d5d08d-2deb-4b92-a650-ee10e70b7af1') // Gavin Cruz's user_id for testing        
  .limit(2)

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

    for (const barber of barberData) {
      let type = 'monthly/rental' // change this to be dynamic later
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-vercel-protection-bypass': BYPASS_TOKEN
        },
        body: JSON.stringify({
          type,
          user_id: barber.user_id,
          month: selectedMonth,
          year: selectedYear,
          week_number: null,
        }),
      })

      // const results: any[] = []
      // const text = await response.text()
      // try {
      //   const data = JSON.parse(text)
      //   console.log('Raw response:', data)
      //   results.push(data)
      // } catch {
      //   console.error('❌ Not JSON, got:', text)
      //   results.push({ error: 'Invalid JSON', raw: text })
      // }

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

