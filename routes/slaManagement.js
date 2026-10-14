/**
 * routes/slaManagement.js
 * WowMyFlight CRM — Phase 3: SLA Management REST API
 * Route Name Matches Menu: "SLA Management" -> /api/sla-management
 */

const express = require('express');
const router = express.Router();

let SLA_KPIS = [
  { id: 'activeSla', title: 'Total Active SLAs', value: '42 Active', change: 'Live countdowns', color: '#6366F1' },
  { id: 'completedOnTime', title: 'Completed On Time', value: '1,280 SLAs', change: '96.4% on-time', color: '#10B981' },
  { id: 'approaching', title: 'Approaching Deadline', value: '8 SLAs', change: '< 2m remaining', color: '#F59E0B' },
  { id: 'breached', title: 'SLA Breached', value: '3 Breaches', change: 'Escalated to TL', color: '#EF4444' },
  { id: 'avgResponse', title: 'Avg Response Time', value: '3m 12s', change: 'Target < 5m', color: '#0284C7' },
  { id: 'avgTicketing', title: 'Avg Ticketing Time', value: '6m 45s', change: 'Target < 10m', color: '#8B5CF6' },
  { id: 'slaCompliance', title: 'SLA Compliance %', value: '96.4%', change: '+1.2% this week', color: '#D97706' }
];

let SLA_RULES = [
  { id: 'RULE-1', event: 'New Lead Created', targetText: 'First Contact within 5 Minutes', targetMinutes: 5, agentAlert: 'At 3 Minutes', tlAlert: 'At 5 Minutes', expertTlEscalation: 'If unresolved after 10m', priority: 'Standard', status: 'Active' },
  { id: 'RULE-2', event: 'High-Value Lead ($10k+)', targetText: 'First Contact within 2 Minutes', targetMinutes: 2, agentAlert: 'At 1 Minute', tlAlert: 'At 2 Minutes', expertTlEscalation: 'Immediate Red Alert', priority: 'Critical Red', status: 'Active' },
  { id: 'RULE-3', event: 'Payment Received', targetText: 'Ticketing within 10 Minutes', targetMinutes: 10, agentAlert: 'At 8 Minutes', tlAlert: 'At 10 Minutes', expertTlEscalation: 'Escalate pending GDS PNR', priority: 'High Priority', status: 'Active' },
  { id: 'RULE-4', event: 'Customer Request / Inquiry', targetText: 'Response within 15 Minutes', targetMinutes: 15, agentAlert: 'At 10 Minutes', tlAlert: 'At 15 Minutes', expertTlEscalation: 'Escalate to Concierge Desk', priority: 'Standard', status: 'Active' }
];

let ACTIVE_SLA_TRACKER = [
  { id: 'SLA-801', customerName: 'Dr. Harrison Wells', leadBookingId: 'LD-99120', type: 'High-Value Lead', agent: 'Sarah Jenkins', tl: 'Michael Chang', startTime: '14:20:10', deadlineTime: '14:22:10', remaining: '1m 15s remaining', priority: 'Critical Red', status: 'On Time', color: '#10B981', bg: 'rgba(16, 185, 129, 0.08)' },
  { id: 'SLA-802', customerName: 'Elena Rostova', leadBookingId: 'BK-10912', type: 'Payment Received (Ticketing)', agent: 'Alex Miller', tl: 'Sofia Rodriguez', startTime: '14:14:00', deadlineTime: '14:24:00', remaining: '1m 45s remaining', priority: 'High Priority', status: 'Warning', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.08)' },
  { id: 'SLA-803', customerName: 'Marcus Sterling', leadBookingId: 'LD-98440', type: 'New Lead', agent: 'David Ross', tl: 'Michael Chang', startTime: '13:45:00', deadlineTime: '13:50:00', remaining: 'Expired (Breached 32m ago)', priority: 'Standard', status: 'SLA Breached', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.08)' },
  { id: 'SLA-804', customerName: 'Ambassador Harold Vance', leadBookingId: 'BK-10892', type: 'Customer Request', agent: 'Sarah Jenkins', tl: 'Michael Chang', startTime: '14:15:00', deadlineTime: '14:30:00', remaining: '7m 45s remaining', priority: 'High Priority', status: 'On Time', color: '#10B981', bg: 'rgba(16, 185, 129, 0.08)' }
];

let SLA_ALERTS = [
  { id: 'ALT-101', type: 'SLA Breached', leadId: 'LD-98440', customer: 'Marcus Sterling', agent: 'David Ross', tl: 'Michael Chang', escalationLevel: 'Expert Team Leader Notified', time: '13:50:05', message: 'New Lead SLA 5m breached. Case escalated to Expert TL.' },
  { id: 'ALT-102', type: 'Approaching Deadline', leadId: 'BK-10912', customer: 'Elena Rostova', agent: 'Alex Miller', tl: 'Sofia Rodriguez', escalationLevel: 'Team Leader Warning', time: '14:22:15', message: 'Payment Ticketing SLA has less than 2 minutes remaining.' }
];

let AGENT_COMPLIANCE = [
  { name: 'Sarah Jenkins', compliance: 98.5, avgTime: '2m 10s', onTime: 420, breached: 6 },
  { name: 'Alex Miller', compliance: 96.2, avgTime: '3m 40s', onTime: 380, breached: 15 },
  { name: 'David Ross', compliance: 94.1, avgTime: '4m 15s', onTime: 310, breached: 19 },
  { name: 'Sofia Rodriguez', compliance: 97.8, avgTime: '2m 45s', onTime: 395, breached: 9 }
];

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/sla-management
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      kpis: SLA_KPIS,
      rules: SLA_RULES,
      activeTracker: ACTIVE_SLA_TRACKER,
      alerts: SLA_ALERTS,
      agentCompliance: AGENT_COMPLIANCE
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. PUT /api/sla-management/rules/:id
// ─────────────────────────────────────────────────────────────────────────────
router.put('/rules/:id', (req, res) => {
  const { id } = req.params;
  const { targetMinutes, priority, status } = req.body;
  const rule = SLA_RULES.find(r => r.id === id);
  if (!rule) return res.status(404).json({ success: false, error: 'SLA Rule not found' });

  if (targetMinutes !== undefined) {
    rule.targetMinutes = Number(targetMinutes);
    rule.targetText = `First Contact within ${targetMinutes} Minutes`;
  }
  if (priority !== undefined) rule.priority = priority;
  if (status !== undefined) rule.status = status;

  res.json({ success: true, message: `SLA Rule ${id} updated`, data: rule });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /api/sla-management/alerts/:id/resolve
// ─────────────────────────────────────────────────────────────────────────────
router.post('/alerts/:id/resolve', (req, res) => {
  const { id } = req.params;
  const idx = SLA_ALERTS.findIndex(a => a.id === id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Alert not found' });
  const removed = SLA_ALERTS.splice(idx, 1)[0];
  res.json({ success: true, message: `Alert ${id} acknowledged and resolved`, data: removed });
});

router.delete('/alerts/:id', (req, res) => {
  const { id } = req.params;
  const idx = SLA_ALERTS.findIndex(a => a.id === id);
  if (idx !== -1) SLA_ALERTS.splice(idx, 1);
  res.json({ success: true, message: `Alert ${id} deleted` });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. POST /api/sla-management/tracker
// ─────────────────────────────────────────────────────────────────────────────
router.post('/tracker', (req, res) => {
  const b = req.body || {};
  const newItem = {
    id: `SLA-${Math.floor(800 + Math.random() * 200)}`,
    customerName: b.customerName || 'Customer',
    leadBookingId: b.leadBookingId || 'LD-NEW',
    type: b.type || 'New Lead',
    agent: b.agent || 'Sarah Jenkins',
    tl: b.tl || 'Michael Chang',
    startTime: new Date().toTimeString().split(' ')[0],
    deadlineTime: b.deadlineTime || '15:00:00',
    remaining: b.remaining || '4m 30s remaining',
    priority: b.priority || 'Standard',
    status: 'On Time',
    color: '#10B981',
    bg: 'rgba(16, 185, 129, 0.08)'
  };
  ACTIVE_SLA_TRACKER.unshift(newItem);
  res.json({ success: true, message: 'New SLA tracker entry added', data: newItem });
});

module.exports = router;
