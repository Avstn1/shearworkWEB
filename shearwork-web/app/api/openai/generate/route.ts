/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { openai } from '@/lib/openaiClient'
import { prompts } from '../prompts'
import { getWeeklyBreakdown } from './weeklyExpenses'

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
  expenses: number
  num_appointments: number
  new_clients: number
  returning_clients: number
  [key: string]: any
}

const MONTH_MAP: Record<string, number> = {
  January: 1,
  February: 2,
  March: 3,
  April: 4,
  May: 5,
  June: 6,
  July: 7,
  August: 8,
  September: 9,
  October: 10,
  November: 11,
  December: 12,
}

async function notifyUserAboutReport(
  userId: string,
  reportId: string,
  reportType: string,
  reportTitle: string,
  supabase: any,
) {
  const { data, error } = await supabase.functions.invoke('send-push-notif', {
    body: {
      userId,
      title: 'New Report Available',
      body: reportTitle,
      reportId,
      reportType,
    },
  })

  if (error) console.error('Error sending notification:', error)
}

async function safeRpc(supabase: any, fn: string, args?: Record<string, any>) {
  const { error } = await supabase.rpc(fn, args ?? {})
  if (error) console.warn(`RPC ${fn} failed:`, error)
}

// ✅ optional: tiny helper to avoid month/year mismatches when tables store report_month/report_year
function monthYearFallback(params: {
  isWeekly: boolean
  month: string
  year: number
  bodyMonth?: any
  bodyYear?: any
}) {
  // You can extend this later if you want smarter fallbacks.
  return { month: params.month, year: params.year }
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const authHeader = req.headers.get('authorization')

    if (
      !authHeader ||
      authHeader !== `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
    ) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      )
    }

    const body = await req.json()

    const typeParam = body.type || 'monthly/rental'
    const [type, barber_type] = typeParam.split('/')
    const user_id = body.user_id

    if (!user_id) {
      return NextResponse.json(
        { success: false, error: 'Missing user_id' },
        { status: 400 },
      )
    }

    const week_number =
      body.week_number != null ? Number.parseInt(body.week_number, 10) : null

    let effectiveWeekNumber: number | null = week_number

    let month =
      body.month || new Date().toLocaleString('default', { month: 'long' })
    const year = Number.parseInt(
      body.year || String(new Date().getFullYear()),
      10,
    )

    const isWeekly = type === 'weekly' || type === 'weekly_comparison'

    // 🧲 Fetch barber's full name & commission rate
    const { data: userData, error: nameError } = await supabase
      .from('profiles')
      .select('full_name, commission_rate, special_access')
      .eq('user_id', user_id)
      .single()
    if (nameError) throw nameError

    const userName = userData?.full_name || 'Unknown Barber'
    const commissionRate =
      barber_type === 'commission' ? userData?.commission_rate || 0 : null

    // Standardize month capitalization
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ]

    const monthIndex = monthNames.findIndex(
      (m) => m.toLowerCase() === String(month).toLowerCase(),
    )
    if (monthIndex === -1) throw new Error(`Invalid month: ${month}`)
    month = monthNames[monthIndex]

    // (optional) placeholder for future fallbacks
    const normalized = monthYearFallback({ isWeekly, month, year, bodyMonth: body.month, bodyYear: body.year })
    month = normalized.month
    const normalizedYear = normalized.year

    const firstDayOfMonth = new Date(normalizedYear, monthIndex, 1)
    const lastDayOfMonth = new Date(normalizedYear, monthIndex + 1, 0)

    // 🧮 Fetch daily data
    const { data: allDailyRows, error: allDailyError } = await supabase
      .from('daily_data')
      .select('*')
      .eq('user_id', user_id)
      .eq('month', month)
      .eq('year', normalizedYear)
    if (allDailyError) throw allDailyError

    const dailyPoints: DailyRow[] = allDailyRows || []

    let summaryData: any = null
    let weekly_rows: WeeklyRow[] | WeeklyRow | null = null
    let totalTips: any = null

    // 🧮 Monthly summary
    if (type.startsWith('monthly')) {
      const { data, error } = await supabase
        .from('monthly_data')
        .select('*')
        .eq('user_id', user_id)
        .eq('month', month)
        .eq('year', normalizedYear)
        .maybeSingle()
      if (error) throw error

      const start_date = firstDayOfMonth.toISOString().split('T')[0]
      const end_date = lastDayOfMonth.toISOString().split('T')[0]

      const { data: tipsData, error: tipsError } = await supabase
        .from('acuity_appointments')
        .select('service_type, tip')
        .eq('user_id', user_id)
        .gte('appointment_date', start_date)
        .lte('appointment_date', end_date)

      if (tipsError) throw tipsError

      const tipsServiceType = tipsData?.reduce((acc, appointment) => {
        const serviceType = appointment.service_type || 'Unknown';
        const tip = appointment.tip || 0;
        acc[serviceType] = (acc[serviceType] || 0) + tip;
        return acc;
      }, {} as Record<string, number>) || {};

      const totalTips = tipsData?.reduce((sum, appointment) => sum + (appointment.tip || 0), 0) || 0;

      const tipsAggregatedData = {
        totalTips,
        tipsServiceType
      };

      summaryData = {
        ...data,
        tips: tipsAggregatedData,
        daily_points: dailyPoints,
        start_date: firstDayOfMonth.toISOString().split('T')[0],
        end_date: lastDayOfMonth.toISOString().split('T')[0],
      }

      const { data: weeklyData, error: weeklyError } = await supabase
        .from('weekly_data')
        .select('*')
        .eq('user_id', user_id)
        .eq('month', month)
        .eq('year', normalizedYear)
        .order('week_number', { ascending: true })

      if (weeklyError) throw weeklyError
      weekly_rows = weeklyData || []
    } else if (type.startsWith('weekly')) {
      let weeklyQuery = supabase
        .from('weekly_data')
        .select('*')
        .eq('user_id', user_id)
        .eq('month', month)
        .eq('year', normalizedYear)

      if (type.includes('comparison') && week_number != null) {
        weeklyQuery = weeklyQuery.lte('week_number', week_number)
      } else if (week_number != null) {
        weeklyQuery = weeklyQuery.eq('week_number', week_number)
      }

      const { data: weeklyData, error: weeklyError } = await weeklyQuery.order(
        'week_number',
        { ascending: true },
      )

      if (weeklyError) throw weeklyError
      if (!weeklyData || weeklyData.length === 0)
        throw new Error('No weekly data found')

      if (type.includes('comparison')) {
        weekly_rows = weeklyData as WeeklyRow[]
        effectiveWeekNumber = null

        await supabase
          .from('reports')
          .delete()
          .eq('type', 'weekly_comparison')
          .eq('month', month)
          .eq('year', normalizedYear)
          .eq('user_id', user_id)

        // Get tips for each week in the comparison
        const tipsForWeeks = await Promise.all(
          weeklyData.map(async (week: any) => {
            const { data: tipsData, error: tipsError } = await supabase
              .from('acuity_appointments')
              .select('tip')
              .eq('user_id', user_id)
              .gte('appointment_date', week.start_date)
              .lte('appointment_date', week.end_date)
            
            if (tipsError) throw tipsError
            
            return tipsData?.reduce((sum, appointment) => sum + (appointment.tip || 0), 0) || 0
          })
        )
        
        totalTips = tipsForWeeks

        summaryData = {
          tips: totalTips
        }
      } else {
        const selectedWeek =
          week_number != null
            ? weeklyData.find((w: any) => w.week_number === week_number)
            : weeklyData[weeklyData.length - 1]

        if (!selectedWeek)
          throw new Error(`Week ${week_number} not found for ${month} ${normalizedYear}`)

        weekly_rows = selectedWeek
        summaryData = selectedWeek
        effectiveWeekNumber = selectedWeek.week_number

        // Get tips for single week
        const { data: tipsData, error: tipsError } = await supabase
          .from('acuity_appointments')
          .select('service_type, tip')
          .eq('user_id', user_id)
          .gte('appointment_date', selectedWeek.start_date)
          .lte('appointment_date', selectedWeek.end_date)
        
        if (tipsError) throw tipsError
        
        const tipsServiceType = tipsData?.reduce((acc, appointment) => {
          const serviceType = appointment.service_type || 'Unknown';
          const tip = appointment.tip || 0;
          acc[serviceType] = (acc[serviceType] || 0) + tip;
          return acc;
        }, {} as Record<string, number>) || {};

        const totalTipsValue = tipsData?.reduce((sum, appointment) => sum + (appointment.tip || 0), 0) || 0;

        summaryData.tips = {
          totalTips: totalTipsValue,
          tipsServiceType
        }
      }

      // best day (single-week only)
      const filteredDailyPoints = dailyPoints.filter((d) => {
        if (!summaryData || Array.isArray(weekly_rows)) return false
        return d.date >= summaryData.start_date && d.date <= summaryData.end_date
      })

      const bestDay: DailyRow | null =
        filteredDailyPoints.length > 0
          ? filteredDailyPoints.reduce((prev, curr) =>
              (curr.total_revenue || 0) > (prev.total_revenue || 0) ? curr : prev,
            )
          : null

      if (!Array.isArray(weekly_rows)) summaryData.best_day = bestDay
    }

    // ---------------- Services ----------------
    let services: any[] | null = null

    if (type === 'monthly') {
      const { data, error } = await supabase
        .from('service_bookings')
        .select('*')
        .eq('user_id', user_id)
        .eq('report_month', month)
        .eq('report_year', normalizedYear)
      if (error) throw error
      services = data
    } else if (type === 'weekly') {
      if (effectiveWeekNumber == null) {
        throw new Error('effectiveWeekNumber is null for weekly services')
      }
      const { data, error } = await supabase
        .from('weekly_service_bookings')
        .select('*')
        .eq('user_id', user_id)
        // NOTE: your weekly_service_bookings uses month/year (not report_month/report_year)
        .eq('month', month)
        .eq('year', normalizedYear)
        .eq('week_number', effectiveWeekNumber)
      if (error) throw error
      services = data
    } else if (type === 'weekly_comparison') {
      let q = supabase
        .from('weekly_service_bookings')
        .select('*')
        .eq('user_id', user_id)
        .eq('month', month)
        .eq('year', normalizedYear)

      if (week_number != null) q = q.lte('week_number', week_number)

      const { data, error } = await q.order('week_number', { ascending: true })
      if (error) throw error
      services = data
    }

    const totalBookings =
      services?.reduce((sum: number, s: any) => sum + (s.bookings || 0), 0) || 0
    const services_percentage = (services || []).map((s: any) => ({
      name: s.service_name,
      bookings: s.bookings || 0,
      percentage: totalBookings ? ((s.bookings || 0) / totalBookings) * 100 : 0,
    }))

    // ---------------- Marketing funnels ----------------
    let funnels: any[] = []

    // ✅ UPDATED: Query from weekly_marketing_funnels_base (new base table)
    const fetchFunnels = async () => {
      if (type === 'monthly') {
        const { data, error } = await supabase
          .from('marketing_funnels')
          .select('*')
          .eq('user_id', user_id)
          .eq('report_month', month)
          .eq('report_year', normalizedYear)
          .neq('source', 'No Source') 
        if (error) throw error
        return data ?? []
      }

      if (type === 'weekly') {
        if (effectiveWeekNumber == null) {
          throw new Error('effectiveWeekNumber is null for weekly funnels')
        }
        const { data, error } = await supabase
          .from('weekly_marketing_funnels_base')  // ✅ CHANGED from weekly_marketing_funnels
          .select('*')
          .eq('user_id', user_id)
          .eq('report_month', month)
          .eq('report_year', normalizedYear)
          .eq('week_number', effectiveWeekNumber)
          .neq('source', 'No Source') 
        if (error) throw error
        return data ?? []
      }

      // weekly_comparison
      let q = supabase
        .from('weekly_marketing_funnels_base')  // ✅ CHANGED from weekly_marketing_funnels
        .select('*')
        .eq('user_id', user_id)
        .eq('report_month', month)
        .eq('report_year', normalizedYear)
        .neq('source', 'No Source') 


      if (week_number != null) q = q.lte('week_number', week_number)

      const { data, error } = await q.order('week_number', { ascending: true })
      if (error) throw error
      return data ?? []
    }

    funnels = await fetchFunnels()

    // ✅ Extra visibility: confirm if ANY funnels exist for this user/month/year
    const { data: funnelAny, error: funnelAnyErr } = await supabase
      .from('weekly_marketing_funnels_base')  // ✅ CHANGED from weekly_marketing_funnels
      .select('user_id, report_month, report_year, week_number, source')
      .eq('user_id', user_id)
      .eq('report_month', month)
      .eq('report_year', normalizedYear)
      .limit(5)
    if (funnelAnyErr) console.warn('FUNNELS ANY query failed:', funnelAnyErr)

    // ---------------- Top clients ----------------
    let topClients: any[] = []

    if (type === 'weekly') {
      if (effectiveWeekNumber == null) {
        throw new Error('effectiveWeekNumber is null for weekly top clients')
      }
      const { data, error } = await supabase
        .from('weekly_top_clients')
        .select('*')
        .eq('user_id', user_id)
        .eq('month', month)
        .eq('year', normalizedYear)
        .eq('week_number', effectiveWeekNumber)
        .order('total_paid', { ascending: false })
      if (error) throw error
      topClients = data ?? []

    } else if (type === 'weekly_comparison') {
      let q = supabase
        .from('weekly_top_clients')
        .select('*')
        .eq('user_id', user_id)
        .eq('month', month)
        .eq('year', normalizedYear)

      if (week_number != null) q = q.lte('week_number', week_number)

      const { data, error } = await q
        .order('week_number', { ascending: true })
        .order('total_paid', { ascending: false })

      if (error) throw error
      topClients = data ?? []
    } else {
      const { data, error } = await supabase
        .from('report_top_clients')
        .select('*')
        .eq('user_id', user_id)
        .eq('month', month)
        .eq('year', normalizedYear)
        .order('total_paid', { ascending: false })
      if (error) throw error
      topClients = data ?? []
    }

    // ---------------- Expenses (weekly comparison) ----------------
    const numericMonth = MONTH_MAP[month]
    const startOfMonth = new Date(normalizedYear, numericMonth - 1, 1)
    const endOfMonth = new Date(normalizedYear, numericMonth, 0)

    let weeklyExpensesData: any
    if (type === 'weekly_comparison') {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('*')
        .eq('user_id', user_id)
        .lte('start_date', endOfMonth.toISOString())
        .or(`end_date.is.null,end_date.gte.${startOfMonth.toISOString()}`)

      if (error) {
        console.error('Error fetching recurring expenses:', error)
        weeklyExpensesData = undefined
      } else {
        weeklyExpensesData = getWeeklyBreakdown(data, normalizedYear, numericMonth)
      }
    } else if (type === 'weekly') {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('*')
        .eq('user_id', user_id)
        .lte('start_date', endOfMonth.toISOString())
        .or(`end_date.is.null,end_date.gte.${startOfMonth.toISOString()}`)

      if (error) {
        console.error('Error fetching recurring expenses:', error)
        weeklyExpensesData = undefined
      } else {
        const allWeeks = getWeeklyBreakdown(data, normalizedYear, numericMonth)
        weeklyExpensesData = (week_number && allWeeks[week_number]?.total) || 0
      }
    }
    console.log(weeklyExpensesData)

    // ✅ FIX: week_number in dataset must be correct + consistent
    const datasetWeekNumber =
      type === 'weekly'
        ? effectiveWeekNumber
        : type === 'weekly_comparison'
          ? week_number ?? null
          : null

    console.log(userData.special_access)

    const dataset = {
      month,
      year: normalizedYear,
      week_number: datasetWeekNumber,
      user_name: userName,
      summary: summaryData,
      weekly_rows,
      services,
      services_percentage,
      marketing_funnels: funnels,
      top_clients: topClients,
      weeklyExpensesData,
      special_access: userData.special_access,
      ...(barber_type === 'commission' && { commission_rate: commissionRate }),
    }

    const promptKey = `${type}/${barber_type}`
    const promptTemplate =
      prompts[promptKey as keyof typeof prompts] || prompts['monthly/rental']

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.5,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert analytics report writer specializing in barbershop business performance summaries.',
        },
        { role: 'user', content: promptTemplate(dataset, userName, month, normalizedYear) },
      ],
    })

    const htmlReport = response.choices?.[0]?.message?.content?.trim() || ''

    const { data: newReport, error: insertError } = await supabase
      .from('reports')
      .insert({
        user_id,
        type,
        barber_type,
        month,
        week_number: dataset.week_number,
        year: normalizedYear,
        content: htmlReport,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (insertError) throw insertError

    const formatType = (str: string) =>
      str
        .split('_')
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' ')
    const formattedType = formatType(type)

    let message = ''
    if (type === 'monthly') {
      message = `Your ${formattedType} report has been generated for ${month} ${normalizedYear}.`
    } else if (type === 'weekly' || type === 'weekly_comparison') {
      const week = dataset.week_number
      if (week != null) {
        const suffix =
          week === 1 ? 'st' : week === 2 ? 'nd' : week === 3 ? 'rd' : 'th'
        message = `Your ${formattedType} report has been generated for the ${week}${suffix} week of ${month} ${normalizedYear}.`
      } else {
        message = `Your ${formattedType} report has been generated for the weeks of ${month} ${normalizedYear}.`
      }
    }

    const { error: notifError } = await supabase.from('notifications').insert({
      user_id,
      header: `${formattedType} report generated`,
      message,
      reference: newReport.id,
      reference_type: type,
    })
    if (notifError) throw notifError

    notifyUserAboutReport(
      user_id,
      newReport.id,
      type,
      `${formattedType} report generated`,
      supabase,
    )

    return NextResponse.json({ success: true, report: newReport })
  } catch (err: any) {
    console.error('❌ Report generation error:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Unknown error' },
      { status: 500 },
    )
  }
}