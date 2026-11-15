<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Persist restaurant menu harmonizations in `restaurant_menu_pairing_guides`; staff mobile links use `access_links.scope = 'pairings'` because browser-only results cannot power service-floor access.
- Store individual printed-menu heading styles and optional uploaded accent images inside each section's saved JSON, then render them through `MenuPreview`; this keeps section formatting in sync across preview, saved menus, and print.
- Store per-wine printed-menu symbols in each saved list's `visible_fields`, not in `wines`, because symbol and side are specific to that menu design.
- Store printed-menu page order and section assignments in `visible_fields.customDesign.sheets`; this keeps pagination migration-free and compatible with legacy lists.
- TrainingLibraryManager supports section and dialog presentations with shared editing content, so catalog administration can use a compact trigger without changing restaurant training.
- Keep official promotional files in the admin marketing-materials library and serve app-distributed downloads from `public/materials`; this centralizes reusable commercial assets without mixing them into operational screens.
- Product table headers must stick on individual header cells with opaque backgrounds and no overflow on intermediate table wrappers; this keeps columns pinned to the page scroll container without internal scrollbars.
- Admin restaurant tables use the page scroll container with opaque sticky header cells and no internal height limit or overflow wrapper; this hides redundant scrollbars and keeps column headings visible.
- Keep printed-menu usage guidance in a dedicated dialog component opened from the editor header; this isolates instructional navigation from saved menu state and printing.
- Technical-sheet extraction uploads originals to user-prefixed private storage keys and passes only validated keys through RPC; authenticated server-side downloads keep file bytes out of browser serialization and preserve source files.
- File pickers open from an explicit non-submit button via a ref to a separate hidden input, with extension-only `accept` values from `src/lib/file-accept.ts`, and AI document uploads go to storage with only the key sent by RPC; MIME filters and nested labels can hang the Windows/OneDrive "Abrir" dialog and large Base64 payloads break server-function transport.
- Dashboard stock history uses a shared paginated reader with the caller's existing authorized client and totals bottle quantities per closed session by reference date; this keeps authenticated and guest charts consistent without changing access policies.
- Supplier quick links live in a separate hashed-token table and public read-only route; validate expiry, revocation and sharing on every request, and filter all data by the link's restaurant and supplier to keep operational staff links unchanged.
- The operation manual's content lives in `src/lib/manual/*` and feeds both the in-app `/app/manual` page and the PDF in `public/materials` (regenerate with `bun scripts/build-manual-pdf.ts && python3 scripts/build-manual-pdf.py`); update both whenever a covered screen changes.
- Keep menu appearance presets and contrast calculations in the shared menu-appearance module; persist restaurant colors in the existing customDesign JSON without setting exclusive, so ordinary menus remain editable and legacy pagination survives.
- The staff Livro de Estudos is built client-side from `wines` data (no AI) by `src/lib/training-book.ts`; page order lives in `training_books.pages` and the published PDF in private storage under `training-books/{restaurant_id}/`, served to training links only via `/api/public/training-book` after token validation.
- Winery history/photos live in the global `wineries` table keyed by lowercased producer name (`name_key`), so every label of the same producer shares one record; the training book and supplier form read it from there.
- Winery maps store location (lat/lng, ISO-3 country, label side) plus a rendered `map_svg` on `wineries`; outlines come from `src/lib/winery-map/countries.json` (Natural Earth, rebuilt by `scripts/build-country-shapes.py`) and one pure geometry function feeds the editor, the saved SVG and the PDF so all three match.
- The Quick Service Guide (`src/lib/quick-guide.ts`) builds cards from `wines` without AI; publishing snapshots them in `training_books.quick_cards` plus PDF/photos under `training-books/{restaurant_id}/`, so the token-validated staff link never reads live wine data.
- Wine, catalog and winery photos must live in the private `product-media` bucket with long-lived signed URLs: `MediaUploader` imports pasted external/data URLs through `importImageFromUrl`, and the admin "Fotos no sistema" tool (`src/lib/image-import.functions.ts`) migrates or re-signs existing rows; external links break over time and are blocked by CORS in generated PDFs.
- Sparkling-wine sugar is stored as a dosage label (Nature, Extra Brut, Brut, Sec, Demi-Sec, Doce/Moscatel) resolved by `src/lib/sparkling-dosage.ts` (label name > style > g/L > saved value); the still-wine scale (Seco/Suave) misclassifies sparkling wines in AI extraction, forms and training materials.
