// ✅ Updated Weekly Comparison Commission Prompt (with enhanced Critical Opportunities)
export const weeklyComparisonCommissionPrompt = (dataset: any, userName: string, month: string, year: number) => {
  const lastWeekEnd = dataset.weekly_rows?.[dataset.weekly_rows.length - 1]?.end_date;
  const monthEndDate = new Date(year, new Date(`${month} 1, ${year}`).getMonth() + 1, 0); // last day of month
  const lastWeekEndDate = lastWeekEnd ? new Date(lastWeekEnd) : null;
  const snapshotTitle = lastWeekEndDate && lastWeekEndDate.getDate() === monthEndDate.getDate() 
    ? 'Month End Snapshot 🧾' 
    : 'Current Period Snapshot 🧾';

  // Compute basic stats for Critical Opportunities
  const totalNewClients = dataset.weekly_rows.reduce((sum:number,w:any)=>sum+(w.new_clients||0),0);
  const totalReturningClients = dataset.weekly_rows.reduce((sum:number,w:any)=>sum+(w.returning_clients||0),0);
  const totalRevenue = dataset.weekly_rows.reduce((sum:number,w:any)=>sum+(w.total_revenue||0),0);
  const totalAppointments = dataset.weekly_rows.reduce((sum:number,w:any)=>sum+(w.num_appointments||0),0);
  const retentionRate = totalAppointments > 0 ? ((totalReturningClients / totalAppointments) * 100).toFixed(1) : '0.0';
  const bestWeekRevenue = dataset.weekly_rows.reduce((a:any,b:any)=>(b.total_revenue>a.total_revenue?b:a),dataset.weekly_rows[0]);
  const worstWeekRevenue = dataset.weekly_rows.reduce((a:any,b:any)=>(b.total_revenue<a.total_revenue?b:a),dataset.weekly_rows[0]);

  return `
IMPORTANT INSTRUCTIONS: You are a professional analytics assistant creating a weekly comparison performance report for a barbershop professional on commission named ${userName}.
Be a little fun and use emojis, especially in section headers. Use start_date and end_date from each week in weekly_rows to accurately reflect weekly ranges.
Use all data from weekly_rows and daily_rows to calculate totals and averages. Make sure all totals match the dataset. Do not leave instructions as raw text—compute all metrics.
NOTICE: Before you start, a reminder to use emojis to make it fun and appealing.

Dataset (JSON):
${JSON.stringify(dataset, null, 2)}

Generate a detailed weekly comparison report in HTML suitable for TinyMCE. Fill in all data in []s. DO NOT WRAP WITH '''html. Include:

1. <h1>Weekly Comparison Report (${month} ${year})</h1>

2. <h2>Date Ranges 📅</h2>
   <ul>
     ${dataset.weekly_rows?.map((w: any) => `<li>Week ${w.week_number}: ${w.start_date} → ${w.end_date}</li>`).join('') || '<li>No weekly data</li>'}
   </ul>

3. <h2>Performance Overview 📊</h2>
   <table>
     <thead>
       <tr>
         <th>Metric</th>
         ${dataset.weekly_rows?.map((w: any) => `<th>W${w.week_number}</th>`).join('')}
         <th>Δ (Last Week → This Week)</th>
         <th>% Change</th>
       </tr>
     </thead>
     <tbody>
       <tr>
         <td>Revenue (Gross)</td>
         ${dataset.weekly_rows?.map((w: any) => `<td>$${(w.total_revenue || 0).toFixed(2)}</td>`).join('')}
         <td>$${dataset.weekly_rows.length > 1 ? ((dataset.weekly_rows.at(-1).total_revenue || 0) - (dataset.weekly_rows.at(-2).total_revenue || 0)).toFixed(2) : '--'}</td>
         <td>${dataset.weekly_rows.length > 1 ? ((((dataset.weekly_rows.at(-1).total_revenue || 0) - (dataset.weekly_rows.at(-2).total_revenue || 0)) / (dataset.weekly_rows.at(-2).total_revenue || 1)) * 100).toFixed(1) + '%' : '--'}</td>
       </tr>
       <tr>
         <td>Total Clients</td>
         ${dataset.weekly_rows?.map((w: any) => `<td>${(w.new_clients || 0) + (w.returning_clients || 0)}</td>`).join('')}
         <td>${dataset.weekly_rows.length > 1 ? ((dataset.weekly_rows.at(-1).num_appointments || 0) - (dataset.weekly_rows.at(-2).num_appointments || 0)) : '--'}</td>
         <td>${dataset.weekly_rows.length > 1 ? ((((dataset.weekly_rows.at(-1).num_appointments || 0) - (dataset.weekly_rows.at(-2).num_appointments || 0)) / (dataset.weekly_rows.at(-2).num_appointments || 1)) * 100).toFixed(1) + '%' : '--'}</td>
       </tr>
       <tr>
         <td>New Clients</td>
         ${dataset.weekly_rows?.map((w: any) => `<td>${w.new_clients || 0}</td>`).join('')}
         <td>${dataset.weekly_rows.length > 1 ? ((dataset.weekly_rows.at(-1).new_clients || 0) - (dataset.weekly_rows.at(-2).new_clients || 0)) : '--'}</td>
         <td>${dataset.weekly_rows.length > 1 ? ((((dataset.weekly_rows.at(-1).new_clients || 0) - (dataset.weekly_rows.at(-2).new_clients || 0)) / (dataset.weekly_rows.at(-2).new_clients || 1)) * 100).toFixed(1) + '%' : '--'}</td>
       </tr>
       <tr>
         <td>Returning Clients</td>
         ${dataset.weekly_rows?.map((w: any) => `<td>${w.returning_clients || 0}</td>`).join('')}
         <td>${dataset.weekly_rows.length > 1 ? ((dataset.weekly_rows.at(-1).returning_clients || 0) - (dataset.weekly_rows.at(-2).returning_clients || 0)) : '--'}</td>
         <td>${dataset.weekly_rows.length > 1 ? ((((dataset.weekly_rows.at(-1).returning_clients || 0) - (dataset.weekly_rows.at(-2).returning_clients || 0)) / (dataset.weekly_rows.at(-2).returning_clients || 1)) * 100).toFixed(1) + '%' : '--'}</td>
       </tr>
       <tr>
         <td>Average Ticket</td>
         ${dataset.weekly_rows?.map((w: any) => `<td>$${w.num_appointments ? (w.final_revenue / w.num_appointments).toFixed(2) : '0.00'}</td>`).join('')}
         <td>--</td><td>--</td>
       </tr>
       <tr>
         <td>Personal Earnings (≈${(dataset.commission_rate*100).toFixed(0)}%)</td>
         ${dataset.weekly_rows?.map((w: any) => `<td>$${((w.total_revenue || 0) * (dataset.commission_rate || 0)).toFixed(2)}</td>`).join('')}
         <td>--</td><td>--</td>
       </tr>
     </tbody>
   </table>

4. <h2>Key Insights & Trends 🔍</h2>
   <ul>
     <li>Month Overview: revenue, clients, and average ticket derived from weekly_rows and daily_rows.</li>
     <li>Peak Performance:
       <ul>
         <li>Best revenue week: Week ${bestWeekRevenue.week_number}</li>
         <li>Best client volume: Week ${dataset.weekly_rows.reduce((a:any,b:any)=>(b.num_appointments>a.num_appointments?b:a), dataset.weekly_rows[0]).week_number}</li>
         <li>Best personal earnings week: Week ${dataset.weekly_rows.reduce((a:any,b:any)=>(b.total_revenue*(dataset.commission_rate||0)>a.total_revenue*(dataset.commission_rate||0)?b:a), dataset.weekly_rows[0]).week_number}</li>
       </ul>
     </li>
     <li>Client Retention: overall rate ${retentionRate}%</li>
     <li>Average Ticket Growth: month avg $${(dataset.weekly_rows.reduce((sum:number,w:any)=>sum+w.final_revenue,0)/dataset.weekly_rows.reduce((sum:number,w:any)=>sum+(w.num_appointments||1),0)).toFixed(2)}</li>
     <li>Tip income total: $${dataset.weekly_rows.reduce((sum:number,w:any)=>sum+(w.tips||0),0).toFixed(2)}</li>
     <li>Service Mix Evolution: ${dataset.services_percentage?.map((s:any)=>s.name + ': ' + s.bookings + ' (' + s.percentage.toFixed(1) + '%)').join(', ')||'No data'}</li>
     <li>Marketing Funnels: ${dataset.marketing_funnels?.filter((f:any)=>f.funnel_name!=='Unknown').map((f:any)=>f.funnel_name + ': ' + f.new_clients + ' new clients (' + (f.percentage||0) + '%)').join(', ')||'No data'}</li>
     <li>Day of Week Performance: Mention the best performing days in fancy jot notes highlighting revenue and number of appointments</li>
   </ul>

5. <h2>${snapshotTitle}</h2>
   <ul>
     <li>Total Revenue: $${totalRevenue.toFixed(2)}</li>
     <li>Total Clients: ${totalNewClients + totalReturningClients}</li>
     <li>New Clients: ${totalNewClients}</li>
     <li>Returning Clients: ${totalReturningClients}</li>
     <li>Average Ticket: $${(dataset.weekly_rows.reduce((sum:number,w:any)=>sum+(w.final_revenue||0),0)/dataset.weekly_rows.reduce((sum:number,w:any)=>sum+(w.num_appointments||1),0)).toFixed(2)}</li>
     <li>Personal Earnings: $${(totalRevenue*(dataset.commission_rate||0)).toFixed(2)}</li>
   </ul>

6. <h2>Critical Opportunities for Growth 🚀</h2>
     Instructions for AI: **Using all data in the dataset, generate an original, creative analysis.** Include:  
     - Strengths and weaknesses in client acquisition and retention  
     - Surprising trends in revenue, profit, and services  
     - Actionable recommendations for boosting growth  
     - Creative emoji use, fun formatting, and human-like tone  
     - Be careful with bolding, sometimes wrapping with ** does not register as bold and displays as raw text, do not allow this.
     - I really need you to be creative in this section, do not just copy the example I gave you, but PLEASE base it off all the data 
     I provided even QUOTING the data and actual NUMBERS, VERY IMPORTANT.
     Example output (do not include literal placeholders; this is just style guidance):  
     "<li>💡 Amazing spike in mid-week revenue hitting $2300! Consider adding premium services on those days.</li>  
      <li>🚨 New client acquisition slower than expected; launch referral and social campaigns.</li>  
      <li>📊 Average ticket trending up — bundle services for higher value sales.</li>"
   </ul>
  `;
};
