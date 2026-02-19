/**
 * StyleScope API client
 * Uses the Vite proxy (/api -> http://localhost:5000) in development.
 */
const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function handleResponse(response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `Request failed (${response.status})`);
  }
  return response.json();
}

export const api = {
  // ── Books ───────────────────────────────────────────────────────────────
  getBooks: (params = {}) => {
    const query = new URLSearchParams(params);
    return fetch(`${API_BASE}/books?${query}`).then(handleResponse);
  },

  getBook: (id) =>
    fetch(`${API_BASE}/books/${id}`).then(handleResponse),

  searchBooks: (q) =>
    fetch(`${API_BASE}/books/search?q=${encodeURIComponent(q)}`).then(handleResponse),

  getHomeSections: () =>
    fetch(`${API_BASE}/books/home-sections`).then(handleResponse),

  // ── Hidden Gems ─────────────────────────────────────────────────────────
  getHiddenGems: () =>
    fetch(`${API_BASE}/hidden-gems/daily`).then(handleResponse),

  // ── User & Auth ─────────────────────────────────────────────────────────
  getUser: (userId) =>
    fetch(`${API_BASE}/user/${userId}`).then(handleResponse),

  sendMagicLink: (email) =>
    fetch(`${API_BASE}/auth/magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).then(handleResponse),

  verifyToken: (token) =>
    fetch(`${API_BASE}/auth/verify?token=${encodeURIComponent(token)}`).then(handleResponse),

  // ── Points ──────────────────────────────────────────────────────────────
  getPoints: (userId) =>
    fetch(`${API_BASE}/user/${userId}/points`).then(handleResponse),

  awardPoints: (userId, points, action) =>
    fetch(`${API_BASE}/user/${userId}/points/award`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points, action }),
    }).then(handleResponse),

  // ── Content Warnings ────────────────────────────────────────────────────
  getWarningCategories: () =>
    fetch(`${API_BASE}/content-warnings/categories`).then(handleResponse),

  // ── User Preferences (Premium) ──────────────────────────────────────────
  getPreferences: (userId) =>
    fetch(`${API_BASE}/user/${userId}/preferences`).then(handleResponse),

  updatePreferences: (userId, prefs) =>
    fetch(`${API_BASE}/user/${userId}/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    }).then(handleResponse),

  // ── Pepper Mascot ───────────────────────────────────────────────────────
  getPepperMessage: (context, qualityScore, spiceLevel) => {
    const params = new URLSearchParams({ context });
    if (qualityScore != null) params.append('quality_score', qualityScore);
    if (spiceLevel != null) params.append('spice_level', spiceLevel);
    return fetch(`${API_BASE}/pepper/message?${params}`).then(handleResponse);
  },

  // ── Spice Levels ────────────────────────────────────────────────────────
  getSpiceLevels: () =>
    fetch(`${API_BASE}/spice-levels`).then(handleResponse),

  // ── Scoring ─────────────────────────────────────────────────────────────
  requestScore: (title, author) =>
    fetch(`${API_BASE}/score-on-demand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, author }),
    }).then(handleResponse),

  getJobStatus: (jobId) =>
    fetch(`${API_BASE}/job-status/${jobId}`).then(handleResponse),

  // ── Series ──────────────────────────────────────────────────────────────
  getSeriesInfo: (bookId) =>
    fetch(`${API_BASE}/books/${bookId}/series`).then(handleResponse),

  subscribeToSeries: (seriesName, email) =>
    fetch(`${API_BASE}/series/${encodeURIComponent(seriesName)}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).then(handleResponse),

  // ── Stripe ──────────────────────────────────────────────────────────────
  createCheckout: (email, plan = 'subscription') =>
    fetch(`${API_BASE}/stripe/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, plan }),
    }).then(handleResponse),
};
