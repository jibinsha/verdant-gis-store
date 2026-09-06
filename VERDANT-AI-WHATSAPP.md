# Verdant AI + WhatsApp

This build adds a professional floating Verdant AI support assistant and WhatsApp contact button.

## AI
- Provider: Experiential Labs
- Model: `gpt-6-astra`
- Base URL: `https://api.experientiallabs.ai/v1`
- Backend endpoint: `POST /api/ai/chat`
- The Experiential API key is server-side only.
- The backend injects current published catalogue metadata as reference context.
- Responses are streamed to the browser.
- A small in-memory IP rate limit is applied to the public chatbot.

Add to the Render backend environment:

```env
EXPLABS_API_KEY=YOUR_SAVED_XPL_KEY
EXPLABS_MODEL=gpt-6-astra
EXPLABS_BASE_URL=https://api.experientiallabs.ai/v1
```

Do not add these to Vite frontend variables and do not commit the key.

## WhatsApp
The floating WhatsApp button opens:

`https://wa.me/917306695292`

with a pre-filled Verdant GIS support message.

## Existing architecture preserved
- Cloudflare R2 remains the private store for large paid source files.
- Supabase remains the metadata/auth/order/GeoJSON database.
- Optional GeoJSON / Map Explorer behavior is preserved.
