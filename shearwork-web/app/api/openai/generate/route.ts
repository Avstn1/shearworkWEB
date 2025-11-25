/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { openai } from '@/lib/openaiClient'
import { prompts } from '../prompts'

interface DailyRow {
  date: string
  total_revenue: number
  tips?: number
  expenses?: number
  num_appointments?: number
  new_clients?: number
  returning_clients?: number
  [key: string]: any
}

interface WeeklyRow {
  week_number: number
  start_date: string
  end_date: string
  total_revenue: number
  tips: number
  // final_revenue: number // NOT USED
  expenses: number
  num_appointments: number
  new_clients: number
  returning_clients: number
  [key: string]: any
}

async function notifyUserAboutReport(
  userId: string,
  reportId: string,
  reportType: string,
  reportTitle: string,
  supabase: any
) {
  const { data, error } = await supabase.functions.invoke(
    'send-push-notification',
    {
      body: {
        userId,
        title: 'New Report Available',
        body: reportTitle,
        reportId,
        reportType,
      },
    }
  )

  if (error) {
    console.error('Error sending notification:', error)
  } else {
    console.log('Notification sent:', data)
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const authHeader = req.headers.get('authorization')

    if (!authHeader || authHeader !== `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await req.json()

    const typeParam = body.type || 'monthly/rental'
    const [type, barber_type] = typeParam.split('/')
    const user_id = body.user_id

    if (!user_id) {
      return NextResponse.json({ success: false, error: 'Missing user_id' }, { status: 400 })
    }

    // ✅ Allow passing any week_number via body
    const week_number = body.week_number ? Number.parseInt(body.week_number, 10) : null

    let month = body.month || new Date().toLocaleString('default', { month: 'long' })
    const year = Number.parseInt(body.year || String(new Date().getFullYear()), 10)

    // 🧲 Fetch barber’s full name & commission rate
    const { data: userData, error: nameError } = await supabase
      .from('profiles')
      .select('full_name, commission_rate')
      .eq('user_id', user_id)
      .single()
    if (nameError) throw nameError

    const userName = userData?.full_name || 'Unknown Barber'
    const commissionRate =
      barber_type === 'commission' ? userData?.commission_rate || 0 : null

    // Standardize month capitalization
    const monthNames = [
      'January','February','March','April','May','June',
      'July','August','September','October','November','December'
    ]
    const monthIndex = monthNames.findIndex((m) => m.toLowerCase() === month.toLowerCase())
    if (monthIndex === -1) throw new Error(`Invalid month: ${month}`)
    month = monthNames[monthIndex]

    const firstDayOfMonth = new Date(year, monthIndex, 1)
    const lastDayOfMonth = new Date(year, monthIndex + 1, 0)

    // 🧮 Fetch daily data
    const { data: allDailyRows, error: allDailyError } = await supabase
      .from('daily_data')
      .select('*')
      .eq('user_id', user_id)
      .eq('month', month)
      .eq('year', year)
    if (allDailyError) throw allDailyError

    const dailyPoints: DailyRow[] = allDailyRows || []

    let summaryData: any = null
    let weekly_rows: WeeklyRow[] | WeeklyRow | null = null

    // 🧮 Monthly summary
    if (type.startsWith('monthly')) {
      // Fetch summary from monthly_data
      const { data, error } = await supabase
        .from('monthly_data')
        .select('*')
        .eq('user_id', user_id)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle()
      if (error) throw error

      summaryData = {
        ...data,
        daily_points: dailyPoints,
        start_date: firstDayOfMonth.toISOString().split('T')[0],
        end_date: lastDayOfMonth.toISOString().split('T')[0],
      }

      // Also generate weekly_rows
      const weeklyRows: WeeklyRow[] = []
      let weekNumber = 1
      let weekStart = new Date(firstDayOfMonth)
      const end = new Date(lastDayOfMonth)

      while (weekStart <= end) {
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekEnd.getDate() + 6)
        if (weekEnd > end) weekEnd.setDate(end.getDate())

        const weekDaily = dailyPoints.filter(
          (d) => new Date(d.date) >= weekStart && new Date(d.date) <= weekEnd
        )

        if (weekDaily.length > 0) {
          const total_revenue = weekDaily.reduce((sum, d) => sum + (d.total_revenue || 0), 0)
          const num_appointments = weekDaily.reduce((sum, d) => sum + (d.num_appointments || 0), 0)
          const new_clients = weekDaily.reduce((sum, d) => sum + (d.new_clients || 0), 0)
          const returning_clients = weekDaily.reduce((sum, d) => sum + (d.returning_clients || 0), 0)

          weeklyRows.push({
            week_number: weekNumber,
            start_date: weekStart.toISOString().split('T')[0],
            end_date: weekEnd.toISOString().split('T')[0],
            total_revenue,
            tips: 0,
            // final_revenue: total_revenue, // NOT USED
            expenses: 0,
            num_appointments,
            new_clients,
            returning_clients,
          })
        }

        weekStart.setDate(weekStart.getDate() + 7)
        weekNumber += 1
      }

      weekly_rows = weeklyRows
    }


    // 🧮 Weekly summary (supports week_number)
    else if (type.startsWith('weekly')) {
      let weeklyQuery = supabase
        .from('weekly_data')
        .select('*')
        .eq('user_id', user_id)
        .eq('month', month)
        .eq('year', year)
      
      if (type.includes('comparison') && week_number != null) {
        weeklyQuery = weeklyQuery.lte('week_number', week_number)  // ≤ week_number
      } else if (week_number != null) {
        weeklyQuery = weeklyQuery.eq('week_number', week_number)  // = week_number
      }
      
      const { data: weeklyData, error: weeklyError } = await weeklyQuery.order('week_number', { ascending: true })
      
      if (weeklyError) throw weeklyError
      if (!weeklyData || weeklyData.length === 0) throw new Error('No weekly data found')
        
      // ✅ Comparison mode uses cumulative weekly dataset (weeks 1-N)
      if (type.includes('comparison')) {
        weekly_rows = weeklyData as WeeklyRow[]  // All weeks up to week_number
        summaryData = null

        const { data: deletedRow, error } = await supabase
          .from('reports')
          .delete()
          .eq('type', 'weekly_comparison')
          .eq('month', month)
          .eq('year', year)
          .eq('user_id', user_id)
          .select();

        console.log("Deleted Row: " + deletedRow)

      } else {
        // ✅ Single week report
        const selectedWeek =
          week_number != null
            ? weeklyData.find((w) => w.week_number === week_number)
            : weeklyData[weeklyData.length - 1]

        if (!selectedWeek)
          throw new Error(`Week ${week_number} not found for ${month} ${year}`)

        weekly_rows = selectedWeek
        summaryData = selectedWeek
      }

      // ✅ Only use daily_points to highlight best day in that week
      const filteredDailyPoints = dailyPoints.filter((d) => {
        if (!summaryData || Array.isArray(weekly_rows)) return false
        return d.date >= summaryData.start_date && d.date <= summaryData.end_date
      })

      const bestDay: DailyRow | null =
        filteredDailyPoints.length > 0
          ? filteredDailyPoints.reduce((prev, curr) =>
              (curr.total_revenue || 0) > (prev.total_revenue || 0) ? curr : prev
            )
          : null

      if (!Array.isArray(weekly_rows)) summaryData.best_day = bestDay
    }

    let services

    if (type == 'monthly') {
      const { data } = await supabase
        .from('service_bookings')
        .select('*')
        .eq('user_id', user_id)
        .eq('report_month', month)
        .eq('report_year', year)
      services = data
    } else if (type === 'weekly') {
      const { data } = await supabase
        .from('weekly_service_bookings')
        .select('*')
        .eq('user_id', user_id)
        .eq('month', month)
        .eq('year', year)
        .eq('week_number', week_number)

      services = data
    } else if (type == 'weekly_comparison') {
      const { data } = await supabase
        .from('weekly_service_bookings')
        .select('*')
        .eq('user_id', user_id)
        .eq('month', month)
        .eq('year', year)
      services = data
    }

    const totalBookings = services?.reduce((sum, s) => sum + (s.bookings || 0), 0) || 0
    const services_percentage = (services || []).map((s) => ({
      name: s.service_name,
      bookings: s.bookings || 0,
      percentage: totalBookings ? ((s.bookings || 0) / totalBookings) * 100 : 0,
    }))

    // 🧩 Fetch marketing funnels
    let funnels
    if (type == 'monthly') {
      const { data } = await supabase
        .from('marketing_funnels')
        .select('*')
        .eq('user_id', user_id)
        .eq('report_month', month)
        .eq('report_year', year)
      funnels = data
    } else if (type === 'weekly') {
      const { data } = await supabase
        .from('weekly_marketing_funnels')
        .select('*')
        .eq('user_id', user_id)
        .eq('report_month', month)
        .eq('report_year', year)
        .eq('week_number', week_number)
      funnels = data
    } else if (type == 'weekly_comparison') {
      const { data } = await supabase
        .from('weekly_marketing_funnels')
        .select('*')
        .eq('user_id', user_id)
        .eq('report_month', month)
        .eq('report_year', year)
      funnels = data
    }

    // 🧩 Fetch top clients (weekly or monthly)
    const { data: topClients } = await supabase
      .from(type.startsWith('weekly') ? 'weekly_top_clients' : 'report_top_clients')
      .select('*')
      .eq('user_id', user_id)
      .eq('month', month)
      .eq('year', year)
      .eq('week_number', week_number)
      .order('total_paid', { ascending: false })

    const {data: expenses } = await supabase
      .from("monthly_data")
      .select("expenses")
      .eq('user_id', user_id)
      .eq('month', month)
      .eq('year', year)

    // 🧠 Build dataset for OpenAI
    const dataset = {
      month,
      year,
      week_number: type.startsWith('weekly') && !Array.isArray(weekly_rows) ? summaryData?.week_number : null,
      user_name: userName,
      summary: summaryData,
      daily_rows: dailyPoints,
      weekly_rows,
      services,
      services_percentage,
      marketing_funnels: funnels,
      top_clients: topClients,
      expenses: expenses,
      ...(barber_type === 'commission' && { commission_rate: commissionRate }),
    }

    const promptKey = `${type}/${barber_type}`
    const promptTemplate =
      prompts[promptKey as keyof typeof prompts] || prompts['monthly/rental']

    // 🧠 Generate report via OpenAI
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.5,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert analytics report writer specializing in barbershop business performance summaries.',
        },
        { role: 'user', content: promptTemplate(dataset, userName, month, year) },
      ],
    })

    const htmlReport = response.choices?.[0]?.message?.content?.trim() || ''



    // 🧾 Store report in DB
    console.log(`Database writing ${type} report for ${user_id} for ${month} ${year}. Current time: ${new Date().toISOString()}`)
    const { data: newReport, error: insertError } = await supabase
      .from('reports')
      .insert({
        user_id,
        type,
        barber_type,
        month,
        week_number: dataset.week_number,
        year,
        content: htmlReport,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (insertError) throw insertError

    console.log(`Generated ${type} report for ${user_id} for ${month} ${year} (${summaryData.start_date} -> ${summaryData.end_date}). Current time: ${new Date().toISOString()}`)

    let message = "";

    const formatType = (str: string) =>
      str
        .split('_')                 
        .map(s => s.charAt(0).toUpperCase() + s.slice(1)) 
        .join(' ');               
    const formattedType = formatType(type);

    if (type === "monthly") {
      message = `Your ${formattedType} report has been generated for ${month} ${year}.`;
    } else if (type === "weekly" || type === "weekly_comparison") {
      const week = dataset.week_number;

      if (week != null) {
        const suffix =
          week === 1 ? "st" :
          week === 2 ? "nd" :
          week === 3 ? "rd" : "th";

        message = `Your ${formattedType} report has been generated for the ${week}${suffix} week of ${month} ${year}.`;
      } else {
        message = `Your ${formattedType} report has been generated for the weeks of ${month} ${year}.`;
      }
    }

    // Insert into notifications table
    const { error: notifError } = await supabase
      .from("notifications")
      .insert({
        user_id,
        header: `${formattedType} report generated`,
        message,
        reference: newReport.id, 
        reference_type: type
      });

    if (notifError) throw notifError;

    console.log(`Notification created for ${user_id}`);

    notifyUserAboutReport(user_id, newReport.id, type, `${formattedType} report generated`, supabase)

    supabase.rpc('refresh_weekly_funnels')
    .then(
      () => console.log('Refreshed weekly funnels'),
      (e: any) => console.warn('Refresh failed:', e)
    )

    return NextResponse.json({ success: true, report: newReport })


  } catch (err: any) {
    console.error('❌ Report generation error:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
