CREATE TABLE IF NOT EXISTS books(
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    price_gbp NUMERIC,
    rating_text TEXT,
    category TEXT,
    summary TEXT,
    quality_flags TEXT[],
    confidence NUMERIC,
    enriched_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);