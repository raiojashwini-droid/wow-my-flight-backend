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
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const leadStore = require('../store/leadStore');
const { prisma, isDbConnected } = require('../db');

// Persistent metadata file for extended CRM fields (city, returnDate, source, priority, labels, etc.)
const METADATA_FILE = path.join(__dirname, '../store/leads_metadata.json');

function loadMetadata() {
  try {
    if (fs.existsSync(METADATA_FILE)) {
      return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('⚠️ [Leads API] Could not load leads_metadata.json:', e.message);
  }
  return {};
}

function saveMetadata(data) {
  try {
    const dir = path.dirname(METADATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(METADATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.warn('⚠️ [Leads API] Could not save leads_metadata.json:', e.message);
  }
}

let metadataStore = loadMetadata();

function formatLead(lead) {
  if (!lead) return null;
  const store = loadMetadata();
  let meta = store[lead.id] || metadataStore[lead.id];
  if (!meta) {
    const values = Object.values(store);
    meta = values.find(m => (m.email && lead.email && m.email.toLowerCase() === lead.email.toLowerCase()) || (m.phone && lead.phone && m.phone === lead.phone)) || {};
  }

  const country = meta.country || lead.country || lead.nationality || '';
  const city = meta.city || lead.city || '';
  const timezone = meta.timezone || lead.timezone || '';
  const returnDate = meta.returnDate || lead.returnDate || '';
  const flexibility = meta.flexibility || lead.flexibility || 'Exact Dates';
  const adults = Number(meta.adults) || Number(lead.adults) || Number(lead.passengers) || 1;
  const children = Number(meta.children) || Number(lead.children) || 0;
  const infants = Number(meta.infants) || Number(lead.infants) || 0;
  const budget = meta.budget || (lead.budget !== null && lead.budget !== undefined ? (String(lead.budget).startsWith('$') ? String(lead.budget) : `$${lead.budget}`) : '');
  const source = meta.source || lead.source || '';
  const priority = meta.priority || lead.priority || 'Medium';
  const labels = Array.isArray(meta.labels) ? meta.labels : (Array.isArray(lead.labels) ? lead.labels : []);
  const notes = lead.notes || meta.notes || '';
  const activities = Array.isArray(meta.activities) && meta.activities.length > 0 ? meta.activities : (Array.isArray(lead.activities) ? lead.activities : []);
  const cabinClass = meta.cabinClass || lead.cabinClass || (lead.serviceId ? lead.serviceId.charAt(0).toUpperCase() + lead.serviceId.slice(1) : 'Economy');

  return {
    ...lead,
    country,
    nationality: lead.nationality || country,
    city,
    timezone,
    timeZone: timezone,
    returnDate,
    flexibility,
    adults,
    children,
    infants,
    passengers: adults + children + infants,
    budget,
    source,
    priority,
    labels,
    notes,
    activities,
    cabinClass
  };
}

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

        const formattedList = Array.from(combinedMap.values()).map(formatLead);
        return res.json({
          success: true,
          source: 'PostgreSQL Database',
          count: formattedList.length,
          data: formattedList
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

    const formattedFallback = fallbackData.map(formatLead);
    return res.json({
      success: true,
      source: 'Fallback Memory',
      count: formattedFallback.length,
      data: formattedFallback
    });
  } catch (err) {
    console.error('❌ [Leads API] Error fetching leads:', err.message);
    let fallbackData = memoryLeads;
    if (leadStore && typeof leadStore.getLeads === 'function') {
      const storeResult = leadStore.getLeads({ isSandbox: req.query.env === 'SANDBOX' });
      fallbackData = storeResult.data || [];
    }
    const formattedFallback = fallbackData.map(formatLead);
    return res.json({
      success: true,
      source: 'fallback',
      count: formattedFallback.length,
      data: formattedFallback,
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
          return res.json({ success: true, data: formatLead(lead) });
        }
      } catch (dbErr) {
        console.warn(`⚠️ [Leads API] Could not fetch lead ${id} from DB:`, dbErr.message);
      }
    }

    if (leadStore && typeof leadStore.getLeadById === 'function') {
      const memLead = leadStore.getLeadById(id);
      if (memLead) return res.json({ success: true, data: formatLead(memLead) });
    }

    const localMemLead = memoryLeads.find((l) => l.id === id);
    if (localMemLead) {
      return res.json({ success: true, data: formatLead(localMemLead) });
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
    const nationality = body.country || body.nationality || null;
    const preferredLanguage = body.preferredLanguage || 'English';
    const serviceId = body.serviceId || body.cabinClass?.toLowerCase() || 'economy';
    const status = body.status || 'New Lead';
    const origin = body.origin ? body.origin.toUpperCase() : null;
    const destination = body.destination ? body.destination.toUpperCase() : null;
    const travelDate = body.travelDate || null;
    const passengers = parseInt(body.adults || body.passengers, 10) || 1;
    const rawBudget = body.budget ? String(body.budget).replace(/[^0-9.]/g, '') : null;
    const budget = rawBudget ? parseFloat(rawBudget) : null;
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

    // Save extended CRM fields into persistent metadata store
    metadataStore = loadMetadata();
    metadataStore[leadId] = {
      id: leadId,
      country: body.country || body.nationality || '',
      city: body.city || '',
      timezone: body.timezone || '',
      returnDate: body.returnDate || '',
      flexibility: body.flexibility || 'Exact Dates',
      adults: parseInt(body.adults || body.passengers, 10) || 1,
      children: parseInt(body.children, 10) || 0,
      infants: parseInt(body.infants, 10) || 0,
      cabinClass: body.cabinClass || (serviceId ? serviceId.charAt(0).toUpperCase() + serviceId.slice(1) : 'Economy'),
      budget: body.budget ? String(body.budget) : '',
      source: body.source || '',
      priority: body.priority || 'Medium',
      labels: Array.isArray(body.labels) ? body.labels : [],
      notes: body.notes || (origin && destination ? `Inquiry created in CRM for ${origin} → ${destination} (${passengers} pax)` : ''),
      activities: Array.isArray(body.activities) ? body.activities : [
        { time: now.toLocaleTimeString(), agent: 'Admin', status: 'New Lead Created', comments: `Flight request for ${origin} → ${destination}` }
      ]
    };
    saveMetadata(metadataStore);

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
    const enrichedLead = formatLead(finalLead);

    // Save in memory fallback
    memoryLeads.unshift(enrichedLead);
    if (leadStore && typeof leadStore.addLead === 'function') {
      try { leadStore.addLead(enrichedLead); } catch (e) { }
    }

    // Real-time broadcast to all connected agents
    const io = req.app.get('io');
    if (io) {
      io.to('agents_group').emit('lead:new', enrichedLead);
      console.log(`📡 [Socket.io] Broadcasted lead:new to agents_group (${enrichedLead.id})`);
    }

    return res.status(201).json({
      success: true,
      message: 'Lead created successfully',
      data: enrichedLead,
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

    // Update persistent metadata store
    metadataStore = loadMetadata();
    metadataStore[id] = {
      ...(metadataStore[id] || {}),
      ...(updates.country !== undefined ? { country: updates.country } : {}),
      ...(updates.city !== undefined ? { city: updates.city } : {}),
      ...(updates.timezone !== undefined ? { timezone: updates.timezone } : {}),
      ...(updates.returnDate !== undefined ? { returnDate: updates.returnDate } : {}),
      ...(updates.flexibility !== undefined ? { flexibility: updates.flexibility } : {}),
      ...(updates.adults !== undefined ? { adults: updates.adults } : {}),
      ...(updates.children !== undefined ? { children: updates.children } : {}),
      ...(updates.infants !== undefined ? { infants: updates.infants } : {}),
      ...(updates.cabinClass !== undefined ? { cabinClass: updates.cabinClass } : {}),
      ...(updates.budget !== undefined ? { budget: updates.budget } : {}),
      ...(updates.source !== undefined ? { source: updates.source } : {}),
      ...(updates.priority !== undefined ? { priority: updates.priority } : {}),
      ...(updates.labels !== undefined ? { labels: updates.labels } : {}),
      ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
      ...(updates.activities !== undefined ? { activities: updates.activities } : {})
    };
    saveMetadata(metadataStore);

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
    const enrichedResult = formatLead(result);

    const io = req.app.get('io');
    if (io) {
      io.to('agents_group').emit('lead:updated', enrichedResult);
    }

    return res.json({
      success: true,
      message: 'Lead updated successfully',
      data: enrichedResult,
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

    // Delete from metadata store
    metadataStore = loadMetadata();
    delete metadataStore[id];
    saveMetadata(metadataStore);

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
