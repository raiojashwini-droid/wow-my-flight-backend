/**
 * server/routes/leads.js
 * WowMyFlight CRM — Direct Leads CRUD API (PostgreSQL Prisma + Resilient Memory Fallback)
 * 
 * Endpoints:
 *   GET    /api/leads       - Fetch all leads
 *   GET    /api/leads/:id   - Fetch single lead by ID
 *   POST   /api/leads       - Create new lead & broadcast via Socket.io
 *   PUT    /api/leads/:id   - Update existing lead
 *   DELETE /api/leads/:id   - Delete lead
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { prisma, isDbConnected } = require('../db');

// In-memory fallback cache if PostgreSQL is offline
let memoryLeads = [];

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/leads
 * Fetch all leads from PostgreSQL or Memory Fallback
 * ─────────────────────────────────────────────────────────────────────────────
 */
router.get('/', async (req, res) => {
  try {
    if (prisma && isDbConnected()) {
      const dbLeads = await prisma.lead.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return res.json({
        success: true,
        source: 'PostgreSQL Database',
        count: dbLeads.length,
        data: dbLeads,
      });
    }

    return res.json({
      success: true,
      source: 'Memory Cache',
      count: memoryLeads.length,
      data: memoryLeads,
    });
  } catch (err) {
    console.error('❌ [Leads API] Error fetching leads:', err.message);
    return res.json({
      success: true,
      source: 'Fallback Memory',
      count: memoryLeads.length,
      data: memoryLeads,
      warning: err.message,
    });
  }
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/leads/:id
 * Fetch single lead by ID
 * ─────────────────────────────────────────────────────────────────────────────
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (prisma && isDbConnected()) {
      const dbLead = await prisma.lead.findUnique({
        where: { id },
      });
      if (dbLead) {
        return res.json({ success: true, data: dbLead });
      }
    }

    const memLead = memoryLeads.find((l) => l.id === id);
    if (memLead) {
      return res.json({ success: true, data: memLead });
    }

    return res.status(404).json({ success: false, error: 'Lead not found' });
  } catch (err) {
    console.error(`❌ [Leads API] Error fetching lead ${id}:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/leads
 * Create new lead in PostgreSQL (or Memory) & notify agents via Socket.io
 * ─────────────────────────────────────────────────────────────────────────────
 */
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const leadId = body.id || uuidv4();
    const now = new Date();

    const firstName = body.firstName || (body.name ? body.name.split(' ')[0] : 'Traveler');
    const lastName = body.lastName || (body.name && body.name.split(' ').length > 1 ? body.name.split(' ').slice(1).join(' ') : '');
    const phone = body.phone || body.phoneNumber || body.fullPhone || '';
    const email = body.email || '';
    const nationality = body.nationality || 'Indian';
    const preferredLanguage = body.preferredLanguage || 'English';
    const serviceId = body.serviceId || body.cabinClass?.toLowerCase() || 'economy';
    const status = body.status || 'New Lead';
    const origin = (body.origin || 'DEL').toUpperCase();
    const destination = (body.destination || 'LHR').toUpperCase();
    const travelDate = body.travelDate || '';
    const passengers = Number(body.passengers) || 1;
    const budget = body.budget ? parseFloat(body.budget) : null;
    const notes = body.notes || `Inquiry created in CRM for ${origin} → ${destination} (${passengers} pax)`;
    const assignedAgentId = body.assignedAgentId || null;

    const leadRecord = {
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
      createdAt: now,
      updatedAt: now,
    };

    let createdRecord = null;

    // 1. Try PostgreSQL insertion if connected
    if (prisma && isDbConnected()) {
      try {
        createdRecord = await prisma.lead.create({
          data: leadRecord,
        });
        console.log(`✅ [PostgreSQL] Created new lead: ${createdRecord.id} (${firstName} ${lastName})`);
      } catch (dbErr) {
        console.warn('⚠️ [PostgreSQL] prisma.lead.create failed, falling back to memory:', dbErr.message);
      }
    }

    // 2. Fallback in memory
    if (!createdRecord) {
      createdRecord = leadRecord;
      memoryLeads.unshift(createdRecord);
      console.log(`📁 [Memory] Saved lead: ${createdRecord.id} (${firstName} ${lastName})`);
    } else {
      memoryLeads.unshift(createdRecord);
    }

    // 3. Broadcast real-time Socket.io event to all connected agents
    const io = req.app.get('io');
    if (io) {
      io.to('agents_group').emit('lead:new', createdRecord);
      console.log(`📡 [Socket.io] Broadcasted lead:new to agents_group (${createdRecord.id})`);
    }

    return res.status(201).json({
      success: true,
      message: 'Lead created successfully',
      data: createdRecord,
    });
  } catch (err) {
    console.error('❌ [Leads API] Error creating lead:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to create lead',
      message: err.message,
    });
  }
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PUT /api/leads/:id
 * Update an existing lead
 * ─────────────────────────────────────────────────────────────────────────────
 */
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body || {};

  try {
    let updatedRecord = null;

    if (prisma && isDbConnected()) {
      try {
        updatedRecord = await prisma.lead.update({
          where: { id },
          data: {
            ...updates,
            updatedAt: new Date(),
          },
        });
        console.log(`✅ [PostgreSQL] Updated lead: ${id}`);
      } catch (dbErr) {
        console.warn(`⚠️ [PostgreSQL] prisma.lead.update failed for ${id}:`, dbErr.message);
      }
    }

    // Update in memory array
    const memIndex = memoryLeads.findIndex((l) => l.id === id);
    if (memIndex !== -1) {
      memoryLeads[memIndex] = { ...memoryLeads[memIndex], ...updates, updatedAt: new Date() };
      if (!updatedRecord) updatedRecord = memoryLeads[memIndex];
    } else if (!updatedRecord) {
      updatedRecord = { id, ...updates, updatedAt: new Date() };
      memoryLeads.unshift(updatedRecord);
    }

    // Broadcast update via socket
    const io = req.app.get('io');
    if (io && updatedRecord) {
      io.to('agents_group').emit('lead:updated', updatedRecord);
    }

    return res.json({
      success: true,
      message: 'Lead updated successfully',
      data: updatedRecord,
    });
  } catch (err) {
    console.error(`❌ [Leads API] Error updating lead ${id}:`, err);
    return res.status(500).json({
      success: false,
      error: 'Failed to update lead',
      message: err.message,
    });
  }
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DELETE /api/leads/:id
 * Delete a lead
 * ─────────────────────────────────────────────────────────────────────────────
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (prisma && isDbConnected()) {
      try {
        await prisma.lead.delete({ where: { id } });
        console.log(`✅ [PostgreSQL] Deleted lead: ${id}`);
      } catch (dbErr) {
        console.warn(`⚠️ [PostgreSQL] prisma.lead.delete failed for ${id}:`, dbErr.message);
      }
    }

    memoryLeads = memoryLeads.filter((l) => l.id !== id);

    const io = req.app.get('io');
    if (io) {
      io.to('agents_group').emit('lead:deleted', { id });
    }

    return res.json({
      success: true,
      message: `Lead ${id} deleted successfully`,
    });
  } catch (err) {
    console.error(`❌ [Leads API] Error deleting lead ${id}:`, err);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete lead',
      message: err.message,
    });
  }
});

module.exports = router;
