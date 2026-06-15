# RAG Demo — Teddy's AI Portfolio

A simplified RAG (Retrieval-Augmented Generation) demo built with Next.js 14, TypeScript, Tailwind CSS, and Google Gemini 1.5 Flash.

## How the RAG pipeline works

```
User query
    │
    ▼
[1] RETRIEVAL    — Read all /data/*.md files into memory
    │
    ▼
[2] AUGMENTATION — Inject documents into Gemini's system prompt as
                   numbered context blocks ([Document 1 — resume], etc.)
    │
    ▼
[3] GENERATION   — Gemini streams a response, citing sources as [1] [2]
    │
    ▼
Frontend parses citations → renders "Sources" panel
```

**This demo uses in-context retrieval** (entire corpus in the prompt). For larger
document sets, the retrieval step would instead embed the query, run similarity
search against a vector DB (Pinecone, pgvector, Weaviate, etc.), and inject only
the top-k most relevant chunks — keeping the prompt small and focused.

## Setup

### 1. Get a free Gemini API key

Go to https://aistudio.google.com/app/apikey and create a key. The free tier is enough for this demo.

### 2. Configure environment

```bash
cp .env.local.example .env.local
# Open .env.local and replace "your_key_here" with your actual key
```

### 3. Fill in your documents

Edit the files in `/data/` — replace the placeholder content with your real information:

| File | What to write |
|---|---|
| `resume.md` | Your resume/CV in markdown |
| `project-secureshift.md` | Tech stack, challenges, outcomes for SecureShift |
| `project-micromomentum.md` | Tech stack, challenges, outcomes for MicroMomentum |

You can add more `.md` files — they're picked up automatically at request time.

### 4. Run

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Features

- **Ask about Teddy** — chat interface with inline citations ([1], [2]) and a Sources panel
- **Job Match Analysis** — paste a JD to get matching skills, gaps, and a match score
- Streaming responses rendered token-by-token
- Dark theme, no external dependencies beyond Gemini
