# Chat App Frontend

Vite + React + TypeScript frontend for the AWS chat app.

## What this frontend expects

- Node.js 20+
- npm 10+
- the full `my-app` folder copied as-is
- for real backend mode, the FastAPI backend running on `http://localhost:8000`

The frontend supports 2 modes:

- fake backend mode: runs without Python backend and shows demo accounts
- real backend mode: loads chats, account list, and streaming responses from the backend

## Quick Start In Another VS Code Folder

1. Copy the entire `my-app` folder to the new location.
2. Open the copied `my-app` folder itself in VS Code.
3. Open a terminal in that folder.
4. Install dependencies:

```powershell
npm install
```

5. Create local frontend config:

```powershell
Copy-Item .env.example .env.local
```

6. Start the app:

```powershell
npm run dev
```

7. Open the local URL shown by Vite, usually `http://localhost:5173`.

## Frontend-Only Demo Mode

Use this in `.env.local`:

```env
VITE_USE_FAKE_BACKEND=true
```

In this mode:

- the app runs without the Python backend
- the account sidebar shows demo accounts `dev` and `prod`
- chat responses are fake streamed text

This is the fastest way to confirm the frontend boots correctly after copy/paste.

## Real Backend Mode

Use this in `.env.local`:

```env
VITE_USE_FAKE_BACKEND=false
VITE_API_BASE_URL=http://localhost:8000
```

Then start the backend and the frontend separately.

Backend:

```powershell
cd ..\backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend:

```powershell
cd ..\my-app
npm install
npm run dev
```

In real backend mode:

- the frontend health check uses `GET /api/health`
- the account sidebar loads from `GET /api/v1/aws/accounts`
- the selected accounts are sent with each chat request
- only backend-configured accounts with valid credentials appear in the UI

For deployed environments, replace `http://localhost:8000` with your real backend URL, for example:

```env
VITE_USE_FAKE_BACKEND=false
VITE_API_BASE_URL=https://api.your-domain.example.com
```

If your backend `.env` contains:

```env
AWS_ACCOUNT_KEYS=dev,prod
```

then the frontend account sidebar will show `dev` and `prod` only if those backend account blocks are fully configured.

## Useful Commands

```powershell
npm run dev
npm run build
npm run lint
```

`npm run build` now verifies TypeScript and produces the Vite production build.

## Files To Copy

Copy the full `my-app` folder, especially:

- `src/`
- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `tsconfig.json`
- `tsconfig.app.json`
- `tsconfig.node.json`
- `tailwind.config.ts`
- `.env.example`

`public/` is optional. If that folder is missing, the app will still run. You only lose optional icons and PWA image assets.

You also do not need to copy any generated `dist/` or `dist/assets/` output. Those files are recreated automatically by `npm run build`.

## Troubleshooting

If VS Code shows many TypeScript errors after copying:

1. Make sure VS Code is opened at the `my-app` folder level, not above it.
2. Run `npm install` inside `my-app`.
3. Run `npm run dev` once.
4. Run `TypeScript: Restart TS Server` from the VS Code command palette.
5. Reopen the `my-app` folder if needed.

If the frontend opens but no real data appears:

1. Confirm backend is running on `http://localhost:8000`.
2. Confirm `.env.local` contains `VITE_USE_FAKE_BACKEND=false`.
3. Confirm backend responds at `http://localhost:8000/api/health`.
4. Confirm backend `.env` has `AWS_ACCOUNT_KEYS` and matching AWS credential variables.

## Notes

- `.env.local` overrides `.env`, so use `.env.local` for machine-specific settings.
- Fake backend mode is best for quick UI validation.
- Real backend mode is required for live account loading and live AWS-backed chat responses.
