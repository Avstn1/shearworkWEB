import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

// Get id if the role is a Barber
const { data: barberIDs, error } = await supabase
  .from('profiles')
  .select('id') 
  .eq('role', 'Barber')          
  
console.log("Barber IDs:", barberIDs);

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") ?? '', 
      Deno.env.get("PUBLISHABLE_KEY") ?? '', 
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Report generation


    // Adding the report to the database
    const { data, error } = await supabase.from('test_table').insert({
      name: 'Test Name',
    })

    if (error) {
      throw error
    }

    return new Response(JSON.stringify({ data }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    return new Response(String(err?.message ?? err), { status: 500 })
  }
})

