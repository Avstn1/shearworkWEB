// ✅ Updated Monthly Rental Prompt (aligned with dataset + weeklyComparisonRentalPrompt structure)
export const monthlyRentalPrompt = (dataset: any, userName: string, month: string, year: number) => {
  const summary = dataset.summary || {}
  const startDate = summary.start_date || ''
  const endDate = summary.end_date || ''
  const services = dataset.services || []
  const funnels = dataset.marketing_funnels || []
  const topClients = dataset.top_clients || []
  const weeklyRows = dataset.weekly_rows || []

  const tips = summary.tips.totalTips || 0
  const tipsServiceType = summary.tips.tipsServiceType || {}

  const totalRevenue = summary.total_revenue + tips || 0
  const expenses = summary.expenses || 0
  const profit = totalRevenue - expenses + tips 
  const avgTicket =
    summary.num_appointments && summary.num_appointments > 0
      ? (summary.final_revenue || 0) / summary.num_appointments
      : 0

  const totalNewClients = funnels
    .filter((f: any) => f.source !== 'Returning Client')
    .reduce((sum: any, f: any) => sum + (f.new_clients || 0), 0);

  const totalReturningClients = summary.num_appointments - totalNewClients

  // Weekly snapshot calculations
  let totalClients = 0
  let totalWeeklyRevenue = 0
  let bestWeek: any = null
  let worstWeek: any = null
  let weeklyAvgTickets: number[] = []

  weeklyRows.forEach((w: any) => {
    const clients = w.num_appointments || 0
    const revenue = w.total_revenue || 0
    const avg = clients ? revenue / clients : 0
    totalClients += clients
    totalWeeklyRevenue += revenue
    weeklyAvgTickets.push(avg)

    if (!bestWeek || revenue > bestWeek.total_revenue) bestWeek = w
    if (!worstWeek || revenue < worstWeek.total_revenue) worstWeek = w
  })

  console.log("From monthly rental: " + tips)

  const avgWeeklyRevenue = weeklyRows.length ? totalWeeklyRevenue / weeklyRows.length : 0

  return `
IMPORTANT INSTRUCTIONS: You are a professional analytics assistant creating a monthly performance report for a barbershop professional on booth rental named ${userName}.
Be a little fun and use emojis, especially in section headers and bullet points. Use start_date and end_date from monthly_data to reflect the full date range.
Use data from summary, services, funnels, top_clients, and weekly_rows to calculate totals and insights. Make sure all totals match the dataset.
The report will be displayed in TinyMCE. After each section generate a 3-4 sentence CREATIVE AND LIVELY
ANALYSIS AND DESCRIPTION!

After each section generate an additional 3-4 sentence CREATIVE AND LIVELY
ANALYSIS AND DESCRIPTION!

YOU ARE TALKING TO A BARBER - NOT A BARBERSHOP!! DO NOT  REMOVE ANY KIND OF DATA.

Dataset (JSON):
${JSON.stringify(dataset.weekly_rows, null, 2)}
${JSON.stringify(dataset.daily_rows, null, 2)}

Generate a detailed monthly report in HTML suitable for TinyMCE. Fill in all data. DO NOT WRAP WITH '''html and
Do NOT use Markdown (** or *) at all to bold text, use <b>Bold Text</b> or <strong>Bold Text</strong> instead.
Include:

1. <h1>${month} ${year} Business Report</h1>

2. <h2>🧐 Quick Overview</h2>
    <table style="table-layout: fixed; width: 100%;">
     <thead><tr><th style="width: 50%;">Metric</th><th style="width: 50%;">Value</th></tr></thead>
     <tbody>
      <tr><td>Total Revenue</td><td>$${totalRevenue.toFixed(2)}</td></tr>
      <tr><td>Estimated Expenses</td><td>$${expenses.toFixed(2)}</td></tr>
      <tr><td>Tips Generated</td><td>$${(tips || 0).toFixed(2)}</td></tr>
      <tr><td>Estimated Profit</td><td>$${profit.toFixed(2)}</td></tr>
      <tr><td>Date Range</td><td>${startDate} → ${endDate}</td></tr>
     </tbody>
   </table>

    <table style="table-layout: fixed; width: 100%;">
     <thead><tr><th style="width: 50%;">Metric</th><th style="width: 50%;">Value</th></tr></thead>
     <tbody>
      <tr><td>Total Appointments</td><td>${summary.num_appointments}</td></tr>
      <tr><td>New Clients</td><td>${totalNewClients || 0}</td></tr>
      <tr><td>Returning Clients</td><td>${totalReturningClients || 0}</td></tr>
      <tr><td>Average Ticket</td><td>$${avgTicket.toFixed(2)}</td></tr>
     </tbody>
   </table>
   

3. <h2>💼 Service Breakdown</h2>
${
  services.length
    ? `<table>
         <thead><tr><th>Service</th><th># of Bookings</th><th>% of Total</th><th>Tips</th><th>Est. Revenue</th><th>Avg/Booking</th></tr></thead>
         <tbody>
           ${services
             .sort((a: any, b: any) => (b.bookings || 0) - (a.bookings || 0))
             .map(
               (s: any) => {
                 const tips = tipsServiceType[s.service_name] || 0;
                 const estRevenue = ((s.price || 0) * s.bookings) + tips;
                 const avgPerBooking = s.bookings > 0 ? estRevenue / s.bookings : 0;
                 return `<tr><td>${s.service_name}</td><td>${s.bookings || 0}</td><td>${dataset.services_percentage?.find((sp:any)=>sp.name===s.service_name)?.percentage.toFixed(1) || 0}%</td><td>$${tips.toFixed(2)}</td><td>$${estRevenue.toFixed(2)}</td><td>$${avgPerBooking.toFixed(2)}</td></tr>`
               }
             )
             .join('')}
           <tr><td><strong>Total</strong></td><td>${services.reduce((sum:any,s:any)=>sum+(s.bookings||0),0)}</td><td>100%</td><td>$${(Object.values(tipsServiceType) as number[]).reduce((sum: any, t: any) => sum + t, 0).toFixed(2)}</td><td>$${services.reduce((sum:any,s:any)=>{
             const tips = tipsServiceType[s.service_name] || 0;
             return sum + ((s.price || 0) * s.bookings) + tips;
           },0).toFixed(2)}</td><td>$${(services.reduce((sum:any,s:any)=>{
             const tips = tipsServiceType[s.service_name] || 0;
             return sum + ((s.price || 0) * s.bookings) + tips;
           },0)/services.reduce((sum:any,s:any)=>sum+(s.bookings||0),0)).toFixed(2)}</td></tr>
         </tbody>
       </table>
       Instructions: creative analysis/generation of above`
    : `<p>No data available for this section.</p>`
}

4. <h2>💰 Expense Overview</h2>
   <table>
     <thead><tr><th>Type</th><th>Amount</th></tr></thead>
     <tbody>
       <tr><td>Rent (Fixed)</td><td>$${expenses.toFixed(2)}</td></tr>
       <tr><td><strong>Net Profit</strong></td><td><strong>$${profit.toFixed(2)}</strong></td></tr>
     </tbody>
   </table>

<h2>📣 Marketing Funnels</h2>
${(funnels.length
      ? `<table>
          <thead><tr><th>Source</th><th>New Clients</th><th>Retained</th><th>Retention</th><th>Avg Ticket</th></tr></thead>
          <tbody>
            ${funnels
              .filter((f: any) => f.source !== 'Returning Client' && f.source !== "Walk In")
              .sort((a: any, b: any) => (b.new_clients || 0) - (a.new_clients || 0))
              .map(
                  (f: any) =>
                  `<tr>
                      <td>${f.source}</td>
                      <td>${f.new_clients || 0}</td>
                      <td>${f.returning_clients || 0}</td>
                      <td>${(f.returning_clients && f.new_clients) ? ((f.returning_clients/f.new_clients) * 100).toFixed(2) + '%' : '--'}</td>
                      <td>$${(f.avg_ticket || 0).toFixed(2)}</td>
                  </tr>`
              )
              .join('')}
          </tbody>
        </table>
        <p>PROMPT: State which channels did the well (UNLESS it's "Walking By") and Encourage exposing more of their work publicly. DO NOT mention any other channels</p>
        Instructions: creative analysis/generation`
      : `<p>No data available for this section.</p>`)
}

6. <h2>👑 Top Clients</h2>
   ${
     topClients.length
       ? `<table>
            <thead><tr><th>Rank</th><th>Client</th><th>Service Totals</th><th>Visits</th></tr></thead>
            <tbody>
                ${topClients
                .slice(0, 5)
                .filter((f: any) => f.source !== 'Returning Client' && f.source !== "Walk In")
                .map((c: any, i: number) => {
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : ''
                    return `<tr>
                            <td>${medal || i + 1}</td>
                            <td>${c.client_name}</td>
                            <td>$${(c.total_paid || 0).toFixed(2)}</td>
                            <td>${c.num_visits || 0}</td>
                            </tr>`
                })
                .join('')}
            </tbody>
          </table>
          Instructions: creative analysis/generation`
       : `<p>No data available for this section.</p>`
   }

7. <h2>↻ Frequency Highlights</h2>
   ${
     topClients.length
       ? `<table>
            <thead><tr><th>Client</th><th>Visits</th><th>Service Totals</th></tr></thead>
            <tbody>
              ${topClients
                .sort((a: any, b: any) => (b.num_visits || 0) - (a.num_visits || 0))
                .slice(0, 5)
                .map(
                  (c: any) =>
                    `<tr><td>${c.client_name}</td><td>${c.num_visits || 0}</td><td>$${(c.total_paid || 0).toFixed(2)}</td></tr>`
                )
                .join('')}
            </tbody>
          </table>
          Instructions: creative analysis/generation`
       : `<p>No data available for this section.</p>`
   }

8. <h2>📊 Weekly Performance Snapshot</h2>
    ${
    weeklyRows.length
        ? (() => {
            // calculate totals and metrics dynamically
            let totalRevenue = 0
            let totalClients = 0
            let bestWeek: any = null
            let worstWeek: any = null
            let avgTickets: number[] = []

            weeklyRows.forEach((w: any) => {
            const clients = w.num_appointments || 0
            const revenue = w.total_revenue || 0
            const avgTicket = clients ? revenue / clients : 0
            totalRevenue += revenue
            totalClients += clients
            avgTickets.push(avgTicket)

            if (!bestWeek || revenue > bestWeek.total_revenue) bestWeek = w
            if (!worstWeek || revenue < worstWeek.total_revenue) worstWeek = w
            })

            const avgWeeklyRevenue = weeklyRows.length ? totalRevenue / weeklyRows.length : 0
            const consistentTicket = Math.min(...avgTickets) // lowest avg ticket determines "dip week"

            return `
            <table>
            <thead><tr><th>Week</th><th>Revenue</th><th>Clients</th><th>Avg Ticket</th></tr></thead>
            <tbody>
                ${weeklyRows
                .map(
                    (w: any) => `<tr>
                                    <td>Week ${w.week_number}</td>
                                    <td>$${(w.total_revenue || 0).toFixed(2)}</td>
                                    <td>${w.num_appointments || 0}</td>
                                    <td>$${w.num_appointments ? ((w.total_revenue || 0) / w.num_appointments).toFixed(2) : '0.00'}</td>
                                </tr>`
                )
                .join('')}
                <tr>
                <td><strong>Total</strong></td>
                <td>$${totalRevenue.toFixed(2)}</td>
                <td>${totalClients}</td>
                <td>$${(totalClients ? (totalRevenue / totalClients).toFixed(2) : '0.00')}</td>
                </tr>
            </tbody>
            </table>
            <li>📈 Best Week: Week ${bestWeek.week_number} — $${bestWeek.total_revenue.toFixed(2)} revenue with ${bestWeek.num_appointments} clients and $${(bestWeek.total_revenue / bestWeek.num_appointments).toFixed(2)} average ticket</li>
            <li>📉 Lightest Week: Week ${worstWeek.week_number} — $${worstWeek.total_revenue.toFixed(2)} revenue with ${worstWeek.num_appointments} clients</li>
            <li>💰 Average Weekly Revenue: $${avgWeeklyRevenue.toFixed(2)}</li>
            <li>⚡ Premium ticket consistency: Lowest weekly average ticket was $${consistentTicket.toFixed(2)} — shows overall pricing stability</li>
            `
        })()
        : `<p>No weekly breakdown available for this month.</p>`
    }


9. <h2>✨ Key Takeaways</h2> (The following is just an example, ai instructions: make it more creative and change it up but use the same data)
   <ul>
     <li>👥 Total Clients: ${summary.total_clients || 0} — strong base of loyal and new clients.</li>
     <li>💵 Approx. Take Home: $${profit.toFixed(2)} net profit.</li>
     <li>💳 Average Ticket: $${avgTicket.toFixed(2)} showing stable revenue per client.</li>
     <li>💈 Multi-visit Clients: ${topClients.filter((c:any)=>(c.num_visits||0)>1).length} returned more than once — great loyalty!</li>
     <li>🚀 Keep growing by leveraging top-performing services and funnels next month!</li>
   </ul>
  `;
};


// 9. <h2>✨ Key Takeaways</h2> (The following is just an example, ai instructions: make it more creative and change it up but use the same data)
//    <ul>
//      <li>👥 Total Clients: ${summary.total_clients || 0} — strong base of loyal and new clients.</li>
//      <li>💵 Approx. Take Home: $${profit.toFixed(2)} net profit.</li>
//      <li>🎯 Best Marketing Funnel: ${funnels.sort((a:any,b:any)=>(b.new_clients||0)-(a.new_clients||0))[0]?.source || 'N/A'} performed best for new leads.</li>
//      <li>💳 Average Ticket: $${avgTicket.toFixed(2)} showing stable revenue per client.</li>
//      <li>💈 Multi-visit Clients: ${topClients.filter((c:any)=>(c.num_visits||0)>1).length} returned more than once — great loyalty!</li>
//      <li>🚀 Keep growing by leveraging top-performing services and funnels next month!</li>
//    </ul>
//   `;
// };