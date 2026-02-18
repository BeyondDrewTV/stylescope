"""
quizzes.py
Quiz data and scoring logic for StyleScope.

Imported by api.py:
    from quizzes import TRIVIA_BANK, PERSONALITY_QUESTIONS, score_personality
"""

# ---------------------------------------------------------------------------
# Trivia Quiz
# Each question has: id, question, options (list[str]), correct_index (int)
# correct_index is NOT sent to the client — it's checked on submit.
# ---------------------------------------------------------------------------

TRIVIA_BANK = [
    {
        "id": 1,
        "question": "Which author wrote 'The Hating Game'?",
        "options": [
            "Emily Henry",
            "Sally Thorne",
            "Talia Hibbert",
            "Helen Hoang",
        ],
        "correct_index": 1,
    },
    {
        "id": 2,
        "question": "In romance publishing, what does 'HEA' stand for?",
        "options": [
            "Happily Ever After",
            "High Emotional Arc",
            "Hero's Emotional Awakening",
            "Happy Ending Assumed",
        ],
        "correct_index": 0,
    },
    {
        "id": 3,
        "question": "Which author is known for the 'Book Boyfriends' series and frequently tops romance bestseller lists?",
        "options": [
            "Nora Roberts",
            "Julia Quinn",
            "Colleen Hoover",
            "Lisa Kleypas",
        ],
        "correct_index": 2,
    },
    {
        "id": 4,
        "question": "The 'Bridgerton' series by Julia Quinn is set in which historical period?",
        "options": [
            "Edwardian England",
            "Regency England",
            "Victorian England",
            "Georgian England",
        ],
        "correct_index": 1,
    },
    {
        "id": 5,
        "question": "What is a 'slow burn' in romance fiction?",
        "options": [
            "A book with graphic content from chapter one",
            "A mystery subplot that builds over the series",
            "A romantic tension that develops gradually before resolution",
            "A villain who becomes a love interest late in the story",
        ],
        "correct_index": 2,
    },
    {
        "id": 6,
        "question": "Which romance trope involves characters pretending to date for external reasons?",
        "options": [
            "Enemies to Lovers",
            "Fake Dating",
            "Second Chance Romance",
            "Forced Proximity",
        ],
        "correct_index": 1,
    },
    {
        "id": 7,
        "question": "Helen Hoang's debut novel 'The Kiss Quotient' features a protagonist who is:",
        "options": [
            "A professional chef",
            "An econometrics professor",
            "A data scientist with autism",
            "A ballet dancer recovering from injury",
        ],
        "correct_index": 2,
    },
    {
        "id": 8,
        "question": "In romance, 'MMC' and 'FMC' refer to what?",
        "options": [
            "Main Male Character / Female Main Character",
            "Maximum Moment of Conflict / Final Moment of Connection",
            "Male Media Coverage / Female Media Coverage",
            "None of the above",
        ],
        "correct_index": 0,
    },
    {
        "id": 9,
        "question": "Which author wrote the 'Outlander' series?",
        "options": [
            "Nora Roberts",
            "Kathleen E. Woodiwiss",
            "Diana Gabaldon",
            "Sandra Brown",
        ],
        "correct_index": 2,
    },
    {
        "id": 10,
        "question": "What is 'BookTok'?",
        "options": [
            "An audiobook platform owned by Amazon",
            "The book community on TikTok",
            "A British romance imprint",
            "A podcast about romance novel writing",
        ],
        "correct_index": 1,
    },
]


# ---------------------------------------------------------------------------
# Personality Quiz
# Each question has: id, question, options (list[str])
# Answers map to a reader profile via score_personality().
# ---------------------------------------------------------------------------

PERSONALITY_QUESTIONS = [
    {
        "id": 1,
        "question": "How much romantic tension do you want before the relationship resolves?",
        "options": [
            "Minimal — get them together quickly",
            "Some buildup, but not too long",
            "Long slow burn — make me wait",
            "Painful levels of unresolved tension",
        ],
    },
    {
        "id": 2,
        "question": "What's your preferred spice level?",
        "options": [
            "Closed-door — fade to black",
            "Mild — some heat, nothing graphic",
            "Medium — explicit but tasteful",
            "Maximum — hold nothing back",
        ],
    },
    {
        "id": 3,
        "question": "Which trope do you gravitate toward most?",
        "options": [
            "Enemies to lovers",
            "Friends to lovers",
            "Second chance romance",
            "Forced proximity",
        ],
    },
    {
        "id": 4,
        "question": "Preferred book length?",
        "options": [
            "Short — under 250 pages",
            "Standard — 300–400 pages",
            "Long — 400–500 pages",
            "Epic — 500+ pages, give me everything",
        ],
    },
    {
        "id": 5,
        "question": "How important is the emotional depth of the characters to you?",
        "options": [
            "Not very — plot and pacing matter more",
            "Somewhat — I want likable characters",
            "Very — I need full arcs and real growth",
            "Everything — the emotional journey is the whole point",
        ],
    },
    {
        "id": 6,
        "question": "Preferred ending?",
        "options": [
            "HEA — happily ever after, fully resolved",
            "HFN — happy for now is enough",
            "Bittersweet — meaningful, not always tidy",
            "Cliffhanger — I'll read the next book anyway",
        ],
    },
    {
        "id": 7,
        "question": "What setting appeals to you most?",
        "options": [
            "Contemporary — real world, modern day",
            "Historical — Regency, Victorian, etc.",
            "Fantasy — magic, other worlds",
            "Dark/taboo — gritty, morally complex",
        ],
    },
    {
        "id": 8,
        "question": "How do you feel about content warnings?",
        "options": [
            "Essential — I need them before I start",
            "Useful — I check them occasionally",
            "Optional — I prefer to be surprised",
            "Irrelevant — I read everything",
        ],
    },
]

# ---------------------------------------------------------------------------
# Personality scoring
# Maps answer patterns to a reader profile.
# This is intentionally simple for V1.
# ---------------------------------------------------------------------------

PROFILES = [
    {
        "id": "slow_burn_hea",
        "label": "Slow Burn HEA Reader",
        "description": (
            "You want the full journey: prolonged tension, real emotional stakes, "
            "and a satisfying, committed resolution. You read for the payoff."
        ),
    },
    {
        "id": "high_spice_fast",
        "label": "High Heat Fast Burn Reader",
        "description": (
            "You are here for intensity, chemistry, and explicit content delivered "
            "without excessive delays. Pacing and spice are your top priorities."
        ),
    },
    {
        "id": "emotional_depth",
        "label": "Character-Driven Reader",
        "description": (
            "You read for growth, vulnerability, and the complexity of human connection. "
            "A book without real emotional arcs is not a book you will finish."
        ),
    },
    {
        "id": "dark_complex",
        "label": "Dark Romance Reader",
        "description": (
            "Morally gray characters, difficult themes, and high stakes are your comfort zone. "
            "You appreciate fiction that does not sanitize reality."
        ),
    },
    {
        "id": "comfort_read",
        "label": "Comfort Reader",
        "description": (
            "You want warmth, low conflict, and the assurance that things will work out. "
            "Romance is your reset button, and there is nothing wrong with that."
        ),
    },
]


def score_personality(answers: list) -> dict:
    """
    Very lightweight scoring: tally answer indices and map to a profile.
    answers: list of int (option indices, 0-based), one per question.
    Returns a profile dict: {id, label, description}
    """
    if not answers:
        return PROFILES[0]

    # Simple heuristic weights
    slow_burn_score = 0
    high_spice_score = 0
    emotional_score = 0
    dark_score = 0
    comfort_score = 0

    for i, ans in enumerate(answers):
        if not isinstance(ans, int):
            continue

        q_id = i  # 0-based index into PERSONALITY_QUESTIONS

        if q_id == 0:  # Tension buildup
            if ans >= 2:
                slow_burn_score += 2
            elif ans == 0:
                comfort_score += 1

        elif q_id == 1:  # Spice level
            if ans >= 3:
                high_spice_score += 3
            elif ans == 0:
                comfort_score += 2

        elif q_id == 2:  # Trope
            if ans == 0:  # enemies to lovers
                dark_score += 1
                slow_burn_score += 1
            elif ans == 1:  # friends to lovers
                emotional_score += 1
                comfort_score += 1

        elif q_id == 4:  # Emotional depth
            if ans >= 2:
                emotional_score += 2
            elif ans == 0:
                high_spice_score += 1

        elif q_id == 5:  # Ending
            if ans == 0:
                comfort_score += 1
                slow_burn_score += 1
            elif ans == 2:
                emotional_score += 1
                dark_score += 1

        elif q_id == 6:  # Setting
            if ans == 3:  # dark/taboo
                dark_score += 3

        elif q_id == 7:  # Content warnings attitude
            if ans == 0:
                comfort_score += 1
            elif ans == 3:
                dark_score += 1

    scores = {
        "slow_burn_hea": slow_burn_score,
        "high_spice_fast": high_spice_score,
        "emotional_depth": emotional_score,
        "dark_complex": dark_score,
        "comfort_read": comfort_score,
    }

    best_id = max(scores, key=lambda k: scores[k])
    return next(p for p in PROFILES if p["id"] == best_id)
