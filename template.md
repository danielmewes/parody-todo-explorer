---
title: "Todo Explorer"
description: "A to-do list with seventy-seven working controls, ten toolbars, and everything one click away"
thumbnail: "template.svg"
version: v1
format: v2
---

# Todo Explorer

This file is the manifest for the **Todo Explorer** template (slug:
`todo-explorer`). It is the one document a future agent reads to understand,
present, and adapt this template. If you are an agent in a mind that was
created from this template, this file is your script: read all of it, then
follow "How to adapt it" below.

## What it is

A to-do list with seventy-seven working controls, ten toolbars, and everything one click away

It is a fully capable to-do list, and it is the only thing this template
ships. Open the tab and you get a late-nineties browser window: a menu bar,
ten stacked toolbars (seven of them add-on toolbars in the style of the era),
a side panel with a paperclip assistant, a status bar, a banner notice, a
side-column notice, and prompts that arrive on their own. Every one of those
controls does real work on the
list -- due dates, urgency markers, notes and categories, hyper-specific chore
templates, several separate lists, search across all of them, archiving, a
recoverable pile of deleted tasks, a one-task-at-a-time focus mode, import,
export and print. Every control is wired to real behaviour. The list
itself lives in the visitor's own browser storage, so it survives a reload
with no server state at all, and View > Stored data shows the exact JSON the
browser is keeping and offers it as a file. What the user sees when it is
running is a single tab called "To-Do List": a working task manager with
every one of its controls live.

## How it works

The snapshot includes these paths (each is a repo-root-relative path copied
from the original mind onto a clean default-workspace-template base):

- `system/apps/todo_list`
- `system/supervisord.conf`

`system/apps/todo_list` is the whole app, and it is small:

- `src/todo_list/runner.py` -- a synchronous Flask app served by the threaded
  Werkzeug server. It has four routes and no state: `/` returns the page,
  `/static/<file>` serves the stylesheet and the script, `/favicon.ico` hands
  back the app's own glyph, and `/health` returns `{"status": "ok"}`. It binds
  `127.0.0.1` on `PORT`, which defaults to 8080 and is overridable with
  `TODO_LIST_PORT`; `DATA_DIR` (`TODO_LIST_DATA_DIR`, default
  `data/.apps/todo-list/`) is declared by the app conventions but the app never
  writes to it, because there is nothing server-side to persist.
- `src/todo_list/assets/index.html` -- the window chrome: the icon sprite
  sheet, the title bar, the menu bar mount point, the ten toolbar strips, the
  side panel, the advert slots, the status bar, and the dialog, menu, pop-up
  and focus-mode layers.
- `src/todo_list/assets/app.css` -- the entire late-nineties look: the
  system palette, the bevelled borders, the gradient title bar, and the
  deliberately clashing colours of the add-on toolbars.
- `src/todo_list/assets/app.js` -- all the behaviour, in one file: the task
  model, the `localStorage` read/write under the key `my-tasks.v1`, the menu
  and dialog framework, undo/redo, and every individual control.
- `app.toml` -- the app manifest (`name = "todo-list"`,
  `display_name = "To-Do List"`, `program = "todo-list"`, `instances = false`),
  which is what `system/scripts/forward_port.py` reads to register the tab.
- `pyproject.toml`, `icon.svg`, `README.md` and `test_todo_list_ratchets.py`
  round it out. The only dependencies are Flask and Werkzeug.

`system/supervisord.conf` carries the `[program:todo-list]` entry that makes
the snapshot bootable. On start it runs `forward_port.py --manifest
system/apps/todo_list/app.toml --url http://localhost:8080`, which registers
the app with the workspace shell so it appears as a tab, and then execs the
`todo-list` console script (`todo_list.runner:main`) from the repo root under
the OOM-priority wrapper. There is nothing else to wire: no database, no
worker, no scheduled job, no second service.

## Recipe

This template is version `v1`. It is not a fork of the
workspace it came from -- it is DERIVED from it by a recipe: include these
paths, leave these out, apply these published-version rules. An update re-runs
the recipe against the current workspace and publishes the result as the next
version, so anything excluded stays excluded even though it still exists in the
source workspace.

The recipe is machine-read, so it lives in the sibling
[`template.toml`](template.toml) -- its `[recipe]` table -- along with
the structured requirements and the environment this template needs
installed. That file is authoritative for all of it; this one holds the prose.

## Requirements

Everything the adopting mind must deal with before this template is really
theirs. Two kinds of entry, handled at different times:

- **Activation** -- what must be SET UP before anything runs, in the
  machine-readable `requires_` forms below. The adopting agent acts on these
  ITSELF, first, before asking anything.
- **Adaptation** -- what must be DECIDED or REWIRED, in prose. Worked through
  interactively with the user, after activation.

### Activation: none

**There is nothing to activate.** This template needs no permissions, no
secrets, and no LLM access, so there are deliberately no `requires_permission:`,
`requires_secret:` or `requires_llm:` lines below -- their absence is the
accurate answer, not an oversight.

It is a self-contained Flask app that serves three static assets and keeps
every task in the visitor's own browser (`localStorage`, key `my-tasks.v1`).
It never calls an external service, holds no API keys, reaches no accounts,
and makes no model calls. Boot the mind and the tab works immediately, for
anyone, with nothing connected.

### Adaptation

These do need working through with the user, after boot:

- **The list is per-browser and is not synced across devices.** Everything
  lives in that one browser's `localStorage`, so opening the app on a phone
  or a second machine shows an empty list, and clearing site data loses it
  (File > Export and File > Import move it by hand). An adopter who wants
  their list on more than one device needs a server-side store: add
  read/write JSON routes to `runner.py` that persist under the app's
  `DATA_DIR`, and change `save()` / `load()` in `app.js` to call them instead
  of `localStorage`.
- **The task templates are somebody else's chores.** `TEMPLATE_PACKS` and
  `EXTRA_PACKS` near the top of `app.js` are hardcoded British-English
  household tasks ("Bleed the radiators", "Descale the kettle with white
  vinegar", "Send the meter reading before the estimate lands"), grouped as
  Around the house / Paperwork / Work / Seasonal / Digital. They are what
  Tools > Task templates inserts, so they should be rewritten for the
  adopter's own life, work, and dialect before the menu is useful to them.
- **The weather is fake.** The WeatherTask 2000 toolbar and its five-day plan
  come from `WEATHER_STATES` and `weatherFor()`, which pick an entry
  deterministically from a hash of the date. It is fabricated, and it will
  happily tell someone it is dry while it rains. Decide whether to keep it as
  decoration, label it as fictional, or wire it to a real weather API keyed on
  the user's location.
- **The styling is strongly opinionated and may not be wanted.** The entire
  late-nineties look -- bevels, system palette, gradient title bar, clashing
  add-on toolbars, banner notices, uninvited prompts -- lives in `app.css`
  plus the toolbar markup in `index.html`. An adopter who wants the
  functionality without the styling has to decide how far to strip it; the
  toolbars can be hidden at runtime (View > Toolbars > Hide every extension
  toolbar) but the styling itself is a code change.
- **The British English is throughout the interface, not just the templates.**
  "Favourites", "Organise Favourites", "Synchronise this list", "a fortnight",
  "Tidy up" and similar wording appear in the menus, dialogs and status
  messages in `app.js`. An adopter publishing to a different audience will
  want to go through those strings.

## Environment

What this template needs INSTALLED, beyond what the template already has.
Declared in `template.toml`'s `[environment]` table; an adopting mind
converges it at ITS OWN pinned apt snapshot timestamp, so package versions come
out consistent with the rest of that mind's environment rather than frozen to
whatever this publisher happened to have.

Nothing extra -- runs on the stock workspace environment.

The app declares Flask and Werkzeug in its own `pyproject.toml`, which the
workspace's normal package install already handles. It shells out to no
binaries and invokes no global npm, uv or cargo tools, so `[environment]` in
`template.toml` is empty on purpose.

## How to adapt it

Instructions for the NEXT agent -- the one adapting this template into a
new mind. This is the `use-template` skill's template path; in short:

1. Read this entire file first, especially "Requirements" below. It holds two
   kinds of entry and they are handled at different times: the machine-readable
   `requires_` lines are ACTIVATION (set them up before anything runs), and
   the prose bullets are ADAPTATION (decide or rewire them afterwards).
2. Present the template to the user in plain, non-technical language: what
   it is, what it does, and what it needs from them (name the activation
   requirements).
3. Ask whether they want to use the same connectors (e.g. their own Slack).
   If YES: ACTIVATE FIRST -- initiate every `requires_permission` line NOW
   via a latchkey permission request (see the `latchkey` skill; the request
   opens the approval/login flow in the minds app), wire up any
   `requires_secret` values, start the services, and get the app showing
   THE USER'S OWN DATA. Done for a data-backed app means the user can open it
   and see their own data -- NOT that a service starts or an endpoint returns
   200. Then tell them it is live and to take a look.
4. Only AFTER that (or immediately, if they chose different connectors -- the
   swap is then the first adaptation) ask: "How do you want to adapt it?"
5. Work through each requirement interactively, one at a time. Translate each
   into plain language, ask for a decision only when you genuinely need one,
   and resolve the obvious ones yourself.
6. When done, append a dated entry to "Adaptation history" below (never
   rewrite earlier entries) and commit.

## Publication history

This template's changelog: what each published version changed. The PUBLISHER
appends one entry per version (newest last); earlier entries are never rewritten.
This is distinct from "Adaptation history" below, which is the ADOPTERS' log.

### v1 (2026-09-14) -- the first publication: the To-Do List app and its supervisord entry, with the late-nineties styling intact and every browser-trademark name replaced by generic period wording.

## Adaptation history

Each mind that adapts this template appends one dated entry below. Earlier
entries are never rewritten.
