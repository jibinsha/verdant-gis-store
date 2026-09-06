# Verdant GIS — Cloudflare R2 setup

This version stores large paid dataset source files in the private Cloudflare R2 bucket `verdant-gis-datasets`.
Supabase remains responsible for dataset metadata, authentication, payments/orders, and optional GeoJSON previews.

## Render environment variables

Add these to the backend service only:

```env
R2_ACCOUNT_ID=YOUR_CLOUDFLARE_ACCOUNT_ID
R2_BUCKET_NAME=verdant-gis-datasets
R2_ACCESS_KEY_ID=YOUR_R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY=YOUR_R2_SECRET_ACCESS_KEY
R2_ENDPOINT=https://YOUR_CLOUDFLARE_ACCOUNT_ID.r2.cloudflarestorage.com
```

Never expose the access key or secret in the Vite frontend.

## R2 bucket CORS

Because the admin browser uploads directly to R2 using a short-lived presigned PUT URL, the bucket needs a CORS policy.
In Cloudflare: **R2 → verdant-gis-datasets → Settings → CORS Policy → Add CORS policy → JSON**.

Use your real production frontend origin. During local development, include `http://localhost:5173`.

Example:

```json
[
  {
    "AllowedOrigins": [
      "https://YOUR-PRODUCTION-FRONTEND-DOMAIN",
      "http://localhost:5173"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Do not make the bucket public.

## How uploads work

1. Admin signs in to Verdant GIS.
2. The frontend asks the backend for a short-lived R2 upload URL.
3. The backend verifies the user is an admin and signs a URL using the server-only R2 credentials.
4. The browser uploads the large source file directly to R2, so Render does not buffer the file.
5. Supabase stores `download_path` as `r2:<object-key>`.

## How downloads work

1. Customer requests a purchased dataset download.
2. Backend verifies the authenticated user owns the dataset.
3. Backend returns a short-lived R2 GET URL.
4. Browser downloads directly from private R2.

Existing datasets whose `download_path` points to the old Supabase Storage bucket continue to use the legacy download path.

## Verdant AI / Experiential Labs

The website includes a public Verdant AI support assistant powered through Experiential Labs.
Add these variables to the Render backend only:

```env
EXPLABS_API_KEY=YOUR_EXPERIENTIAL_LABS_API_KEY
EXPLABS_MODEL=gpt-6-astra
EXPLABS_BASE_URL=https://api.experientiallabs.ai/v1
```

Never put the Experiential Labs key in a `VITE_` variable or in the frontend source.
The browser calls `/api/ai/chat`; Render calls Experiential Labs and streams the answer back.

The WhatsApp support button opens:
`https://wa.me/917306695292`
