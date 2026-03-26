import { useState } from "react";
import { usePwaInstall } from "../hooks/usePwaInstall";

export default function InstallAppButton() {
  const { canInstall, install } = usePwaInstall();
  const [showHelp, setShowHelp] = useState(false);

  async function handleClick() {
    if (canInstall) {
      await install();
      return;
    }
    setShowHelp(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title="Install this app"
        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
      >
        Install App
      </button>

      {showHelp && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
          <button
            type="button"
            aria-label="Close install instructions"
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowHelp(false)}
          />

          <div className="relative z-[1] w-[520px] max-w-[90vw] rounded-2xl border border-white/10 bg-[#111827] p-6 text-white shadow-2xl">
            <h2 className="text-lg font-semibold">Install as an app</h2>
            <p className="mt-3 text-white/80">
              If the automatic install prompt is unavailable, you can still install manually in Microsoft Edge:
            </p>
            <ol className="mt-4 list-decimal space-y-1 pl-5 text-white/80">
              <li>Open the Edge menu (⋯)</li>
              <li>Select <strong>Apps</strong></li>
              <li>Click <strong>Install this site as an app</strong></li>
            </ol>
            <p className="mt-4 text-sm text-white/60">
              Tip: the automatic prompt appears more reliably after running <code>npm run build</code> followed by{" "}
              <code>npm run preview</code> (or on a deployed HTTPS site).
            </p>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 hover:bg-white/10"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
