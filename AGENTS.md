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
- Open the technical-sheet picker synchronously from an explicit non-submit Button through a ref to a separate file input; this avoids nested label activation without changing upload or extraction.
