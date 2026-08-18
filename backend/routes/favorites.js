const express = require('express');
const { randomUUID } = require('crypto');
const { rateLimit } = require('express-rate-limit');

function createFavoritesRouter({ usersFile, booksFile, readJSON, writeJSON, authenticateToken }) {
  const router = express.Router();
  const commentWriteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Too many comment requests, please try again later' },
  });

  function getUser(req, res, users) {
    const user = users.find(u => u.username === req.user.username);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return null;
    }
    return user;
  }

  function getFavoriteUser(req, res) {
    const users = readJSON(usersFile);
    const user = getUser(req, res, users);
    if (!user) return null;
    if (!user.favorites.includes(req.params.bookId)) {
      res.status(403).json({ message: 'Book must be a favorite before it can be commented on' });
      return null;
    }
    user.favoriteComments ||= {};
    user.favoriteComments[req.params.bookId] ||= [];
    return { users, user, comments: user.favoriteComments[req.params.bookId] };
  }

  router.get('/', authenticateToken, (req, res) => {
    const users = readJSON(usersFile);
    const user = getUser(req, res, users);
    if (!user) return;
    const books = readJSON(booksFile);
    const favorites = books
      .filter(b => user.favorites.includes(b.id))
      .map(book => ({ ...book, comments: user.favoriteComments?.[book.id] || [] }));
    res.json(favorites);
  });

  router.post('/', authenticateToken, (req, res) => {
    const { bookId } = req.body;
    if (!bookId) return res.status(400).json({ message: 'Book ID required' });
    const users = readJSON(usersFile);
    const user = getUser(req, res, users);
    if (!user) return;
    if (!user.favorites.includes(bookId)) {
      user.favorites.push(bookId);
      writeJSON(usersFile, users);
    }
    res.status(200).json({ message: 'Book added to favorites' });
  });

  router.delete('/:bookId', authenticateToken, (req, res) => {
    const { bookId } = req.params;
    const users = readJSON(usersFile);
    const user = getUser(req, res, users);
    if (!user) return;
    const nextFavorites = user.favorites.filter(id => id !== bookId);
    if (nextFavorites.length !== user.favorites.length) {
      user.favorites = nextFavorites;
      if (user.favoriteComments) delete user.favoriteComments[bookId];
      writeJSON(usersFile, users);
    }
    res.status(200).json({ message: 'Book removed from favorites' });
  });

  router.post('/:bookId/comments', authenticateToken, commentWriteLimiter, (req, res) => {
    const favorite = getFavoriteUser(req, res);
    if (!favorite) return;
    const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
    if (!content) return res.status(400).json({ message: 'Comment cannot be empty' });
    const comment = { id: randomUUID(), content };
    favorite.comments.push(comment);
    writeJSON(usersFile, favorite.users);
    res.status(201).json(comment);
  });

  router.put('/:bookId/comments/:commentId', authenticateToken, commentWriteLimiter, (req, res) => {
    const favorite = getFavoriteUser(req, res);
    if (!favorite) return;
    const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
    if (!content) return res.status(400).json({ message: 'Comment cannot be empty' });
    const comment = favorite.comments.find(item => item.id === req.params.commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    comment.content = content;
    writeJSON(usersFile, favorite.users);
    res.json(comment);
  });

  router.delete('/:bookId/comments/:commentId', authenticateToken, commentWriteLimiter, (req, res) => {
    const favorite = getFavoriteUser(req, res);
    if (!favorite) return;
    const index = favorite.comments.findIndex(item => item.id === req.params.commentId);
    if (index === -1) return res.status(404).json({ message: 'Comment not found' });
    favorite.comments.splice(index, 1);
    writeJSON(usersFile, favorite.users);
    res.status(200).json({ message: 'Comment deleted' });
  });

  return router;
}

module.exports = createFavoritesRouter;
