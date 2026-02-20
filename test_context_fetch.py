#!/usr/bin/env python3
"""
Test script to debug fetch_book_context flow.
Run this to see if Hardcover/Google Books are finding books correctly.
"""

import sys
sys.path.insert(0, 'backend')

import logging

# Enable DEBUG logging to see all the details
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)

from backend.book_context import fetch_book_context

# Test with a well-known book
test_cases = [
    {"title": "The Seven Husbands of Evelyn Hugo", "author": "Taylor Jenkins Reid"},
    {"title": "It Ends with Us", "author": "Colleen Hoover"},
    {"title": "The Hating Game", "author": "Sally Thorne"},
]

print("\n" + "="*80)
print("TESTING FETCH_BOOK_CONTEXT")
print("="*80 + "\n")

for test in test_cases:
    print(f"\n>>> Testing: {test['title']} by {test['author']}")
    print("-" * 80)
    
    result = fetch_book_context(
        title=test["title"],
        author=test["author"],
        isbn=None
    )
    
    print(f"\n✓ RESULT:")
    print(f"  Source: {result['meta']['source']}")
    print(f"  Context text length: {len(result['context_text'])} chars")
    print(f"  Review count: {result['review_count']}")
    print(f"  Excerpt count: {result['excerpt_count']}")
    print(f"  Description length: {result['meta']['description_length']}")
    print(f"\n  Context text preview:")
    print(f"  {result['context_text'][:500]}")
    print(f"  ...")
    
print("\n" + "="*80)
print("TEST COMPLETE")
print("="*80 + "\n")
