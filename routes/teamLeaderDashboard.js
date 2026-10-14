/**
 * routes/teamLeaderDashboard.js
 * WowMyFlight CRM — Phase 3: Team Leader Dashboard REST API
 * Route Name Matches Menu: "Team Leader Dashboard" -> /api/team-leader-dashboard
 */

const express = require('express');
const router = express.Router();

// Initial In-Memory State
let KPIS = [
  { id: 'leads', title: 'Team Leads', value: '482', change: '+14% vs last week', isUp: true, color: '#E8EAF6' },
  { id: 'bookings', title: 'Team Bookings', value: '128', change: '+9% vs last week', isUp: true, color: '#ECFDF5' },
  { id: 'revenue', title: 'Team Revenue', value: '$342,850', change: '+18% vs last week', isUp: true, color: '#FFFBEB' },
  { id: 'conversion', title: 'Conversion Rate', value: '26.5%', change: '+2.1% this month', isUp: true, color: '#EFF6FF' },
  { id: 'calls', title: 'Total Calls', value: '1,840', change: '+5% vs target', isUp: true, color: '#F5F3FF' },
  { id: 'talktime', title: 'Total Talk Time', value: '142h 30m', change: '+8% floor volume', isUp: true, color: '#FEF3C7' },
  { id: 'followups', title: 'Pending Follow-ups', value: '34', change: '-12% overdue backlog', isUp: false, color: '#FEF2F2' },
  { id: 'sla', title: 'SLA Compliance', value: '96.4%', change: '+1.5% on-time responses', isUp: true, color: '#ECFDF5' },
  { id: 'qa', title: 'Booking QA Score', value: '94.2%', change: '+3.0% audit accuracy', isUp: true, color: '#EFF6FF' },
  { id: 'revPerAgent', title: 'Revenue per Agent', value: '$42,856', change: '+15% avg per rep', isUp: true, color: '#E8EAF6' },
  { id: 'bookPerAgent', title: 'Bookings per Agent', value: '16.0', change: '+10% deals closed', isUp: true, color: '#FFFBEB' }
];

let AGENTS = [
  { id: 'AGT-01', name: 'Sarah Jenkins', role: 'Senior Flight Specialist', assignedLeads: 64, activeBookings: 18, revenue: 48200, conversion: 28.1, callsCompleted: 245, talkTime: '19h 40m', pendingFollowups: 3, qaScore: 98, slaStatus: 'On Track', badge: 'Top Performer', status: 'ON CALL' },
  { id: 'AGT-02', name: 'Alex Miller', role: 'Corporate Sales Agent', assignedLeads: 58, activeBookings: 16, revenue: 42600, conversion: 27.5, callsCompleted: 210, talkTime: '18h 10m', pendingFollowups: 4, qaScore: 95, slaStatus: 'On Track', badge: 'Top Performer', status: 'ON CALL' },
  { id: 'AGT-03', name: 'Sofia Rodriguez', role: 'Flight Consultant', assignedLeads: 52, activeBookings: 14, revenue: 38900, conversion: 26.9, callsCompleted: 195, talkTime: '16h 50m', pendingFollowups: 2, qaScore: 96, slaStatus: 'On Track', badge: 'Consistent', status: 'AVAILABLE' },
  { id: 'AGT-04', name: 'Michael Chang', role: 'Luxury Travel Expert', assignedLeads: 50, activeBookings: 13, revenue: 36200, conversion: 26.0, callsCompleted: 190, talkTime: '15h 45m', pendingFollowups: 3, qaScore: 94, slaStatus: 'On Track', badge: 'Consistent', status: 'AVAILABLE' },
  { id: 'AGT-05', name: 'David Ross', role: 'Sales Executive', assignedLeads: 46, activeBookings: 11, revenue: 31400, conversion: 23.9, callsCompleted: 180, talkTime: '14h 20m', pendingFollowups: 5, qaScore: 91, slaStatus: 'At Risk', badge: 'Consistent', status: 'WRAP UP' },
  { id: 'AGT-06', name: 'Emily Watson', role: 'Ticketing & Sales Agent', assignedLeads: 44, activeBookings: 10, revenue: 29800, conversion: 22.7, callsCompleted: 170, talkTime: '14h 00m', pendingFollowups: 4, qaScore: 92, slaStatus: 'On Track', badge: 'Consistent', status: 'ON CALL' },
  { id: 'AGT-07', name: 'Rita Verma', role: 'Junior Flight Consultant', assignedLeads: 42, activeBookings: 9, revenue: 26500, conversion: 21.4, callsCompleted: 165, talkTime: '13h 10m', pendingFollowups: 6, qaScore: 88, slaStatus: 'Needs Coaching', badge: 'Needs Coaching', status: 'ON BREAK' },
  { id: 'AGT-08', name: 'James Cooper', role: 'Trainee Sales Specialist', assignedLeads: 38, activeBookings: 7, revenue: 21100, conversion: 18.4, callsCompleted: 145, talkTime: '11h 25m', pendingFollowups: 7, qaScore: 85, slaStatus: 'Breached', badge: 'Needs Coaching', status: 'IDLE' }
];

let FLOOR_MONITORING = [
  { id: 'AGT-01', name: 'Sarah Jenkins', status: 'ON CALL', timeOnStatus: '14:20 min', currentLead: 'Karan S. (DEL → LHR)', todayCalls: 38, todayBookings: 3, followupsDue: 2, qaPct: 98, color: 'success' },
  { id: 'AGT-02', name: 'Alex Miller', status: 'ON CALL', timeOnStatus: '08:45 min', currentLead: 'Michael C. (JFK → LHR)', todayCalls: 32, todayBookings: 2, followupsDue: 3, qaPct: 95, color: 'success' },
  { id: 'AGT-03', name: 'Sofia Rodriguez', status: 'AVAILABLE', timeOnStatus: '03:10 min', currentLead: 'Ready for Next Inbound', todayCalls: 29, todayBookings: 2, followupsDue: 1, qaPct: 96, color: 'info' },
  { id: 'AGT-04', name: 'Michael Chang', status: 'AVAILABLE', timeOnStatus: '05:40 min', currentLead: 'Ready for Next Inbound', todayCalls: 28, todayBookings: 2, followupsDue: 2, qaPct: 94, color: 'info' },
  { id: 'AGT-05', name: 'David Ross', status: 'WRAP UP', timeOnStatus: '02:15 min', currentLead: 'Ankit S. (DEL → DXB) Notes', todayCalls: 25, todayBookings: 1, followupsDue: 4, qaPct: 91, color: 'warning' },
  { id: 'AGT-06', name: 'Emily Watson', status: 'ON CALL', timeOnStatus: '11:30 min', currentLead: 'Priya P. (BOM → SIN)', todayCalls: 24, todayBookings: 1, followupsDue: 3, qaPct: 92, color: 'success' },
  { id: 'AGT-07', name: 'Rita Verma', status: 'ON BREAK', timeOnStatus: '18:50 min', currentLead: 'Lunch Break (15m elapsed)', todayCalls: 22, todayBookings: 1, followupsDue: 5, qaPct: 88, color: 'default' },
  { id: 'AGT-08', name: 'James Cooper', status: 'IDLE', timeOnStatus: '09:20 min', currentLead: 'Reviewing Fare Rules', todayCalls: 18, todayBookings: 0, followupsDue: 6, qaPct: 85, color: 'error' }
];

let LEADS = [
  { id: 'LD-1001', customerName: 'Rajesh Sharma', destination: 'DEL → LHR', travelDate: '2026-10-15', priority: 'VIP', assignedAgent: 'Unassigned', status: 'Unassigned', source: 'Google Ads', pax: 2 },
  { id: 'LD-1002', customerName: 'Elena Petrova', destination: 'JFK → CDG', travelDate: '2026-09-20', priority: 'High', assignedAgent: 'Sarah Jenkins', status: 'In Progress', source: 'Meta Inbound', pax: 1 },
  { id: 'LD-1003', customerName: 'Carlos Rivera', destination: 'MIA → MAD', travelDate: '2026-11-05', priority: 'Normal', assignedAgent: 'Alex Miller', status: 'Contacted', source: 'Website Organic', pax: 3 },
  { id: 'LD-1004', customerName: 'Aisha Al-Mansoor', destination: 'DXB → LHR', travelDate: '2026-10-02', priority: 'VIP', assignedAgent: 'Unassigned', status: 'Unassigned', source: 'Referral', pax: 4 },
  { id: 'LD-1005', customerName: 'Vikram Mehta', destination: 'BOM → JFK', travelDate: '2026-12-18', priority: 'High', assignedAgent: 'Sofia Rodriguez', status: 'Quoted', source: 'Google Ads', pax: 2 },
  { id: 'LD-1006', customerName: 'David Zhang', destination: 'SFO → NRT', travelDate: '2026-09-30', priority: 'Urgent', assignedAgent: 'Unassigned', status: 'Unassigned', source: 'Google Ads', pax: 1 },
  { id: 'LD-1007', customerName: 'Samantha Green', destination: 'LHR → SYD', travelDate: '2026-11-12', priority: 'Normal', assignedAgent: 'Rita Verma', status: 'Stalled', source: 'Meta Inbound', pax: 2 },
  { id: 'LD-1008', customerName: 'Liam Johnson', destination: 'ORD → FCO', travelDate: '2026-10-25', priority: 'High', assignedAgent: 'James Cooper', status: 'Stalled', source: 'Website Organic', pax: 2 }
];

let APPROVALS = [
  { id: 'APP-101', bookingId: 'BK-9912', customer: 'Karan Singh', agent: 'Sofia Rodriguez', sector: 'DEL → LHR', pax: 2, cabin: 'Business', originalPrice: 2500, requestedDiscount: 150, finalPrice: 2350, marginAfterDiscount: 280, reason: 'Client has competing quote from Expedia. Ready to pay immediately if we match.', status: 'Pending' },
  { id: 'APP-102', bookingId: 'BK-9913', customer: 'Michael Chen', agent: 'Alex Miller', sector: 'JFK → LHR', pax: 1, cabin: 'First', originalPrice: 4800, requestedDiscount: 200, finalPrice: 4600, marginAfterDiscount: 450, reason: 'Repeat corporate flyer requesting waiver on service fee for expedited issuance.', status: 'Pending' },
  { id: 'APP-103', bookingId: 'BK-9914', customer: 'Jessica Alba', agent: 'David Ross', sector: 'LAX → HND', pax: 3, cabin: 'Premium Economy', originalPrice: 3900, requestedDiscount: 250, finalPrice: 3650, marginAfterDiscount: 210, reason: 'Family group booking, requesting group discount coupon code application.', status: 'Pending' }
];

let ESCALATIONS = [
  { id: 'ESC-401', leadName: 'Arthur Dent', assignedAgent: 'James Cooper', reason: 'SLA Response Breached (> 4 hours with no callback on business quote)', priority: 'Critical', date: '2026-08-20', status: 'Open', notes: 'Customer called helpline complaining about delayed itinerary proposal.' },
  { id: 'ESC-402', leadName: 'Fatima Zahra', assignedAgent: 'Rita Verma', reason: 'Competitor Price Mismatch & Missing Baggage Allowance Explanation', priority: 'High', date: '2026-08-20', status: 'Open', notes: 'Agent quoted non-baggage fare without explaining upgrade option.' },
  { id: 'ESC-403', leadName: 'George Clooney', assignedAgent: 'David Ross', reason: 'Complex Multi-City Segment Routing GDS Availability Error', priority: 'Medium', date: '2026-08-19', status: 'In Review', notes: 'Needs Senior Flight Specialist to rebuild married segment logic.' }
];

let COACHING = [
  { id: 'COACH-01', agent: 'Rita Verma', date: '2026-08-19', topic: 'Baggage Allowance & Fare Rules Briefing', mistakeType: 'Fare Rule Miscommunication', scoreImpact: '-8% QA', status: 'Completed', notes: 'Coached on verifying baggage inclusions in Sabre before quoting economy saver fares.' },
  { id: 'COACH-02', agent: 'James Cooper', date: '2026-08-18', topic: 'SLA Callback Follow-up Discipline', mistakeType: 'Delayed Follow-up', scoreImpact: '-12% SLA', status: 'In Progress', notes: 'Agent provided calendar notification templates to avoid missing scheduled call slots.' },
  { id: 'COACH-03', agent: 'David Ross', date: '2026-08-17', topic: 'Upsell Engine Usage on Premium Cabins', mistakeType: 'Missed Upsell Opportunity', scoreImpact: '-$400 Margin', status: 'Completed', notes: 'Reviewed luxury hotel add-on prompts during business class flight booking.' }
];

let PENDING_PAYMENTS = [
  { id: 'PAY-801', customer: 'John Smith', bookingId: 'BK-10231', totalAmount: 1850, paidAmount: 850, pendingAmount: 1000, dueDate: '2026-08-20', status: 'Due Today', agent: 'Sarah Jenkins' },
  { id: 'PAY-802', customer: 'Elena Rostova', bookingId: 'BK-10232', totalAmount: 3200, paidAmount: 0, pendingAmount: 3200, dueDate: '2026-08-18', status: 'Overdue', agent: 'James Cooper' },
  { id: 'PAY-803', customer: 'David Becker', bookingId: 'BK-10233', totalAmount: 4500, paidAmount: 2000, pendingAmount: 2500, dueDate: '2026-08-25', status: 'Upcoming', agent: 'Alex Miller' },
  { id: 'PAY-804', customer: 'Aisha Khan', bookingId: 'BK-10234', totalAmount: 2800, paidAmount: 2800, pendingAmount: 0, dueDate: '2026-08-19', status: 'Paid', agent: 'Sofia Rodriguez' }
];

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/team-leader-dashboard
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      kpis: KPIS,
      agents: AGENTS,
      floorAgents: FLOOR_MONITORING,
      leads: LEADS,
      approvals: APPROVALS,
      escalations: ESCALATIONS,
      coachingList: COACHING,
      pendingPayments: PENDING_PAYMENTS
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Discount Approvals & Counters
// ─────────────────────────────────────────────────────────────────────────────
router.post('/approvals/:id/approve', (req, res) => {
  const { id } = req.params;
  const item = APPROVALS.find(a => a.id === id);
  if (!item) return res.status(404).json({ success: false, error: 'Approval request not found' });
  item.status = 'Approved';
  res.json({ success: true, message: `Discount approved for ${item.customer}`, data: item });
});

router.post('/approvals/:id/reject', (req, res) => {
  const { id } = req.params;
  const item = APPROVALS.find(a => a.id === id);
  if (!item) return res.status(404).json({ success: false, error: 'Approval request not found' });
  item.status = 'Rejected';
  res.json({ success: true, message: `Discount rejected for ${item.customer}`, data: item });
});

router.post('/approvals/:id/counter', (req, res) => {
  const { id } = req.params;
  const { counterAmount } = req.body;
  const item = APPROVALS.find(a => a.id === id);
  if (!item) return res.status(404).json({ success: false, error: 'Approval request not found' });
  item.status = `Counter $${counterAmount}`;
  item.finalPrice = item.originalPrice - Number(counterAmount || 0);
  res.json({ success: true, message: `Counter offer $${counterAmount} submitted for ${item.customer}`, data: item });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Lead Assignment & Bulk Distribution
// ─────────────────────────────────────────────────────────────────────────────
router.post('/leads/assign', (req, res) => {
  const { leadId, agentName } = req.body;
  const lead = LEADS.find(l => l.id === leadId);
  if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });
  lead.assignedAgent = agentName;
  lead.status = 'In Progress';
  res.json({ success: true, message: `Lead ${leadId} assigned to ${agentName}`, data: lead });
});

router.post('/leads/distribute', (req, res) => {
  const { source = 'All Inbound', strategy = 'Round Robin' } = req.body;
  const activeAgentNames = AGENTS.filter(a => a.status !== 'ON BREAK' && a.status !== 'IDLE').map(a => a.name);
  let count = 0;
  LEADS.forEach((l, idx) => {
    if (l.assignedAgent === 'Unassigned') {
      const assigned = activeAgentNames[idx % (activeAgentNames.length || 1)] || 'Sarah Jenkins';
      l.assignedAgent = assigned;
      l.status = 'In Progress';
      count++;
    }
  });
  res.json({ success: true, message: `Distributed ${count} unassigned leads across team (${strategy})`, data: LEADS });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Coaching & Mentoring
// ─────────────────────────────────────────────────────────────────────────────
router.post('/coaching', (req, res) => {
  const { agent, topic, notes, mistakeType, scoreImpact } = req.body;
  const newCoach = {
    id: `COACH-${String(COACHING.length + 1).padStart(2, '0')}`,
    agent: agent || 'Rita Verma',
    date: new Date().toISOString().split('T')[0],
    topic: topic || 'Sales Skill Enhancement',
    mistakeType: mistakeType || 'General Coaching',
    scoreImpact: scoreImpact || '-5% QA',
    status: 'In Progress',
    notes: notes || 'Scheduled mentoring session.'
  };
  COACHING.unshift(newCoach);
  res.json({ success: true, message: `Coaching scheduled for ${newCoach.agent}`, data: newCoach });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Escalation Resolution
// ─────────────────────────────────────────────────────────────────────────────
router.post('/escalations/:id/resolve', (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;
  const esc = ESCALATIONS.find(e => e.id === id);
  if (!esc) return res.status(404).json({ success: false, error: 'Escalation not found' });
  esc.status = 'Resolved';
  if (notes) esc.notes = `${esc.notes} | Resolved: ${notes}`;
  res.json({ success: true, message: `Escalation ${id} resolved`, data: esc });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Payment Reminders
// ─────────────────────────────────────────────────────────────────────────────
router.post('/payments/:id/remind', (req, res) => {
  const { id } = req.params;
  const { channel = 'WhatsApp' } = req.body;
  const pay = PENDING_PAYMENTS.find(p => p.id === id);
  if (!pay) return res.status(404).json({ success: false, error: 'Payment not found' });
  res.json({ success: true, message: `${channel} payment reminder dispatched to ${pay.customer} for $${pay.pendingAmount}` });
});

module.exports = router;
