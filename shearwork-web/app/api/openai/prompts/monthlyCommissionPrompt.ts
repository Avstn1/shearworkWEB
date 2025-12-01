export const monthlyCommissionPrompt = (dataset: any, userName: string, month: string, year: number) => {
  const summary = dataset.summary || {}
  const startDate = summary.start_date || ''
  const endDate = summary.end_date || ''
  const services = dataset.services || []
  const funnels = dataset.marketing_funnels || []
  const topClients = dataset.top_clients || []
  const weeklyRows = dataset.weekly_rows || []
  const totalRevenue = summary.total_revenue || 0
  const personalEarnings = (totalRevenue * summary.commission_rate) + summary.tips || 0
  
  const totalNewClients = funnels.reduce(
    (sum, f) => sum + (f.new_clients || 0),
    0
  )

  const expenses = summary.expenses || 0
  const avgTicket =
    summary.num_appointments && summary.num_appointments > 0
      ? (summary.final_revenue || 0) / summary.num_appointments
      : 0

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

  console.log(summary)

  const avgWeeklyRevenue = weeklyRows.length ? totalWeeklyRevenue / weeklyRows.length : 0

  return `
  IMPORTANT INSTRUCTIONS: You are a professional analytics assistant creating a monthly performance report for a barbershop professional on booth rental named ${userName}.
Be a little fun and use emojis, especially in section headers and bullet points. Use start_date and end_date from monthly_data to reflect the full date range.
Use data from summary, services, funnels, top_clients, and weekly_rows to calculate totals and insights. Make sure all totals match the dataset.
Do NOT use Markdown (** or *) at all to bold text, use <b>Bold Text</b> or <strong>Bold Text</strong> instead. The report will be displayed in TinyMCE.

After each section generate an additional 3-4 sentence CREATIVE AND LIVELY
ANALYSIS AND DESCRIPTION!

Dataset (JSON):
${JSON.stringify(dataset.weekly_rows, null, 2)}

Generate a detailed monthly report in HTML suitable for TinyMCE. Fill in all data. DO NOT WRAP WITH '''html and
Do NOT use Markdown (** or *) at all. 
Include:
<h1>${month} ${year} Business Report</h1>

<h2>🧐 Quick Overview</h2>
<table>
  <thead><tr><th>Metric</th><th>Value</th></tr></thead>
  <tbody>
    <tr><td>Total Appointments</td><td>${summary.num_appointments}</td></tr>
    <tr><td>Unique Clients</td><td>${summary.unique_clients || 0}</td></tr>
    <tr><td>New Clients</td><td>${totalNewClients || 0}</td></tr>
    <tr><td>Returning Clients</td><td>${summary.unique_clients - totalNewClients || 0}</td></tr>
    <tr><td>Average Ticket</td><td>$${avgTicket.toFixed(2)}</td></tr>
    <tr><td>Total Revenue</td><td>$${totalRevenue.toFixed(2)}</td></tr>
    <tr><td>Tips Generated</td><td>$${summary.tips}</td></tr>
    <tr><td>Personal Earnings</td><td>$${((totalRevenue * dataset.commission_rate) + summary.tips).toFixed(2)}</td></tr>
    <tr><td>Estimated Expenses</td><td>$${expenses.toFixed(2)}</td></tr>
    <tr><td>Date Range</td><td>${startDate} → ${endDate}</td></tr>
  </tbody>
</table>
Instructions: creative analysis/generation of above

<h2>💼 Service Breakdown</h2>
${
  services.length
    ? `<table>
         <thead><tr><th>Service</th><th># of Bookings</th><th>% of Total</th><th>Est. Revenue</th><th>Avg/Booking</th></tr></thead>
         <tbody>
           ${services
             .sort((a: any, b: any) => (b.bookings || 0) - (a.bookings || 0))
             .map(
               (s: any) =>
                 `<tr><td>${s.service_name}</td><td>${s.bookings || 0}</td><td>${dataset.services_percentage?.find((sp:any)=>sp.name===s.service_name)?.percentage.toFixed(1) || 0}%</td><td>$${((s.price || 0) * s.bookings).toFixed(2)}</td><td>$${(s.price || 0).toFixed(2)}</td></tr>`
             )
             .join('')}
           <tr><td><strong>Total</strong></td><td>${services.reduce((sum:any,s:any)=>sum+(s.bookings||0),0)}</td><td>100%</td><td>$${services.reduce((sum:any,s:any)=>sum+(s.total_revenue||0),0).toFixed(2)}</td><td>$${(services.reduce((sum:any,s:any)=>sum+(s.price||0),0)/services.length).toFixed(2)}</td></tr>
         </tbody>
       </table>
       Instructions: creative analysis/generation of above`
    : `<p>No data available for this section.</p>`
}

<h2>💰 Earnings Summary</h2>
${
  weeklyRows.length
    ? `<table>
         <thead><tr><th>Week</th><th>Total Revenue</th><th>Personal Earnings</th></tr></thead>
         <tbody>
           ${weeklyRows
             .map(
               (w: any) => `<tr>
                               <td>Week ${w.week_number}</td>
                               <td>$${(w.total_revenue || 0).toFixed(2)}</td>
                               <td>$${((w.total_revenue || 0) * (dataset.commission_rate || 0)).toFixed(2)}</td>
                             </tr>`
             )
             .join('')}
           <tr>
             <td><strong>Total Month</strong></td>
             <td>$${totalWeeklyRevenue.toFixed(2)}</td>
             <td>$${(totalWeeklyRevenue * dataset.commission_rate).toFixed(2)}</td>
           </tr>
         </tbody>
       </table>
       Instructions: creative analysis/generation of above`
    : `<p>No data available for this section.</p>`
}

<h2>📣 Marketing Funnels</h2>
${
  funnels.length
    ? `<table>
         <thead><tr><th>Source</th><th>New Clients</th><th>Returning</th><th>Total</th><th>Retention</th><th>Avg Ticket</th></tr></thead>
         <tbody>
           ${funnels
             .filter((f: any) => f.source !== 'Returning Client')
             .sort((a: any, b: any) => (b.new_clients || 0) - (a.new_clients || 0))
             .map(
               (f: any) => `<tr>
                               <td>${f.source}</td>
                               <td>${f.new_clients || 0}</td>
                               <td>${f.returning_clients || 0}</td>
                               <td>${(f.new_clients || 0) + (f.returning_clients || 0)}</td>
                               <td>${(f.returning_clients && f.new_clients) ? (f.returning_clients/f.new_clients).toFixed(1) + '%' : '--'}</td>
                               <td>$${(f.avg_ticket || 0).toFixed(2)}</td>
                             </tr>`
             )
             .join('')}
         </tbody>
       </table>
       Instructions: creative analysis/generation of above`
    : `<p>No data available for this section.</p>`
}

<h2>👑 Top Clients</h2>
${
  topClients.length
    ? `<table>
         <thead><tr><th>Rank</th><th>Client</th><th>Service Totals</th><th>Visits</th></tr></thead>
         <tbody>
           ${topClients
             .filter((f: any) => f.source !== 'Returning Client' && f.source !== "Walk In")
             .slice(0, 5)
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
       Instructions: creative analysis/generation of above`
    : `<p>No data available for this section.</p>`
}

<h2>↻ Frequency Highlights</h2>
${
  topClients.length
    ? `<table>
         <thead><tr><th>Client</th><th>Visits</th><th>Service Totals</th></tr></thead>
         <tbody>
           ${topClients
             .filter((f: any) => f.source !== 'Returning Client' && f.source !== "Walk In")
             .sort((a: any, b: any) => (b.num_visits || 0) - (a.num_visits || 0))
             .slice(0, 5)
             .map(
               (c: any) => `<tr>
                               <td>${c.client_name}</td>
                               <td>${c.num_visits || 0}</td>
                               <td>$${(c.total_paid || 0).toFixed(2)}</td>
                             </tr>`
             )
             .join('')}
         </tbody>
       </table>
       Instructions: creative analysis/generation of above`
    : `<p>No data available for this section.</p>`
}

<h2>📊 Weekly Performance Snapshot</h2>
${
  weeklyRows.length
    ? (() => {
        const consistentTicket = Math.min(...weeklyAvgTickets)
        return `
          <table>
            <thead><tr><th>Week</th><th>Revenue</th><th>Visits</th><th>Avg Ticket</th></tr></thead>
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
                <td>$${totalWeeklyRevenue.toFixed(2)}</td>
                <td>${totalClients}</td>
                <td>$${(totalClients ? (totalWeeklyRevenue / totalClients).toFixed(2) : '0.00')}</td>
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

<h2>✨ Key Takeaways</h2> (The following is just an example, ai instructions: make it more creative and change it up but use the same data)
<ul>
  <li>👥 Total Clients: ${summary.total_clients || 0} — strong base of loyal and new clients.</li>
  <li>💵 Approx. Take Home: $${personalEarnings.toFixed(2)} net profit.</li>
  <li>🎯 Best Marketing Funnel: ${funnels.sort((a:any,b:any)=>(b.new_clients||0)-(a.new_clients||0))[0]?.funnel_name || 'N/A'} performed best for new leads.</li>
  <li>💳 Average Ticket: $${avgTicket.toFixed(2)} showing stable revenue per client.</li>
  <li>💈 Multi-visit Clients: ${topClients.filter((c:any)=>(c.visits||0)>1).length} returned more than once — great loyalty!</li>
  <li>🚀 Keep growing by leveraging top-performing services and funnels next month!</li>
</ul>
`
}
