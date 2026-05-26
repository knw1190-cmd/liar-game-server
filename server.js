// 라이어게임 Socket.io 서버
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const server = http.createServer(app);

// 정적 파일 서빙 (프론트엔드)
app.use(express.static('public'));

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const fs = require('fs');
const path = require('path');

// data 디렉토리 확인
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// SQLite DB 연결
const dbPath = path.join(dataDir, 'liar-game.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// DB 초기화
function initializeDatabase() {
  db.serialize(() => {
    db.run('CREATE TABLE IF NOT EXISTS rooms (id INTEGER PRIMARY KEY AUTOINCREMENT, room_code TEXT UNIQUE NOT NULL, team_name TEXT NOT NULL, current_round INTEGER DEFAULT 0, total_rounds INTEGER DEFAULT 5, status TEXT DEFAULT "waiting", created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
    db.run('CREATE TABLE IF NOT EXISTS players (id INTEGER PRIMARY KEY AUTOINCREMENT, room_id INTEGER NOT NULL, name TEXT NOT NULL, score INTEGER DEFAULT 0, is_liar BOOLEAN DEFAULT false, is_ready BOOLEAN DEFAULT false, FOREIGN KEY (room_id) REFERENCES rooms(id))');
    db.run('CREATE TABLE IF NOT EXISTS word_sets (id INTEGER PRIMARY KEY AUTOINCREMENT, topic TEXT NOT NULL, words TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
    db.run('CREATE TABLE IF NOT EXISTS teams (id INTEGER PRIMARY KEY AUTOINCREMENT, team_name TEXT UNIQUE NOT NULL, members TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
    db.run('CREATE TABLE IF NOT EXISTS round_log (id INTEGER PRIMARY KEY AUTOINCREMENT, room_id INTEGER NOT NULL, round_number INTEGER NOT NULL, liar_name TEXT NOT NULL, result TEXT NOT NULL, scores TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (room_id) REFERENCES rooms(id))');

    const defaultWords = [
      ['동물', '사자,호랑이,곰,여우,토끼,사슴'],
      ['과일', '사과,바나나,딸기,포도,수박,오렌지'],
      ['나라', '한국,일본,중국,미국,프랑스,독일'],
      ['직업', '선생님,의사,엔지니어,요리사,운전사,경찰']
    ];
    defaultWords.forEach(([topic, words]) => {
      db.run('INSERT OR IGNORE INTO word_sets (topic, words) VALUES (?, ?)', [topic, words]);
    });
  });
}

const gameStates = new Map();

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('joinRoom', ({ roomCode, name }) => {
    db.get('SELECT id, team_name, status FROM rooms WHERE room_code = ?', [roomCode], (err, room) => {
      if (err || !room) {
        socket.emit('joinError', '방이 존재하지 않습니다.');
        return;
      }
      db.run('INSERT INTO players (room_id, name) VALUES (?, ?)', [room.id, name], function(err) {
        if (err) { socket.emit('joinError', '이미 같은 이름이 있습니다.'); return; }
        io.to(roomCode).emit('playerJoined', { name });
        socket.join(roomCode);
        socket.emit('joinedRoom', { roomCode, name });
      });
    });
  });

  socket.on('startGame', (roomCode) => {
    const state = { currentRound: 1, totalRounds: 5, status: 'wordConfirm', players: [] };
    gameStates.set(roomCode, state);
    io.to(roomCode).emit('gameStarted', state);
  });

  socket.on('nextRound', (roomCode) => {
    const state = gameStates.get(roomCode);
    if (!state) return;
    state.currentRound++;
    state.status = 'wordConfirm';
    state.players.forEach(p => { p.hasConfirmed = false; p.hasExplained = false; });
    io.to(roomCode).emit('nextRound', state);
  });

  socket.on('confirmWord', ({ roomCode, playerName }) => {
    const state = gameStates.get(roomCode);
    if (!state) return;
    const player = state.players.find(p => p.name === playerName);
    if (player) player.hasConfirmed = true;
    io.to(roomCode).emit('wordConfirmed', { playerName });
  });

  socket.on('submitExplanation', ({ roomCode, playerName, explanation }) => {
    const state = gameStates.get(roomCode);
    if (!state || state.status !== 'explanation') return;
    const player = state.players.find(p => p.name === playerName);
    if (player && !player.hasExplained) {
      player.hasExplained = true;
      player.explanation = explanation;
      io.to(roomCode).emit('explanationSubmitted', { playerName, explanation });
      const allExplained = state.players.every(p => p.hasExplained);
      if (allExplained) {
        state.status = 'discussion';
        io.to(roomCode).emit('phaseChanged', { phase: 'discussion' });
      }
    }
  });

  socket.on('chatMessage', ({ roomCode, sender, text }) => {
    io.to(roomCode).emit('chatMessage', { sender, text });
  });

  socket.on('submitVote', ({ roomCode, voterName, targetName }) => {
    const state = gameStates.get(roomCode);
    if (!state || state.status !== 'voting') return;
    if (!state.votes) state.votes = {};
    state.votes[voterName] = targetName;
    io.to(roomCode).emit('voteSubmitted', { voterName, targetName });
  });

  socket.on('submitWordGuess', ({ roomCode, playerName, guessedWord }) => {
    const state = gameStates.get(roomCode);
    if (!state || state.status !== 'wordGuess') return;
    state.guessedWord = guessedWord;
    state.status = 'result';
    io.to(roomCode).emit('wordGuessResult', { guessedWord, result: state });
  });

  socket.on('endGame', (roomCode) => {
    const state = gameStates.get(roomCode);
    if (!state) return;
    gameStates.delete(roomCode);
    io.to(roomCode).emit('gameEnded', {});
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// REST API
app.use(express.json());

// 교사 비밀번호 (환경변수로 설정, 기본값은 랜덤 UUID 생성)
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || require('crypto').randomBytes(6).toString('hex');

// 교사 로그인
app.post('/api/teacher/login', (req, res) => {
  const { password } = req.body;
  if (password === TEACHER_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: '비밀번호가 틀렸습니다.' });
  }
});

app.get('/api/word-sets', (req, res) => {
  db.all('SELECT * FROM word_sets ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/word-sets', (req, res) => {
  const { topic, words } = req.body;
  db.run('INSERT INTO word_sets (topic, words) VALUES (?, ?)', [topic, words], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, topic, words });
  });
});

app.put('/api/word-sets/:id', (req, res) => {
  const { topic, words } = req.body;
  db.run('UPDATE word_sets SET topic = ?, words = ? WHERE id = ?', [topic, words, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ updated: true });
  });
});

app.delete('/api/word-sets/:id', (req, res) => {
  db.run('DELETE FROM word_sets WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: true });
  });
});

app.post('/api/rooms', (req, res) => {
  const { teamName } = req.body;
  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  db.run('INSERT INTO rooms (room_code, team_name, status) VALUES (?, ?, ?)',
    [roomCode, teamName, 'waiting'], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, roomCode, teamName });
  });
});

// 전체 방 목록 (교사용)
app.get('/api/rooms', (req, res) => {
  db.all('SELECT * FROM rooms ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/rooms/:code', (req, res) => {
  db.get('SELECT * FROM rooms WHERE room_code = ?', [req.params.code], (err, room) => {
    if (err || !room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  });
});

app.delete('/api/rooms/:code', (req, res) => {
  db.run('DELETE FROM rooms WHERE room_code = ?', [req.params.code], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: true });
  });
});

const PORT = process.env.PORT || 3001;

// 테스트 환경이 아닐 때만 서버 시작
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log('Liar Game server running on port ' + PORT);
  });
}

module.exports = { app, server, io, db };