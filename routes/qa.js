/**
 * routes/qa.js
 * WowMyFlight CRM — Phase 3: QA (Quality Assurance) REST API
 * Route Name Matches Menu: "QA" -> /api/qa
 */

const express = require('express');
const router = express.Router();
const { prisma } = require('../db');

let QA_DOCUMENTS = [
  {
    id: 'DOC-101',
    type: 'Passport',
    customerName: 'Karan Singh',
    customerEmail: 'karan@example.com',
    bookingRef: 'BK-001',
    pnr: 'SAB78K',
    fileName: 'Karan_Singh_US_Passport_2031.pdf',
    fileSize: '2.4 MB',
    uploadDate: '2026-06-18',
    expiryDate: '2031-08-15',
    verifiedBy: 'Super Admin (CEO)',
    status: 'Verified',
    notes: 'US Citizen Passport verified valid (> 6 months validity for UK entry).'
  },
  {
    id: 'DOC-102',
    type: 'E-Ticket (PDF)',
    customerName: 'Karan Singh',
    customerEmail: 'karan@example.com',
    bookingRef: 'BK-001',
    pnr: 'SAB78K',
    fileName: 'BA_ClubWorld_eTicket_1259834102941.pdf',
    fileSize: '1.1 MB',
    uploadDate: '2026-06-18',
    expiryDate: '2026-10-15',
    verifiedBy: 'Ticketing Desk',
    status: 'Verified',
    notes: 'British Airways 13-digit GDS e-ticket confirmed and active.'
  },
  {
    id: 'DOC-103',
    type: 'Official Itinerary',
    customerName: 'Elena Rostova',
    customerEmail: 'elena@example.com',
    bookingRef: 'BK-002',
    pnr: 'AM449X',
    fileName: 'AirFrance_Official_Itinerary_JFK_CDG.pdf',
    fileSize: '850 KB',
    uploadDate: '2026-06-20',
    expiryDate: '2026-09-20',
    verifiedBy: 'Super Admin (CEO)',
    status: 'Verified',
    notes: 'Itinerary generated and dispatched to passenger.'
  },
  {
    id: 'DOC-104',
    type: 'Travel Insurance',
    customerName: 'Elena Rostova',
    customerEmail: 'elena@example.com',
    bookingRef: 'BK-002',
    pnr: 'AM449X',
    fileName: 'Allianz_Travel_Insurance_Policy_3920.pdf',
    fileSize: '1.8 MB',
    uploadDate: '2026-06-21',
    expiryDate: '2026-09-30',
    verifiedBy: 'Operations Desk',
    status: 'Verified',
    notes: 'Comprehensive international medical & cancellation policy.'
  },
  {
    id: 'DOC-105',
    type: 'Visa Copy',
    customerName: 'Rajesh Sharma',
    customerEmail: 'rajesh@example.com',
    bookingRef: 'BK-003',
    pnr: 'UA9921',
    fileName: 'UK_Standard_Visitor_Visa_RS.pdf',
    fileSize: '3.1 MB',
    uploadDate: '2026-06-22',
    expiryDate: '2026-12-15',
    verifiedBy: 'Pending Review',
    status: 'Under Review',
    notes: 'Valid 6-month UK standard visitor visa submitted for compliance check.'
  },
  {
    id: 'DOC-106',
    type: 'Auth Form',
    customerName: 'Carlos Rivera',
    customerEmail: 'carlos@example.com',
    bookingRef: 'BK-004',
    pnr: 'IB7782',
    fileName: 'CC_Authorization_Form_Signed.pdf',
    fileSize: '950 KB',
    uploadDate: '2026-06-23',
    expiryDate: '2026-11-05',
    verifiedBy: 'Finance Desk',
    status: 'Verified',
    notes: 'DocuSign digital signature verified for credit card payment of $3,450.'
  }
];

let QA_AUDITS = [
  {
    id: 'CALL-8801',
    agentId: 'ag-1',
    agentName: 'Maria Santos',
    customerName: 'Michael Chen',
    pnr: 'ABC12D',
    date: '2026-08-20 10:15',
    duration: '04:35',
    overallScore: 96,
    status: 'Passed',
    evaluator: 'Super Admin (QA Lead)',
    feedback: 'Excellent greeting, accurate PNR verification, clear fare rule explanation.',
    scores: { greeting: 100, verification: 100, fareExplanation: 95, upselling: 90, closing: 95 }
  },
  {
    id: 'CALL-8802',
    agentId: 'ag-2',
    agentName: 'Omar Farouq',
    customerName: 'Elena Rostova',
    pnr: 'SAB78K',
    date: '2026-08-20 11:40',
    duration: '06:12',
    overallScore: 92,
    status: 'Passed',
    evaluator: 'Super Admin (QA Lead)',
    feedback: 'Solid baggage explanation, confirmed 13-digit e-ticket promptly.',
    scores: { greeting: 95, verification: 95, fareExplanation: 90, upselling: 85, closing: 95 }
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/qa (or /api/qa/documents)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status, type, search } = req.query;

    if (prisma) {
      try {
        const dbDocs = await prisma.document.findMany({ orderBy: { createdAt: 'desc' } });
        if (dbDocs && dbDocs.length > 0) {
          return res.json({
            success: true,
            count: dbDocs.length,
            data: dbDocs.map(d => ({
              id: d.id,
              type: d.category || 'Passport',
              customerName: d.customerName || 'Traveler',
              customerEmail: d.customerEmail || 'client@wowmyflight.com',
              bookingRef: d.bookingRef || 'BK-101',
              pnr: d.pnr || 'WMF-99',
              fileName: d.fileName || 'document.pdf',
              fileSize: d.fileSize || '1.8 MB',
              uploadDate: d.createdAt ? String(d.createdAt).substring(0, 10) : '2026-10-09',
              expiryDate: d.expiryDate || '2031-10-15',
              verifiedBy: d.reviewedBy || 'QA Officer',
              status: d.status || 'Verified',
              notes: d.comment || d.notes || 'Document verified.'
            }))
          });
        }
      } catch (err) {
        console.warn('[QA API] Prisma fallback to memory:', err.message);
      }
    }

    let filtered = [...QA_DOCUMENTS];
    if (status && status !== 'all') filtered = filtered.filter(d => d.status.toLowerCase() === status.toLowerCase());
    if (type && type !== 'all') filtered = filtered.filter(d => d.type.toLowerCase() === type.toLowerCase());
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(d =>
        d.id.toLowerCase().includes(q) ||
        d.customerName.toLowerCase().includes(q) ||
        d.fileName.toLowerCase().includes(q) ||
        d.bookingRef.toLowerCase().includes(q)
      );
    }

    res.json({
      success: true,
      count: filtered.length,
      data: filtered,
      kpis: {
        total: QA_DOCUMENTS.length,
        verified: QA_DOCUMENTS.filter(d => d.status === 'Verified').length,
        underReview: QA_DOCUMENTS.filter(d => d.status === 'Under Review').length,
        uploaded: QA_DOCUMENTS.filter(d => d.status === 'Uploaded').length,
        avgQaScore: 94.8
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/documents', (req, res) => {
  res.json({ success: true, count: QA_DOCUMENTS.length, data: QA_DOCUMENTS });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST /api/qa/documents (Upload / Create)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/documents', async (req, res) => {
  try {
    const b = req.body || {};
    const newDoc = {
      id: b.id || `DOC-${QA_DOCUMENTS.length + 101}`,
      type: b.type || 'Passport',
      customerName: b.customerName || 'Traveler',
      customerEmail: b.customerEmail || 'client@wowmyflight.com',
      bookingRef: b.bookingRef || 'BK-101',
      pnr: b.pnr || 'WMF-99',
      fileName: b.fileName || 'Travel_Document.pdf',
      fileSize: b.fileSize || '1.5 MB',
      uploadDate: new Date().toISOString().split('T')[0],
      expiryDate: b.expiryDate || '2031-10-15',
      verifiedBy: 'Pending Review',
      status: 'Uploaded',
      notes: b.notes || 'Uploaded via QA Dashboard.'
    };

    if (prisma) {
      try {
        await prisma.document.create({
          data: {
            customerName: newDoc.customerName,
            fileName: newDoc.fileName,
            fileType: 'application/pdf',
            fileSize: newDoc.fileSize,
            fileUrl: 'https://assets.wowmyflight.com/docs/' + newDoc.fileName,
            category: newDoc.type,
            status: 'Uploaded',
            comment: newDoc.notes
          }
        });
      } catch (err) {
        console.warn('[QA API] Prisma document create warning:', err.message);
      }
    }

    QA_DOCUMENTS.unshift(newDoc);
    res.json({ success: true, message: `Document ${newDoc.id} uploaded successfully`, data: newDoc });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. PUT /api/qa/documents/:id/status
// ─────────────────────────────────────────────────────────────────────────────
router.put('/documents/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, verifiedBy = 'Super Admin (QA Lead)', notes } = req.body;

    const doc = QA_DOCUMENTS.find(d => d.id === id);
    if (!doc) return res.status(404).json({ success: false, error: 'Document not found' });

    doc.status = status;
    doc.verifiedBy = verifiedBy;
    if (notes) doc.notes = notes;

    if (prisma) {
      try {
        await prisma.document.updateMany({
          where: { id },
          data: { status, reviewedBy: verifiedBy, comment: notes }
        });
      } catch (err) {}
    }

    res.json({ success: true, message: `Document ${id} marked as ${status}`, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. QA Call & Booking Audits
// ─────────────────────────────────────────────────────────────────────────────
router.get('/audits', (req, res) => {
  res.json({
    success: true,
    count: QA_AUDITS.length,
    data: QA_AUDITS,
    stats: {
      averageScore: 94.2,
      passedCount: QA_AUDITS.filter(a => a.status === 'Passed').length,
      auditedToday: 18,
      qaCompliance: '97.4%'
    }
  });
});

router.post('/audits', (req, res) => {
  const b = req.body || {};
  const newAudit = {
    id: `CALL-${Math.floor(8800 + Math.random() * 1000)}`,
    agentId: b.agentId || 'ag-1',
    agentName: b.agentName || 'Agent',
    customerName: b.customerName || 'Customer',
    pnr: b.pnr || 'WMF-01',
    date: new Date().toISOString().replace('T', ' ').substring(0, 16),
    duration: b.duration || '04:15',
    overallScore: b.overallScore || 95,
    status: (b.overallScore || 95) >= 90 ? 'Passed' : 'Needs Coaching',
    evaluator: b.evaluator || 'Super Admin (QA)',
    feedback: b.feedback || 'QA scorecard audit completed.',
    scores: b.scores || { greeting: 100, verification: 95, fareExplanation: 90, closing: 95 }
  };
  QA_AUDITS.unshift(newAudit);
  res.json({ success: true, message: 'QA Audit evaluation saved successfully', data: newAudit });
});

module.exports = router;
