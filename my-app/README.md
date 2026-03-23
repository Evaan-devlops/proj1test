# Chat App Frontend

This is a Vite + React + TypeScript frontend.

## Fastest way to run it in another VS Code folder

1. Copy the entire `my-app` folder to the new location.
2. Open that copied `my-app` folder itself in VS Code.
3. Open a terminal in VS Code.
4. Run:

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

5. Open the local URL shown in the terminal, usually `http://localhost:5173`.

## If VS Code shows many red TypeScript errors after copy/paste

Usually that means VS Code is opened at the wrong folder level or `npm install` was not run inside `my-app`.

Check these exactly:

1. In VS Code, the opened folder should be the frontend root containing `package.json`, `src`, and `tsconfig.json`.
2. Run `npm install` inside that same folder.
3. Run `npm run dev` inside that same folder.
4. Press `Cmd+Shift+P` in VS Code and run `TypeScript: Restart TS Server`.
5. If errors still remain, close VS Code and reopen the copied `my-app` folder directly.

## Easiest mode

For quick demo/testing, keep this in `.env.local`:

```env
VITE_USE_FAKE_BACKEND=true
```

That lets the app run without the Python backend.

## If you want the real backend later

Use:

```env
VITE_USE_FAKE_BACKEND=false
VITE_API_BASE_URL=http://localhost:8000
```

Then make sure the backend server is running on port `8000`.

## Files you should copy

Copy the full `my-app` folder, including:

- `src/`
- `public/`
- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `tsconfig*.json`
- `tailwind.config.ts`
- `.env.example`

## Notes

- `npm run dev` is the best command for local execution.
- `npm run build` is currently blocked by existing TypeScript issues unrelated to the recent UI changes.
- `.env.local` overrides `.env`, so it is the safest place for local settings.
