# DocFlow

A document reading workspace built with Next.js.

Users can upload `PDF`, `HTML`, `DOCX`, or plain text documents, then run a reading workflow that includes:

- document ingestion
- language detection and translation
- summary generation
- section navigation
- grounded Q&A with citations
- multi-document comparison
- notes, favorites, and reading reports

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- OpenAI-compatible API
- local JSON persistence

## Local Development

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Set your model credentials in `.env.local`:

```env
LLM_API_KEY=your_api_key_here
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
LLM_MODEL=qwen-plus
```

Run the development server:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Notes

- `.env.local` is ignored and should not be committed.
- `data/` is ignored and stores local workspace data only.
- `node_modules/` and `.next/` are ignored.
