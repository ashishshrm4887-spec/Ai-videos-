# AI Videos

Personal AI image and video creator.

## Current status

Stage 1 foundation + provider abstraction:
- Mobile-first creator UI
- Text-to-video / image-to-video / text-to-image modes
- Generation settings
- Mock generation API with job queue + status polling
- Provider-independent architecture (`lib/providers`)
- Ready for Hugging Face / open-source adapters later
- Secure environment-variable setup (no keys in repo)

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Providers

Active provider is selected with the `AI_PROVIDER` env var (default: `mock`).

| Value | Description |
|-------|-------------|
| `mock` | Built-in free simulator (default) |
| (future) `huggingface` | Open-source models via HF Inference |
| (future) `seedance` | Paid Seedance when you choose to add it |

Never put API keys in frontend code or commit them to GitHub. Use Vercel Environment Variables only.
