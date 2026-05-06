"use client";

import type { MediaAsset } from "@game-game/shared";

export function AdminMediaPickerField({
  label,
  value,
  placeholder,
  onChange,
  recentAssets,
  allowedTypes,
  disabled = false
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (nextValue: string) => void;
  recentAssets: MediaAsset[];
  allowedTypes: Array<MediaAsset["type"]>;
  disabled?: boolean;
}) {
  const matchingAssets = recentAssets.filter((asset) => allowedTypes.includes(asset.type)).slice(0, 4);

  return (
    <div className="stack">
      <label className="stack">
        <span>{label}</span>
        <input className="input" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} disabled={disabled} />
      </label>

      {matchingAssets.length > 0 ? (
        <div className="stack" style={{ gap: 10 }}>
          <div className="eyebrow">Recent {allowedTypes.join("/")}</div>
          {matchingAssets.map((asset) => (
            <div key={asset.id} className="card" style={{ padding: 12 }}>
              <div className="button-row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <div className="stack" style={{ gap: 6 }}>
                  <strong>{asset.filename}</strong>
                  <div className="button-row">
                    <span className="pill">{asset.type}</span>
                    <span className="pill">{asset.mimeType}</span>
                  </div>
                  <p className="subtle" style={{ margin: 0 }}>{asset.url}</p>
                </div>
                <button className="button-secondary" type="button" onClick={() => onChange(asset.url)} disabled={disabled}>
                  Use
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
