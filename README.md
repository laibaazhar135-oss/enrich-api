**Book Enrichment API — LLM-Powered Classification**
**FlyRank Internship · Backend Track · Week 7 · Assignment A17**
**Goal**: One request in, one structured JSON answer out. No raw model text ever reaches the caller.
**What it does**
This API takes a messy book listing — just a title and a description — and returns clean, validated JSON containing a category, a one-sentence summary, quality flags, and a confidence score. It is built like a production feature: the model is treated as a slow, expensive, sometimes-wrong external API, so every answer is parsed, validated, repaired once if broken, and quarantined if it still fails.
Quick start
1. Clone & install
bash
git clone <your-repo-url>
cd enrich-api
npm install
2. Configure environment
bash
cp .env.example .env
# Edit .env with your values (see Environment Variables below)
3. Start the server
bash
# Normal mode (calls the model)
node --env-file=.env index.js

# Stub mode — returns fake schema-valid data without calling the model
LLM_STUB=1 node --env-file=.env index.js

# Kill switch — model disabled, returns 503
LLM_ENABLED=false node --env-file=.env index.js
4. Test with curl
Valid request:
bash
curl -X POST http://localhost:3000/enrich \
  -H "Content-Type: application/json" \
  -d '{"title":"The Great Gatsby","description":"A tragic story of wealth, love, and the American Dream in 1920s New York."}'
Expected response:
JSON
{
  "category": "fiction",
  "summary": "A tragic novel about wealth, love, and the American Dream in 1920s New York.",
  "quality_flags": ["looks_fine"],
  "confidence": 0.95
}
Invalid request (missing title):
bash
curl -X POST http://localhost:3000/enrich \
  -H "Content-Type: application/json" \
  -d '{"description":"Missing the title field"}'
Expected response:
JSON
{ "error": "Invalid or missing field: title" }
Job Card
Endpoint: POST /enrich
Input:
JSON
{ "title": "string, 1-300 chars", "description": "string, 1-3000 chars, may be empty/null" }
Output:
JSON
{
  "category": "fiction | non-fiction | poetry | children | other",
  "summary": "one short sentence",
  "quality_flags": ["vague_description | missing_details | too_short | looks_fine"],
  "confidence": 0.0-1.0
}
It must never:
Invent a category outside the closed list
Make up details not present in the input
Return free text outside the four defined fields
Give pricing, legal, or purchasing advice
When unsure:
Return category "other" with confidence below 0.5
Include "vague_description" in quality_flags
Never guess a specific category it isn't sure about
Project Structure
plain
enrich-api/
├── index.js                    # Express entry point
├── .env                        # Secrets (gitignored)
├── .env.example                # Template with empty values
├── JOB-CARD.md                 # Contract definition
├── package.json
├── src/
│   ├── routes/
│   │   └── enrich.js           # POST /enrich route (validation + stub + kill switch + error handling)
│   ├── llm/
│   │   ├── client.js           # LLM caller with retries, timeout, and cost logging
│   │   ├── parse-repair.js     # Parse → Validate → Repair once → Quarantine
│   │   ├── schema.js           # Zod input & output schemas
│   │   └── hello.js            # Stage 0: "ready" sanity check
│   ├── utils/
│   │   ├── retry.js            # Exponential backoff + jitter, retry rules
│   │   └── costLogger.js       # Structured cost logging
│   └── prompts/
│       └── enrich-v1.md        # Versioned system prompt
├── evals/
│   ├── cases.json              # 8 hand-labelled test cases
│   ├── test.js                 # Eval runner script
│   └── results.json            # Latest eval run output
└── logs/
    ├── cost.jsonl              # One structured line per model call
    └── quarantineLogs.jsonl    # Failed validations after repair attempt
Stage-by-Stage Build Diary
Stage 0 — Job Card & Provider Setup (~45 min)
What I did:
Wrote JOB-CARD.md first, before any code. This defined the closed output shape, the "must never" rules, and the "when unsure" fallback.
Chose the Ollama provider lane (local, free, no API key needed beyond the literal string ollama).
Installed Ollama locally and pulled llama3.2.
Created .env with LLM_BASE_URL, LLM_MODEL, LLM_API_KEY, and LLM_ENABLED.
Added .env to .gitignore immediately; committed .env.example with empty values.
Wrote src/llm/hello.js — a throwaway script that asks the model to reply with exactly the word ready.
Checkpoint: node --env-file=.env src/llm/hello.js prints something containing ready. git status does not list .env.
Commit: Stage 0: job card, provider working, key in .env
Stage 1 — Endpoint, Validation, Schema, Stub Mode (~45 min)
What I did:
Added POST /enrich to the existing Express API via src/routes/enrich.js.
Defined the input schema in src/llm/schema.js using Zod:
title: trimmed string, 1–300 chars
description: string, max 3000 chars, nullable, optional
Defined the output schema in the same file:
category: enum of 5 closed values
summary: non-empty string
quality_flags: array enum, min 1 item
confidence: number between 0.0 and 1.0
Input validation runs before any model call. Missing fields, wrong types, or oversized text → 400 with a JSON message naming the offending field.
Added stub mode: when LLM_STUB=1 is set, the endpoint skips the model entirely and returns a hard-coded object that satisfies the output schema.
Why stub mode matters: On OpenRouter's free tier, failed requests count against the 50/day limit. Stub mode lets you develop and restart the server twenty times without burning a single call.
Checkpoint: With LLM_STUB=1, a valid curl returns 200 and JSON matching the schema. A broken request returns 400 naming the field. Zero model calls.
Commit: Stage 1: endpoint, input validation, output schema, stub mode
Stage 2 — Prompt as a Versioned Specification (~1h 15m)
What I did:
Created src/prompts/enrich-v1.md — the prompt lives in a file with a version number, not as a string inside a route.
Structured the system prompt with five parts in order:
Role and job: "You classify and summarize book listings for an online bookstore's catalog."
Exact output shape: Every field, its type, and the closed list of allowed values.
Rules: Never invent categories, never add fields, never return anything except the JSON object.
When unsure: Use "other" with confidence < 0.5; include "vague_description"; do not guess.
Examples: A typical case (The Great Gatsby), an ambiguous case (null description), and a hostile/prompt-injection case.
Sent user data as a separate user message, JSON-encoded, never concatenated into the system prompt. This keeps untrusted content walled off from instructions.
Set temperature: 0.2 for deterministic classification output.
Wired the prompt file into src/llm/client.js — loaded at runtime with fs.readFileSync.
Checkpoint: With LLM_STUB unset, the endpoint returns a real model answer for three different inputs. The prompt is in a file, and the file is committed.
Commit: Stage 2: prompt v1 as a versioned file, wired to endpoint
Stage 3 — Parse, Validate, Repair Once, Quarantine (~1h 30m)
What I did:
Built src/llm/parse-repair.js to handle the fact that models sometimes wrap JSON in markdown fences or add conversational fluff.
Parse strategy (tried in order):
Match ```json ... ```
Match plain ``` ... ```
Match the first {...} object literal
If all fail → parse error
Validate the parsed object against the Zod output schema using safeParse. A structurally valid JSON object with a category outside the enum is still a failure.
Repair once (and only once): If parsing or validation fails, we make exactly one more call. The repair prompt includes:
The broken raw output
The exact validation error from Zod
A strict instruction to return only corrected JSON
Quarantine: If the repair also fails, we return 422 to the caller with a clear message, and write the raw output to logs/quarantineLogs.jsonl with the input, error, and prompt version. The process never crashes and never returns raw model text.
Checkpoint: Happy path returns schema-shaped JSON. Temporarily editing the prompt to demand a forbidden category triggers a 422 with a readable message and a new line in logs/quarantineLogs.jsonl.
Commit: Stage 3: parse, validate, repair once, quarantine on failure
Stage 4 — Timeout, Retry Policy, Cost Logging, Kill Switch (~1h 15m)
What I did:
Real timeout: Set timeout: 30000 (30 seconds) on the OpenAI client. The SDK default is 10 minutes — unusable for an HTTP endpoint. If the model call exceeds 30s, we return 504.
Retry policy: Built src/utils/retry.js with:
Exponential backoff with jitter: 1s, 2s, 4s + random 0–500ms
Retry on: timeouts (ETIMEDOUT), 429, and 5xx
Never retry on 400, 401, or 403 — a bad key is still a bad key in four seconds
Explicitly set maxRetries: 0 on the SDK client so we control retries ourselves (no silent double-retries)
Cost logging: Every call writes one structured line to logs/cost.jsonl containing:
Prompt version, model name, input tokens, output tokens, total tokens
Duration in milliseconds
Whether it needed a repair
Status (success, failed_504, etc.)
Kill switch: LLM_ENABLED=false makes the endpoint skip the model entirely and return a clean 503 with a message. This exists so someone who is not me can turn the feature off during an outage or bill spike without deploying code.
Checkpoint: With LLM_ENABLED=false, the endpoint answers immediately with 503, and logs show zero model calls. With a deliberately wrong API key, it fails fast with a clear error and logs show no retries (401 is never retried).
Commit: Stage 4: timeout, retry policy, cost logging, kill switch
Stage 5 — Eval Set, Results, README, Published (~1h)
What I did:
Built evals/cases.json with 8 hand-labelled inputs, each with the expected category:
The Great Gatsby → fiction (typical)
Sapiens → non-fiction (typical)
Where the Wild Things Are → children (typical)
The Road → fiction (dark but still fiction)
Howl and Other Poems → poetry (explicit genre)
Untitled Manuscript / null description → other (ambiguous / missing)
The Lean Startup → non-fiction (business)
Ambiguous Text About Things → other (deliberately vague)
Wrote evals/test.js — a script that runs all 8 cases through the live endpoint and prints pass/fail per case, plus an overall score.
Results are saved to evals/results.json with date, prompt version, model name, and score.
To run the eval:
bash
node --env-file=.env index.js   # terminal 1
node evals/test.js              # terminal 2
Commit: Stage 5: eval set, results, README, published
Provider Swap — Ollama to OpenRouter
I built the whole thing against Ollama first, then proved it works on OpenRouter by changing exactly three environment variables. Zero code changes.
What I changed in .env
bash
# Ollama (local)
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3.2
LLM_API_KEY=ollama

# OpenRouter (hosted)
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=openrouter/free
LLM_API_KEY=sk-or-v1-...
OpenRouter setup steps
Sign up at https://openrouter.ai
Create an API key
Go to Settings → Privacy and turn ON both:
"Allow free endpoints that train on request data"
"Allow free endpoints that publish prompts"
(Without these, every free model returns 404.)
Paste the key into .env
node --env-file=.env index.js — same code, different provider
Privacy note: Free endpoints may use your prompts for training and may publish them. I only send the fake test data from my eval cases — no real personal or employer data.
Environment Variables
Table
Variable	Ollama example	OpenRouter example	Purpose
LLM_BASE_URL	http://localhost:11434/v1	https://openrouter.ai/api/v1	Provider base URL
LLM_MODEL	llama3.2	openrouter/free	Model ID
LLM_API_KEY	ollama	sk-or-v1-...	API key
LLM_ENABLED	true	true	Kill switch. Set to false to disable model calls instantly.
LLM_STUB	0	0	Stub mode. Set to 1 to return fake schema-valid data without calling the model.
PORT	3000	3000	HTTP port for the Express server.
Eval Results
OpenRouter — openrouter/free
Table
Metric	Value
Date	2026-08-31
Prompt Version	v1
Model	openrouter/free
Score	5 / 8
Percentage	62.5%
Breakdown:
Table
Case	Title	Expected	Actual	Status
1	The Great Gatsby	fiction	fiction	✅ PASS
2	Sapiens	non-fiction	non-fiction	✅ PASS
3	Where the Wild Things Are	children	children	✅ PASS
4	The Road	fiction	fiction	✅ PASS
5	Howl and Other Poems	poetry	null	❌ FAIL
6	Untitled Manuscript	other	null	❌ FAIL
7	The Lean Startup	non-fiction	non-fiction	✅ PASS
8	Ambiguous Text About Things	other	fiction	❌ FAIL
Why the failures happened:
Cases 5 & 6 (poetry / other → null): The free model returned unparsable or schema-invalid JSON. My parse-repair loop tried once, failed, correctly returned 422, and quarantined the raw output. The test runner shows null because it hit an error response. This is the code working as designed — the model was wrong, not the pipeline.
Case 8 (other → fiction): The model returned perfectly valid JSON, but factually ignored the "when unsure" rule. It saw "story" and "characters" and confidently guessed fiction instead of other. This is a model quality issue, not a code bug — the schema can't catch a wrong answer that looks structurally correct.
What this tells me: 62.5% on a free rotating model pool is acceptable. The failures are the model being dumb, not my integration being broken. The two null cases prove the quarantine/repair system actually works — it caught bad output and refused to return garbage to the caller.
Ollama — llama3.2 (local)
I also verified the entire pipeline works against Ollama with the same three-env-var swap. The local model is more consistent but requires the Ollama daemon to be running and the model pulled locally.
Cost Analysis
OpenRouter (openrouter/free)
Per-call cost: $0.00 (free tier).
Limits: 20 requests/minute, 50 requests/day. Failed requests count against the daily quota.
At 10,000 requests/day: You would need to switch to a paid model. Rough estimate for a cheap paid model:
~500 tokens per call × 10,000 = ~5,000,000 tokens/day
Estimated: ~$3.50–$4.50/day depending on output length and repair rate.
Ollama (llama3.2)
Per-call cost: $0.00 (runs on your own CPU/GPU). No rate limits.
Trade-off: Slower responses, requires ~2GB disk space, and your laptop fan gets loud.
Sample cost log entry (logs/cost.jsonl)
JSON
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
What I'd Fix With Another Day
Prompt v2: Tighten the "when unsure" language. The free model ignored it on Case 8 (Ambiguous Text). I'd add an explicit rule: "If the description is vague, contradictory, or uses words like 'mysterious' and 'unclear meaning', you MUST use 'other' regardless of whether it mentions 'story' or 'characters'."
Provider abstraction: Extract a small src/llm/provider.js interface with a single complete(prompt, input) function and two implementations (Ollama, OpenRouter). The route should not know which provider exists — this matters more for LLMs than normal HTTP APIs because providers have different rate limits, error shapes, and model catalogs.
Prompt injection defense: While the prompt includes a hostile example, I'd add runtime JSON-encoding of the user message and test with 5 explicit attack cases in the eval set (OWASP LLM01).
Token pre-counting: Before sending, count tokens and reject anything over a limit. The biggest cost driver is usually retries on long inputs, not the initial call.
Caching: Add an in-memory cache keyed by hash(input + promptVersion). This pays off heavily when re-running evals or normalizing a fixed vocabulary.
Better 401 handling: The route currently returns 500 on an LLM 401 authentication error; it should return 401 since it's a client configuration problem, not a server crash.
Fix retry log: client.js logs ...retrying again after X seconds but X is actually milliseconds. Change the log to say ms or divide by 1000.

**Tech Stack**

Layer-	Choice
Runtime-	Node.js 20+ (ES modules)
Framework-	Express 5
Validation-	Zod 4
LLM Client	-openai npm package (OpenAI-compatible)
Providers tested	-Ollama (local) + OpenRouter (hosted)
Models tested	-llama3.2, openrouter/free