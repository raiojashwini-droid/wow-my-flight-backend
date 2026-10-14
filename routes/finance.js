/**
 * routes/finance.js
 * WowMyFlight CRM — Phase 3: Finance REST API
 * Route Name Matches Menu: "Finance" -> /api/finance
 */

const express = require('express');
const router = express.Router();

let REFUND_REQUESTS = [
  {
    id: 'REF-001',
    clientId: 'CL2008',
    clientName: 'Olga Kuznetsova',
    category: 'Visa Rejection',
    amount: 900,
    reason: 'Spanish Consulate rejected visa application due to lack of local ties.',
    status: 'Approved',
    date: '2026-06-25',
    auditLogs: [
      { date: '2026-06-25T10:00:00Z', action: 'Refund requested automatically on visa rejection.', user: 'System' },
      { date: '2026-06-25T14:30:00Z', action: 'Refund reviewed and approved.', user: 'Wael Madi (CEO)' }
    ]
  },
  {
    id: 'REF-002',
    clientId: 'CL2009',
    clientName: 'Marcus Sterling',
    category: 'Flight Cancellation',
    amount: 450,
    reason: 'British Airways schedule change cancelled connecting flight segment.',
    status: 'Pending Review',
    date: '2026-08-20',
    auditLogs: [
      { date: '2026-08-20T11:00:00Z', action: 'Refund requested by agent on schedule change.', user: 'Agent Alex' }
    ]
  }
];

let COMMISSION_RATES = [
  { agentId: 'c1', type: '10%', value: 10 },
  { agentId: 'c2', type: '5%', value: 5 },
  { agentId: 'c3', type: 'custom', value: 12 },
  { agentId: 'c4', type: 'fixed', value: 200 },
  { agentId: 'c5', type: '10%', value: 10 }
];

let COMMISSION_REPORTS = [
  {
    id: 'COMM-01',
    paymentId: 'PAY-1001',
    clientName: 'Karan Singh',
    serviceId: 'Business Class Flight',
    amountPaid: 2500,
    agentId: 'c1',
    agentName: 'Sarah Jenkins',
    structure: '10% (10%)',
    commissionEarned: 250,
    commissionPaid: 250,
    commissionPending: 0,
    date: '2026-08-15'
  },
  {
    id: 'COMM-02',
    paymentId: 'PAY-1002',
    clientName: 'Michael Chen',
    serviceId: 'First Class Flight',
    amountPaid: 4800,
    agentId: 'c2',
    agentName: 'Alex Miller',
    structure: '5% (5%)',
    commissionEarned: 240,
    commissionPaid: 0,
    commissionPending: 240,
    date: '2026-08-18'
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/finance/refunds (or /api/finance)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      refunds: REFUND_REQUESTS,
      commissionRates: COMMISSION_RATES,
      commissionReports: COMMISSION_REPORTS,
      summary: {
        totalRefundsApproved: 1350,
        pendingReviewCount: REFUND_REQUESTS.filter(r => r.status === 'Pending Review').length,
        totalCommissionPaid: 490,
        totalCommissionPending: 240
      }
    }
  });
});

router.get('/refunds', (req, res) => {
  res.json({ success: true, count: REFUND_REQUESTS.length, data: REFUND_REQUESTS });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST /api/finance/refunds (Create Refund Request)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/refunds', (req, res) => {
  const b = req.body || {};
  const newRefund = {
    id: `REF-${REFUND_REQUESTS.length + 101}`,
    clientId: b.clientId || 'CL-GEN',
    clientName: b.clientName || 'Traveler Client',
    category: b.category || 'General Refund',
    amount: Number(b.amount || 0),
    reason: b.reason || 'Requested via Refund Hub',
    status: 'Pending Review',
    date: new Date().toISOString().split('T')[0],
    auditLogs: [
      { date: new Date().toISOString(), action: `Refund requested for ${b.category || 'General'}. Amount: $${b.amount}`, user: b.user || 'Finance Team' }
    ]
  };

  REFUND_REQUESTS.unshift(newRefund);
  res.json({ success: true, message: 'Refund request created successfully', data: newRefund });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. PUT /api/finance/refunds/:id/status
// ─────────────────────────────────────────────────────────────────────────────
router.put('/refunds/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, user = 'Finance Manager' } = req.body;
  const refund = REFUND_REQUESTS.find(r => r.id === id);
  if (!refund) return res.status(404).json({ success: false, error: 'Refund request not found' });

  refund.status = status;
  refund.auditLogs = refund.auditLogs || [];
  refund.auditLogs.push({ date: new Date().toISOString(), action: `Status updated to ${status}`, user });

  res.json({ success: true, message: `Refund status updated to ${status}`, data: refund });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Commissions
// ─────────────────────────────────────────────────────────────────────────────
router.get('/commissions/rates', (req, res) => {
  res.json({ success: true, data: COMMISSION_RATES });
});

router.put('/commissions/rates', (req, res) => {
  const { agentId, type, value } = req.body;
  const existing = COMMISSION_RATES.find(r => r.agentId === agentId);
  if (existing) {
    existing.type = type;
    existing.value = Number(value);
  } else {
    COMMISSION_RATES.push({ agentId, type, value: Number(value) });
  }
  res.json({ success: true, message: 'Commission rate updated', data: COMMISSION_RATES });
});

router.get('/commissions/report', (req, res) => {
  res.json({ success: true, data: COMMISSION_REPORTS });
});

module.exports = router;
