export function drawChart(canvas, series, capacity = 60, max = 100) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  const w = rect.width,
    h = rect.height;
  const css = getComputedStyle(document.documentElement);
  ctx.strokeStyle = css.getPropertyValue("--line").trim();
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = 8 + ((h - 20) * i) / 4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  if (!series.some((s) => s.values.some((v) => v != null))) {
    ctx.fillStyle = css.getPropertyValue("--muted").trim();
    ctx.font = "12px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText("測定データを待っています", w / 2, h / 2);
    return;
  }
  for (const [index, s] of series.entries()) {
    ctx.strokeStyle = css
      .getPropertyValue(index === 0 ? "--accent" : "--green")
      .trim();
    ctx.lineWidth = 2;
    ctx.beginPath();
    let open = false;
    s.values.forEach((value, i) => {
      if (value == null) {
        open = false;
        return;
      }
      const x = ((capacity - s.values.length + i) / (capacity - 1)) * w,
        y = h - 12 - Math.min(1, Math.max(0, value / max)) * (h - 24);
      if (open) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
      open = true;
    });
    ctx.stroke();
  }
}
