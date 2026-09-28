/**
 * server/index.js
 * WowMyFlight CRM — Main Backend Server
 * 
 * Responsibilities:
 *   - Express HTTP server
 *   - Socket.io real-time events (incoming calls, call status, SMS)
 *   - CORS configured for React frontend
 *   - Telnyx routes mounted at /api/telnyx
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const telnyxRoutes = require('./routes/telnyx');
const chatStore = require('./store/chatStore');

const app = express();
const server = http.createServer(app);

// ─────────────────────────────────────────────────────────────────────────────
// Socket.io Setup — Real-time events to frontend
// ─────────────────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Make io accessible in route handlers via req.app.get('io')
app.set('io', io);

io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  // --- EXISTING LOGIC: Agent identifies themselves ---
  socket.on('agent:register', ({ agentId, agentName }) => {
    socket.join(`agent:${agentId}`); // Join agent-specific room
    socket.join('agents_group'); // All agents join this room to get global notifications
    console.log(`[Socket.io] Agent registered: ${agentName} (${agentId})`);
  });

  // --- LIVE CHAT LOGIC ---

  // 1. Customer initiates a chat
  socket.on('chat:customer_join', (customerDetails, callback) => {
    const session = chatStore.createSession(customerDetails);
    socket.join(`chat_${session.id}`); // Customer joins their own chat room
    console.log(`[Socket.io] Chat session created: ${session.id}`);
    
    // Notify all agents that a new chat has started
    io.to('agents_group').emit('chat:new_session', session);
    
    if (callback) callback({ sessionId: session.id });
  });

  // 1.5 Customer rejoins a chat after refresh
  socket.on('chat:customer_rejoin', ({ sessionId }, callback) => {
    const session = chatStore.getSession(sessionId);
    if (session) {
      socket.join(`chat_${sessionId}`);
      const messages = chatStore.getMessagesForSession(sessionId);
      if (callback) callback({ success: true, session, messages });
    } else {
      if (callback) callback({ success: false, error: 'Session not found' });
    }
  });

  // 2. Customer or Agent sends a message
  socket.on('chat:send_message', (messageData, callback) => {
    const { sessionId, senderType, senderId, senderName, text, type, attachment } = messageData;
    const msg = chatStore.addMessage({ sessionId, senderType, senderId, senderName, text, type, attachment });
    
    if (msg) {
      // Send the message to the specific chat room (both customer and joined agent will receive it)
      io.to(`chat_${sessionId}`).emit('chat:receive_message', msg);
      
      // Update session activity for agent's list
      io.to('agents_group').emit('chat:session_updated', chatStore.getSession(sessionId));
      
      if (callback) callback({ success: true, message: msg });
    } else {
      if (callback) callback({ success: false, error: 'Session not found' });
    }
  });

  // 3. Typing indicator
  socket.on('chat:typing', ({ sessionId, isTyping, senderType, senderName }) => {
    // Broadcast to everyone in the room except the sender
    socket.to(`chat_${sessionId}`).emit('chat:typing_status', { sessionId, isTyping, senderType, senderName });
    // Also notify agents group so the sidebar can show typing indicator
    io.to('agents_group').emit('chat:session_typing', { sessionId, isTyping, senderType });
  });

  // 3.5 Mark messages as read
  socket.on('chat:mark_read', ({ sessionId, readerType }) => {
    const updated = chatStore.markMessagesAsRead(sessionId, readerType);
    if (updated) {
      // Broadcast back to the room so the sender can see the read ticks
      io.to(`chat_${sessionId}`).emit('chat:messages_read', { sessionId, readerType });
    }
  });

  // 4. Agent joins a specific customer's chat room to reply
  socket.on('chat:agent_join_room', ({ sessionId, agentId }, callback) => {
    socket.join(`chat_${sessionId}`);
    const session = chatStore.assignAgentToSession(sessionId, agentId);
    
    // Send previous messages to the agent
    const messages = chatStore.getMessagesForSession(sessionId);
    
    // Notify everyone in the room that an agent has joined
    io.to(`chat_${sessionId}`).emit('chat:agent_joined', { agentId });
    io.to('agents_group').emit('chat:session_updated', session);

    if (callback) callback({ success: true, messages });
  });

  // 4. Get active sessions (requested by agent dashboard on mount)
  socket.on('chat:get_active_sessions', (data, callback) => {
    const sessions = chatStore.getAllSessions();
    if (typeof callback === 'function') {
      callback(sessions);
    } else if (typeof data === 'function') {
      data(sessions);
    }
  });

  // 5. Resolve a chat session
  socket.on('chat:resolve_session', ({ sessionId }, callback) => {
    const session = chatStore.resolveSession(sessionId);
    if (session) {
      io.to('agents_group').emit('chat:session_updated', session);
      if (callback) callback({ success: true, session });
    }
  });

  // 6. Transfer Chat (Unassign)
  socket.on('chat:transfer_session', ({ sessionId }, callback) => {
    const session = chatStore.unassignSession(sessionId);
    if (session) {
      io.to('agents_group').emit('chat:session_updated', session);
      if (callback) callback({ success: true, session });
    }
  });

  // 7. Block User
  socket.on('chat:block_session', ({ sessionId }, callback) => {
    const session = chatStore.blockSession(sessionId);
    if (session) {
      io.to('agents_group').emit('chat:session_updated', session);
      // Disconnect the customer socket from the room if needed
      io.to(`chat_${sessionId}`).emit('chat:blocked');
      if (callback) callback({ success: true, session });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
  ],
  credentials: true,
}));

// Parse JSON — NOTE: Telnyx webhook route uses express.raw() internally
app.use(express.json());

// ─────────────────────────────────────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'WowMyFlight CRM Backend',
    timestamp: new Date().toISOString(),
    telnyx: {
      configured: !!process.env.TELNYX_API_KEY,
      connectionId: process.env.TELNYX_CONNECTION_ID,
      defaultNumber: process.env.TELNYX_DEFAULT_FROM_NUMBER,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/telnyx', telnyxRoutes);

// ─────────────────────────────────────────────────────────────────────────────
// 404 Handler
// ─────────────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ─────────────────────────────────────────────────────────────────────────────
// Global Error Handler
// ─────────────────────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ─────────────────────────────────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   WowMyFlight Backend Server — LIVE   ║');
  console.log(`╠════════════════════════════════════════╣`);
  console.log(`║  URL:    http://localhost:${PORT}          ║`);
  console.log(`║  Health: http://localhost:${PORT}/health   ║`);
  console.log('╠════════════════════════════════════════╣');
  console.log(`║  Telnyx API Key: ${process.env.TELNYX_API_KEY ? '✓ Loaded' : '✗ MISSING!'}           ║`);
  console.log(`║  Default Number: ${process.env.TELNYX_DEFAULT_FROM_NUMBER} ║`);
  console.log('╚════════════════════════════════════════╝\n');
});
