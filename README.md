# AI Videos

Personal AI image and video creator.

## Current status

Stage 1 foundation + provider abstraction:
- Mobile-first creator UI
- Text-to-video / image-to-video / text-to-image modes
- Generation settings
- Mock generation API with serverless-safe job status
- Optional Hugging Face provider (`Wan-AI/Wan2.2-TI2V-5B` via Inference Providers)
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
| `mock` | Built-in free simulator (default) — no external calls |
| `huggingface` | Hugging Face Inference Providers + `Wan-AI/Wan2.2-TI2V-5B` |

### Hugging Face setup (optional)

1. Create a fine-grained token at https://huggingface.co/settings/tokens with **Inference Providers** permission.
2. In Vercel → Project → Settings → Environment Variables, add:
   - `AI_PROVIDER` = `huggingface`
   - `HF_TOKEN` = your token (never commit this)
3. Optional: `HF_PROVIDER` = `fal-ai` | `replicate` | `wavespeed` (provider preference)
4. Optional: `HF_VIDEO_MODEL` (default `Wan-AI/Wan2.2-TI2V-5B`)

**Credits:** Hugging Face free accounts receive a small monthly Inference Providers allowance (about **$0.10**, subject to change). Video generation is compute-heavy and often exceeds that. This app does **not** auto-purchase credits. If quota/billing errors occur, the API returns a clear failure and stays on the free path.

Never put API keys in frontend code or commit them to GitHub.
