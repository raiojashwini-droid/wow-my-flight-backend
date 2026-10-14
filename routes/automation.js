/**
 * routes/automation.js
 * WowMyFlight CRM — Phase 3: Automation Engine REST API
 * Route Name Matches Menu: "Automation" -> /api/automation
 */

const express = require('express');
const router = express.Router();

let AUTOMATION_KPIS = [
  { id: 'activeWf', title: 'Active Workflows', value: '24 Flows', change: '+3 created today', color: '#6366F1' },
  { id: 'triggeredToday', title: 'Triggered Today', value: '1,840 Runs', change: '+14% execution', color: '#2563EB' },
  { id: 'pendingAuto', title: 'Pending Automations', value: '42 Runs', change: 'In delay queue', color: '#0284C7' },
  { id: 'failedAuto', title: 'Failed Automations', value: '3 Runs', change: 'Retry required', color: '#EF4444' },
  { id: 'slaBreaches', title: 'SLA Breaches', value: '2 Breaches', change: 'Alerts sent to TL', color: '#F59E0B' },
  { id: 'autoTasks', title: 'Auto Tasks Created', value: '640 Tasks', change: 'Follow-ups assigned', color: '#8B5CF6' },
  { id: 'smsSent', title: 'SMS Sent', value: '410 SMS', change: 'Delivery 99.1%', color: '#EC4899' },
  { id: 'emailsSent', title: 'Emails Sent', value: '1,280 Emails', change: 'Delivery 99.8%', color: '#10B981' },
  { id: 'waSent', title: 'WhatsApp Sent', value: '1,540 Msgs', change: 'Delivery 100%', color: '#059669' }
];

let WORKFLOWS = [
  {
    id: 'WF-EX-1',
    name: 'Workflow 1 – New Lead SLA Escalation Engine',
    trigger: 'New Lead Created in CRM',
    status: true,
    steps: [
      { step: 1, type: 'ACTION', text: 'Assign Lead to Sales Agent via Round-Robin' },
      { step: 2, type: 'ACTION', text: 'Notify Assigned Agent instantly via Push & In-App' },
      { step: 3, type: 'ACTION', text: 'Automatically create 2h Follow-up Task' },
      { step: 4, type: 'TIMER', text: 'Start SLA 2-Hour Response Timer' }
    ],
    escalationRules: [
      { rule: '2 Hours (No Contact)', action: 'Send SMS to Customer ("We received your flight request!")' },
      { rule: '24 Hours (No Contact)', action: 'Send Email Reminder to Customer with Top Deals' },
      { rule: '48 Hours (No Contact)', action: 'Alert Team Leader & Mark SLA Status as BREACHED' }
    ]
  },
  {
    id: 'WF-EX-2',
    name: 'Workflow 2 – Payment Pending Automation',
    trigger: 'Quote Accepted by Customer',
    status: true,
    steps: [
      { step: 1, type: 'ACTION', text: 'Generate Secure Online Payment Link' },
      { step: 2, type: 'ACTION', text: 'Send Payment Link via Email & WhatsApp' },
      { step: 3, type: 'TIMER', text: 'Start Payment Reminder Countdown Timer' }
    ],
    escalationRules: [
      { rule: 'After 30 Minutes', action: 'Send First Payment Reminder via WhatsApp' },
      { rule: 'After 2 Hours', action: 'Send Second Payment Reminder & Alert Assigned Agent' },
      { rule: 'Unpaid > 4 Hours', action: 'Escalate to Team Leader to prevent fare expiration' }
    ]
  },
  {
    id: 'WF-EX-3',
    name: 'Workflow 3 – Instant Booking Confirmation',
    trigger: 'Payment Successful (Gateway Webhook)',
    status: true,
    steps: [
      { step: 1, type: 'ACTION', text: 'Update Booking Status to CONFIRMED' },
      { step: 2, type: 'ACTION', text: 'Send Official Booking Confirmation Email' },
      { step: 3, type: 'ACTION', text: 'Send WhatsApp Confirmation with Booking Summary' },
      { step: 4, type: 'ACTION', text: 'Create Ticket Issuance Task & Alert Assigned Agent' }
    ],
    escalationRules: []
  },
  {
    id: 'WF-EX-4',
    name: 'Workflow 4 – Automated Ticket Issued Dispatch',
    trigger: 'Ticket Issued in Sabre / Amadeus GDS',
    status: true,
    steps: [
      { step: 1, type: 'ACTION', text: 'Email 13-Digit E-Ticket PDF to Customer' },
      { step: 2, type: 'ACTION', text: 'Send WhatsApp Ticket Copy with PNR Reference' },
      { step: 3, type: 'ACTION', text: 'Update Booking Status to TICKET ISSUED' },
      { step: 4, type: 'ACTION', text: 'Notify Customer & Assigned Agent' }
    ],
    escalationRules: []
  },
  {
    id: 'WF-EX-5',
    name: 'Workflow 5 – 24-Hour Pre-Departure Travel Reminder',
    trigger: '24 Hours Before Departure Date',
    status: true,
    steps: [
      { step: 1, type: 'ACTION', text: 'Send Pre-Flight Travel Checklist & Web Check-in Email' },
      { step: 2, type: 'ACTION', text: 'Send WhatsApp Alert with Terminal, Gate, and Baggage Rules' },
      { step: 3, type: 'ACTION', text: 'Alert Dedicated Concierge Desk' }
    ],
    escalationRules: []
  }
];

let SLA_LEADS = [
  { id: 'LD-99120', customer: 'Dr. Harrison Wells', destination: 'DEL → LHR', agent: 'Sarah Jenkins', stage: 'Stage 1 – Initial Callback', timeElapsed: '01h 14m', remaining: '46m left', status: 'On Track', color: 'success' },
  { id: 'LD-99121', customer: 'Elena Rostova', destination: 'JFK → CDG', agent: 'Alex Miller', stage: 'Stage 2 – SMS Follow-up Sent', timeElapsed: '22h 30m', remaining: '1h 30m left', status: 'Warning', color: 'warning' },
  { id: 'LD-99122', customer: 'Marcus Sterling', destination: 'MIA → MAD', agent: 'David Ross', stage: 'Stage 3 – Team Leader Alerted', timeElapsed: '49h 10m', remaining: 'Breached 1h ago', status: 'Breached', color: 'error' }
];

let NOTIFICATIONS = [
  { id: 'NOTIF-1', trigger: 'Quote Accepted', customer: 'Arthur Dent', channel: 'WhatsApp + Email', template: 'Payment Link Dispatch', status: 'Dispatched', time: '14:22:10' },
  { id: 'NOTIF-2', trigger: 'Ticket Issued (Sabre)', customer: 'Karan Singh', channel: 'Email (PDF Attached)', template: 'Official 13-Digit E-Ticket', status: 'Dispatched', time: '14:10:05' },
  { id: 'NOTIF-3', trigger: 'Pre-Departure (24h)', customer: 'Fatima Zahra', channel: 'WhatsApp', template: 'Pre-Flight Terminal Alert', status: 'Scheduled (Tomorrow 08:00)', time: 'Pending' }
];

let HISTORY_LOGS = [
  { id: 'HIS-901', workflow: 'Workflow 1 – New Lead SLA Escalation Engine', trigger: 'New Inbound Lead', customer: 'Rajesh Sharma', agent: 'Sarah Jenkins', action: 'Lead assigned via Round-Robin, 2h task created', timestamp: '2026-08-20 14:15', status: 'Success' },
  { id: 'HIS-902', workflow: 'Workflow 3 – Instant Booking Confirmation', trigger: 'Payment Webhook', customer: 'Carlos Rivera', agent: 'Sofia Rodriguez', action: 'Email & WhatsApp booking confirmation sent', timestamp: '2026-08-20 13:40', status: 'Success' },
  { id: 'HIS-903', workflow: 'Workflow 2 – Payment Pending Automation', trigger: 'Quote Accepted', customer: 'Elena Rostova', agent: 'Alex Miller', action: 'Payment link generated & sent via WhatsApp', timestamp: '2026-08-20 12:10', status: 'Success' },
  { id: 'HIS-904', workflow: 'Workflow 5 – 24-Hour Pre-Departure Travel Reminder', trigger: '24h Before Travel', customer: 'Arthur Pendelton', agent: 'David Ross', action: 'WhatsApp dispatch failed (Invalid Phone Format)', timestamp: '2026-08-20 12:05', status: 'Failed' }
];

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/automation
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      kpis: AUTOMATION_KPIS,
      workflows: WORKFLOWS,
      slaLeads: SLA_LEADS,
      notifications: NOTIFICATIONS,
      historyLogs: HISTORY_LOGS
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST /api/automation/workflows (Create)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/workflows', (req, res) => {
  const { name, trigger, steps, escalationRules } = req.body;
  if (!name) return res.status(400).json({ success: false, error: 'Workflow name required' });

  const newFlow = {
    id: `WF-CUSTOM-${Math.floor(100 + Math.random() * 900)}`,
    name,
    trigger: trigger || 'New Lead Created',
    status: true,
    steps: steps || [
      { step: 1, type: 'ACTION', text: 'Send Automated Email & WhatsApp Dispatch' },
      { step: 2, type: 'ACTION', text: 'Assign Follow-up Task to Agent' }
    ],
    escalationRules: escalationRules || []
  };

  WORKFLOWS.unshift(newFlow);
  res.json({ success: true, message: `Workflow "${name}" created and activated!`, data: newFlow });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. PUT /api/automation/workflows/:id/toggle
// ─────────────────────────────────────────────────────────────────────────────
router.put('/workflows/:id/toggle', (req, res) => {
  const { id } = req.params;
  const wf = WORKFLOWS.find(w => w.id === id);
  if (!wf) return res.status(404).json({ success: false, error: 'Workflow not found' });
  wf.status = !wf.status;
  res.json({ success: true, message: `Workflow "${wf.name}" is now ${wf.status ? 'ACTIVE' : 'PAUSED'}`, data: wf });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. POST /api/automation/history/:id/retry
// ─────────────────────────────────────────────────────────────────────────────
router.post('/history/:id/retry', (req, res) => {
  const { id } = req.params;
  const item = HISTORY_LOGS.find(h => h.id === id);
  if (!item) return res.status(404).json({ success: false, error: 'History item not found' });
  item.status = 'Success';
  item.action = 'Retried manually by Admin: Message dispatched successfully';
  res.json({ success: true, message: `Execution ${id} retried successfully`, data: item });
});

module.exports = router;
