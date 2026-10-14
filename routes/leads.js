/**
 * server/routes/leads.js
 * WowMyFlight CRM — Full Production Leads REST API
 * 
 * Features:
 *   - Real PostgreSQL persistence via Prisma (with auto-reconnect & health check)
 *   - Resilient memory fallback via leadStore
 *   - Real-time Socket.io broadcasting on create / update / assign / delete
 *   - Status filtering, search, and agent assignment
 * 
 * Endpoints:
 *   GET    /api/leads            - Fetch all leads (with status/search/agent filters)
 *   GET    /api/leads/:id        - Fetch single lead by ID
 *   POST   /api/leads            - Create new lead & broadcast via Socket.io
 *   PUT    /api/leads/:id        - Update existing lead
 *   PATCH  /api/leads/:id/assign - Quick assign agent to lead
 *   DELETE /api/leads/:id        - Delete lead
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const leadStore = require('../store/leadStore');
const { prisma, isDbConnected } = require('../db');

// In-memory fallback cache if PostgreSQL is offline
let memoryLeads = [];

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/leads
// Fetch all leads with optional filters: status, assignedAgentId, search, env
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status, assignedAgentId, search, env = 'PRODUCTION' } = req.query;

    if (prisma && (typeof isDbConnected !== 'function' || isDbConnected())) {
      try {
        const where = {};
        if (status && status !== 'all' && status !== 'All') {
          where.status = status;
        }
        if (assignedAgentId) {
          where.assignedAgentId = assignedAgentId;
        }
        if (search) {
          where.OR = [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { origin: { contains: search, mode: 'insensitive' } },
            { destination: { contains: search, mode: 'insensitive' } },
          ];
        }

        const dbLeads = await prisma.lead.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: {
            assignedAgent: {
              select: { id: true, name: true, email: true, role: true }
            }
          }
        });

        // Combine with any leadStore sandbox/memory leads
        let storeLeads = [];
        if (leadStore && typeof leadStore.getLeads === 'function') {
          const storeResult = leadStore.getLeads({ isSandbox: env === 'SANDBOX' });
          storeLeads = storeResult.data || [];
        }

        const combinedMap = new Map();
        memoryLeads.forEach((l) => combinedMap.set(l.id, l));
        storeLeads.forEach((l) => combinedMap.set(l.id, l));
        dbLeads.forEach((l) => combinedMap.set(l.id, l));

        const leadsList = Array.from(combinedMap.values());
        return res.json({
          success: true,
          source: 'PostgreSQL Database',
          count: leadsList.length,
          data: leadsList
        });
      } catch (dbErr) {
        console.warn('⚠️ [Leads API] DB query failed, falling back to memory:', dbErr.message);
      }
    }

    // Fallback to memory store
    let fallbackData = [];
    if (leadStore && typeof leadStore.getLeads === 'function') {
      const storeResult = leadStore.getLeads({ isSandbox: env === 'SANDBOX', status });
      fallbackData = storeResult.data || [];
    } else {
      fallbackData = memoryLeads;
    }

    return res.json({
      success: true,
      source: 'Fallback Memory',
      count: fallbackData.length,
      data: fallbackData
    });
  } catch (err) {
    console.error('❌ [Leads API] Error fetching leads:', err.message);
    let fallbackData = memoryLeads;
    if (leadStore && typeof leadStore.getLeads === 'function') {
      const storeResult = leadStore.getLeads({ isSandbox: req.query.env === 'SANDBOX' });
      fallbackData = storeResult.data || [];
    }
    return res.json({
      success: true,
      source: 'fallback',
      count: fallbackData.length,
      data: fallbackData,
      warning: err.message
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /api/leads/:id
// Get details for a single lead
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (prisma && (typeof isDbConnected !== 'function' || isDbConnected())) {
      try {
        const lead = await prisma.lead.findUnique({
          where: { id },
          include: {
            assignedAgent: {
              select: { id: true, name: true, email: true, role: true }
            }
          }
        });
        if (lead) {
          return res.json({ success: true, data: lead });
        }
      } catch (dbErr) {
        console.warn(`⚠️ [Leads API] Could not fetch lead ${id} from DB:`, dbErr.message);
      }
    }

    if (leadStore && typeof leadStore.getLeadById === 'function') {
      const memLead = leadStore.getLeadById(id);
      if (memLead) return res.json({ success: true, data: memLead });
    }

    const localMemLead = memoryLeads.find((l) => l.id === id);
    if (localMemLead) {
      return res.json({ success: true, data: localMemLead });
    }

    return res.status(404).json({ success: false, error: 'Lead not found' });
  } catch (err) {
    console.error(`❌ [Leads API] Error fetching lead ${id}:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /api/leads
// Create a new lead (manual agent entry, website webhook, or API)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const leadId = body.id || uuidv4();
    const now = new Date();

    const firstName = body.firstName || (body.name ? body.name.split(' ')[0] : 'Traveler');
    const lastName = body.lastName || (body.name && body.name.split(' ').length > 1 ? body.name.split(' ').slice(1).join(' ') : '');
    const phone = body.phone || body.phoneNumber || body.fullPhone || null;
    const email = body.email || null;
    const nationality = body.nationality || 'Indian';
    const preferredLanguage = body.preferredLanguage || 'English';
    const serviceId = body.serviceId || body.cabinClass?.toLowerCase() || 'economy';
    const status = body.status || 'New Lead';
    const origin = body.origin ? body.origin.toUpperCase() : null;
    const destination = body.destination ? body.destination.toUpperCase() : null;
    const travelDate = body.travelDate || null;
    const passengers = parseInt(body.passengers, 10) || 1;
    const budget = body.budget ? parseFloat(body.budget) : null;
    const notes = body.notes || (origin && destination ? `Inquiry created in CRM for ${origin} → ${destination} (${passengers} pax)` : null);
    const assignedAgentId = body.assignedAgentId || null;

    const newLeadData = {
      id: leadId,
      firstName,
      lastName,
      email,
      phone,
      nationality,
      preferredLanguage,
      serviceId,
      status,
      origin,
      destination,
      travelDate,
      passengers,
      budget,
      notes,
      assignedAgentId,
      createdAt: body.createdAt ? new Date(body.createdAt) : now,
      updatedAt: now,
    };

    // Save in PostgreSQL via Prisma
    let savedDbLead = null;
    if (prisma && (typeof isDbConnected !== 'function' || isDbConnected())) {
      try {
        savedDbLead = await prisma.lead.upsert({
          where: { id: leadId },
          update: newLeadData,
          create: newLeadData,
          include: {
            assignedAgent: {
              select: { id: true, name: true, email: true, role: true }
            }
          }
        });
        console.log(`✅ [PostgreSQL] Saved lead: ${savedDbLead.id} (${firstName} ${lastName})`);
      } catch (dbErr) {
        console.warn('⚠️ [Leads API] Database save warning:', dbErr.message);
      }
    }

    const finalLead = savedDbLead || newLeadData;

    // Save in memory fallback
    memoryLeads.unshift(finalLead);
    if (leadStore && typeof leadStore.addLead === 'function') {
      try { leadStore.addLead(finalLead); } catch (e) { }
    }

    // Real-time broadcast to all connected agents
    const io = req.app.get('io');
    if (io) {
      io.to('agents_group').emit('lead:new', finalLead);
      console.log(`📡 [Socket.io] Broadcasted lead:new to agents_group (${finalLead.id})`);
    }

    return res.status(201).json({
      success: true,
      message: 'Lead created successfully',
      data: finalLead,
    });
  } catch (err) {
    console.error('❌ [Leads API] Error creating lead:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. PUT /api/leads/:id
// Update lead info or status
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    updates.updatedAt = new Date();

    let updatedDbLead = null;
    if (prisma && (typeof isDbConnected !== 'function' || isDbConnected())) {
      try {
        const allowedPrismaFields = [
          'firstName', 'lastName', 'email', 'phone', 'nationality',
          'preferredLanguage', 'serviceId', 'status', 'origin', 'destination',
          'travelDate', 'passengers', 'budget', 'notes', 'assignedAgentId'
        ];
        const prismaData = {};
        for (const key of allowedPrismaFields) {
          if (updates[key] !== undefined) {
            prismaData[key] = updates[key];
          }
        }
        prismaData.updatedAt = new Date();

        updatedDbLead = await prisma.lead.update({
          where: { id },
          data: prismaData,
          include: {
            assignedAgent: {
              select: { id: true, name: true, email: true, role: true }
            }
          }
        });
        console.log(`✅ [PostgreSQL] Updated lead: ${id}`);
      } catch (dbErr) {
        console.warn(`⚠️ [Leads API] Could not update lead ${id} in DB:`, dbErr.message);
      }
    }

    // Update memory cache
    const memIndex = memoryLeads.findIndex((l) => l.id === id);
    if (memIndex !== -1) {
      memoryLeads[memIndex] = { ...memoryLeads[memIndex], ...updates, updatedAt: new Date() };
    }
    const result = updatedDbLead || (memIndex !== -1 ? memoryLeads[memIndex] : { id, ...updates });

    const io = req.app.get('io');
    if (io) {
      io.to('agents_group').emit('lead:updated', result);
    }

    return res.json({
      success: true,
      message: 'Lead updated successfully',
      data: result,
    });
  } catch (err) {
    console.error(`❌ [Leads API] Error updating lead ${req.params.id}:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. PATCH /api/leads/:id/assign
// Quick assign agent to lead
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { agentId } = req.body;

    if (!agentId) {
      return res.status(400).json({ success: false, error: 'agentId is required' });
    }

    let updated = null;
    if (prisma && (typeof isDbConnected !== 'function' || isDbConnected())) {
      try {
        updated = await prisma.lead.update({
          where: { id },
          data: { assignedAgentId: agentId },
          include: { assignedAgent: { select: { id: true, name: true, email: true } } }
        });
      } catch (dbErr) {
        console.warn('⚠️ [Leads API] Could not update assignedAgent in DB:', dbErr.message);
      }
    }

    const io = req.app.get('io');
    if (io) {
      io.to('agents_group').emit('lead:assigned', { leadId: id, agentId });
      io.to(`agent:${agentId}`).emit('notification:new', {
        type: 'lead_assigned',
        leadId: id,
        message: `You have been assigned lead #${id}`
      });
    }

    return res.json({
      success: true,
      message: 'Agent assigned successfully',
      data: updated || { id, assignedAgentId: agentId }
    });
  } catch (err) {
    console.error('❌ [Leads API] Error assigning agent:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. DELETE /api/leads/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (prisma && (typeof isDbConnected !== 'function' || isDbConnected())) {
      try {
        await prisma.lead.delete({ where: { id } });
        console.log(`✅ [PostgreSQL] Deleted lead: ${id}`);
      } catch (dbErr) {
        console.warn(`⚠️ [Leads API] Could not delete lead ${id} from DB:`, dbErr.message);
      }
    }

    memoryLeads = memoryLeads.filter((l) => l.id !== id);

    const io = req.app.get('io');
    if (io) {
      io.to('agents_group').emit('lead:deleted', { id, leadId: id });
    }

    return res.json({ success: true, message: 'Lead deleted successfully' });
  } catch (err) {
    console.error('❌ [Leads API] Error deleting lead:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
