# todo-list

A to-do list that lives entirely in the browser, wearing a late-nineties web
browser and every toolbar that era could install on it.

- **The list.** Add a task, tick it off, delete it. Everything is stored in the
  visitor's own browser (`localStorage`, key `my-tasks.v1`), so the list
  survives a reload with no server state at all. The Flask app only serves the
  page, the stylesheet and the script.
- **Every control is live.** Every button on every toolbar, menu and pop-up
  does something to the list -- dates, urgency markers, notes, templates,
  multiple lists, search across lists, archive, deleted-task recovery, focus
  mode, import and export. Every control is wired to real behaviour.
- **Raw data is always reachable.** View > Stored data (and the button under
  the list) shows exactly what is kept, and offers it as a file.

## Layout

    src/todo_list/runner.py            Flask: the page, the assets, /health
    src/todo_list/assets/index.html    the window chrome and toolbars
    src/todo_list/assets/app.css       the late-nineties system palette and bevels
    src/todo_list/assets/app.js        the list, and every control's behaviour

Runs as the `todo-list` supervisord program on port 8080.
