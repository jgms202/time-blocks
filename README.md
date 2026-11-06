# Time Blocks

A simple calendar for blocking out your week by project. Each block unlocks that project's to-do list.

Built on the official [FullCalendar](https://fullcalendar.io) React example (MIT licence).

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5183.

## Using it

- Pick a project on the left, then click (one hour) or drag (longer) on the calendar. Blocks snap to the half hour.
- Drag a block to move it. Drag its bottom edge to resize it. Click it to see its to-do list.
- 1, 2 and 3 week views always start on the Monday of the current week. Click any day in Month to open its week.
- While a block runs, only that project's to-dos can be ticked off. Turn this off with Focus lock in Settings.

- Tick "Theme: name and tick each block" on a project for one-off blocks, such as "Long run" under Running. A new block opens so you can name it, and its box can be ticked on the calendar.
- The Alarm button plays a 10 second sound whenever a block starts or ends. Keep the tab open and the laptop awake. After loading the page, click once to arm it, as browsers block sound until then. A web page can't raise the Mac's own volume, so keep that up.

## Your data

Without accounts set up, everything is saved in this browser, at this exact address. Use Save backup in Settings to keep a copy.
Clearing browser data, or using a different browser, starts empty until you restore a backup.

With accounts set up, each person's data is saved to their account and follows them to any device.

## Accounts and sharing

Accounts use [Supabase](https://supabase.com). The app turns them on when these are set at build time:

| Setting | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | The project URL |
| `VITE_SUPABASE_KEY` | The project's publishable key (safe in a web page; never use the secret key) |
| `VITE_GOOGLE_SIGNIN` | `true` once Google is set up in Supabase |
| `BASE_PATH` | The path the site is served from, such as `/time-blocks/`, if not the domain's root |

The private data table is in `supabase/migrations/`. `supabase/privacy-test.mjs` checks against a local Supabase (`supabase start`) that nobody can read or change another person's data.

## Where to change things

| To change | Look in |
| --- | --- |
| Colours, spacing, fonts, dark mode | `src/styles.css` |
| The rules (one hour minimum, overlaps, focus lock), project colours | `src/lib/model.ts` |
| Calendar views and options | `src/components/CalendarView.tsx` |
| Sidebar, to-do list, block panel, sign-in page | `src/components/` |
| Alarm sound | `src/lib/alarm.ts` |
| Saving to accounts | `src/lib/sync.ts`, `src/lib/cloud.ts` |

Run the tests for the rules with `npm test`.
