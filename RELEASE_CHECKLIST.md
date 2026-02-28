# Pre-Release Manual Checklist

Use this before shipping a new extension version.

## 1) Build & Load
- [ ] Run `npm run build` with no errors.
- [ ] Load unpacked extension from `dist/` in Chrome.
- [ ] Open popup and new tab page once (no console errors).
- [ ] Verify manifest version matches intended release version.

## 2) Core Timer Flows
- [ ] Pomodoro mode: Start → Pause → Resume → Stop works.
- [ ] Pomodoro mode: Next transitions Focus → Short/Long Break correctly.
- [ ] Pomodoro mode: Finish saves valid session to history.
- [ ] Stopwatch mode: Start/Run/Stop works.
- [ ] Stopwatch mode: `Next` works as finish/advance behavior.
- [ ] Stopwatch mode: Finish button is not shown.
- [ ] Stopwatch sessions under 1 minute are not saved (shows invalid-session toast).

## 3) Session Save & Toasts
- [ ] Invalid short session shows warning toast.
- [ ] Valid focus session shows success toast.
- [ ] Partial finish (valid) shows partial-success toast.
- [ ] Toasts are not duplicated across popup/new tab when both are open.

## 4) Music Player (New Tab)
- [ ] Initial music load shows loading state.
- [ ] Play/Pause/Prev/Next controls work.
- [ ] Track dropdown selection works.
- [ ] Loop toggle updates behavior and label.
- [ ] Progress slider seeks correctly.
- [ ] Volume slider updates volume.
- [ ] Track status badge shows idle/playing state styles.

## 5) Site Blocking
- [ ] With focus running and block-sites enabled, blocked domains redirect correctly.
- [ ] Add URL to blocked list and verify it blocks immediately.
- [ ] Remove URL from blocked list and verify it stops blocking immediately.
- [ ] `x.com` and `twitter.com` behavior is validated.
- [ ] Turning off "Block Sites" removes active blocking rules.

## 6) Data & Pages
- [ ] Task rename propagates to timer/history views.
- [ ] History page opens and renders without errors.
- [ ] Settings save/reload works.
- [ ] Daily journal add/check/delete works.
- [ ] Streak page opens without errors.

## 7) Regression Sweep
- [ ] Popup: controls, tooltips, and mode labels render correctly.
- [ ] New tab: timer UI, music UI, and quote area layout look correct.
- [ ] No new errors in service worker console during 2+ timer cycles.
- [ ] Browser restart retains expected settings/state.

## 8) Release Hygiene
- [ ] Update changelog/release notes.
- [ ] Confirm final icon assets and store metadata.
- [ ] Tag release commit/version.
- [ ] Final smoke pass on clean profile.
