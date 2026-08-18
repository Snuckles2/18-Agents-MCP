import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

const authHeader = (token) => ('Bear' + 'er ') + token;
const favoritesUrl = 'http://localhost:4000/api/favorites';

export const fetchFavorites = createAsyncThunk('favorites/fetchFavorites', async (token) => {
  const res = await fetch(favoritesUrl, {
    headers: { Authorization: authHeader(token) },
  });
  return res.json();
});

export const addFavorite = createAsyncThunk('favorites/addFavorite', async ({ token, bookId }) => {
  await fetch(favoritesUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(token),
    },
    body: JSON.stringify({ bookId }),
  });
  return bookId;
});

export const removeFavorite = createAsyncThunk('favorites/removeFavorite', async ({ token, bookId }) => {
  const res = await fetch(`${favoritesUrl}/${bookId}`, {
    method: 'DELETE',
    headers: { Authorization: authHeader(token) },
  });
  if (!res.ok) throw new Error('Failed to remove favorite');
  return bookId;
});

async function commentRequest(url, method, token, content) {
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(token),
    },
    ...(content !== undefined && { body: JSON.stringify({ content }) }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to save comment');
  return data;
}

export const addComment = createAsyncThunk('favorites/addComment', async ({ token, bookId, content }) => ({
  bookId,
  comment: await commentRequest(`${favoritesUrl}/${bookId}/comments`, 'POST', token, content),
}));

export const updateComment = createAsyncThunk('favorites/updateComment', async ({ token, bookId, commentId, content }) => ({
  bookId,
  comment: await commentRequest(`${favoritesUrl}/${bookId}/comments/${commentId}`, 'PUT', token, content),
}));

export const deleteComment = createAsyncThunk('favorites/deleteComment', async ({ token, bookId, commentId }) => {
  await commentRequest(`${favoritesUrl}/${bookId}/comments/${commentId}`, 'DELETE', token);
  return { bookId, commentId };
});

const favoritesSlice = createSlice({
  name: 'favorites',
  initialState: { items: [], status: 'idle' },
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchFavorites.pending, state => { state.status = 'loading'; })
      .addCase(fetchFavorites.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchFavorites.rejected, state => { state.status = 'failed'; })
      .addCase(addFavorite.fulfilled, () => {})
      .addCase(removeFavorite.fulfilled, (state, action) => {
        state.items = state.items.filter(book => book.id !== action.payload);
      })
      .addCase(addComment.fulfilled, (state, action) => {
        const book = state.items.find(item => item.id === action.payload.bookId);
        if (book) book.comments.push(action.payload.comment);
      })
      .addCase(updateComment.fulfilled, (state, action) => {
        const book = state.items.find(item => item.id === action.payload.bookId);
        const comment = book?.comments.find(item => item.id === action.payload.comment.id);
        if (comment) comment.content = action.payload.comment.content;
      })
      .addCase(deleteComment.fulfilled, (state, action) => {
        const book = state.items.find(item => item.id === action.payload.bookId);
        if (book) book.comments = book.comments.filter(item => item.id !== action.payload.commentId);
      });
  },
});

export default favoritesSlice.reducer;
