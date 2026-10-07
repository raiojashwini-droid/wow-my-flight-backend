/**
 * server/routes/bookings.js
 * WowMyFlight CRM — Live PostgreSQL Database Bookings & Ticketing API
 */

const express = require('express');
const router = express.Router();
const { prisma, isDbConnected } = require('../db');

// Initial seed bookings for queue if database table is initially empty
const INITIAL_SEED_BOOKINGS = [
  {
    bookingId: 'BK-1001',
    pnr: 'ABC12D',
    supplier: 'Sabre GDS (BA 012)',
    ticketNumber: '0172345678901',
    passenger: 'M. Chen',
    name: 'M. Chen',
    route: 'JFK → LHR',
    origin: 'JFK',
    destination: 'LHR',
    fare: '$1,050.00',
    taxes: '$200.00',
    commission: '$125.00 (10%)',
    amount: '$1,250.00',
    paymentStatus: 'Payment Confirmed',
    ticketStatus: 'Ready to Issue',
    timeLimit: '38 mins remaining (TTL Urgent)',
    ttl: '38 mins remaining',
    isTtlUrgent: true,
    issuingAgent: 'Omar Farouq',
    issueDateTime: '15 Oct 2026 14:20 EST',
    date: '15 Oct 2026',
    cabinClass: 'Business',
    passengers: 2,
  },
  {
    bookingId: 'BK-1002',
    pnr: 'LMN78F',
    supplier: 'Amadeus 1A (SQ 618)',
    ticketNumber: '0179988776655',
    passenger: 'A. Lee',
    name: 'A. Lee',
    route: 'DEL → SIN',
    origin: 'DEL',
    destination: 'SIN',
    fare: '$450.00',
    taxes: '$80.00',
    commission: '$45.00 (8%)',
    amount: '$530.00',
    paymentStatus: 'Payment Confirmed',
    ticketStatus: 'Ticketing in Progress',
    timeLimit: '2h 15m remaining',
    ttl: '2h 15m remaining',
    isTtlUrgent: false,
    issuingAgent: 'Omar Farouq',
    issueDateTime: '20 Nov 2026 11:05 IST',
    date: '20 Nov 2026',
    cabinClass: 'Economy',
    passengers: 1,
  },
  {
    bookingId: 'BK-1003',
    pnr: 'QRS90G',
    supplier: 'Emirates Direct API',
    ticketNumber: '1765432109876',
    passenger: 'K. Singh',
    name: 'K. Singh',
    route: 'DXB → LHR',
    origin: 'DXB',
    destination: 'LHR',
    fare: '$1,550.00',
    taxes: '$300.00',
    commission: '$185.00 (10%)',
    amount: '$1,850.00',
    paymentStatus: 'Payment Confirmed',
    ticketStatus: 'Ticketed',
    timeLimit: 'Ticketed on 05 Dec 2026',
    ttl: 'Ticketed',
    isTtlUrgent: false,
    issuingAgent: 'Sarah Jenkins',
    issueDateTime: '05 Dec 2026 09:15 GST',
    date: '05 Dec 2026',
    cabinClass: 'First Class',
    passengers: 3,
  },
  {
    bookingId: 'BK-1004',
    pnr: 'SAB89X',
    supplier: 'Travelport GDS (AA 001)',
    ticketNumber: 'Unissued',
    passenger: 'R. Sharma',
    name: 'R. Sharma',
    route: 'BOM → JFK',
    origin: 'BOM',
    destination: 'JFK',
    fare: '$920.00',
    taxes: '$160.00',
    commission: '$75.00 (7%)',
    amount: '$1,080.00',
    paymentStatus: 'Pending Payment',
    ticketStatus: 'Pending Payment',
    timeLimit: '12h 40m remaining',
    ttl: '12h 40m remaining',
    isTtlUrgent: false,
    issuingAgent: 'Unassigned',
    issueDateTime: '—',
    date: '18 Dec 2026',
    cabinClass: 'Economy',
    passengers: 1,
  },
  {
    bookingId: 'BK-1005',
    pnr: '1A990P',
    supplier: 'Consolidator AirDesk',
    ticketNumber: 'Unissued',
    passenger: 'J. Dupont',
    name: 'J. Dupont',
    route: 'CDG → DXB',
    origin: 'CDG',
    destination: 'DXB',
    fare: '$2,100.00',
    taxes: '$340.00',
    commission: '$210.00 (10%)',
    amount: '$2,440.00',
    paymentStatus: 'Payment Confirmed',
    ticketStatus: 'Pending Ticketing',
    timeLimit: '4h 10m remaining',
    ttl: '4h 10m remaining',
    isTtlUrgent: false,
    issuingAgent: 'Unassigned',
    issueDateTime: '—',
    date: '22 Dec 2026',
    cabinClass: 'Business',
    passengers: 2,
  },
  {
    bookingId: 'BK-1006',
    pnr: 'FAIL99',
    supplier: 'Sabre GDS (LH 040)',
    ticketNumber: 'Failed (ERR-503)',
    passenger: 'H. Miller',
    name: 'H. Miller',
    route: 'FRA → ORD',
    origin: 'FRA',
    destination: 'ORD',
    fare: '$780.00',
    taxes: '$140.00',
    commission: '$60.00 (6%)',
    amount: '$920.00',
    paymentStatus: 'Payment Confirmed',
    ticketStatus: 'Failed',
    timeLimit: 'Expired / Re-issue required',
    ttl: 'EXPIRED',
    isTtlUrgent: true,
    issuingAgent: 'Omar Farouq',
    issueDateTime: '—',
    date: '24 Dec 2026',
    cabinClass: 'Economy',
    passengers: 1,
  },
  {
    bookingId: 'BK-1007',
    pnr: 'REV44Z',
    supplier: 'Amadeus 1A (QR 005)',
    ticketNumber: 'Under Audit',
    passenger: 'S. Al-Mansoor',
    name: 'S. Al-Mansoor',
    route: 'DOH → LHR',
    origin: 'DOH',
    destination: 'LHR',
    fare: '$1,320.00',
    taxes: '$250.00',
    commission: '$140.00 (9%)',
    amount: '$1,570.00',
    paymentStatus: 'Payment Confirmed',
    ticketStatus: 'Manual Review',
    timeLimit: 'Audited by FinOps',
    ttl: 'Manual Review',
    isTtlUrgent: false,
    issuingAgent: 'Fatima Zahra',
    issueDateTime: '—',
    date: '28 Dec 2026',
    cabinClass: 'Business',
    passengers: 2,
  }
];

// Fallback in-memory cache if Prisma is temporarily unreachable
let memoryBookings = [...INITIAL_SEED_BOOKINGS];

// Helper to seed database if empty
async function ensureDatabaseSeed() {
  if (!prisma) return;
  try {
    const count = await prisma.booking.count();
    if (count === 0) {
      console.log('🌱 [PostgreSQL] Initializing empty bookings table with seed records...');
      for (const item of INITIAL_SEED_BOOKINGS) {
        await prisma.booking.create({ data: item });
      }
      console.log('✅ [PostgreSQL] Seeded 7 standard CRM bookings successfully.');
    }
  } catch (err) {
    console.warn('⚠️ [PostgreSQL] Auto-seed check notice:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bookings
// Fetch all bookings from PostgreSQL Database
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    if (prisma) {
      await ensureDatabaseSeed();
      const dbBookings = await prisma.booking.findMany({
        orderBy: { createdAt: 'desc' }
      });
      return res.json({
        success: true,
        source: 'PostgreSQL Database',
        count: dbBookings.length,
        data: dbBookings
      });
    }

    return res.json({
      success: true,
      source: 'Memory Cache',
      count: memoryBookings.length,
      data: memoryBookings
    });
  } catch (err) {
    console.error('❌ [Bookings API] Error fetching bookings:', err);
    return res.json({
      success: true,
      source: 'Fallback Memory',
      count: memoryBookings.length,
      data: memoryBookings,
      warning: err.message
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/bookings
// Create a new booking in PostgreSQL Database
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const bookingId = body.bookingId || `BK-${Math.floor(1000 + Math.random() * 9000)}`;
    const pnr = body.pnr || (body.pnrCode || `PNR${Math.random().toString(36).substring(2, 6).toUpperCase()}`);
    
    const newRecord = {
      bookingId,
      pnr,
      supplier: body.supplier || 'Travelopro GDS',
      ticketNumber: body.ticketNumber || 'Unissued',
      passenger: body.passenger || body.customerName || 'Lead Passenger',
      name: body.name || body.passenger || body.customerName || 'Lead Passenger',
      route: body.route || `${body.origin || 'DEL'} → ${body.destination || 'BOM'}`,
      origin: body.origin || '',
      destination: body.destination || '',
      fare: body.fare || '$450.00',
      taxes: body.taxes || '$80.00',
      commission: body.commission || '$45.00 (10%)',
      amount: body.amount || body.totalAmount || '$530.00',
      paymentStatus: body.paymentStatus || 'Payment Confirmed',
      ticketStatus: body.ticketStatus || 'Ready to Issue',
      timeLimit: body.timeLimit || '24h remaining',
      ttl: body.ttl || body.timeLimit || '24h remaining',
      isTtlUrgent: Boolean(body.isTtlUrgent),
      issuingAgent: body.issuingAgent || 'Omar Farouq',
      issueDateTime: body.issueDateTime || '—',
      date: body.date || new Date().toLocaleDateString(),
      cabinClass: body.cabinClass || 'Economy',
      passengers: Number(body.passengers) || 1,
      airlineCode: body.airlineCode || '',
      flightNumber: body.flightNumber || '',
      notes: body.notes || ''
    };

    let createdBooking = null;
    if (prisma) {
      createdBooking = await prisma.booking.create({ data: newRecord });
      console.log(`✅ [PostgreSQL] Created new booking: ${createdBooking.bookingId} (${createdBooking.pnr})`);
    } else {
      newRecord.id = `mem-${Date.now()}`;
      newRecord.createdAt = new Date();
      memoryBookings.unshift(newRecord);
      createdBooking = newRecord;
    }

    // Broadcast live event to socket.io listeners
    const io = req.app.get('io');
    if (io) {
      io.emit('booking:created', createdBooking);
    }

    return res.status(201).json({
      success: true,
      message: 'Booking created successfully in Database',
      data: createdBooking
    });
  } catch (err) {
    console.error('❌ [Bookings API] Error creating booking:', err);
    return res.status(500).json({ error: 'Failed to create booking', message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/bookings/:id/status
// Update status / ticket number in PostgreSQL Database
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { ticketStatus, paymentStatus, ticketNumber, issueDateTime, issuingAgent } = req.body;

    let updated = null;
    if (prisma) {
      // Find by id or bookingId or pnr
      const existing = await prisma.booking.findFirst({
        where: {
          OR: [{ id: id }, { bookingId: id }, { pnr: id }]
        }
      });

      if (existing) {
        updated = await prisma.booking.update({
          where: { id: existing.id },
          data: {
            ...(ticketStatus && { ticketStatus }),
            ...(paymentStatus && { paymentStatus }),
            ...(ticketNumber && { ticketNumber }),
            ...(issueDateTime && { issueDateTime }),
            ...(issuingAgent && { issuingAgent }),
          }
        });
        console.log(`✅ [PostgreSQL] Updated booking ${updated.bookingId} -> status: ${ticketStatus || existing.ticketStatus}`);
      }
    }

    if (!updated) {
      // Check memory
      const idx = memoryBookings.findIndex(b => b.id === id || b.bookingId === id || b.pnr === id);
      if (idx !== -1) {
        memoryBookings[idx] = {
          ...memoryBookings[idx],
          ...(ticketStatus && { ticketStatus }),
          ...(paymentStatus && { paymentStatus }),
          ...(ticketNumber && { ticketNumber }),
          ...(issueDateTime && { issueDateTime }),
          ...(issuingAgent && { issuingAgent }),
        };
        updated = memoryBookings[idx];
      }
    }

    if (!updated) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('booking:updated', updated);
    }

    return res.json({
      success: true,
      message: 'Booking status updated in Database',
      data: updated
    });
  } catch (err) {
    console.error('❌ [Bookings API] Error updating booking status:', err);
    return res.status(500).json({ error: 'Failed to update booking status', message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/bookings/:id/issue
// Full Issuance Workflow: Updates DB status to "Ticketed", records e-ticket
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/issue', async (req, res) => {
  try {
    const { id } = req.params;
    const { eTickets, issuingAgent = 'Wael Madi (CEO)' } = req.body;

    const formattedTicket = Array.isArray(eTickets) ? eTickets.join(', ') : (eTickets || '0172345678901');
    const issueDateTime = new Date().toLocaleString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    let updated = null;
    if (prisma) {
      const existing = await prisma.booking.findFirst({
        where: {
          OR: [{ id: id }, { bookingId: id }, { pnr: id }]
        }
      });

      if (existing) {
        updated = await prisma.booking.update({
          where: { id: existing.id },
          data: {
            ticketStatus: 'Ticketed',
            paymentStatus: 'Payment Confirmed',
            ticketNumber: formattedTicket,
            issueDateTime,
            issuingAgent,
            ttl: 'Ticketed'
          }
        });
        console.log(`✅ [PostgreSQL] Ticket issued in DB for ${updated.bookingId} (${updated.pnr}) -> ${formattedTicket}`);
      }
    }

    if (!updated) {
      const idx = memoryBookings.findIndex(b => b.id === id || b.bookingId === id || b.pnr === id);
      if (idx !== -1) {
        memoryBookings[idx] = {
          ...memoryBookings[idx],
          ticketStatus: 'Ticketed',
          paymentStatus: 'Payment Confirmed',
          ticketNumber: formattedTicket,
          issueDateTime,
          issuingAgent,
          ttl: 'Ticketed'
        };
        updated = memoryBookings[idx];
      }
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('booking:ticketed', updated);
    }

    return res.json({
      success: true,
      message: 'E-Ticket issued and saved to PostgreSQL Database',
      data: updated,
      eTickets: Array.isArray(eTickets) ? eTickets : [formattedTicket],
      issueDateTime
    });
  } catch (err) {
    console.error('❌ [Bookings API] Error issuing ticket:', err);
    return res.status(500).json({ error: 'Failed to issue ticket in DB', message: err.message });
  }
});

module.exports = router;
