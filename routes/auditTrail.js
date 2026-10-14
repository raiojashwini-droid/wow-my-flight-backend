/**
 * routes/auditTrail.js
 * WowMyFlight CRM — Phase 3: Audit Trail REST API
 * Route Name Matches Menu: "Audit Trail" -> /api/audit-trail
 */

const express = require('express');
const router = express.Router();

let AUDIT_KPIS = [
  { id: 'total', title: 'Total Audit Records', value: '14,280 Logs', change: 'Immutable audit trail', isUp: true, color: '#3F51B5' },
  { id: 'today', title: "Today's Activities", value: '340 Events', change: 'Live system logs', isUp: true, color: '#0284C7' },
  { id: 'sensitive', title: 'Sensitive Changes', value: '18 Records', change: '🔴 Price & Refunds', isUp: false, color: '#DC2626' },
  { id: 'refund', title: 'Refund Audit Logs', value: '12 Actions', change: 'Finance verified', isUp: true, color: '#D97706' },
  { id: 'price', title: 'Price Modifications', value: '24 Changes', change: 'Approval logged', isUp: true, color: '#059669' },
  { id: 'failedLogin', title: 'Failed Login Attempts', value: '2 Attempts', change: 'IP Flagged 192.168.1.9', isUp: false, color: '#DC2626' }
];

let AUDIT_LOGS = [
  {
    auditId: 'AUD-99120',
    user: 'Michael Chang',
    role: 'Team Leader',
    action: 'Customer Price Changed',
    module: 'Pricing & Quotes',
    refId: 'BK-10892',
    customer: 'Ambassador Harold Vance',
    timestamp: '2026-08-20 14:15:22',
    oldValue: '$1,820.00',
    newValue: '$1,620.00',
    reason: 'Manager approved promotional discount for embassy corporate tier',
    ipAddress: '192.168.1.104',
    device: 'Chrome 127.0.0.0 / Windows 11',
    sessionId: 'SESS-881920',
    sensitive: true
  },
  {
    auditId: 'AUD-99121',
    user: 'Elena Finance',
    role: 'Finance Manager',
    action: 'Refund Processed',
    module: 'Payments & Refunds',
    refId: 'BK-10920',
    customer: 'Marcus Sterling',
    timestamp: '2026-08-20 13:50:10',
    oldValue: 'Refund Pending ($450.00)',
    newValue: 'Refund Completed ($450.00)',
    reason: 'Flight cancellation approved by British Airways waiver',
    ipAddress: '192.168.1.110',
    device: 'Edge 126.0.0.0 / Windows 11',
    sessionId: 'SESS-771204',
    sensitive: true
  },
  {
    auditId: 'AUD-99122',
    user: 'Carlos Ticketing',
    role: 'Ticketing Agent',
    action: 'Ticket Issued',
    module: 'Ticketing GDS',
    refId: 'BK-10231',
    customer: 'Arthur Pendelton',
    timestamp: '2026-08-20 12:30:00',
    oldValue: 'Ticket Status: Pending PNR',
    newValue: 'Ticket Status: Issued (E-Ticket 13381235436196)',
    reason: 'Sabre GDS PNR SAB78K ticketed successfully',
    ipAddress: '192.168.1.115',
    device: 'Firefox 128.0.0.0 / macOS Sonoma',
    sessionId: 'SESS-551920',
    sensitive: false
  },
  {
    auditId: 'AUD-99123',
    user: 'Sarah Jenkins',
    role: 'Sales Consultant',
    action: 'Lead Reassigned',
    module: 'Lead Management',
    refId: 'LD-99120',
    customer: 'Dr. Harrison Wells',
    timestamp: '2026-08-20 11:10:45',
    oldValue: 'Assigned: Unassigned Pool',
    newValue: 'Assigned: Sarah Jenkins',
    reason: 'Auto-distribution round-robin SLA assignment',
    ipAddress: '192.168.1.102',
    device: 'Chrome 127.0.0.0 / Windows 11',
    sessionId: 'SESS-331029',
    sensitive: false
  },
  {
    auditId: 'AUD-99124',
    user: 'Super Admin',
    role: 'Super Admin',
    action: 'User Role Changed',
    module: 'User Permissions',
    refId: 'USR-8812',
    customer: 'Alex Miller',
    timestamp: '2026-08-20 10:00:00',
    oldValue: 'Role: Flight Expert',
    newValue: 'Role: Expert Team Leader',
    reason: 'Promoted to Senior Escalation Desk Supervisor',
    ipAddress: '192.168.1.100',
    device: 'Safari 17.5 / macOS Sonoma',
    sessionId: 'SESS-110099',
    sensitive: true
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/audit-trail
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { search, module, role, sensitiveOnly } = req.query;

  let filtered = [...AUDIT_LOGS];

  if (module && module !== 'ALL') {
    filtered = filtered.filter(l => l.module === module);
  }
  if (role && role !== 'ALL') {
    filtered = filtered.filter(l => l.role === role);
  }
  if (sensitiveOnly === 'true' || sensitiveOnly === true) {
    filtered = filtered.filter(l => l.sensitive);
  }
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(l =>
      l.auditId.toLowerCase().includes(q) ||
      l.user.toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q) ||
      l.refId.toLowerCase().includes(q) ||
      l.customer.toLowerCase().includes(q)
    );
  }

  res.json({
    success: true,
    count: filtered.length,
    data: {
      kpis: AUDIT_KPIS,
      logs: filtered
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST /api/audit-trail (Log New Immutable Entry)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  const b = req.body || {};
  const newAudit = {
    auditId: `AUD-${Math.floor(99200 + Math.random() * 800)}`,
    user: b.user || 'System User',
    role: b.role || 'Super Admin',
    action: b.action || 'Configuration Change',
    module: b.module || 'System',
    refId: b.refId || 'SYS-01',
    customer: b.customer || 'Internal',
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    oldValue: b.oldValue || 'N/A',
    newValue: b.newValue || 'Updated',
    reason: b.reason || 'Administrative action logged to immutable audit trail',
    ipAddress: req.ip || '127.0.0.1',
    device: req.headers['user-agent'] ? req.headers['user-agent'].substring(0, 45) : 'API Client',
    sessionId: `SESS-${Date.now().toString().slice(-6)}`,
    sensitive: !!b.sensitive
  };

  AUDIT_LOGS.unshift(newAudit);
  res.json({ success: true, message: 'Audit entry logged immutably', data: newAudit });
});

module.exports = router;
