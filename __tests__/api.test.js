/**
 * @jest-environment node
 */
const request = require('supertest');
const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');

let app, db, httpServer;

beforeAll((done) => {
  process.env.NODE_ENV = 'test';
  process.env.TEACHER_PASSWORD = 'test1234';
  
  delete require.cache[require.resolve('../server')];
  const mod = require('../server');
  app = mod.app;
  db = mod.db;
  
  // 테스트용 HTTP 서버
  httpServer = createServer(app);
  httpServer.listen(() => {
    const port = httpServer.address().port;
    process.env.TEST_PORT = port;
    done();
  });
});

afterAll((done) => {
  httpServer.close(done);
});

// ====== REST API Tests ======

describe('POST /api/teacher/login', () => {
  test('올바른 비밀번호로 로그인 성공', async () => {
    const res = await request(app)
      .post('/api/teacher/login')
      .send({ password: 'test1234' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('틀린 비밀번호로 로그인 실패', async () => {
    const res = await request(app)
      .post('/api/teacher/login')
      .send({ password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/word-sets', () => {
  test('기본 단어세트 목록 반환', async () => {
    const res = await request(app).get('/api/word-sets');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(4);
    expect(res.body[0]).toHaveProperty('topic');
    expect(res.body[0]).toHaveProperty('words');
  });
});

describe('POST /api/word-sets', () => {
  test('새 단어세트 추가', async () => {
    const res = await request(app)
      .post('/api/word-sets')
      .send({ topic: '테스트주제', words: 'A,B,C' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body.topic).toBe('테스트주제');
  });
});

describe('POST /api/rooms', () => {
  test('방 생성 및 6자리 코드 반환', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .send({ teamName: '1모둠' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('roomCode');
    expect(res.body.teamName).toBe('1모둠');
    expect(res.body.roomCode).toMatch(/^[A-Z0-9]{6}$/);
  });
});

describe('GET /api/rooms', () => {
  test('방 목록 반환', async () => {
    const res = await request(app).get('/api/rooms');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ====== Socket.io Tests ======

describe('Socket.io Events', () => {
  let serverSocket, io, httpSrv, clientSocket;

  beforeAll((done) => {
    httpSrv = createServer(app);
    io = new Server(httpSrv, { transports: ['websocket'] });
    
    httpSrv.listen(() => {
      const port = httpSrv.address().port;
      clientSocket = new Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        forceNew: true,
      });
      io.on('connection', (socket) => {
        serverSocket = socket;
      });
      clientSocket.on('connect', done);
    });
  });

  afterAll((done) => {
    if (clientSocket && clientSocket.connected) clientSocket.close();
    io && io.close();
    httpSrv && httpSrv.close(done);
  });

  test('client가 서버에 연결됨', () => {
    expect(clientSocket.connected).toBe(true);
  });
});
