export const weeklyCommissionPrompt = (dataset: any, userName: string, month: string, year: number) => {
  const summary = dataset.summary || {};
  const services = dataset.services || []
  const funnels = dataset.marketing_funnels || []
  const bestDay = summary.best_day || null;
  const commissionRate = dataset.commission_rate || 0;

  const tips = summary.tips.totalTips || 0
  const tipsServiceType = summary.tips.tipsServiceType || {}
  
  const personalEarnings = ((summary.total_revenue || 0) * commissionRate) + (tips || 0);
  const avgTicket = summary.num_appointments > 0 
    ? (personalEarnings / summary.num_appointments).toFixed(2) 
    : '0.00';
  const retentionRate = summary.num_appointments > 0 
    ? (((summary.returning_clients || 0) / summary.num_appointments) * 100).toFixed(1) 
    : '0.0';

  const totalNewClients = funnels
    .filter((f: any) => f.source !== 'Returning Client')
    .reduce((sum: any, f: any) => sum + (f.new_clients || 0), 0);

  const totalReturningClients = summary.num_appointments - totalNewClients

  return `
You are a professional analytics assistant creating a weekly performance report for a barbershop professional on commission named ${userName}.
Be a little fun and use some emojis, especially in section headers. Keep tone encouraging but analytical. 
Important: Do not wrap with ''' html or 3 backticks at top and bottom. Do NOT use Markdown (** or *) at all. The report will be displayed in TinyMCE.

You are given a JSON dataset that includes:
- summary: weekly metrics (week_number, start_date, end_date, total_revenue, tips, expenses, num_appointments, new_clients, returning_clients)
- daily_rows: day-by-day data across the month
- services and services_percentage: service mix and booking percentages
- top_clients: highest-paying or most loyal clients for the week
- marketing_funnels: data on client acquisition/referrals
- best_day: the top daily performer in the week
- commission_rate: the barber's commission split percentage

YOU ARE TALKING TO A BARBER - NOT A BARBERSHOP!!
Generate a detailed weekly report in **HTML** suitable for TinyMCE.
Use the provided data and computed values. Do not invent numbers. DO NOT REMOVE ANY KIND OF DATA.

<h1>Weekly Report - Week ${summary.week_number || 'N/A'} (${summary.start_date || 'N/A'} → ${summary.end_date || 'N/A'}, ${year})</h1>

<h2>Weekly Summary 💰</h2>
<ul>
  <li><strong>Total Clients:</strong> ${totalNewClients + totalReturningClients || 0}</li>
  <li><strong>New Clients:</strong> ${totalNewClients || 0} | <strong>Returning:</strong> ${totalReturningClients || 0}</li>
  <li><strong>Gross Revenue:</strong> $${(summary.total_revenue || 0).toFixed(2)}</li>
  <li><strong>Tips:</strong> $${(tips || 0).toFixed(2)}</li>
  <li><strong>Commission Rate:</strong> ${(commissionRate * 100).toFixed(0)}%</li>
  <li><strong>Personal Earnings:</strong> $${personalEarnings.toFixed(2)} <em>(commission + tips)</em></li>
  <li><strong>Average Ticket:</strong> $${avgTicket} per client</li>
</ul>

<h2>Highlights & Notes 📝</h2>
<ul>
THE FOLLOWING HAS AI INSTRUCTIONS IN THE TAGS, INTERPRET AND FOLLOW INSTRUCTIONS
  <li><strong>Revenue Performance:</strong> Gross revenue of $${(summary.total_revenue || 0).toFixed(2)} resulted in $${((summary.total_revenue || 0) * commissionRate).toFixed(2)} in commission earnings.</li>
  <li><strong>New Client Acquisition:</strong> ${summary.new_clients || 0} new clients joined this week (${summary.num_appointments > 0 ? (((summary.new_clients || 0) / summary.num_appointments) * 100).toFixed(1) : '0.0'}% of total).</li>
  ${bestDay ? `<li><strong>Best Day:</strong> ${bestDay.date} with $${(bestDay.total_revenue || 0).toFixed(2)} in gross revenue.</li>` : ''}
  <li><strong>Tips:</strong> Earned $${(tips || 0).toFixed(2)} in tips this week${summary.num_appointments > 0 ? ` (avg $${((tips || 0) / summary.num_appointments).toFixed(2)} per client)` : ''}.</li>
  <li><strong>Average Ticket Trend:</strong> $${avgTicket} personal earnings per client. ${parseFloat(avgTicket) > 30 ? 'Strong performance! 💪' : 'Consider upselling opportunities to boost average ticket.'}</li>
</ul>

<h2>💼 Service Breakdown</h2>
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
(extra instructions: do not include a row if source is literally called "Returning Client")
${
  funnels.length
    ? `<table>
        <thead><tr><th>Source</th><th>New Clients</th><th>Avg Ticket</th></tr></thead>
        <tbody>
          ${funnels
            .filter((f: any) => f.source !== 'Returning Client' && f.source !== "Walk In")
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
      <p>PROMPT: State which channels did the well and Encourage exposing more of their work publicly. DO NOT mention any other channels</p>
      Instructions: creative analysis/generation`
    : `<p>No data available for this section.</p>`
}


<h2>Top Clients 💎</h2>
${dataset.top_clients && dataset.top_clients.length > 0 ? `
<table>
  <thead>
    <tr>
      <th>Rank</th>
      <th>Client Name</th>
      <th>Visits</th>
      <th>Total Paid</th>
    </tr>
  </thead>
  <tbody>
    ${dataset.top_clients.slice(0, 10).map((client: any, index: number) => `
    <tr>
      <td>${index + 1}</td>
      <td>${client.client_name || 'Unknown'}</td>
      <td>${client.num_visits || 0}</td>
      <td>$${(client.total_paid || 0).toFixed(2)}</td>
    </tr>
    `).join('')}
  </tbody>
</table>
` : '<p>No data available for this section.</p>'}

<h2>Insights 🔍</h2>
AI INSTRUCTIONS: Based on the data provided, generate 2-3 insightful observations about:
<ul>
  <li><strong>Client Retention:</strong> ${retentionRate}% retention rate ${parseFloat(retentionRate) >= 60 ? 'shows strong loyalty! Keep nurturing these relationships.' : 'has room for improvement. Focus on rebooking strategies and follow-ups.'}</li>
  <li><strong>Revenue Patterns:</strong> Your personal earnings of $${personalEarnings.toFixed(2)} were driven by ${summary.num_appointments || 0} appointments at an average of $${avgTicket} per client.</li>
  <li><strong>Service Strategy:</strong> ${dataset.services_percentage?.[0]?.name || 'Your top service'} is your highest performer. ${dataset.services_percentage && dataset.services_percentage.length > 2 ? 'Consider promoting underperforming services to balance your mix.' : ''}</li>
  ${bestDay ? `<li><strong>Peak Performance:</strong> ${bestDay.date} was your strongest day with $${(bestDay.total_revenue || 0).toFixed(2)} in revenue. Analyze what made this day successful.</li>` : ''}
  <li><strong>Marketing Effectiveness:</strong> ${dataset.marketing_funnels?.[0]?.source || 'Your primary source'} brought in ${dataset.marketing_funnels?.[0]?.new_clients || 0} new clients. ${(dataset.marketing_funnels?.[0]?.new_clients || 0) > 3 ? 'This channel is performing well!' : 'Consider diversifying your marketing efforts.'}</li>
</ul>

<h2>Action Steps 🚀</h2>
Suggest 2-3 actionable improvements for next week:
<ul>
  <li><strong>Boost Retention:</strong> ${parseFloat(retentionRate) < 60 ? `Current retention is ${retentionRate}%. Implement post-appointment follow-ups and pre-booking reminders.` : `Maintain your ${retentionRate}% retention by continuing excellent service and communication.`}</li>
  <li><strong>Maximize High-Margin Services:</strong> Promote ${dataset.services_percentage?.[0]?.name || 'your top service'} and consider upselling complementary services to increase average ticket from $${avgTicket}.</li>
  <li><strong>Optimize Schedule:</strong> ${bestDay ? `Replicate the success of ${bestDay.date} by analyzing booking patterns and client preferences from that day.` : 'Identify your busiest days and optimize your schedule to maximize earnings.'}</li>
  <li><strong>Client Acquisition:</strong> ${(summary.new_clients || 0) < 5 ? `Focus on attracting new clients through ${dataset.marketing_funnels?.[0]?.source || 'referrals and promotions'}.` : `You brought in ${summary.new_clients || 0} new clients—keep this momentum going!`}</li>
</ul>

<p><em>Keep up the great work, ${userName}! 💈✨</em></p>
`;
};