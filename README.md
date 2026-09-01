# Book Enrichment API

LLM-powered book classification and enrichment. Takes messy book listings → returns clean, validated JSON.

**In:** `{ title, description }`  
**Out:** `{ category, summary, quality_flags, confidence }`

---

## Features

- ✅ **Structured output** — Every response is validated JSON, never raw model text
- ✅ **Parse + Repair** — Model output is parsed, validated, and auto-repaired once if broken; quarantined if it still fails
- ✅ **Provider agnostic** — Works with Ollama (local) or OpenRouter (hosted); swap with just three env vars
- ✅ **Production controls** — Timeout, retry policy, kill switch, cost logging
- ✅ **Stub mode** — Test the endpoint without calling the LLM
- ✅ **Eval set** — 8 hand-labelled test cases with results

---

## Quick Start

### 1. Clone and install

```bash
git clone <your-repo-url>
cd enrich-api
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your provider choice (see below)
```

### 3. Start the server

```bash
# Normal mode (calls the model)
node --env-file=.env index.js

# Stub mode (returns fake valid data, no model calls)
LLM_STUB=1 node --env-file=.env index.js

# Kill switch (model disabled, returns 503)
LLM_ENABLED=false node --env-file=.env index.js
```

### 4. Test it

```bash
curl -X POST http://localhost:3000/enrich \
  -H "Content-Type: application/json" \
  -d '{
    "title": "The Great Gatsby",
    "description": "A tragic story of wealth, love, and the American Dream in 1920s New York."
  }'
```

**Expected response:**

```json
{
  "category": "fiction",
  "summary": "A tragic novel about wealth, love, and the American Dream in 1920s New York.",
  "quality_flags": ["looks_fine"],
  "confidence": 0.95
}
```

---

## API Specification

### Endpoint: `POST /enrich`

#### Request

```json
{
  "title": "string (1–300 chars, required)",
  "description": "string (0–3000 chars, optional/nullable)"
}
```

#### Response (Success: 200)

```json
{
  "category": "fiction | non-fiction | poetry | children | other",
  "summary": "one short sentence",
  "quality_flags": ["vague_description | missing_details | too_short | looks_fine"],
  "confidence": 0.0
}
```

#### Response (Invalid Input: 400)

```json
{
  "error": "Invalid or missing field: title"
}
```

#### Response (Model Failed After Repair: 422)

```json
{
  "error": "Failed to enrich book after repair attempt. See logs for details."
}
```

#### Response (Model Disabled: 503)

```json
{
  "error": "LLM enrichment is currently disabled."
}
```

---

## Environment Setup

### Option 1: Ollama (Local, Free)

1. Install [Ollama](https://ollama.ai)
2. Pull a model: `ollama pull llama3.2`
3. Start the daemon: `ollama serve` (runs on `localhost:11434`)
4. Set `.env`:

```env
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3.2
LLM_API_KEY=ollama
LLM_ENABLED=true
LLM_STUB=0
PORT=3000
```

### Option 2: OpenRouter (Hosted, Free Tier Available)

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Create an API key
3. Go to **Settings → Privacy** and enable:
   - "Allow free endpoints that train on request data"
   - "Allow free endpoints that publish prompts"
4. Set `.env`:

```env
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=openrouter/free
LLM_API_KEY=sk-or-v1-YOUR_KEY_HERE
LLM_ENABLED=true
LLM_STUB=0
PORT=3000
```

**Rate limits:** 20 req/min, 50 req/day (free tier)

**Privacy note:** Free endpoints may train on request data and publish prompts. Only send test/non-sensitive data.

---

## Project Structure

```
enrich-api/
├── index.js                    # Express entry point
├── .env                        # Secrets (gitignored)
├── .env.example                # Template
├── package.json
├── src/
│   ├── routes/
│   │   └── enrich.js           # POST /enrich route
│   ├── llm/
│   │   ├── client.js           # LLM caller (timeout, retry, logging)
│   │   ├── parse-repair.js     # Parse → Validate → Repair → Quarantine
│   │   ├── schema.js           # Zod schemas (input & output)
│   │   └── hello.js            # Sanity check
│   ├── utils/
│   │   ├── retry.js            # Exponential backoff + jitter
│   │   └── costLogger.js       # Cost tracking
│   └── prompts/
│       └── enrich-v1.md        # System prompt (versioned)
├── evals/
│   ├── cases.json              # 8 hand-labelled test cases
│   ├── test.js                 # Eval runner
│   └── results.json            # Latest results
└── logs/
    ├── cost.jsonl              # Cost per call
    └── quarantineLogs.jsonl    # Failed validations
```

---

## Testing & Evaluation

Run the eval suite:

```bash
# Terminal 1
node --env-file=.env index.js

# Terminal 2
node evals/test.js
```

### Results (OpenRouter Free Model)

| Case | Title | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| 1 | The Great Gatsby | fiction | fiction | ✅ PASS |
| 2 | Sapiens | non-fiction | non-fiction | ✅ PASS |
| 3 | Where the Wild Things Are | children | children | ✅ PASS |
| 4 | The Road | fiction | fiction | ✅ PASS |
| 5 | Howl and Other Poems | poetry | null | ❌ FAIL |
| 6 | Untitled Manuscript | other | null | ❌ FAIL |
| 7 | The Lean Startup | non-fiction | non-fiction | ✅ PASS |
| 8 | Ambiguous Text | other | fiction | ❌ FAIL |

**Score:** 5/8 (62.5%)

**Why failures happened:**
- Cases 5 & 6: Model returned unparsable JSON → caught by repair loop, quarantined (working as designed)
- Case 8: Model ignored "when unsure" rule (model quality issue, not integration bug)

---

## Key Design Decisions

### Parse + Repair Pipeline

1. **Parse:** Extract JSON from markdown fences (`\`\`\`json...`) or raw literals
2. **Validate:** Check against Zod output schema (closed category enum, valid confidence range, etc.)
3. **Repair (once):** If parsing or validation fails, make one more call with the broken output + error + strict instruction
4. **Quarantine:** If repair also fails, return 422 and log to `logs/quarantineLogs.jsonl`

Model output is never returned raw to the caller.

### Timeout & Retry

- **Timeout:** 30 seconds per call (default SDK timeout is 10 minutes — unusable for HTTP)
- **Retry:** Exponential backoff (1s, 2s, 4s + jitter) on timeout/429/5xx; never retry 4xx errors
- **Kill switch:** Set `LLM_ENABLED=false` to disable model instantly without redeploying

### Stub Mode

When `LLM_STUB=1`, the endpoint returns hard-coded valid JSON without calling the model. Useful for:
- Testing the full pipeline without burning API quota
- Local development on unstable internet
- CI/CD

### Cost Logging

Every call writes to `logs/cost.jsonl`:

```json
{
  "TimeStamp": "2026-08-31T19:12:33.000Z",
  "PromptVersion": "v1",
  "ModelName": "openrouter/free",
  "InputTokens": 420,
  "OutputTokens": 85,
  "TotalTokens": 505,
  "DurationMs": 3200,
  "NeededRepair": false,
  "Status": "success"
}
```

---

## Cost Analysis

| Provider | Per-Call Cost | Rate Limit | Notes |
|----------|---------------|-----------|-------|
| **Ollama** | $0 | None | Runs locally; requires ~2GB disk + CPU |
| **OpenRouter Free** | $0 | 50 req/day | Free tier; may train on data |
| **OpenRouter Paid** | ~$0.0003–0.001 | Unlimited | Estimate: $3.50–$4.50/day at 10k req/day |

---

## Tech Stack

- **Runtime:** Node.js 20+
- **Framework:** Express 5
- **Validation:** Zod 4
- **LLM Client:** openai npm package (OpenAI-compatible)
- **Providers:** Ollama + OpenRouter
- **Models Tested:** llama3.2, openrouter/free

---

## License

ISC

---

## Contributing

Contributions welcome. Please:
1. Test against both Ollama and OpenRouter
2. Add test cases to `evals/cases.json` if adding features
3. Commit `.env.example` changes, never `.env`

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Error: connect ECONNREFUSED` | Ollama daemon not running. Run `ollama serve` in another terminal. |
| `401 Unauthorized` | Check your API key in `.env`. Make sure OpenRouter privacy settings are enabled. |
| `422 Unprocessable Entity` | Model returned invalid JSON after repair. Check `logs/quarantineLogs.jsonl` for details. |
| `503 Service Unavailable` | `LLM_ENABLED=false`. Remove or set to `true` in `.env`. |
| Tests pass locally but fail in CI | Ensure `.env` is set in CI environment. Use GitHub Secrets for API keys. |

---

**Built during FlyRank Internship · Backend Track · Week 7**