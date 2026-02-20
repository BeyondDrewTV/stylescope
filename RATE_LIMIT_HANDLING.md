# Rate Limit Handling Implementation Summary

## Changes Made

### 1. **backend/scorer.py** — Last error handler (lines ~334-356)

**Before:** All scoring failures returned `"scoring_status": "error"` regardless of error type.

**After:** 
- Detects when the last error is classified as `"api_error_rate_limit"` (429 response)
- Sets `scoring_status` to `"temporarily_unavailable"` for rate limits
- Keeps `scoring_status` as `"error"` for all other error types
- Returns flag `"openrouter_rate_limited"` specifically for rate-limit errors
- Returns the original error classification flag for other errors

```python
# Special handling for rate limits: return "temporarily_unavailable" status
error_classification = _classify_error(last_error)
is_rate_limit = error_classification == "api_error_rate_limit"

flags = [error_classification]
if is_rate_limit:
    flags = ["openrouter_rate_limited"]

return {
    # ... other fields ...
    "flags": flags,
    "scoring_status": "temporarily_unavailable" if is_rate_limit else "error",
}
```

### 2. **backend/api.py** — On-demand job handler in `_run_scoring_job` (lines ~949-960)

**Before:** Only checked for `scoring_status == "error"`, treating all errors the same.

**After:**
- Added new check for `scoring_status == "temporarily_unavailable"`
- Treats rate-limited jobs as failed (calls `update_on_demand_job_status(job_id, "failed", ...)`)
- Provides user-friendly error message: **"Scoring is temporarily busy, please try again in a few minutes."**
- Logs rate limit incidents with `logger.warning` instead of `logger.error`

```python
if scores.get("scoring_status") == "error":
    error_msg = (scores.get("flags") or ["Unknown error"])[0]
    logger.error(f"[JOB {job_id}] Scoring failed: {error_msg}")
    update_on_demand_job_status(job_id, "failed", error_message=error_msg)
    return

if scores.get("scoring_status") == "temporarily_unavailable":
    error_msg = "Scoring is temporarily busy, please try again in a few minutes."
    logger.warning(f"[JOB {job_id}] Rate limited: {error_msg}")
    update_on_demand_job_status(job_id, "failed", error_message=error_msg)
    return
```

## Behavior

### When OpenRouter returns 429 (Rate Limit):

1. **scorer.py**:
   - Retries are exhausted after hitting rate limits
   - `_classify_error()` detects "429" in the error message
   - Returns: `{"scoring_status": "temporarily_unavailable", "flags": ["openrouter_rate_limited"], ...}`

2. **api.py**:
   - Detects `scoring_status == "temporarily_unavailable"`
   - Marks job as failed (not error, just failed)
   - User sees: **"Scoring is temporarily busy, please try again in a few minutes."**
   - Can retry the job later

3. **Other Errors** (500, JSON parse, etc.):
   - Rate limit handling does NOT affect them
   - Continue to use `"scoring_status": "error"` as before
   - Error flags and messages remain unchanged

## Testing

All rate limit classification and status handling logic has been verified:
- ✓ 429 errors detected as `api_error_rate_limit`
- ✓ Rate limits set status to `temporarily_unavailable`
- ✓ Non-rate-limit errors continue using `error` status
- ✓ Both files compile without syntax errors
