**/enrich**

**What it does:** Takes a book's title and description, returns a category, a one-sentence summary, and quality flags about the listing.

**Input shape**:
{ "title": "string, 1-300 chars", "description": "string, 1-3000 chars, may be empty/null" }

**Output shape**:
{
  "category": one of [fiction, non-fiction, poetry, children, other],
  "summary": "one short sentence",
  "quality_flags": array, each one of [vague_description, missing_details, too_short, looks_fine],
  "confidence": number, 0.0 to 1.0
}

**It must never:**
- invent a category outside the list
- make up details not present in the input
- return free text outside these fields
- give pricing, legal, or purchasing advice

**When unsure:**
- return category "other" with confidence below 0.5
- include "vague_description" in quality_flags
- never guess a specific category it isn't sure about