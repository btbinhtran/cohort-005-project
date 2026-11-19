# Giving the agent a browser

This is how you drive a page in the app, and ask it questions.

It uses [agent-browser](https://github.com/vercel-labs/agent-browser), a CLI
built for exactly this — one command per action, an answer on stdout.

## Once, per machine

The factory workflows install it before the agent starts; `which
agent-browser` tells you. Anywhere else:

```bash
npm install -g agent-browser
agent-browser install
```

## Starting the app

```bash
npm run dev:bg
```

It starts the dev server in the background on `http://localhost:5173`, logs to
`/tmp/dev.log`, and returns once the server answers. Run it again to restart
the server, e.g. when a hot reload leaves the page stale.

## Signing in

The seed is the same on every run, so these ids are stable:

| User                   | id  | Useful for                                                                                                                                                |
| ---------------------- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alex Rivera, admin     | 1   | `/admin/*`                                                                                                                                                |
| Sarah Chen, instructor | 2   | `/instructor/*`, owns `introduction-to-typescript`                                                                                                        |
| Emma Wilson, student   | 5   | enrolled in `introduction-to-typescript`: lesson 18 (notes, discussion), lesson 3 (a quiz). Lesson 40 of `design-systems-with-tailwind` is locked for her |

Switch user from the page, so the browser keeps the cookie:

```bash
agent-browser open http://localhost:5173/
agent-browser eval 'fetch("/api/switch-user",{method:"POST",body:new URLSearchParams({userId:"5"})}).then(r=>r.status)'
```

Seed rows you add while testing stay in `data.db`; delete them before you
finish.

## Asking your own question

A screenshot is pixels. To verify a fix you need a yes or a no, so read the
DOM:

```bash
agent-browser open http://localhost:5173/courses
agent-browser find placeholder "Search courses..." fill "typescript"
agent-browser find role button click --name "Search"

# Did the search reach the URL?
agent-browser get url

# How many course cards came back?
agent-browser get count 'a[href^="/courses/"]'

# What does the empty state say, if there is one?
agent-browser get text main

# Did anything break?
agent-browser errors
agent-browser console
```

The commands worth knowing: `open`, `click`, `fill`,
`find <role|text|label|placeholder> …`, `wait`, `get text|html|attr|count|url`,
`is visible|enabled|checked`, `eval`, `snapshot` (the accessibility tree, with
refs), `screenshot`, `console`, `errors`, `close`. `agent-browser --help` has
the rest.

**Ask the page, do not ask the person.** A change you have not looked at is a
change you are reporting on trust.

Screenshots are PR evidence: a before and an after for a change that shows in
the UI.

## Two things that will bite you

**Hydration lags "networkidle".** The button is in the server HTML before
React attaches its `onClick`, so the first click can be a silent no-op. Poll
for the click's effect and click again, rather than waiting a fixed time.

**Vite re-optimizes on the first load.** On a fresh checkout, the first page
load discovers dependencies Vite has not pre-bundled, and pushes a full-page
reload a moment after the response has finished. Absorb it once against a
throwaway load before the real loop; otherwise it lands mid-interaction and
every click after it hits a page that is already navigating away.
