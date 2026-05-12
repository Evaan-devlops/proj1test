# Chat App Frontend

Vite + React + TypeScript frontend for the AWS chat app.

## What this frontend expects

- Node.js 20+
- npm 10+
- the full `my-app` folder copied as-is
- access to the backend at `http://127.0.0.1:8000`

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

## Backend Mode

Use this in `.env.local`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Then start the frontend.

If you need to run a local backend instead:

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
- the dashboard opens from the backend's stored Analytics Hub snapshot first, then refreshes AWS data in the background
- each dashboard table refresh button asks the backend to refresh only that table, so Financial Impact, Accounts, Certificates, and Utilization can update independently

For deployed environments, set `VITE_API_BASE_URL` to the backend URL:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
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

1. Confirm `.env.local` contains `VITE_API_BASE_URL=http://127.0.0.1:8000`.
2. Confirm backend responds at `http://127.0.0.1:8000/health`.
3. Confirm backend `.env` has `AWS_ACCOUNT_KEYS` and matching AWS credential variables.
4. If using AWS Secrets Manager, confirm each `AWS_ACCOUNT__<KEY>__SECRET_ID` secret contains JSON credentials and the backend role can call `secretsmanager:GetSecretValue`.

## Notes

- `.env.local` overrides `.env`, so use `.env.local` for machine-specific settings.
- The frontend requires the backend for account loading, chat history, streaming responses, and Analytics Hub data.
