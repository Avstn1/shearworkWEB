export const weeklyRentalPrompt = (dataset: any, userName: string, month: string, year: number) => {
  const summary = dataset.summary || {};
  const services = dataset.services || []
  const funnels = dataset.marketing_funnels || []
  const bestDay = summary.best_day || null;
  const avgTicket = summary.num_appointments > 0 
    ? (summary.total_revenue / summary.num_appointments).toFixed(2) 
    : '0.00';

  const tips = summary.tips.totalTips || 0
  const tipsServiceType = summary.tips.tipsServiceType || {}

  console.log(dataset.weeklyExpensesData)

  const netProfit = (summary.total_revenue || 0) - (dataset.weeklyExpensesData || 0) + (tips || 0);
  
  // ✅ FIX 1: Calculate total unique clients correctly
  const totalUniqueClients = (summary.new_clients || 0) + (summary.returning_clients || 0);
  
  // ✅ FIX 2: Filter marketing funnels - only show sources with new clients > 0
  const activeFunnels = funnels
    .filter((f: any) => 
      f.source !== 'Returning Client' && 
      f.source !== 'Walk In' &&
      (f.new_clients || 0) > 0
    )
    .map((f: any) => ({
      ...f,
      source: f.source === 'Unknown' ? 'No Source' : f.source
    }));

  const totalNewClients = funnels
  .filter((f: any) => f.source !== 'Returning Client')
  .reduce((sum: any, f: any) => sum + (f.new_clients || 0), 0);

  const totalReturningClients = summary.num_appointments - totalNewClients

  return `
You are a professional analytics assistant creating a weekly performance report for a barbershop professional named ${userName}.
Be a little fun and use some emojis, especially in section headers. Keep the writing conversational but data-driven. DO NOT WRAP
the document with '''html '''. Do NOT use Markdown (** or *) at all. The report will be displayed in TinyMCE.

YOU ARE TALKING TO A BARBER - NOT A BARBERSHOP!! DO NOT REMOVE ANY KIND OF DATA.


Generate a detailed weekly report in **HTML** suitable for TinyMCE. 
Use the provided data and computed values. Pull values directly from the dataset fields — do not make up numbers.

<h1>Weekly Report - Week ${summary.week_number || 'N/A'} (${summary.start_date || 'N/A'} → ${summary.end_date || 'N/A'})</h1>

<h2>Weekly Summary 📊</h2>
<ul>
  <li>Total Clients: ${totalNewClients + totalReturningClients}</li>
  <li>New Clients: ${totalNewClients || 0} | Returning: ${totalReturningClients || 0}</li>
  <li>Total Revenue: $${(summary.total_revenue || 0).toFixed(2)}</li>
  <li>Tips: $${(tips || 0).toFixed(2)}</li>
  <li>Average Ticket: $${avgTicket}</li>
  <li>weeklyExpensesData: $${(dataset.weeklyExpensesData || 0).toFixed(2)}</li>
  <li>Net Profit: $${netProfit.toFixed(2)}</li>
</ul>

<h2>Notes & Highlights 📝</h2>
THE FOLLOWING HAS AI INSTRUCTIONS IN THE TAGS, INTERPRET AND FOLLOW INSTRUCTIONS
<ul>
  <li><strong>Revenue Performance:</strong> Analyze whether $${(summary.total_revenue || 0).toFixed(2)} is strong or weak for the week. Compare to previous weeks if possible.</li>
  <li><strong>New Client Acquisition:</strong> ${summary.new_clients || 0} new clients (${totalUniqueClients > 0 ? (((summary.new_clients || 0) / totalUniqueClients) * 100).toFixed(1) : '0.0'}% of total).</li>
  ${bestDay ? `<li><strong>Best Day:</strong> ${bestDay.date} with $${(bestDay.total_revenue || 0).toFixed(2)} in revenue.</li>` : ''}
  <li><strong>Average Ticket:</strong> $${avgTicket} per client. ${parseFloat(avgTicket) > 50 ? 'Strong average ticket!' : 'Consider upselling opportunities.'}</li>
</ul>

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
                    const serviceTips = tipsServiceType[s.service_name] || 0;
                    const estRevenue = (s.price || 0) + serviceTips;
                    const avgPerBooking = s.bookings > 0 ? estRevenue / s.bookings : 0;
                    return `<tr><td>${s.service_name}</td><td>${s.bookings || 0}</td><td>${dataset.services_percentage?.find((sp:any)=>sp.name===s.service_name)?.percentage.toFixed(1) || 0}%</td><td>$${serviceTips.toFixed(2)}</td><td>$${estRevenue.toFixed(2)}</td><td>$${avgPerBooking.toFixed(2)}</td></tr>`
                  }
                )
                .join('')}
              <tr><td><strong>Total</strong></td><td>${services.reduce((sum:any,s:any)=>sum+(s.bookings||0),0)}</td><td>100%</td><td>$${tips.toFixed(2)}</td><td>$${(services.reduce((sum:any,s:any)=>sum+(s.price||0),0) + tips).toFixed(2)}</td><td>$${((services.reduce((sum:any,s:any)=>sum+(s.price||0),0) + tips) / services.reduce((sum:any,s:any)=>sum+(s.bookings||0),0)).toFixed(2)}</td></tr>
            </tbody>
          </table>
          <p>💇‍♂️ ${userName}'s most popular service this month was <strong>${services.sort((a:any,b:any)=>(b.bookings||0)-(a.bookings||0))[0]?.service_name || 'N/A'}</strong>, showing consistent client demand and service value.</p>`
       : `<p>No data available for this section.</p>`
  }
  
<h2>📣 Marketing Funnels</h2>
${(activeFunnels.length
      ? `<table>
           <thead><tr><th>Source</th><th>New Clients</th><th>Avg Ticket</th></tr></thead>
           <tbody>
             ${activeFunnels
               .sort((a: any, b: any) => (b.new_clients || 0) - (a.new_clients || 0))
               .map(
                   (f: any) =>
                   `<tr>
                       <td>${f.source}</td>
                       <td>${f.new_clients || 0}</td>
                       <td>$${(f.avg_ticket || 0).toFixed(2)}</td>
                   </tr>`
               )
               .join('')}
           </tbody>
         </table>
         <p>Your top-performing channel this week was <strong>${activeFunnels.sort((a:any,b:any)=>(b.new_clients||0)-(a.new_clients||0))[0]?.source || 'No Source'}</strong>, bringing in ${activeFunnels.sort((a:any,b:any)=>(b.new_clients||0)-(a.new_clients||0))[0]?.new_clients || 0} new clients. ${activeFunnels.sort((a:any,b:any)=>(b.new_clients||0)-(a.new_clients||0))[0]?.source !== 'No Source' && activeFunnels.sort((a:any,b:any)=>(b.new_clients||0)-(a.new_clients||0))[0]?.source !== 'Walking By' ? 'Consider showcasing more of your work publicly to attract even more potential clients!' : 'Consider asking satisfied clients how they heard about you to better track your marketing channels.'}</p>`
      : `<p>No new client acquisition data available for this week.</p>`)
}

<h2>Top Clients 💈</h2>
${dataset.top_clients && dataset.top_clients.length > 0 ? `
<table>
  <thead>
    <tr>
      <th>Rank</th>
      <th>Client Name</th>
      <th>Total Paid</th>
    </tr>
  </thead>
  <tbody>
    ${dataset.top_clients.slice(0, 10).map((client: any, index: number) => `
    <tr>
      <td>${index + 1}</td>
      <td>${client.client_name || 'Unknown'}</td>
      <td>$${(client.total_paid || 0).toFixed(2)}</td>
    </tr>
    `).join('')}
  </tbody>
</table>
` : '<p>No data available for this section.</p>'}

<h2>Insights 🔍</h2>
AI INSTRUCTIONS: Based on the data provided, generate 2-3 insightful observations about:
<ul>
  <li>Client flow patterns (busiest days, new vs. returning trends)</li>
  <li>Revenue trends and average ticket performance</li>
  <li>Service popularity and potential upsell opportunities</li>
</ul>

<h2>Action Steps 🚀</h2>
Suggest 2-3 actionable improvements for next week:
<ul>
  <li>Focus on improving rebooking rates if retention is low (currently ${totalUniqueClients > 0 ? (((summary.returning_clients || 0) / totalUniqueClients) * 100).toFixed(1) : '0.0'}%)</li>
  <li>Promote high-performing services: ${dataset.services_percentage?.[0]?.name || 'N/A'}</li>
  <li>Target new client acquisition through ${activeFunnels.filter((f: any) => f.new_clients > 0).map((f: any) => f.source).join(', ') || 'referrals'}</li>
</ul>
`;
};

// <h2>Insights 🔍</h2>
// AI INSTRUCTIONS: Based on the data provided, generate 2-3 insightful observations about:
// <ul>
//   <li>Client flow patterns (busiest days, new vs. returning trends)</li>
//   <li>Revenue trends and average ticket performance</li>
//   <li>Service popularity and potential upsell opportunities</li>
//   <li>Marketing effectiveness based on funnel data</li>
// </ul>