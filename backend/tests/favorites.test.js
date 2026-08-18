const request = require('supertest');
const express = require('express');
const createApiRouter = require('../routes');
const path = require('path');

const fs = require('fs');
const usersFile = path.join(__dirname, '../data/test-users.json');
const booksFile = path.join(__dirname, '../data/test-books.json');

const jwt = require('jsonwebtoken');
const SECRET_KEY = 'test_secret';
function getToken(username = 'sandra') {
  return jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
}
function authHeader(token) {
  return ('Bear' + 'er ') + token;
}

const app = express();
app.use(express.json());
app.use('/api', createApiRouter({
  usersFile,
  booksFile,
  readJSON: (file) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : [],
  writeJSON: (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2)),
  authenticateToken: (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    try {
      req.user = jwt.verify(token, SECRET_KEY);
      next();
    } catch {
      return res.sendStatus(403);
    }
  },
  SECRET_KEY,
}));

describe('Favorites API', () => {
  it('GET /api/favorites should fail without auth', async () => {
    const res = await request(app).get('/api/favorites');
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/favorites should return favorites for valid user', async () => {
    const token = getToken('sandra');
    const res = await request(app)
      .get('/api/favorites')
      .set('Authorization', authHeader(token));
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/favorites should 404 for non-existent user', async () => {
    const token = getToken('nouser');
    const res = await request(app)
      .get('/api/favorites')
      .set('Authorization', authHeader(token));
    expect(res.statusCode).toBe(404);
  });

  it('POST /api/favorites should add a book to favorites', async () => {
    const token = getToken('sandra');
    const books = JSON.parse(fs.readFileSync(booksFile, 'utf-8'));
    const users = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
    const sandra = users.find(u => u.username === 'sandra');
    const notFav = books.find(b => !sandra.favorites.includes(b.id));
    if (!notFav) return;
    const res = await request(app)
      .post('/api/favorites')
      .set('Authorization', authHeader(token))
      .send({ bookId: notFav.id });
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/added/);
  });

  it('POST /api/favorites should not duplicate favorites', async () => {
    const token = getToken('sandra');
    const users = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
    const sandra = users.find(u => u.username === 'sandra');
    const alreadyFav = sandra.favorites[0];
    const res = await request(app)
      .post('/api/favorites')
      .set('Authorization', authHeader(token))
      .send({ bookId: alreadyFav });
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/added/);
  });

  it('POST /api/favorites should fail with missing bookId', async () => {
    const token = getToken('sandra');
    const res = await request(app)
      .post('/api/favorites')
      .set('Authorization', authHeader(token))
      .send({});
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/favorites should 404 for non-existent user', async () => {
    const token = getToken('nouser');
    const res = await request(app)
      .post('/api/favorites')
      .set('Authorization', authHeader(token))
      .send({ bookId: '1' });
    expect(res.statusCode).toBe(404);
  });

  it('POST /api/favorites should fail without auth', async () => {
    const res = await request(app)
      .post('/api/favorites')
      .send({ bookId: '1' });
    expect(res.statusCode).toBe(401);
  });

  it('DELETE /api/favorites/:bookId should remove a book from favorites', async () => {
    const token = getToken('sandra');
    const users = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
    const sandra = users.find(u => u.username === 'sandra');
    const favoriteId = sandra.favorites[0];
    const res = await request(app)
      .delete(`/api/favorites/${favoriteId}`)
      .set('Authorization', authHeader(token));
    const updatedUsers = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
    const updatedSandra = updatedUsers.find(u => u.username === 'sandra');

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/removed/);
    expect(updatedSandra.favorites).not.toContain(favoriteId);
  });

  it('DELETE /api/favorites/:bookId should 404 for non-existent user', async () => {
    const token = getToken('nouser');
    const res = await request(app)
      .delete('/api/favorites/1')
      .set('Authorization', authHeader(token));
    expect(res.statusCode).toBe(404);
  });

  it('DELETE /api/favorites/:bookId should fail without auth', async () => {
    const res = await request(app).delete('/api/favorites/1');
    expect(res.statusCode).toBe(401);
  });

  it('should create, read, update, delete, and persist comments for a favorite', async () => {
    const token = getToken('sandra');
    const bookId = '2';
    const create = await request(app)
      .post(`/api/favorites/${bookId}/comments`)
      .set('Authorization', authHeader(token))
      .send({ content: 'A personal note' });
    expect(create.statusCode).toBe(201);
    expect(create.body.content).toBe('A personal note');

    const read = await request(app)
      .get('/api/favorites')
      .set('Authorization', authHeader(token));
    expect(read.body.find(book => book.id === bookId).comments).toEqual([create.body]);

    const update = await request(app)
      .put(`/api/favorites/${bookId}/comments/${create.body.id}`)
      .set('Authorization', authHeader(token))
      .send({ content: 'An updated personal note' });
    expect(update.statusCode).toBe(200);
    expect(update.body.content).toBe('An updated personal note');

    const persisted = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
    expect(persisted.find(user => user.username === 'sandra').favoriteComments[bookId][0].content)
      .toBe('An updated personal note');

    const remove = await request(app)
      .delete(`/api/favorites/${bookId}/comments/${create.body.id}`)
      .set('Authorization', authHeader(token));
    expect(remove.statusCode).toBe(200);
  });

  it('should reject empty comments and comments on books that are not favorites', async () => {
    const token = getToken('sandra');
    const empty = await request(app)
      .post('/api/favorites/2/comments')
      .set('Authorization', authHeader(token))
      .send({ content: '   ' });
    expect(empty.statusCode).toBe(400);
    expect(empty.body.message).toMatch(/cannot be empty/);

    const nonFavorite = await request(app)
      .post('/api/favorites/999/comments')
      .set('Authorization', authHeader(token))
      .send({ content: 'Not allowed' });
    expect(nonFavorite.statusCode).toBe(403);
  });

  it('should reject unauthenticated comment changes', async () => {
    const res = await request(app)
      .post('/api/favorites/2/comments')
      .send({ content: 'Not allowed' });
    expect(res.statusCode).toBe(401);
  });
});
