from apify_client import ApifyClient
import os
from dotenv import load_dotenv

load_dotenv()

# Initialize client
client = ApifyClient(os.getenv('APIFY_API_TOKEN'))  # Add this to your .env

# Test with one book
run_input = {
    "startUrls": [
        "https://www.goodreads.com/book/show/62057697"  # Twisted Love
    ],
    "includeReviews": True,
    "maxItems": 100,
    "proxy": {
        "useApifyProxy": True
    }
}

print("Starting Apify scrape...")
run = client.actor("epctex/goodreads-scraper").call(run_input=run_input)

print("Getting results...")
reviews = []
for item in client.dataset(run["defaultDatasetId"]).iterate_items():
    if 'reviews' in item and item['reviews']:
        for review in item['reviews']:
            if review.get('text'):
                reviews.append(review['text'])
                
print(f"\nFound {len(reviews)} reviews!")
print("\nFirst review sample:")
print(reviews[0][:200] if reviews else "No reviews found")
