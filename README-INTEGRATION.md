# StyleScope Backend — Integration Guide

## What you just got

| File | Purpose |
|---|---|
| `api.py` | Flask backend — wraps `scorer.py`, serves REST API |
| `requirements.txt` | Updated Python deps (Flask, Stripe, Flask-Mail) |
| `react-integration.jsx` | Drop-in hooks/functions for `stylescope-v8.jsx` |
| `.env.example` | Config template — copy to `.env` and fill in |

---

## Step 1 — Install dependencies

```bash
pip install -r requirements.txt
```

---

## Step 2 — Configure environment

```bash
cp .env.example .env
# Fill in your keys (see comments in .env.example)
```

Minimum required to start:

```
FLASK_SECRET_KEY=any-random-string
# Everything else can be left blank for local dev
```

---

## Step 3 — Start the API

```bash
python api.py
```

You should see:

```
[migration] Done — 37 books imported.
 * Running on http://0.0.0.0:5000
```

Verify it works:

```bash
curl http://localhost:5000/api/health
# → {"status": "ok", "books_in_db": 37}

curl http://localhost:5000/api/books | python -m json.tool | head -60
```

---

## Step 4 — Connect React frontend

1. Open `src/stylescope-v8.jsx`
2. Copy the contents of `react-integration.jsx` into the top of your component
3. Delete (or comment out) the old `const [books, setBooks] = useState(BOOKS)` line
4. Add `VITE_API_URL=http://localhost:5000` to `.env.local` in your React project (optional — defaults to `localhost:5000`)

```bash
cd your-react-project
npm run dev
```

Books should now load from the API instead of the hardcoded array.

---

## Step 5 — Test on-demand scoring

```bash
curl -X POST http://localhost:5000/api/score-on-demand \
  -H "Content-Type: application/json" \
  -d '{"title": "The Name of the Wind", "author": "Patrick Rothfuss"}'

# Returns: {"job_id": "abc-123", "estimated_seconds": 30}

# Poll for result:
curl http://localhost:5000/api/job-status/abc-123
# → {"status": "processing", "progress": "Scraping Goodreads reviews…"}
# After ~30s:
# → {"status": "complete", "book": {...}}
```

---

## Step 6 — Stripe setup (optional for V1)

1. Create an account at [stripe.com](https://stripe.com)
2. In the Stripe dashboard → Products → create two products:
   - "StyleScope Score" (one-time, e.g. $4.99)
   - "StyleScope Pro" (monthly subscription, e.g. $9.99/mo)
3. Copy the **Price IDs** (start with `price_`) into `.env`
4. For webhooks in local dev, use the Stripe CLI:

```bash
brew install stripe/stripe-cli/stripe
stripe login
stripe listen --forward-to localhost:5000/api/stripe/webhook
# Copy the webhook secret it prints → STRIPE_WEBHOOK_SECRET in .env
```

---

## Step 7 — Magic link auth (optional for V1)

1. Create a [Gmail App Password](https://myaccount.google.com/apppasswords) (2FA must be on)
2. Fill in `.env`:

```
MAIL_USERNAME=your@gmail.com
MAIL_PASSWORD=your-16-char-app-password
```

3. Test:

```bash
curl -X POST http://localhost:5000/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

> **Dev tip:** If SMTP isn't configured, the link is printed to the Flask console so you can test the full flow without email.

---

## API Reference

### Books

```
GET  /api/books                     List all (filters: genre, author, minQuality, limit, offset)
GET  /api/books/<id>                Get single book
GET  /api/books/search?q=<query>    Search by title or author
```

### On-demand scoring

```
POST /api/score-on-demand           Body: {title, author}
GET  /api/job-status/<job_id>       Poll job progress
```

### Auth

```
POST /api/auth/magic-link           Body: {email} — sends login email
GET  /api/auth/verify?token=<tok>   Verifies token, returns user object
```

### Payments

```
POST /api/stripe/checkout           Body: {email, plan: "one_time"|"subscription"}
POST /api/stripe/webhook            Stripe sends events here
```

### Health

```
GET  /api/health                    Returns book count — good smoke test
```

---

## Common issues

| Problem | Fix |
|---|---|
| `ModuleNotFoundError: scorer` | Run `api.py` from the same directory as `scorer.py` |
| `No CSV to migrate` | Make sure `scores_SUCCESS.csv` is in the same directory |
| CORS errors in browser | Flask-CORS is already enabled; check `VITE_API_URL` matches port 5000 |
| Stripe webhook signature error | Make sure you're running `stripe listen` and copied the secret to `.env` |
| Magic link not arriving | Check Flask console for the dev link — SMTP may not be configured yet |

---

## Production checklist (when you're ready to deploy)

- [ ] Set `FLASK_ENV=production` and `FLASK_DEBUG=0`
- [ ] Use `gunicorn api:app` instead of `python api.py`
- [ ] Move `scoring_jobs` dict to Redis (`flask-caching` or `rq`)
- [ ] Put Flask behind Nginx or Caddy for HTTPS
- [ ] Use a real session/JWT library instead of returning user object directly
- [ ] Set `FRONTEND_URL` to your production domain
