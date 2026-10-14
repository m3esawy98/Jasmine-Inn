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

## Architecture
- All demo data and business rules live in `src/lib/demo/store.ts` (actions + selectors) with seed in `seed.ts`; screens only call `actions.*` and read via `useDemo()` — keeps every screen on one shared, swappable data layer (localStorage now, shared DB later).
- UI strings use `useT()(ar, en)` inline; Arabic/RTL is default — avoids a separate dictionary drifting out of sync.
