# Verdant GIS V14 — Catalogue & Map Integration

This version keeps the existing payment gateway, secure download flow, authentication, and admin portal code unchanged.

## Changes
- Home page search now sends users to the live Store catalogue.
- Home category cards are connected to the real `categories` and published `datasets` tables.
- Added `/categories` category index.
- Added `/categories/:slug` category detail pages.
- Category pages show only published datasets whose `category_id` matches that category.
- Added dataset counts to category cards.
- Added "Explore on map" from each category.
- Map Explorer now loads the same published datasets used by the Store.
- Map Explorer supports category filtering and dataset search.
- Map Explorer loads the uploaded `preview_geojson_url` for the selected dataset.
- Map Explorer provides a direct link to the selected dataset's details page.
- Store search/category filters can be opened from URL query parameters.
- No hard-coded/sample GIS datasets were added.
- Existing payment/download/admin/server files were not modified.

## Important
Keep your existing `.env` values and Supabase configuration. The payment server and secure download implementation are intentionally unchanged.
