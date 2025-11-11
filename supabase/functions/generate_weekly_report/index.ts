import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

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

// This is going to run every 12am every Monday, effectively generating the report for the previous week
Deno.serve(async (req) => {
  try {
    // Report generation
    let type = 'monthly/rental'
    let todaysDate = now.getDate();

    let selectedMonth = now.getMonth();
    let selectedYear = now.getFullYear();

    let mondays_in_month = getMondaysInMonth(selectedMonth, selectedYear); // [ex. Nov: [3, 10, 17, 24]]
    let week_number = ; // CONTINUE LATER. YOU ARE SETTING THE WEEK NUMBER

    // If today's date is the first Monday of the month...
    if ((todaysDate == mondays_in_month[0])) {
      // If current month is January, set month to December, else go back one month
      selectedMonth = monthNames[(now.getMonth() - 1) < 0 ? 11 : (now.getMonth() - 1)];

      // If the current month is January, go back one year
      if ((now.getMonth() - 1) < 0)
        selectedYear = (now.getFullYear() - 1);

      mondays_in_month = getMondaysInMonth(selectedMonth, selectedYear);
  
      week_number = ; // CONTINUE LATER. YOU ARE SETTING THE WEEK NUMBER
    }
    

    console.log(`Generating report for ${selectedMonth} ${selectedYear}`)
    
    for (const barber of barberData) {
      const localURL = "http://192.168.56.1:3000"
      // const supabaseURL = Deno.env.get("NEXT_PUBLIC_SUPABASE_URL")

      const url = `${localURL}/api/openai/generate`
      const token = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          type,
          user_id: barber.user_id,
          month: selectedMonth,
          year: selectedYear,
          week_number: week_number,
        }),
      })

      const data = await response.json()
      console.log('Raw response:', data)
    }

    // Adding the report to the database
    const { data, error: insertError } = await supabase.from('test_table').insert({
      name: 'Test Name',
    })

    if (insertError) {
      throw insertError
    }

    return new Response(JSON.stringify({ data }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    return new Response(String(err?.message ?? err), { status: 500 })
  }
})

