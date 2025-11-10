export const monthlyRentalPrompt = (dataset: any, userName: string, month: string, year: number) => `
You are a professional analytics assistant creating a monthly performance report for a barbershop professional. 
Be a little fun and use some emojis PLEASE, especially in section headers. Use emojis beside any jot notes you use or
beside any brief summaries in each section.

Dataset (JSON):
${JSON.stringify(dataset, null, 2)}

Generate a detailed monthly report in HTML suitable for TinyMCE. Include sections:
1. <h1>${month} ${year} Business Report</h1>
2. 🧐 Quick Overview (from monthly_data)
    - Display table with columns: Metric, Value.
    - In the same table with rows: Total Clients, New Clients, Returning Clients, Average Ticket, Total Revenue, Estimated Expenses, 
      Estimated Profit, Date Range
    - **After the table**, write a short summary paragraph (2–3 sentences) that naturally interprets these metrics.
      Example style:
      "<strong>${month}</strong> was a strong month for ${userName} — [X] total clients with [Y]% new bookings. 
      Consistent pricing kept the average ticket around $[avg_ticket], reflecting steady efficiency and client growth."
3. 💼 Service Breakdown (from service_bookings, instruction: sort rows by # of bookings)
    - columns: Service, # of bookings, % of total, Est. Revenue, Avg/Booking
    - final row: total
    one sentence summary of the table
4. 💰 Expense Overview
    - columns: type, amount
    - for now assume only expense type is Rent(Fixed)
    - final row (for type): Net Profit
5. 📣 Marketing Funnels (from marketing_funnels)
    - columns: Source, New Clients, Returning, Total, Retention, Avg Ticket
    Highlights: (pinpoint highlights in table)
6. 👑 Top Clients (from top_clients)
    - Rank (give emojis to top 3), Client, Total Paid, Visits, Notes
    (short summary of table - highlight revenue of top clients, percentage of total)
7.  ↻ Frequency Highlights (from top_clients)
    - columns: Client, Visits, Total Paid, Notes
    (short summary of table)
7. 📊 Weekly Performance Snapshot
8. ✨ Key Takeaways (use emojis beside each sentence)
    - [total client summary]
    - [approx. take home]
    - [best marketing funnel]
    - [average ticket comparison]
    - [any other notable marketing funnel]
    - [any weekly records or revenue comparisons]
    - [number of multi visit clients]
    - [any other cool insights you can provide]

Use <h2>/<h3> for headings, <p> for text, <ul><li> for lists, <table> for tables. 
If any section has no data, write: "No data available for this section." Output only HTML body, no triple backticks.
`
