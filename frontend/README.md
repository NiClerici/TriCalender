# TriCalendar Frontend

React/Vite UI for inspecting and managing the training plan stored in `trainingskalender/trainings.json`.  
The development server also exposes a couple of helper endpoints so that the Strava sync scripts and the Git auto-commit helper can be triggered from the UI.

## Prerequisites

- Node.js 18+ (for the Vite dev server and build)
- npm
- Python 3.11+ with the dependencies from `requirements.txt` installed (e.g. inside a virtualenv)
- Git (for the optional auto commit action)
- A `.env` file in the project root containing the Strava OAuth credentials used by `trainingskalender/getStrava.py`:

  ```ini
  CLIENT_ID=xxxx
  CLIENT_SECRET=xxxx
  REFRESH_TOKEN=xxxx
  ```

## Install & Run

```bash
# install frontend dependencies
npm --prefix frontend install

# optional: install python deps
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# start the dev server
npm --prefix frontend run dev
```

The app reads `trainingskalender/trainings.json` directly. Any edits performed in the UI are written back to that file through the dev server middleware.

## Toolbar Actions

The action buttons in the header call local helper scripts through the Vite dev server:

| Button        | Endpoint                | Script / Action                                     | Result |
|---------------|------------------------|------------------------------------------------------|--------|
| Get Strava    | `POST /api/actions/get-strava`  | `python trainingskalender/getStrava.py`             | Updates `trainingskalender/exportStravaTraining.json` |
| Sync          | `POST /api/actions/sync-strava` | `python trainingskalender/syncStrava.py`            | Merges Strava data into `trainingskalender/trainings.json` |
| Export        | `POST /api/actions/export`      | `python trainingskalender/export.py`                | Writes/refreshes `tritrainings.ics` |
| Commit        | `POST /api/actions/commit`      | `bash auto_commit.sh`                               | Runs git add/commit/push |

The UI shows a toast once an action finishes. Error messages from the scripts are surfaced if a command exits with a non-zero status.

> **Note**  
> These middleware routes are only available while the Vite dev server is running. They are not bundled into the production build.

## Building for Production

```bash
npm --prefix frontend run build
```

The build artefacts go to `frontend/dist`. The pipeline also copies the current `trainingskalender/trainings.json` into `dist/trainingskalender/trainings.json` so that static deployments can serve the latest plan data.
