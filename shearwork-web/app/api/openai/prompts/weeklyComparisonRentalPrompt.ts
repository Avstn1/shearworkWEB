// ✅ Weekly Comparison Rental Prompt with full HTML, minimal dataset, dynamic Critical Opportunities
export const weeklyComparisonRentalPrompt = (dataset: any, userName: string, month: string, year: number) => {
  const lastWeekEnd = dataset.weekly_rows?.[dataset.weekly_rows.length - 1]?.end_date;
  const monthEndDate = new Date(year, new Date(`${month} 1, ${year}`).getMonth() + 1, 0);
  const lastWeekEndDate = lastWeekEnd ? new Date(lastWeekEnd) : null;
  const services = dataset.services || []
  const funnels = dataset.marketing_funnels || []
  const snapshotTitle =
    lastWeekEndDate && lastWeekEndDate.getDate() === monthEndDate.getDate()
      ? 'Month End Snapshot 🧾'
      : 'Current Period Snapshot 🧾';

  const totalNewClients = dataset.weekly_rows.reduce((sum:number,w:any)=>sum+(w.new_clients||0),0);
  const totalReturningClients = dataset.weekly_rows.reduce((sum:number,w:any)=>sum+(w.returning_clients||0),0);
  const finalRevenue = dataset.weekly_rows.reduce((sum:number,w:any)=>sum+(w.final_revenue||0),0);
  const totalAppointments = dataset.weekly_rows.reduce((sum:number,w:any)=>sum+(w.num_appointments||0),0);
  const retentionRate = totalAppointments > 0 ? ((totalReturningClients / totalAppointments) * 100).toFixed(1) : '0.0';
  const bestWeekRevenue = dataset.weekly_rows.reduce((a:any,b:any)=>(b.final_revenue>a.final_revenue?b:a),dataset.weekly_rows[0]);
  const worstWeekRevenue = dataset.weekly_rows.reduce((a:any,b:any)=>(b.final_revenue<a.final_revenue?b:a),dataset.weekly_rows[0]);
  const averageRevenue = finalRevenue / (dataset.weekly_rows?.length || 1);

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
      expenses: w.expenses, // All expenses are 0 in the database
      tips: w.tips
    })),
    services_percentage: dataset.services_percentage,
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
      ${minimalDataset.weekly_rows.map((w: any) => `<td>$${(w.final_revenue || 0).toFixed(2)}</td>`).join('')}
      <td>$${minimalDataset.weekly_rows.length > 1 ? ((minimalDataset.weekly_rows.at(-1).final_revenue || 0) - (minimalDataset.weekly_rows.at(-2).final_revenue || 0)).toFixed(2) : '--'}</td>
      <td>${minimalDataset.weekly_rows.length > 1 ? ((((minimalDataset.weekly_rows.at(-1).final_revenue || 0) - (minimalDataset.weekly_rows.at(-2).final_revenue || 0)) / (minimalDataset.weekly_rows.at(-2).final_revenue || 1)) * 100).toFixed(1) + '%' : '--'}</td>
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
      <td>Tips</td>
      ${minimalDataset.weekly_rows
        .map((w:any) => `<td>$${(w.tips || 0).toFixed(2)}</td>`)
        .join('')}
      ${
        minimalDataset.weekly_rows.length > 1
          ? (() => {
              const cur = minimalDataset.weekly_rows.at(-1);
              const prev = minimalDataset.weekly_rows.at(-2);
              const delta = (cur.tips || 0) - (prev.tips || 0);
              const pct = ((delta / (prev.tips || 1)) * 100).toFixed(1);
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
      ${minimalDataset.weekly_rows.map((w:any)=>`<td>$${((w.final_revenue||0)-(w.expenses||0)).toFixed(2)}</td>`).join('')}
      ${
        minimalDataset.weekly_rows.length > 1
          ? (()=>{ 
              const cur = minimalDataset.weekly_rows.at(-1), prev = minimalDataset.weekly_rows.at(-2);
              const curNet = (cur.final_revenue||0)-(cur.expenses||0);
              const prevNet = (prev.final_revenue||0)-(prev.expenses||0);
              const delta = curNet - prevNet;
              const pct = ((delta / (prevNet || 1)) * 100).toFixed(1);
              return `<td>$${delta.toFixed(2)}</td><td>${pct}%</td>`;
            })()
          : '<td>--</td><td>--</td>'
      }
    </tr>
  </tbody>
</table>

<h2>💼 Service Breakdown</h2>
<table>
  <thead>
    <tr>
      <th>Service Count</th>
      ${minimalDataset.weekly_rows.map((w: any) => `<th>W${w.week_number}</th>`).join('')}
      <th>Δ (Last Week → This Week)</th>
      <th>% Change</th>
    </tr>
  </thead>
    <tbody>
      ${(() => {
        // Get all unique service names with their total bookings
        const serviceNames = [...new Set(services.map((s: any) => s.service_name))];
        
        const servicesWithTotals = serviceNames.map(serviceName => {
          const weeklyBookings = minimalDataset.weekly_rows.map((w: any) => {
            const serviceData = services.find((s: any) => 
              s.service_name === serviceName && s.week_number === w.week_number
            );
            return serviceData?.total_bookings || 0;
          });
          
          const total = weeklyBookings.reduce((sum: number, b: number) => sum + b, 0);
          
          return {
            name: serviceName,
            weeklyBookings,
            total
          };
        })
        .filter(s => s.total > 0)  // Remove services with 0 bookings
        .sort((a, b) => b.total - a.total);  // Sort by total (highest first)
        
        // Split into top 5 and others
        const top5 = servicesWithTotals.slice(0, 5);
        const others = servicesWithTotals.slice(5);
        
        // Generate rows for top 5
        const top5Rows = top5.map(service => {
          const delta = service.weeklyBookings.length > 1 
            ? service.weeklyBookings[service.weeklyBookings.length - 1] - service.weeklyBookings[service.weeklyBookings.length - 2]
            : 0;
          
          const percentChange = service.weeklyBookings.length > 1 && service.weeklyBookings[service.weeklyBookings.length - 2] > 0
            ? ((delta / service.weeklyBookings[service.weeklyBookings.length - 2]) * 100).toFixed(1)
            : '--';
          
          return `
            <tr>
              <td style="padding: 8px 4px;">${service.name}</td>
              ${service.weeklyBookings.map((bookings: number) => `<td style="padding: 8px 4px;">${bookings}</td>`).join('')}
              <td style="padding: 8px 4px;">${service.weeklyBookings.length > 1 ? delta : '--'}</td>
              <td style="padding: 8px 4px;">${service.weeklyBookings.length > 1 && percentChange !== '--' ? percentChange + '%' : '--'}</td>
            </tr>
          `;
        }).join('');
        
        // Generate "Others" row if there are more than 5 services
        const othersRow = others.length > 0 ? (() => {
          const othersWeeklyBookings = minimalDataset.weekly_rows.map((w: any, index: number) => {
            return others.reduce((sum: number, service) => sum + (service.weeklyBookings[index] || 0), 0);
          });
          
          const delta = othersWeeklyBookings.length > 1 
            ? othersWeeklyBookings[othersWeeklyBookings.length - 1] - othersWeeklyBookings[othersWeeklyBookings.length - 2]
            : 0;
          
          const percentChange = othersWeeklyBookings.length > 1 && othersWeeklyBookings[othersWeeklyBookings.length - 2] > 0
            ? ((delta / othersWeeklyBookings[othersWeeklyBookings.length - 2]) * 100).toFixed(1)
            : '--';
          
          return `
            <tr style="font-style: italic; opacity: 0.8;">
              <td style="padding: 8px 4px;"><em>Others (${others.length} services)</em></td>
              ${othersWeeklyBookings.map((bookings: number) => `<td style="padding: 8px 4px;">${bookings}</td>`).join('')}
              <td style="padding: 8px 4px;">${othersWeeklyBookings.length > 1 ? delta : '--'}</td>
              <td style="padding: 8px 4px;">${othersWeeklyBookings.length > 1 && percentChange !== '--' ? percentChange + '%' : '--'}</td>
            </tr>
          `;
        })() : '';
        
        return top5Rows + othersRow;
      })()}
    </tbody>
</table>

<h2>📣 Marketing Funnels</h2>
<table>
  <thead>
    <tr>
      <th style="padding: 8px 4px;">Source</th>
      ${minimalDataset.weekly_rows.map((w: any) => `<th style="padding: 8px 4px;">W${w.week_number}</th>`).join('')}
    </tr>
  </thead>
  <tbody>
    ${(() => {
      // Get all unique sources with their total new clients
      const sourceNames = [...new Set(funnels.map((f: any) => f.source))]
        .filter(source => source !== 'Returning Client' && source !== 'Walk In');
      
      const sourcesWithTotals = sourceNames.map(source => {
        const weeklyNewClients = minimalDataset.weekly_rows.map((w: any) => {
          const funnelData = funnels.find((f: any) => 
            f.source === source && f.week_number === w.week_number
          );
          return funnelData?.new_clients || 0;
        });
        
        const total = weeklyNewClients.reduce((sum: number, c) => sum + c, 0);
        
        return {
          name: source,
          weeklyNewClients,
          total
        };
      })
      .filter(s => s.total > 0)  // Remove sources with 0 new clients
      .sort((a, b) => b.total - a.total);  // Sort by total (highest first)
      
      // Split into top 5 and others
      const top5 = sourcesWithTotals.slice(0, 5);
      const others = sourcesWithTotals.slice(5);
      
      // Generate rows for top 5
      const top5Rows = top5.map(source => {
        return `
          <tr>
            <td style="padding: 8px 4px;">${source.name}</td>
            ${source.weeklyNewClients.map((clients: number) => `<td style="padding: 8px 4px;">${clients}</td>`).join('')}
          </tr>
        `;
      }).join('');
      
      // Generate "Others" row if there are more than 5 sources
      const othersRow = others.length > 0 ? (() => {
        const othersWeeklyClients = minimalDataset.weekly_rows.map((w: any, index: number) => {
          return others.reduce((sum: number, source) => sum + (source.weeklyNewClients[index] || 0), 0);
        });
        
        return `
          <tr style="font-style: italic; opacity: 0.8;">
            <td style="padding: 8px 4px;"><em>Others (${others.length} sources)</em></td>
            ${othersWeeklyClients.map((clients: number) => `<td style="padding: 8px 4px;">${clients}</td>`).join('')}
          </tr>
        `;
      })() : '';
      
      return top5Rows + othersRow;
    })()}
  </tbody>
</table>

<h2>Key Insights & Trends 🔍</h2>
<ul>
  <li>Revenue Performance: Final revenue $${finalRevenue.toFixed(2)}, Best week: Week ${bestWeekRevenue.week_number}, Worst week: Week ${worstWeekRevenue.week_number}</li>
  <li>Client Retention: Overall ${retentionRate}%, highlight best retention week.</li>
  <li>Average Ticket: Monthly avg $${(minimalDataset.weekly_rows.reduce((sum:number,w:any)=>sum+(w.final_revenue||0),0)/(minimalDataset.weekly_rows.reduce((sum:number,w:any)=>sum+(w.num_appointments||1),0))).toFixed(2)}, range from lowest to highest week.</li>
  <li>Service Breakdown: ${dataset.services_percentage?.map((s:any)=>s.name + ': ' + s.bookings + ' (' + s.percentage.toFixed(1) + '%)').join(', ')||'No data'}</li>
  <li>Marketing Funnels: ${dataset.marketing_funnels?.filter((f:any)=>f.source!=='Unknown' && f.source!=='Returning Client').map((f:any)=>f.source + ': ' + f.new_clients + ' new clients (' + (f.percentage||0) + '%)').join(', ')||'No data'}</li>
</ul>

<h2>${snapshotTitle}</h2>
<ul>
  <li>Final revenue: $${finalRevenue.toFixed(2)}</li>
  <li>Total Clients: ${totalNewClients + totalReturningClients}</li>
  <li>New Clients: ${totalNewClients}</li>
  <li>Returning Clients: ${totalReturningClients}</li>
  <li>Average Ticket: $${(minimalDataset.weekly_rows.reduce((sum:number,w:any)=>sum+(w.final_revenue||0),0)/(minimalDataset.weekly_rows.reduce((sum:number,w:any)=>sum+(w.num_appointments||1),0))).toFixed(2)}</li>
  <li>Total Expenses: $${minimalDataset.weekly_rows.reduce((sum:number,w:any)=>sum+(w.expenses||0),0).toFixed(2)}</li>
  <li>Net Profit: $${(minimalDataset.weekly_rows.reduce((sum:number,w:any)=>sum+((w.final_revenue||0)-(w.expenses||0)),0)).toFixed(2)}</li>
  <li>Profit Margin: ${((minimalDataset.weekly_rows.reduce((sum:number,w:any)=>sum+((w.final_revenue||0)-(w.expenses||0)),0)/minimalDataset.weekly_rows.reduce((sum:number,w:any)=>sum+(w.final_revenue||1),0))*100).toFixed(1)}%</li>
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
