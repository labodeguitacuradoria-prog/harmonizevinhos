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
- Store individual printed-menu heading styles inside each section's saved JSON and render them through `MenuPreview`; this keeps independent section/subsection formatting in sync across preview, saved menus, and print without changing shared templates.
