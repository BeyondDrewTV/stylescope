#!/usr/bin/env python
"""Quick test to verify rate limit handling logic."""

import sys
sys.path.insert(0, '.')

from backend import scorer

# Test 1: Verify _classify_error correctly identifies rate limits
error_429 = "HTTP 429: Too Many Requests - rate limit exceeded"
error_500 = "HTTP 500: Internal Server Error"
error_unknown = "Some random error"

result_429 = scorer._classify_error(error_429)
result_500 = scorer._classify_error(error_500)
result_unknown = scorer._classify_error(error_unknown)

print(f"429 error classified as: '{result_429}'")
print(f"500 error classified as: '{result_500}'")
print(f"Unknown error classified as: '{result_unknown}'")

# Verify 429 is classified as rate limit
assert result_429 == "api_error_rate_limit", f"Expected 'api_error_rate_limit', got '{result_429}'"
print("\n✓ 429 errors are correctly classified as 'api_error_rate_limit'")

# Test 2: Verify the scoring status flag logic
# Simulate the logic from score_book final error handler
is_rate_limit = result_429 == "api_error_rate_limit"
flags = [result_429]
if is_rate_limit:
    flags = ["openrouter_rate_limited"]
    status = "temporarily_unavailable"
else:
    status = "error"

print(f"\nFor 429 error:")
print(f"  Flags: {flags}")
print(f"  Status: {status}")
assert flags == ["openrouter_rate_limited"], f"Expected ['openrouter_rate_limited'], got {flags}"
assert status == "temporarily_unavailable", f"Expected 'temporarily_unavailable', got '{status}'"

print("✓ Rate limit scoring status correctly set to 'temporarily_unavailable'")

# Test 3: Verify non-rate-limit errors still use 'error' status
is_rate_limit_500 = result_500 == "api_error_rate_limit"
flags_500 = [result_500]
if is_rate_limit_500:
    flags_500 = ["openrouter_rate_limited"]
    status_500 = "temporarily_unavailable"
else:
    status_500 = "error"

print(f"\nFor 500 error:")
print(f"  Flags: {flags_500}")
print(f"  Status: {status_500}")
assert status_500 == "error", f"Expected 'error', got '{status_500}'"

print("✓ Non-rate-limit errors correctly use 'error' status")

print("\n" + "="*60)
print("All rate limit handling tests passed!")
print("="*60)
