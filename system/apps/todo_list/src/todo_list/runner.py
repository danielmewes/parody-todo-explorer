"""A simple to-do list.

Services run from /home/user/workspace (the repo root). Conventions:

- Persistent state (anything written and read across runs -- cursors,
  caches, snapshots, user records): read and write it under ``DATA_DIR``
  (defined below), never a hardcoded ``data/.apps/todo-list/`` at the
  call site. ``DATA_DIR`` defaults to ``data/.apps/todo-list/`` but
  honors the ``TODO_LIST_DATA_DIR`` env var, so an editing agent can point a
  throwaway instance at a *copy* of the data instead of the live store
  (see the update-app skill). Do NOT use ``Path(__file__)``-based
  paths for state -- the bug to avoid is one process writing to
  ``/home/user/workspace/data/.apps/...`` while another reads from
  ``/home/user/workspace/system/apps/<pkg>/data/...``.
- Static assets shipped alongside this file (templates, default
  configs, bundled JSON): ``Path(__file__).parent / "assets/..."`` is
  fine and is the right pattern.
- Listen port: bind ``PORT`` (defined below), which defaults to this
  app's assigned port but honors the ``TODO_LIST_PORT`` env var, so
  an editing agent can boot a throwaway instance on a *spare* port
  alongside the live one (see the update-app skill). Never hardcode
  the port at the ``run_simple`` call.

This is a synchronous Flask app served by the threaded Werkzeug server.
The app owns its own browser origin (the forwarder routes
``http://todo-list.<workspace-host>/`` straight to this port), so it serves
at ``/`` and root-absolute URLs, cookies, and service workers all work
unmodified -- nothing rewrites anything. Use ``flask_sock`` if you need
WebSockets.
"""

import os
from pathlib import Path

from flask import Flask, Response, send_from_directory
from werkzeug.serving import run_simple

# Persistent state for this app lives under DATA_DIR. It defaults to
# ``data/.apps/todo-list/`` but is overridable via the ``TODO_LIST_DATA_DIR`` env var
# so a throwaway instance can run against a *copy* of the data while editing --
# see the update-app skill. Always read/write state through DATA_DIR;
# never hardcode ``data/.apps/todo-list/`` at a call site, or the override is
# bypassed. A writing call site should ``DATA_DIR.mkdir(parents=True,
# exist_ok=True)`` before writing.
DATA_DIR = Path(os.environ.get("TODO_LIST_DATA_DIR", "data/.apps/todo-list"))

# Listen port. Defaults to this app's assigned port but is overridable via
# the ``TODO_LIST_PORT`` env var so an editing agent can boot a throwaway
# instance on a spare port next to the live one (see the update-app skill).
# Never hardcode the port at the ``run_simple`` call, or the override is bypassed.
PORT = int(os.environ.get("TODO_LIST_PORT", "8080"))

ASSETS_DIR = Path(__file__).parent / "assets"

app = Flask("todo_list", static_folder=None)


@app.route("/")
def index() -> Response:
    # The page carries the location beacon that posts the viewed path one hop up
    # to the workspace shell, so the shell can reopen this app's tab in place.
    return Response(
        (ASSETS_DIR / "index.html").read_text(encoding="utf-8"),
        mimetype="text/html",
    )


@app.route("/favicon.ico")
def favicon() -> Response:
    # Browsers ask for this unprompted; hand them the app's own glyph.
    return send_from_directory(
        Path(__file__).parent.parent.parent, "icon.svg", mimetype="image/svg+xml"
    )


@app.route("/static/<path:filename>")
def static_asset(filename: str) -> Response:
    # The stylesheet and the script that make up the page. The list itself is
    # never served from here -- it lives in the visitor's own browser storage.
    return send_from_directory(ASSETS_DIR, filename)


@app.route("/health")
def health() -> Response:
    return Response('{"status": "ok"}', mimetype="application/json")


def main() -> None:
    run_simple(
        "127.0.0.1", PORT, app, threaded=True, use_reloader=False, use_debugger=False
    )


if __name__ == "__main__":
    main()
