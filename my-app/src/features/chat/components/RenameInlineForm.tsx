import { useEffect, useState } from "react";

type RenameInlineFormProps = {
  initialTitle: string;
  onSave: (title: string) => void;
  onCancel: () => void;
};

export default function RenameInlineForm({
  initialTitle,
  onSave,
  onCancel,
}: RenameInlineFormProps) {
  const [value, setValue] = useState(initialTitle);

  useEffect(() => {
    setValue(initialTitle);
  }, [initialTitle]);

  function handleSave() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSave(trimmed);
  }

  return (
    <div className="space-y-2">
      <input
        autoFocus
        className="w-full rounded-lg border px-2 py-1 text-sm"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSave();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      <div className="flex gap-2">
        <button
          className="text-xs rounded-lg border px-2 py-1"
          onClick={handleSave}
        >
          Save
        </button>
        <button
          className="text-xs rounded-lg border px-2 py-1"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
