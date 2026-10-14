/**
 * routes/managementReports.js
 * WowMyFlight CRM — Phase 3: Management Reports REST API
 * Route Name Matches Menu: "Management Reports" -> /api/management-reports
 */

const express = require('express');
const router = express.Router();

const REPORT_DATA = {
  MONTHLY: {
    kpis: [
      { id: 'leads', title: 'Total Leads', value: '12,450 Leads', change: '+14% MoM', color: '#6366F1' },
      { id: 'bookings', title: 'Total Bookings', value: '1,840 Bookings', change: '+18% MoM', color: '#2563EB' },
      { id: 'revenue', title: 'Total Revenue', value: '$1,420,000', change: '+$142k this month', color: '#10B981' },
      { id: 'profit', title: 'Gross Profit', value: '$184,500', change: '13.0% margin', color: '#D97706' },
      { id: 'conv', title: 'Conversion Rate', value: '14.8%', change: '+1.4% target', color: '#8B5CF6' },
      { id: 'avgValue', title: 'Avg Booking Value', value: '$771', change: 'Per ticket avg', color: '#0284C7' },
      { id: 'pending', title: 'Pending Payments', value: '$42,800', change: 'In clearing queue', color: '#F59E0B' },
      { id: 'refund', title: 'Refund Amount', value: '$8,200', change: '12 approved cases', color: '#EF4444' },
      { id: 'cancel', title: 'Cancellation Rate', value: '1.2%', change: 'Industry low', color: '#10B981' }
    ],
    revenueTrend: [
      { month: 'Jan', revenue: 98000, profit: 12800 },
      { month: 'Feb', revenue: 110000, profit: 14500 },
      { month: 'Mar', revenue: 125000, profit: 16200 },
      { month: 'Apr', revenue: 118000, profit: 15400 },
      { month: 'May', revenue: 142000, profit: 18500 },
      { month: 'Jun', revenue: 165000, profit: 21800 }
    ],
    agentLeaderboard: [
      { rank: 1, name: 'Sarah Jenkins', calls: 450, talkTime: '18h 30m', leads: 280, quotes: 84, bookings: 42, conv: '15.0%', revenue: '$145,000', profit: '$18,200' },
      { rank: 2, name: 'Alex Miller', calls: 410, talkTime: '16h 45m', leads: 240, quotes: 72, bookings: 36, conv: '15.0%', revenue: '$128,000', profit: '$16,100' },
      { rank: 3, name: 'David Ross', calls: 380, talkTime: '14h 10m', leads: 210, quotes: 60, bookings: 28, conv: '13.3%', revenue: '$98,000', profit: '$12,400' },
      { rank: 4, name: 'Sofia Rodriguez', calls: 430, talkTime: '17h 20m', leads: 260, quotes: 78, bookings: 38, conv: '14.6%', revenue: '$132,000', profit: '$16,800' }
    ]
  },
  WEEKLY: {
    kpis: [
      { id: 'leads', title: 'Total Leads', value: '3,120 Leads', change: '+6% WoW', color: '#6366F1' },
      { id: 'bookings', title: 'Total Bookings', value: '460 Bookings', change: '+8% WoW', color: '#2563EB' },
      { id: 'revenue', title: 'Total Revenue', value: '$355,000', change: '+$35k vs last week', color: '#10B981' },
      { id: 'profit', title: 'Gross Profit', value: '$46,200', change: '13.0% margin', color: '#D97706' },
      { id: 'conv', title: 'Conversion Rate', value: '14.7%', change: '+0.5% WoW', color: '#8B5CF6' },
      { id: 'avgValue', title: 'Avg Booking Value', value: '$772', change: 'Per ticket avg', color: '#0284C7' },
      { id: 'pending', title: 'Pending Payments', value: '$11,200', change: 'In clearing queue', color: '#F59E0B' },
      { id: 'refund', title: 'Refund Amount', value: '$2,100', change: '3 approved cases', color: '#EF4444' },
      { id: 'cancel', title: 'Cancellation Rate', value: '1.1%', change: 'Industry low', color: '#10B981' }
    ],
    revenueTrend: [
      { month: 'Mon', revenue: 48000, profit: 6200 },
      { month: 'Tue', revenue: 52000, profit: 6800 },
      { month: 'Wed', revenue: 58000, profit: 7500 },
      { month: 'Thu', revenue: 61000, profit: 7900 },
      { month: 'Fri', revenue: 68000, profit: 8900 },
      { month: 'Sat', revenue: 68000, profit: 8900 }
    ],
    agentLeaderboard: [
      { rank: 1, name: 'Sarah Jenkins', calls: 110, talkTime: '4h 40m', leads: 70, quotes: 21, bookings: 11, conv: '15.7%', revenue: '$38,000', profit: '$4,800' },
      { rank: 2, name: 'Alex Miller', calls: 102, talkTime: '4h 15m', leads: 60, quotes: 18, bookings: 9, conv: '15.0%', revenue: '$32,000', profit: '$4,100' }
    ]
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/management-reports
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const range = (req.query.range || 'MONTHLY').toUpperCase();
  const selected = REPORT_DATA[range] || REPORT_DATA.MONTHLY;

  res.json({
    success: true,
    range,
    data: selected
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST /api/management-reports/export
// ─────────────────────────────────────────────────────────────────────────────
router.post('/export', (req, res) => {
  const { format = 'csv', range = 'MONTHLY' } = req.body;
  const selected = REPORT_DATA[range.toUpperCase()] || REPORT_DATA.MONTHLY;

  res.json({
    success: true,
    message: `Report exported successfully in ${format.toUpperCase()} format`,
    downloadUrl: `https://reports.wowmyflight.com/exports/wmf_report_${range.toLowerCase()}_${Date.now()}.${format}`,
    summary: {
      generatedAt: new Date().toISOString(),
      format,
      recordsCount: selected.agentLeaderboard.length,
      totalRevenue: selected.kpis.find(k => k.id === 'revenue')?.value
    }
  });
});

module.exports = router;
