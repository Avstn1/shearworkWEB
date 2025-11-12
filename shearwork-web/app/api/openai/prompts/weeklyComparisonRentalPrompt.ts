// ✅ Weekly Comparison Rental Prompt with full HTML, minimal dataset, dynamic Critical Opportunities
export const weeklyComparisonRentalPrompt = (dataset: any, userName: string, month: string, year: number) => {
  const lastWeekEnd = dataset.weekly_rows?.[dataset.weekly_rows.length - 1]?.end_date;
  const monthEndDate = new Date(year, new Date(`${month} 1, ${year}`).getMonth() + 1, 0);
  const lastWeekEndDate = lastWeekEnd ? new Date(lastWeekEnd) : null;
  const snapshotTitle =
    lastWeekEndDate && lastWeekEndDate.getDate() === monthEndDate.getDate()
      ? 'Month End Snapshot 🧾'
      : 'Current Period Snapshot 🧾';

  const totalNewClients = dataset.weekly_rows.reduce((sum:number,w:any)=>sum+(w.new_clients||0),0);
  const totalReturningClients = dataset.weekly_rows.reduce((sum:number,w:any)=>sum+(w.returning_clients||0),0);
  const totalRevenue = dataset.weekly_rows.reduce((sum:number,w:any)=>sum+(w.total_revenue||0),0);
  const totalAppointments = dataset.weekly_rows.reduce((sum:number,w:any)=>sum+(w.num_appointments||0),0);
  const retentionRate = totalAppointments > 0 ? ((totalReturningClients / totalAppointments) * 100).toFixed(1) : '0.0';
  const bestWeekRevenue = dataset.weekly_rows.reduce((a:any,b:any)=>(b.total_revenue>a.total_revenue?b:a),dataset.weekly_rows[0]);
  const worstWeekRevenue = dataset.weekly_rows.reduce((a:any,b:any)=>(b.total_revenue<a.total_revenue?b:a),dataset.weekly_rows[0]);
  const averageRevenue = totalRevenue / (dataset.weekly_rows?.length || 1);

  const minimalDataset = {
    weekly_rows: dataset.weekly_rows.map((w: any) => ({
      week_number: w.week_number,
      start_date: w.start_date,
      end_date: w.end_date,
      total_revenue: w.total_revenue,
      final_revenue: w.final_revenue,
      num_appointments: w.num_appointments,
      new_clients: w.new_clients,
      returning_clients: w.returning_clients,
      expenses: w.expenses,
      tips: w.tips
    })),
    services_percentage: dataset.services_percentage,
    marketing_funnels: dataset.marketing_funnels
  };

  return `
IMPORTANT INSTRUCTIONS: You are a professional analytics assistant creating a weekly comparison performance report for a barbershop professional on booth rental named ${userName}.
Use HTML tags for all formatting: <strong>, <em>, <ul>/<li>, <h1>-<h3>. Do NOT use Markdown (** or *).
Compute totals and averages exactly. Report will display in TinyMCE. 

Dataset (JSON):
${JSON.stringify(minimalDataset, null, 2)}

<h1>Weekly Comparison Report (${month} ${year})</h1>

<h2>Date Ranges 📅</h2>
<ul>
  ${minimalDataset.weekly_rows.map((w: any) => `<li>Week ${w.week_number}: ${w.start_date} → ${w.end_date}</li>`).join('') || '<li>No weekly data</li>'}
</ul>

<h2>Performance Overview 📊</h2>
<table>
  <thead>
    <tr>
      <th>Metric</th>
      ${minimalDataset.weekly_rows.map((w: any) => `<th>W${w.week_number}</th>`).join('')}
      <th>Δ (Last Week → This Week)</th>
      <th>% Change</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Revenue (Gross)</td>
      ${minimalDataset.weekly_rows.map((w: any) => `<td>$${(w.total_revenue || 0).toFixed(2)}</td>`).join('')}
      <td>$${minimalDataset.weekly_rows.length > 1 ? ((minimalDataset.weekly_rows.at(-1).total_revenue || 0) - (minimalDataset.weekly_rows.at(-2).total_revenue || 0)).toFixed(2) : '--'}</td>
      <td>${minimalDataset.weekly_rows.length > 1 ? ((((minimalDataset.weekly_rows.at(-1).total_revenue || 0) - (minimalDataset.weekly_rows.at(-2).total_revenue || 0)) / (minimalDataset.weekly_rows.at(-2).total_revenue || 1)) * 100).toFixed(1) + '%' : '--'}</td>
    </tr>
    <tr>
      <td>Total Clients</td>
      ${minimalDataset.weekly_rows.map((w: any) => `<td>${(w.new_clients || 0) + (w.returning_clients || 0)}</td>`).join('')}
      <td>${minimalDataset.weekly_rows.length > 1 ? ((minimalDataset.weekly_rows.at(-1).num_appointments || 0) - (minimalDataset.weekly_rows.at(-2).num_appointments || 0)) : '--'}</td>
      <td>${minimalDataset.weekly_rows.length > 1 ? ((((minimalDataset.weekly_rows.at(-1).num_appointments || 0) - (minimalDataset.weekly_rows.at(-2).num_appointments || 0)) / (minimalDataset.weekly_rows.at(-2).num_appointments || 1)) * 100).toFixed(1) + '%' : '--'}</td>
    </tr>
    <tr>
      <td>New Clients</td>
      ${minimalDataset.weekly_rows.map((w: any) => `<td>${w.new_clients || 0}</td>`).join('')}
      <td>${minimalDataset.weekly_rows.length > 1 ? ((minimalDataset.weekly_rows.at(-1).new_clients || 0) - (minimalDataset.weekly_rows.at(-2).new_clients || 0)) : '--'}</td>
      <td>${minimalDataset.weekly_rows.length > 1 ? ((((minimalDataset.weekly_rows.at(-1).new_clients || 0) - (minimalDataset.weekly_rows.at(-2).new_clients || 0)) / (minimalDataset.weekly_rows.at(-2).new_clients || 1)) * 100).toFixed(1) + '%' : '--'}</td>
    </tr>
    <tr>
      <td>Returning Clients</td>
      ${minimalDataset.weekly_rows.map((w: any) => `<td>${w.returning_clients || 0}</td>`).join('')}
      <td>${minimalDataset.weekly_rows.length > 1 ? ((minimalDataset.weekly_rows.at(-1).returning_clients || 0) - (minimalDataset.weekly_rows.at(-2).returning_clients || 0)) : '--'}</td>
      <td>${minimalDataset.weekly_rows.length > 1 ? ((((minimalDataset.weekly_rows.at(-1).returning_clients || 0) - (minimalDataset.weekly_rows.at(-2).returning_clients || 0)) / (minimalDataset.weekly_rows.at(-2).returning_clients || 1)) * 100).toFixed(1) + '%' : '--'}</td>
    </tr>
    <tr>
      <td>Average Ticket</td>
      ${minimalDataset.weekly_rows.map((w:any)=>`<td>$${(w.num_appointments?(w.final_revenue/w.num_appointments):0).toFixed(2)}</td>`).join('')}
      ${
        minimalDataset.weekly_rows.length > 1
          ? (()=>{ 
              const cur = minimalDataset.weekly_rows.at(-1);
              const prev = minimalDataset.weekly_rows.at(-2);
              const curAvg = (cur.final_revenue || 0) / (cur.num_appointments || 1);
              const prevAvg = (prev.final_revenue || 0) / (prev.num_appointments || 1);
              const delta = curAvg - prevAvg;
              const pct = ((delta / (prevAvg || 1)) * 100).toFixed(1);
              return `<td>$${delta.toFixed(2)}</td><td>${pct}%</td>`;
            })()
          : '<td>--</td><td>--</td>'
      }
    </tr>
    <tr>
      <td>Expenses</td>
      ${minimalDataset.weekly_rows.map((w:any)=>`<td>$${(w.expenses||0).toFixed(2)}</td>`).join('')}
      ${
        minimalDataset.weekly_rows.length > 1
          ? (()=>{ 
              const cur = minimalDataset.weekly_rows.at(-1), prev = minimalDataset.weekly_rows.at(-2);
              const delta = (cur.expenses||0) - (prev.expenses||0);
              const pct = ((delta / (prev.expenses || 1)) * 100).toFixed(1);
              return `<td>$${delta.toFixed(2)}</td><td>${pct}%</td>`;
            })()
          : '<td>--</td><td>--</td>'
      }
    </tr>
    <tr>
      <td>Net Profit</td>
      ${minimalDataset.weekly_rows.map((w:any)=>`<td>$${((w.total_revenue||0)-(w.expenses||0)).toFixed(2)}</td>`).join('')}
      ${
        minimalDataset.weekly_rows.length > 1
          ? (()=>{ 
              const cur = minimalDataset.weekly_rows.at(-1), prev = minimalDataset.weekly_rows.at(-2);
              const curNet = (cur.total_revenue||0)-(cur.expenses||0);
              const prevNet = (prev.total_revenue||0)-(prev.expenses||0);
              const delta = curNet - prevNet;
              const pct = ((delta / (prevNet || 1)) * 100).toFixed(1);
              return `<td>$${delta.toFixed(2)}</td><td>${pct}%</td>`;
            })()
          : '<td>--</td><td>--</td>'
      }
    </tr>
  </tbody>
</table>

<h2>Key Insights & Trends 🔍</h2>
<ul>
  <li>Revenue Performance: total revenue $${totalRevenue.toFixed(2)}, best week: Week ${bestWeekRevenue.week_number}, worst week: Week ${worstWeekRevenue.week_number}</li>
  <li>Client Retention: overall ${retentionRate}%, highlight best retention week.</li>
  <li>Average Ticket: monthly avg $${(minimalDataset.weekly_rows.reduce((sum:number,w:any)=>sum+(w.final_revenue||0),0)/(minimalDataset.weekly_rows.reduce((sum:number,w:any)=>sum+(w.num_appointments||1),0))).toFixed(2)}, range from lowest to highest week.</li>
  <li>Service Breakdown: ${dataset.services_percentage?.map((s:any)=>s.name + ': ' + s.bookings + ' (' + s.percentage.toFixed(1) + '%)').join(', ')||'No data'}</li>
  <li>Marketing Funnels: ${dataset.marketing_funnels?.filter((f:any)=>f.source!=='Unknown' && f.source!=='Returning Client').map((f:any)=>f.source + ': ' + f.new_clients + ' new clients (' + (f.percentage||0) + '%)').join(', ')||'No data'}</li>
  <li>Day of Week Performance: highlight best performing days for revenue 💈</li>
</ul>

<h2>${snapshotTitle}</h2>
<ul>
  <li>Total Revenue: $${totalRevenue.toFixed(2)}</li>
  <li>Total Clients: ${totalNewClients + totalReturningClients}</li>
  <li>New Clients: ${totalNewClients}</li>
  <li>Returning Clients: ${totalReturningClients}</li>
  <li>Average Ticket: $${(minimalDataset.weekly_rows.reduce((sum:number,w:any)=>sum+(w.final_revenue||0),0)/(minimalDataset.weekly_rows.reduce((sum:number,w:any)=>sum+(w.num_appointments||1),0))).toFixed(2)}</li>
  <li>Total Expenses: $${minimalDataset.weekly_rows.reduce((sum:number,w:any)=>sum+(w.expenses||0),0).toFixed(2)}</li>
  <li>Net Profit: $${(minimalDataset.weekly_rows.reduce((sum:number,w:any)=>sum+((w.total_revenue||0)-(w.expenses||0)),0)).toFixed(2)}</li>
  <li>Profit Margin: ${((minimalDataset.weekly_rows.reduce((sum:number,w:any)=>sum+((w.total_revenue||0)-(w.expenses||0)),0)/minimalDataset.weekly_rows.reduce((sum:number,w:any)=>sum+(w.total_revenue||1),0))*100).toFixed(1)}%</li>
</ul>

<h2>Critical Opportunities for Growth 🚀</h2> AI INSTRUCTIONS: DO NOT JUST OUTPUT THE FOLLOWING AS RAW TEXT, ACTUALLY GENERATE SOMETHING CREATIVE!
<ul>
  Generate a creative, human-like analysis of this dataset. Use HTML tags only (<strong>, <em>, <ul>/<li>) and emojis to make it engaging. Do NOT echo instructions or placeholders — produce actual insights based on the numbers. Include:

  <li><strong>Strengths and Weaknesses:</strong> Identify weeks with the highest and lowest client acquisition, retention, and revenue. Quote exact numbers from the dataset. Example: "💪 Week 3 brought 15 new clients, our strongest new client week this month." </li>

  <li><strong>Revenue & Service Trends:</strong> Highlight patterns such as spikes, dips, and anomalies in revenue, net profit, average ticket, services, and tips. Use actual numbers. Example: "📊 Revenue dropped to $1,200 in Week 2, below 75% of average ($${averageRevenue.toFixed(2)})." </li>

  <li><strong>Actionable Recommendations:</strong> Suggest specific steps to improve growth, retention, or upsells based on these numbers. Example: "🚨 Consider running a mid-week referral campaign; Week 2 had the lowest new client count: 4 clients." </li>

  <li><strong>Human Touch & Formatting:</strong> Use emojis, bullet points, short engaging sentences, and HTML formatting. Avoid placeholders. Make each insight dynamic — do not hard-code week numbers or thresholds; compute from the dataset.</li>
</ul>
`;
};
