# StyleScope Book Scorer

Automated pipeline that scrapes reader reviews from Reddit and Goodreads, then uses Google Gemini to score writing quality across 5 dimensions.

## Validated Scores (ground truth)

| Book | Overall | Readability | Notes |
|------|---------|-------------|-------|
| Hate — Tate James | 81 | 86 | High accessibility, simple prose |
| Hideaway — Penelope Douglas | 81 | 83 | Balanced craft, clear timeline |
| Haunting Adeline — H.D. Carlton | 56 | 52 | Multiple "TERRIBLE writing" reviews, DNF at 35% |

## Setup

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure API keys

```bash
cp .env.example .env
# Edit .env with your keys
```

**Required:**
- `GEMINI_API_KEY` — [Get free key](https://makersuite.google.com/app/apikey) (15 RPM on free tier)

**Optional but recommended:**
- Reddit API keys — [Create script app](https://www.reddit.com/prefs/apps) — gives significantly better review coverage

### 3. Prepare your input CSV

```csv
Title,Author,Series,Genre,Subgenre
God of Malice,Rina Kent,Legacy of Gods #1,Dark Romance,Bully Romance
```

Series and Subgenre are optional. Title and Author are required.

## Usage

```bash
# Score all books in input CSV
python main.py --input input/books.csv --output output/scored_books.csv

# Skip Reddit (Goodreads only)
python main.py --input input/books.csv --output output/scored_books.csv --no-reddit

# Dry run (see what would be scored without API calls)
python main.py --input input/books.csv --output output/scored_books.csv --dry-run

# Test on first 3 books only
python main.py --input input/books.csv --output output/scored_books.csv --limit 3
```

## Output CSV columns

| Column | Description |
|--------|-------------|
| `readability` | 0-100, weighted 40% |
| `grammar` | 0-100, weighted 15% |
| `polish` | 0-100, weighted 15% |
| `prose` | 0-100, weighted 15% |
| `pacing` | 0-100, weighted 15% |
| `overall_score` | Weighted formula result |
| `confidence` | 0-100 confidence in score |
| `review_count` | Number of excerpts used |
| `flags` | Pipe-separated warnings |
| `key_phrases` | Key reviewer language |
| `scoring_status` | `ok` / `error` |

## Scoring Formula

```
Overall = (Readability × 40%) + (Grammar × 15%) + (Polish × 15%) + (Prose × 15%) + (Pacing × 15%)
```

**Critical rule:** If Readability < 70, overall score is capped at 75.

## Rate Limits

- **Gemini free tier:** 15 requests/minute → ~4 second delay between books
- **Goodreads:** 2 second delay between page requests (polite scraping)
- **Reddit:** PRAW handles rate limits automatically

At 4s/book, scoring 100 books takes ~7 minutes.

## Mapping to StyleScope App

Map output columns to `qualityBreakdown` in `BOOKS` array:

```js
qualityBreakdown: {
  grammar:           row.grammar,
  polishEditing:     row.polish,
  readability:       row.readability,
  proseStyle:        row.prose,
  pacing:            row.pacing,
  communityConsensus: row.confidence,  // or separate metric
}
```

## Files

```
stylescope-scorer/
├── main.py              # CLI entry point
├── scorer.py            # Gemini LLM integration + scoring
├── config.py            # All configuration
├── scrapers/
│   ├── reddit.py        # Reddit PRAW scraper
│   ├── goodreads.py     # Goodreads BeautifulSoup scraper
│   └── utils.py         # Shared text utilities
├── requirements.txt
├── .env.example
├── input/books.csv      # Sample input
└── output/              # Scored results land here
```
