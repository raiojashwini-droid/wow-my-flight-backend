/**
 * chatStore.js
 * In-memory cache + Live PostgreSQL (Prisma) persistence for live chat sessions and messages.
 */

const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../db');

// In-memory cache for ultra-fast Socket.io broadcasting
const chatSessions = [];
const messages = [];

// Pre-load past active chat sessions from PostgreSQL on startup
async function initChatStore() {
  if (!prisma) return;
  try {
    const dbSessions = await prisma.chatSession.findMany({
      include: { messages: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    if (Array.isArray(dbSessions)) {
      dbSessions.forEach((ds) => {
        if (!chatSessions.some((s) => s.id === ds.id)) {
          chatSessions.push({
            id: ds.id,
            customerName: ds.customerName || 'Guest',
            customerEmail: ds.customerEmail || '',
            customerPhone: ds.customerPhone || '',
            status: ds.status || 'active',
            agentId: ds.agentId || null,
            createdAt: ds.createdAt ? ds.createdAt.toISOString() : new Date().toISOString(),
            lastActivityAt: ds.lastActivityAt ? ds.lastActivityAt.toISOString() : new Date().toISOString(),
          });
        }

        if (Array.isArray(ds.messages)) {
          ds.messages.forEach((dm) => {
            if (!messages.some((m) => m.id === dm.id)) {
              messages.push({
                id: dm.id,
                sessionId: dm.sessionId,
                senderType: dm.senderType,
                senderId: dm.senderId,
                senderName: dm.senderName,
                text: dm.text,
                type: dm.type || 'text',
                attachment: dm.attachment || null,
                timestamp: dm.createdAt ? dm.createdAt.toISOString() : new Date().toISOString(),
                status: 'delivered',
              });
            }
          });
        }
      });
      console.log(`💬 [LiveChat] Synchronized ${chatSessions.length} chat sessions and ${messages.length} messages from PostgreSQL`);
    }
  } catch (err) {
    console.warn('[LiveChat] PostgreSQL chat init error:', err.message);
  }
}

// Automatically initiate on startup
initChatStore();

/**
 * Create a new chat session for a customer
 */
function createSession({ customerName, customerEmail, customerPhone }) {
  const session = {
    id: uuidv4(),
    customerName: customerName || 'Guest',
    customerEmail: customerEmail || '',
    customerPhone: customerPhone || '',
    status: 'active',
    agentId: null,
    createdAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
  };

  chatSessions.push(session);

  // Asynchronous background persistence to PostgreSQL
  if (prisma) {
    prisma.chatSession.create({
      data: {
        id: session.id,
        customerName: session.customerName,
        customerEmail: session.customerEmail,
        customerPhone: session.customerPhone,
        status: session.status,
      }
    }).catch(err => console.warn('[LiveChat] DB session create error:', err.message));
  }

  return session;
}

/**
 * Get a session by ID
 */
function getSession(sessionId) {
  return chatSessions.find(s => s.id === sessionId);
}

/**
 * Get all chat sessions (for the agent dashboard)
 */
function getAllSessions() {
  return chatSessions.sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt));
}

/**
 * Resolve a session
 */
function resolveSession(sessionId) {
  const session = getSession(sessionId);
  if (session) {
    session.status = 'resolved';
    session.lastActivityAt = new Date().toISOString();
    if (prisma) {
      prisma.chatSession.update({
        where: { id: sessionId },
        data: { status: 'resolved', lastActivityAt: new Date(session.lastActivityAt) }
      }).catch(() => {});
    }
  }
  return session;
}

/**
 * Assign an agent to a chat session
 */
function assignAgentToSession(sessionId, agentId) {
  const session = getSession(sessionId);
  if (session) {
    session.agentId = agentId;
    session.lastActivityAt = new Date().toISOString();
    if (prisma) {
      prisma.chatSession.update({
        where: { id: sessionId },
        data: { agentId, lastActivityAt: new Date(session.lastActivityAt) }
      }).catch(() => {});
    }
  }
  return session;
}

/**
 * Unassign agent from session (Transfer)
 */
function unassignSession(sessionId) {
  const session = getSession(sessionId);
  if (session) {
    session.agentId = null;
    session.lastActivityAt = new Date().toISOString();
    if (prisma) {
      prisma.chatSession.update({
        where: { id: sessionId },
        data: { agentId: null, lastActivityAt: new Date(session.lastActivityAt) }
      }).catch(() => {});
    }
  }
  return session;
}

/**
 * Block a user's session
 */
function blockSession(sessionId) {
  const session = getSession(sessionId);
  if (session) {
    session.status = 'blocked';
    session.lastActivityAt = new Date().toISOString();
    if (prisma) {
      prisma.chatSession.update({
        where: { id: sessionId },
        data: { status: 'blocked', lastActivityAt: new Date(session.lastActivityAt) }
      }).catch(() => {});
    }
  }
  return session;
}

/**
 * Add a new message to a session
 */
function addMessage({ sessionId, senderType, senderId, senderName, text, type, attachment }) {
  const session = getSession(sessionId);
  if (!session) return null;

  const msg = {
    id: uuidv4(),
    sessionId,
    senderType, // 'customer' or 'agent'
    senderId,   // socket.id for customer, or agentId for agent
    senderName,
    text,
    type: type || 'text',
    attachment: attachment || null,
    timestamp: new Date().toISOString(),
    status: 'delivered', // 'sent', 'delivered', 'read'
  };

  messages.push(msg);
  
  // Update last activity
  session.lastActivityAt = msg.timestamp;

  // Asynchronous background persistence to PostgreSQL
  if (prisma) {
    prisma.chatMessage.create({
      data: {
        id: msg.id,
        sessionId: msg.sessionId,
        senderType: msg.senderType,
        senderId: String(msg.senderId || ''),
        senderName: msg.senderName || '',
        text: msg.text || '',
        type: msg.type,
        attachment: msg.attachment,
      }
    }).then(() => {
      return prisma.chatSession.update({
        where: { id: sessionId },
        data: { lastActivityAt: new Date(msg.timestamp) }
      }).catch(() => {});
    }).catch(err => console.warn('[LiveChat] DB message create error:', err.message));
  }

  return msg;
}

/**
 * Get all messages for a specific session
 */
function getMessagesForSession(sessionId) {
  return messages
    .filter(m => m.sessionId === sessionId)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

/**
 * Mark messages as read
 */
function markMessagesAsRead(sessionId, readerType) {
  let updated = false;
  messages.forEach(m => {
    if (m.sessionId === sessionId && m.senderType !== readerType && m.status !== 'read') {
      m.status = 'read';
      updated = true;
    }
  });
  return updated;
}

module.exports = {
  createSession,
  getSession,
  getAllSessions,
  resolveSession,
  assignAgentToSession,
  unassignSession,
  blockSession,
  addMessage,
  getMessagesForSession,
  markMessagesAsRead,
};
