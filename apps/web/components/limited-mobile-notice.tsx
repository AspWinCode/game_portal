"use client";

import { useEffect, useState } from "react";

export function LimitedMobileNotice() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 920px)");
    const sync = () => setCompact(media.matches);

    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  if (!compact) {
    return null;
  }

  return (
    <div className="card" style={{ borderColor: "rgba(245, 158, 11, 0.35)" }}>
      <div className="eyebrow">Mobile / Tablet Mode</div>
      <p className="subtle" style={{ marginBottom: 0 }}>
        На телефоне и небольшом планшете интерфейс упрощён: меньше колонок, короче карта миссии и компактнее
        controls. Для полного прохождения и показа результата тренеру лучше использовать компьютер.
      </p>
    </div>
  );
}
