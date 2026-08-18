import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { addComment, deleteComment, fetchFavorites, removeFavorite, updateComment } from '../store/favoritesSlice';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/BookList.module.css';

const Favorites = () => {
  const dispatch = useAppDispatch();
  const favorites = useAppSelector(state => state.favorites.items);
  const status = useAppSelector(state => state.favorites.status);
  const token = useAppSelector(state => state.user.token);
  const navigate = useNavigate();
  const [newComments, setNewComments] = useState({});
  const [editingComment, setEditingComment] = useState(null);
  const [commentError, setCommentError] = useState('');

  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }
    dispatch(fetchFavorites(token));
  }, [dispatch, token, navigate]);

  const handleRemoveFavorite = async (bookId) => {
    if (!token) {
      navigate('/');
      return;
    }
    if (!window.confirm('Remove this book from your favorites?')) return;
    await dispatch(removeFavorite({ token, bookId }));
  };

  const handleAddComment = async (bookId) => {
    try {
      await dispatch(addComment({ token, bookId, content: newComments[bookId] || '' })).unwrap();
      setNewComments({ ...newComments, [bookId]: '' });
      setCommentError('');
    } catch (error) {
      setCommentError(error.message);
    }
  };

  const handleUpdateComment = async (bookId, commentId) => {
    try {
      await dispatch(updateComment({ token, bookId, commentId, content: editingComment.content })).unwrap();
      setEditingComment(null);
      setCommentError('');
    } catch (error) {
      setCommentError(error.message);
    }
  };

  if (status === 'loading') return <div>Loading...</div>;
  if (status === 'failed') return <div>Failed to load favorites.</div>;

  return (
    <div>
      <h2>My Favorite Books</h2>
      {favorites.length === 0 ? (
        <div style={{
          background: '#fff',
          padding: '2rem',
          borderRadius: '8px',
          maxWidth: '400px',
          margin: '2rem auto',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          textAlign: 'center',
          color: '#888',
        }}>
          <p>No favorite books yet.</p>
          <p>
            Go to the <a href="/books" onClick={e => { e.preventDefault(); navigate('/books'); }}>book list</a> to add some!
          </p>
        </div>
      ) : (
        <ul>
          {favorites.map(book => (
            <li key={book.id}>
              <strong>{book.title}</strong> by {book.author}
              <button
                className={styles.simpleBtn}
                onClick={() => handleRemoveFavorite(book.id)}
              >
                Remove
              </button>
              <div>
                <h3>Comments</h3>
                {book.comments.map(comment => (
                  <div key={comment.id}>
                    {editingComment?.id === comment.id ? (
                      <>
                        <input
                          aria-label="Edit comment"
                          value={editingComment.content}
                          onChange={event => setEditingComment({ ...editingComment, content: event.target.value })}
                        />
                        <button className={styles.simpleBtn} onClick={() => handleUpdateComment(book.id, comment.id)}>Save</button>
                      </>
                    ) : (
                      <>
                        <span>{comment.content}</span>
                        <button className={styles.simpleBtn} onClick={() => setEditingComment(comment)}>Edit</button>
                        <button className={styles.simpleBtn} onClick={() => dispatch(deleteComment({ token, bookId: book.id, commentId: comment.id }))}>Delete</button>
                      </>
                    )}
                  </div>
                ))}
                <textarea
                  aria-label={`Add comment for ${book.title}`}
                  value={newComments[book.id] || ''}
                  onChange={event => setNewComments({ ...newComments, [book.id]: event.target.value })}
                />
                <button className={styles.simpleBtn} onClick={() => handleAddComment(book.id)}>Add Comment</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {commentError && <div role="alert">{commentError}</div>}
    </div>
  );
};

export default Favorites;
