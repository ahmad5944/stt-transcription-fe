# Tailwind Template Migration Plan

## Goal
Migrate the frontend in `D:\My Document\Kerjaan\Nawatech\Project Code\Frontend\binus-meeting-transcription-fe` so its visual structure matches the BICON template at `D:\My Document\Kerjaan\Nawatech\Project Code\BICON\binus-conscience-frontend` as closely as possible, while preserving all existing app logic.

The target should move from the current plain-CSS approach to a Tailwind-based implementation, with the same overall feel as the template: clean shell, responsive layout, strong card borders, structured spacing, and a polished enterprise UI.

## Important Reference Note
The BICON template itself explicitly says not to use Tailwind in that repo. That does **not** apply to this project. Here, the template is a visual reference only, and the target repo should be converted to Tailwind as requested.

## What the Template Looks Like
The BICON template is built around:
- A provider-heavy app shell
- Routed public/private layouts
- MUI-driven layout containers
- A consistent header/footer/side-menu structure
- Strong border-based cards and subtle shadows
- Responsive spacing and full-height shells
- A dark/light friendly theme system

The most important visual cues to copy are:
- Full-height page framing
- Centered content width behavior
- Crisp cards with subtle borders and rounded corners
- Strong header/footer spacing
- Clean form controls
- Drawer/sidebar behavior on smaller screens

## Migration Strategy

### Phase 1: Add Tailwind Foundation
1. Add Tailwind v4 to the target repo.
2. Replace the current global CSS approach with Tailwind entry styles.
3. Move global colors, spacing, and typography into Tailwind-friendly tokens.
4. Keep all current logic intact while the visual foundation changes.

### Phase 2: Rebuild the App Shell
1. Restructure the app shell in `src/App.tsx` and `src/main.tsx` so the layout can resemble the template more closely.
2. Introduce a reusable shell pattern for header, content area, and footer-like framing.
3. Keep the current auth and feature routing logic, but restyle the wrapper structure.

### Phase 3: Convert the Main Surfaces
1. Restyle `src/pages/DeviceSelection.tsx` and `src/pages/Dashboard.css` first, because that is the largest and most visible surface.
2. Restyle `src/pages/Login.tsx` and `src/pages/Login.css` so the auth page matches the template’s cleaner form/card treatment.
3. Restyle `src/pages/RecordingsList.tsx` with Tailwind utilities for the header, states, and action buttons.
4. Keep `src/components/PiPControlPanel.tsx` visually aligned with the main dashboard.

### Phase 4: Remove Legacy CSS
1. Reduce or remove `src/App.css`.
2. Replace remaining page CSS rules with Tailwind utilities or small reusable component classes.
3. Make sure the app no longer depends on the old custom CSS theme for layout behavior.

### Phase 5: Parity Pass
1. Compare the target app against the BICON template screen by screen.
2. Fine-tune spacing, borders, shadows, and widths until the target visually feels the same.
3. Validate mobile and desktop behavior.

## Files to Prioritize
1. `src/pages/Dashboard.css`
2. `src/pages/DeviceSelection.tsx`
3. `src/pages/Login.tsx`
4. `src/pages/Login.css`
5. `src/pages/RecordingsList.tsx`
6. `src/components/PiPControlPanel.tsx`
7. `src/index.css`
8. `src/App.css`
9. `src/App.tsx`
10. `src/main.tsx`

## What Must Stay Unchanged
These are logic files and should not be refactored for styling migration:
- `src/hooks/useAudioCapture.ts`
- `src/hooks/usePictureInPicture.ts`
- `src/services/websocketClient.ts`
- `src/services/mediaClient.ts`
- `src/services/authClient.ts`

Critical invariants to preserve:
- Existing CSS class names that drive component behavior
- `COMPACT_THRESHOLD = 400px`
- `MIN_DB = -80`
- PiP two-effect lifecycle pattern
- WebSocket `readyState === OPEN` guard
- `isStoppingRef` disconnect handling
- Audio track `ended` + `MediaRecorder.onerror` behavior

## Template Visual Cues to Match
The BICON template emphasizes:
- White/very light header surfaces
- Dark charcoal footer surfaces
- 24px to 48px horizontal padding on major shells
- 64px vertical section spacing in broader page areas
- Cards with subtle borders and low-shadow depth
- Responsive drawer/sidebar widths
- Clear typography hierarchy with medium-weight headings
- Dense but clean form spacing

## Verification
1. Run `npm run build` and `npm run lint` after the Tailwind foundation is installed.
2. Compare the target app against the BICON template visually after the shell migration.
3. Verify login, dashboard, transcript, recordings, PiP, and delete flows still work.
4. Check desktop and mobile layouts for consistency.

## Open Decision
The migration can be done in two ways:
- **Tailwind-first imitation**: use Tailwind utilities to recreate the template feel, while keeping existing app logic.
- **Hybrid template shell**: add a stronger shared layout wrapper structure first, then convert page surfaces.

Given the current repo shape, the Tailwind-first imitation with a shell wrapper is the safest path.
Microsoft.QuickAction.Bluetooth