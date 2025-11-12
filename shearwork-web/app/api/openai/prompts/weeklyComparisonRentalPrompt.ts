// ✅ Weekly Comparison Rental Prompt with HTML formatting enforced
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
**Use HTML tags for all formatting**: <strong>bold</strong>, <em>italic</em>, <ul>/<li> for lists, <h1>-<h3> for headers.
Do NOT use Markdown (** or *) at all. The report will be displayed in TinyMCE. HOWEVER DO NOT WRAP IN '''HTML ''' PLEASE DON'T!
Use start_date and end_date from weekly_rows. Compute totals and averages exactly.

Dataset (JSON):
${JSON.stringify(minimalDataset)}

Generate a detailed weekly comparison report in HTML suitable for TinyMCE. Include:

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
      ${minimalDataset.weekly_rows.map((w: any) => `<td>$${w.num_appointments ? (w.final_revenue / w.num_appointments).toFixed(2) : '0.00'}</td>`).join('')}
      <td>--</td><td>--</td>
    </tr>
    <tr>
      <td>Expenses</td>
      ${minimalDataset.weekly_rows.map((w: any) => `<td>$${(w.expenses || 0).toFixed(2)}</td>`).join('')}
      <td>--</td><td>--</td>
    </tr>
    <tr>
      <td>Net Profit</td>
      ${minimalDataset.weekly_rows.map((w: any) => `<td>$${((w.total_revenue||0)-(w.expenses||0)).toFixed(2)}</td>`).join('')}
      <td>--</td><td>--</td>
    </tr>
  </tbody>
</table>

<h2>Critical Opportunities for Growth 🚀</h2>
<ul>
  Instructions for AI: in the tags, do not rewrite as raw output, Be creative, use emojis! 
  <li><strong>Strengths and Weaknesses:</strong> Analyze client acquisition and retention, quoting actual numbers.</li>
  <li><strong>Revenue & Service Trends:</strong> Highlight surprising trends in revenue, profit, services.</li>
  <li><strong>Actionable Recommendations:</strong> Suggest concrete steps to boost growth.</li>
  <li><strong>Formatting:</strong> Use HTML tags for emphasis, lists, and human-like tone with emojis.</li>
</ul>
`;
};
