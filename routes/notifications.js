/**
 * routes/notifications.js
 * WowMyFlight CRM — Live PostgreSQL Database Notifications API
 * Route: /api/notifications
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { prisma } = require('../db');

/**
 * Format relative time display (e.g., 'Just now', '5m ago', '2h ago')
 */
function getRelativeTime(date) {
  if (!date) return 'Recently';
  const diffSec = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

/**
 * Sync real live operational events into Notification database table
 */
async function syncLiveOperationalEvents() {
  if (!prisma) return;
  try {
    const existing = await prisma.notification.findMany({
      select: { title: true, message: true },
    });
    const existingKeys = new Set(existing.map((n) => `${n.title}|${n.message}`));

    const newAlerts = [];

    // 1. Live Bookings (Tickets & PNRs)
    const bookings = await prisma.booking.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    for (const b of bookings) {
      const title = 'Booking Confirmed';
      const message = `Booking PNR ${b.pnr || 'WMF-CONF'} confirmed for ${b.passengerName || 'Traveler'}.`;
      if (!existingKeys.has(`${title}|${message}`)) {
        newAlerts.push({
          title,
          message,
          type: 'booking',
          read: false,
          link: '/bookings',
          createdAt: b.createdAt || new Date(),
        });
        existingKeys.add(`${title}|${message}`);
      }
    }

    // 2. Live Customer Documents (Passport / Visa Uploads)
    const docs = await prisma.document.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    for (const d of docs) {
      const title = 'Document Uploaded';
      const message = `${d.fileName || 'Travel_Document.pdf'} uploaded for ${d.customerName || 'Customer'}.`;
      if (!existingKeys.has(`${title}|${message}`)) {
        newAlerts.push({
          title,
          message,
          type: 'document',
          read: d.status === 'Approved',
          link: '/super_admin/qa',
          createdAt: d.createdAt || new Date(),
        });
        existingKeys.add(`${title}|${message}`);
      }
    }

    // 3. Live Payments (Stripe & Bank Transfers)
    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    for (const p of payments) {
      const title = 'Payment Received';
      const message = `Payment of $${p.amount || '1,500.00'} verified and processed via Stripe.`;
      if (!existingKeys.has(`${title}|${message}`)) {
        newAlerts.push({
          title,
          message,
          type: 'payment',
          read: false,
          link: '/finance/payments',
          createdAt: p.createdAt || new Date(),
        });
        existingKeys.add(`${title}|${message}`);
      }
    }

    // 4. Live Leads (Website & Agent Inquiries)
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    for (const l of leads) {
      const title = 'New Flight Lead';
      const message = `${l.firstName} ${l.lastName || ''} requested ${l.destination || 'International'} flight quote.`;
      if (!existingKeys.has(`${title}|${message}`)) {
        newAlerts.push({
          title,
          message,
          type: 'lead',
          read: false,
          link: '/agent/leads',
          createdAt: l.createdAt || new Date(),
        });
        existingKeys.add(`${title}|${message}`);
      }
    }

    // 5. Call Dispositions & Scheduled Callbacks
    const dispFile = path.join(__dirname, '../store/disposition_logs.json');
    if (fs.existsSync(dispFile)) {
      try {
        const disps = JSON.parse(fs.readFileSync(dispFile, 'utf8'));
        if (Array.isArray(disps)) {
          for (const dp of disps.slice(0, 3)) {
            const title = dp.disposition === 'Booked' ? 'Call Result: Booked' : `Callback Scheduled: ${dp.customer || 'Client'}`;
            const message = dp.notes ? `Call wrap-up: "${dp.notes}" (${dp.customer || 'Customer'})` : `Call completed with disposition "${dp.disposition}".`;
            if (!existingKeys.has(`${title}|${message}`)) {
              newAlerts.push({
                title,
                message,
                type: 'call',
                read: false,
                link: '/call-dispositions',
                createdAt: dp.createdAt ? new Date(dp.createdAt) : new Date(),
              });
              existingKeys.add(`${title}|${message}`);
            }
          }
        }
      } catch (err) {}
    }

    // 6. SLA Priority Alerts for High Priority Pending Inquiries
    const highPriorityLead = await prisma.lead.findFirst({
      where: { priority: 'High', status: 'New Lead' },
      orderBy: { createdAt: 'desc' },
    });
    if (highPriorityLead) {
      const title = 'High Priority SLA Alert';
      const message = `Urgent flight inquiry from ${highPriorityLead.firstName} requires immediate response.`;
      if (!existingKeys.has(`${title}|${message}`)) {
        newAlerts.push({
          title,
          message,
          type: 'sla',
          read: false,
          link: '/super_admin/sla-management',
          createdAt: new Date(),
        });
        existingKeys.add(`${title}|${message}`);
      }
    }

    // Insert new alerts into DB
    for (const a of newAlerts) {
      await prisma.notification.create({
        data: {
          title: a.title,
          message: a.message,
          type: a.type,
          read: a.read,
          link: a.link,
          time: getRelativeTime(a.createdAt),
          createdAt: new Date(a.createdAt),
        },
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('[Notifications] Live sync warning:', err.message);
  }
}

// Role-based notification category permissions
const ROLE_NOTIFICATION_MAP = {
  super_admin: null, // Full access to all alerts
  admin: null,       // Full access to all alerts
  team_leader: ['lead', 'booking', 'call', 'sla', 'document', 'system'],
  expert_team_leader: ['lead', 'booking', 'call', 'sla', 'document', 'system'],
  consultant: ['lead', 'booking', 'call', 'sla'],
  sales_agent: ['lead', 'booking', 'call', 'sla'],
  agent: ['lead', 'booking', 'call', 'sla'],
  ticketing_agent: ['booking', 'document', 'call', 'sla'],
  flight_expert: ['booking', 'document', 'call', 'sla'],
  operations: ['booking', 'document', 'call', 'sla'],
  after_sales: ['booking', 'document', 'call', 'sla'],
  finance: ['payment', 'booking', 'system'],
  accountant: ['payment', 'booking', 'system'],
  marketing: ['lead', 'system'],
  'marketing-manager': ['lead', 'system'],
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/notifications (Role-Specific & Central Alerts)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    if (!prisma) {
      return res.status(503).json({ success: false, error: 'Database not connected' });
    }

    await syncLiveOperationalEvents();

    const { role, type } = req.query;
    const whereClause = {};

    if (type && type !== 'all') {
      if (type === 'document') {
        whereClause.type = { in: ['document', 'qa'] };
      } else {
        whereClause.type = type;
      }
    } else if (role && ROLE_NOTIFICATION_MAP[role]) {
      whereClause.type = { in: ROLE_NOTIFICATION_MAP[role] };
    }

    const notifications = await prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 60,
    });

    // Ensure strict chronological order (newest first)
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const formatted = notifications.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      read: n.read,
      time: getRelativeTime(n.createdAt),
      link: n.link,
      createdAt: n.createdAt,
    }));

    const unreadCount = formatted.filter((n) => !n.read).length;

    res.json({
      success: true,
      data: formatted,
      unreadCount,
      role: role || 'all',
    });
  } catch (err) {
    console.error('[Notifications API] GET / error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST /api/notifications (Create a new live notification)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { title, message, type = 'system', link, userId } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, error: 'Title and message are required' });
    }

    const newNotif = await prisma.notification.create({
      data: {
        title,
        message,
        type,
        time: 'Just now',
        read: false,
        link: link || null,
        userId: userId || null,
      },
    });

    res.json({ success: true, data: newNotif });
  } catch (err) {
    console.error('[Notifications API] POST / error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. PATCH /api/notifications/:id/read (Mark single as read)
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true },
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[Notifications API] PATCH /:id/read error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. POST /api/notifications/mark-all-read (Role-Aware Mark All Read)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/mark-all-read', async (req, res) => {
  try {
    const { role } = req.body || req.query || {};
    const whereClause = { read: false };

    if (role && ROLE_NOTIFICATION_MAP[role]) {
      whereClause.type = { in: ROLE_NOTIFICATION_MAP[role] };
    }

    await prisma.notification.updateMany({
      where: whereClause,
      data: { read: true },
    });

    res.json({
      success: true,
      message: `Notifications marked as read${role ? ` for role ${role}` : ''}`,
    });
  } catch (err) {
    console.error('[Notifications API] POST /mark-all-read error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. DELETE /api/notifications/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.notification.delete({ where: { id } });
    res.json({ success: true, message: 'Notification deleted' });
  } catch (err) {
    console.error('[Notifications API] DELETE /:id error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
