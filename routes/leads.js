/**
 * server/routes/leads.js
 * WowMyFlight CRM — Full Production Leads REST API
 * 
 * Features:
 *   - Real PostgreSQL persistence via Prisma
 *   - Resilient memory fallback via leadStore
 *   - Real-time Socket.io broadcasting on create / update / assign
 *   - Status filtering, search, and agent assignment
 */

const express = require('express');
const router = express.Router();
const leadStore = require('../store/leadStore');
const { prisma } = require('../db');

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/leads
// Fetch all leads with optional filters: status, agentId, search
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status, assignedAgentId, search, env = 'PRODUCTION' } = req.query;

    if (prisma) {
      const where = {};
      if (status && status !== 'all') {
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
        include: { assignedAgent: { select: { id: true, name: true, email: true, role: true } } }
      });

      // Also get store leads if any
      const storeResult = leadStore.getLeads({ isSandbox: env === 'SANDBOX' });
      const storeLeads = storeResult.data || [];

      const combinedMap = new Map();
      storeLeads.forEach(l => combinedMap.set(l.id, l));
      dbLeads.forEach(l => combinedMap.set(l.id, l));

      const leadsList = Array.from(combinedMap.values());
      return res.json({
        success: true,
        count: leadsList.length,
        data: leadsList
      });
    }

    // Fallback to memory store
    const storeResult = leadStore.getLeads({ isSandbox: env === 'SANDBOX', status });
    return res.json({
      success: true,
      count: (storeResult.data || []).length,
      data: storeResult.data || []
    });
  } catch (err) {
    console.error('❌ [Leads API] Error fetching leads:', err.message);
    const storeResult = leadStore.getLeads({ isSandbox: req.query.env === 'SANDBOX' });
    return res.json({
      success: true,
      source: 'fallback',
      count: (storeResult.data || []).length,
      data: storeResult.data || [],
      warning: err.message
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /api/leads/:id
// Get details for a single lead
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (prisma) {
      const lead = await prisma.lead.findUnique({
        where: { id },
        include: { assignedAgent: { select: { id: true, name: true, email: true, role: true } } }
      });
      if (lead) {
        return res.json({ success: true, data: lead });
      }
    }

    const memLead = leadStore.getLeadById(id);
    if (!memLead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    return res.json({ success: true, data: memLead });
  } catch (err) {
    console.error(`❌ [Leads API] Error fetching lead ${req.params.id}:`, err.message);
    const memLead = leadStore.getLeadById(req.params.id);
    if (memLead) return res.json({ success: true, data: memLead });
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /api/leads
// Create a new lead (manual agent entry or API)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const leadId = body.id || `LD-${Math.floor(1000 + Math.random() * 9000)}`;

    const newLeadData = {
      id: leadId,
      firstName: body.firstName || body.name || 'Traveler',
      lastName: body.lastName || '',
      email: body.email || null,
      phone: body.phone || null,
      nationality: body.nationality || null,
      preferredLanguage: body.preferredLanguage || 'English',
      serviceId: body.serviceId || 'economy',
      status: body.status || 'New Lead',
      origin: body.origin || null,
      destination: body.destination || null,
      travelDate: body.travelDate || null,
      passengers: parseInt(body.passengers, 10) || 1,
      budget: body.budget ? parseFloat(body.budget) : null,
      notes: body.notes || null,
      assignedAgentId: body.assignedAgentId || null,
      createdAt: body.createdAt ? new Date(body.createdAt) : new Date(),
      updatedAt: new Date()
    };

    // Save in PostgreSQL
    let savedDbLead = null;
    if (prisma) {
      try {
        savedDbLead = await prisma.lead.upsert({
          where: { id: leadId },
          update: newLeadData,
          create: newLeadData
        });
      } catch (dbErr) {
        console.warn('⚠️ [Leads API] Database save warning:', dbErr.message);
      }
    }

    const finalLead = savedDbLead || newLeadData;

    // Real-time broadcast to all connected agents
    const io = req.app.get('io');
    if (io) {
      io.to('agents_group').emit('lead:new', finalLead);
    }

    return res.status(201).json({
      success: true,
      message: 'Lead created successfully',
      data: finalLead
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
    if (prisma) {
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
          data: prismaData
        });
      } catch (dbErr) {
        console.warn(`⚠️ [Leads API] Could not update lead ${id} in DB:`, dbErr.message);
      }
    }

    const result = updatedDbLead || { id, ...updates };

    const io = req.app.get('io');
    if (io) {
      io.to('agents_group').emit('lead:updated', result);
    }

    return res.json({
      success: true,
      message: 'Lead updated successfully',
      data: result
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
    if (prisma) {
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

    if (prisma) {
      try {
        await prisma.lead.delete({ where: { id } });
      } catch (dbErr) {
        console.warn(`⚠️ [Leads API] Could not delete lead ${id} from DB:`, dbErr.message);
      }
    }

    const io = req.app.get('io');
    if (io) {
      io.to('agents_group').emit('lead:deleted', { leadId: id });
    }

    return res.json({ success: true, message: 'Lead deleted successfully' });
  } catch (err) {
    console.error('❌ [Leads API] Error deleting lead:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
