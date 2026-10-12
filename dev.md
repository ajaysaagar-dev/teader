The monochrome pass is incomplete and the UI looks flat/dull. Fix, without removing any feature.

1) FINISH MONO. Open the app with Playwright (/dashboard, /projects, /projects/<id> for Overview/Tasks/Docs/Settings, Docs editor, Settings modal, Cmd+K) and dump every element whose computed color/background/border/fill/stroke has R!=G or G!=B. Fix ALL of them at the source. Known leftovers: blue "New Issue" button, blue search box, green Cmd+K chip, green "+" button, green project-key pill, green version badge, purple LIVE SYNC dots, green active "Docs" tab + "Docs" toggle top-right, blue selected project row and blue "PR" badge. Extend tests/mono-guard.test.ts to also catch arbitrary values (bg-[#...], text-[rgb(...)], hsl()), inline style={{}} colors, and gradients. Keep the Playwright computed-style check as a script (npm run check:mono).

2) DEPTH WITHOUT COLOR. Three surface levels: canvas #0A0A0A, sidebar #0F0F0F, raised panel/card #141414 with 1px border rgba(255,255,255,.08), hover rgba(255,255,255,.05), selected rgba(255,255,255,.10). Main content area is a rounded-lg raised panel inset from the sidebar. Subtle shadow only on popovers/modals.

3) CLEAR HIERARCHY. Titles #FFFFFF weight 600; body #EDEDED; secondary #A3A3A3; meta #737373. Page title 20-24px, section headings 14px/600 sentence case, body 13-14px.

4) KILL THE HARSH LOOK. UI font = Inter. Geist Mono ONLY for task keys, code, file names, Ln/Col. Remove uppercase+mono on headings/labels ("Documentation tree", "Projects", "Live sync", "Build"). Remove emoji/decorative pills.

5) STRONG ACTIVE STATES (monochrome): primary button = white bg + black text; active tab = white text with 2px white underline; selected sidebar row and selected doc/task row = bg white/10 + 2px white left bar + white text; focus ring 1px white.

6) DECLUTTER DOCS: flat folder tree (no boxed card per folder, no always-visible drag handles - show on hover, count as plain muted text), 32-36px rows, 12px indent guides. Open-doc tabs: remove the folder chips (Gameplay, Trailer...) from tabs, show them as tooltip. Header meta (Folder / File path / Ln Col / chars / Synced / Live sync) collapse into one muted line; Save stays visible.

7) STATUS BADGES: LIVE SYNC = small white dot + "Live" text, no pill background. Project key = muted mono text with copy icon, no colored pill. Version badge next to "Teader" = muted text.

8) Preview pane: remove the extra bordered card behind the reading column; max-w-3xl, 16px/1.7 body, comfortable heading spacing.

Follow INSTRUCTIONS.md: granular commits, one push, update BUILD_NUMBER, run lint/test/build. Finish by printing the Playwright mono report (must be zero violations) and before/after screenshots in docs/screenshots-mono/.