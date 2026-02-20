# On-Demand Scoring Jobs Implementation Guide

## Overview

The on-demand scoring system allows the frontend to request scoring for books that aren't yet in the database. The system uses a background thread to fetch book context and run the scoring pipeline, while jobs are persisted to SQLite for durability and frontend polling.

## Components Added

### 1. Database Table: `on_demand_jobs`

Created automatically in `init_db()` with the following schema:
- `id` (TEXT, PK): UUID for the job
- `created_at` (TEXT): ISO format timestamp
- `updated_at` (TEXT): ISO format timestamp  
- `status` (TEXT): Currently one of `queued`, `running`, `completed`, `failed`
- `isbn` (TEXT, nullable): Optional ISBN for context fetching
- `title` (TEXT): Book title (required)
- `author` (TEXT): Book author (required)
- `user_id` (TEXT, nullable): Optional user ID for future analytics
- `result_json` (TEXT, nullable): JSON string of scoring result when completed
- `error_message` (TEXT, nullable): Error details if job failed

### 2. New Module: `backend/jobs.py`

Job management functions with lazy imports to avoid circular dependencies:

#### `create_on_demand_job(title, author, isbn=None, user_id=None) -> str`
Creates a new job in the database with status "queued". Returns the job_id (UUID).

#### `get_on_demand_job(job_id) -> Dict[str, Any] | None`
Retrieves a job's full record including status and result. Returns None if not found.

#### `update_on_demand_job_status(job_id, status, result=None, error_message=None)`
Updates a job's status and optionally stores:
- `result`: Dict converted to JSON string
- `error_message`: Human-readable error for failed jobs

### 3. Flask Endpoints in `backend/api.py`

#### `POST /api/score-on-demand`

**Request:**
```json
{
  "title": "The Hating Game",
  "author": "Sally Thorne",
  "isbn": "978-0062802187",
  "user_id": "optional-user-123"
}
```

**Response (202 Accepted):**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Behavior:**
- Validates title and author (both required)
- Creates job record with status "queued"
- Launches background thread to run scoring
- Returns 202 immediately (job executes async)

---

#### `GET /api/score-on-demand/<job_id>`

**Response Examples:**

**Queued (202):**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued"
}
```

**Running (200):**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "running"
}
```

**Completed (200):**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "result": {
    "book_title": "The Hating Game",
    "author": "Sally Thorne",
    "scores": {
      "readability": 85,
      "grammar": 88,
      "prose": 82,
      "polish": 84,
      "pacing": 80
    },
    "overall_score": 84,
    "confidence": "high",
    "flags": [],
    "review_count": 1250,
    "scoring_status": "ok"
  }
}
```

**Failed (200):**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "failed",
  "error_message": "No context available from data sources"
}
```

**Not Found (404):**
```json
{
  "error": "job not found"
}
```

### 4. Background Worker: `_run_scoring_job()`

The background worker executes in a daemon thread and:

1. **Updates status to "running"**
2. **Fetches book context** using `fetch_book_context(isbn, title, author)`
   - Returns `context_text` and `meta` (containing `review_count_estimate`)
   - Falls back gracefully if no context available
3. **Scores the book** using `scorer.score_book()`
   - Uses hybrid book context (Hardcover + Google Books)
   - Genre hardcoded to "Romance" (can be parameterized later)
4. **Updates job status to "completed"** with result JSON
   - Result stored as JSON string in `result_json` column
5. **Handles exceptions** by updating status to "failed" with error message

## Frontend Integration

### Basic Flow

```javascript
// 1. Start scoring
const response = await fetch('/api/score-on-demand', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: "The Hating Game",
    author: "Sally Thorne",
    isbn: "978-0062802187"
  })
});
const { job_id } = await response.json();

// 2. Poll for completion (every 2-3 seconds)
let job = null;
while (!job || (job.status !== 'completed' && job.status !== 'failed')) {
  const pollResponse = await fetch(`/api/score-on-demand/${job_id}`);
  job = await pollResponse.json();
  await new Promise(resolve => setTimeout(resolve, 2000));
}

// 3. Handle result or error
if (job.status === 'completed') {
  showScores(job.result.scores);
  showConfidence(job.result.confidence);
} else {
  showError(job.error_message);
}
```

### UI States

- **Submitted**: Show spinner + "Fetching book context..."
- **Running**: Show Pepper animations + quiz while scoring
- **Completed**: Reveal scores + biome + gamification
- **Failed**: Show error message + retry button

### Polling Strategy

- Poll every 2-3 seconds (not too aggressive)
- Set maximum polling duration (e.g., 5 minutes)
- Show user a cancel button if UI supports it
- Consider caching results in localStorage for repeated lookups

## Architecture Notes

### Why SQLite Instead of In-Memory?

1. **Durability**: Jobs persist across server restarts
2. **Debugging**: Can query job history via SQL
3. **User reference**: Backend can look up job later if needed
4. **Scalability**: Supports adding job cancellation, cleanup, etc.

### Why Daemon Threads?

- Fast API response (202 Accepted) while work happens in background
- Non-blocking for other users
- Flask handles multiple threads gracefully in development
- **Note**: For production, consider a proper job queue (Celery, Redis Queue)

### Why Lazy Imports?

Jobs module imports `get_conn` from api.py lazily (inside functions) to avoid circular imports, since api.py also imports jobs.

### Error Handling

Broad try-except in `_run_scoring_job`:
- Catches API errors (fetch_book_context, scorer failures)
- Catches JSON parsing errors
- Stores error message for frontend display

## Testing

### Manual Test

```bash
# Terminal 1: Start the API
cd backend
python api.py

# Terminal 2: Create a job
curl -X POST http://localhost:5000/api/score-on-demand \
  -H "Content-Type: application/json" \
  -d '{"title":"The Hating Game","author":"Sally Thorne"}'

# Get the job_id from response, then poll:
curl http://localhost:5000/api/score-on-demand/{job_id}
```

### Expected Behavior

1. First request returns 202 with job_id
2. Status polling returns "queued" → "running" → "completed" or "failed"
3. Completed jobs include full result object
4. Failed jobs include error_message
5. Database persists all job records

## Future Enhancements

1. **Job Cancellation**: Add `DELETE /api/score-on-demand/<job_id>` to cancel queued/running jobs
2. **Job History**: Add `GET /api/score-on-demand?user_id=X&limit=10` to list user's recent jobs
3. **Job TTL**: Add cleanup job to archive or delete jobs older than 30 days
4. **Celery Integration**: Replace threading with Celery for production scalability
5. **Genre/Subgenre**: Parameterize "Romance" genre or autodetect from context
6. **Series Detection**: Extract series info from context if available
7. **Result Caching**: Cache scoring results in books table after job completes

## Security Considerations

- **Rate Limiting**: Consider adding per-user rate limits on scoring requests
- **Input Validation**: Title/author already stripped, but could add regex patterns
- **User Attribution**: Optional user_id field can track which user requested scoring
- **Result Privacy**: Result JSON stays in the job record; decide on retention policy

## Configuration

- `DB_PATH`: Path to SQLite database (default: stylescope.db)
- All other config comes from existing backend setup
- No new environment variables required
