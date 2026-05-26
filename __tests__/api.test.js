/**
 * @jest-environment node
 */
const request = require('supertest');
const fs = require('fs');
const path = require('path');

let app, httpServer;

beforeAll((done) => {
  process.env.NODE_ENV = 'test';
  process.env.TEACHER_PASSWORD = 'test1234';
  
  // data 디렉토리 보장
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  
  delete require.cache[require.resolve('../server')];
  const mod = require('../server');
  app = mod.app;
  
  httpServer = require('http').createServer(app);
  httpServer.listen(() => {
    process.env.TEST_PORT = httpServer.address().port;
    done();
  });
});

afterAll((done) => {
  httpServer.close(done);
});

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
  }, 10000);
});

describe('POST /api/word-sets', () => {
  test('새 단어세트 추가', async () => {
    const res = await request(app)
      .post('/api/word-sets')
      .send({ topic: '테스트주제', words: 'A,B,C' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body.topic).toBe('테스트주제');
  }, 10000);
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
  }, 10000);
});

describe('GET /api/rooms', () => {
  test('방 목록 반환', async () => {
    const res = await request(app).get('/api/rooms');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  }, 10000);
});
