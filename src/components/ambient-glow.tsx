/** Soft mascot-colored light behind the page, so frosted glass has something to blur. */
export function AmbientGlow() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-[22vh] -right-[12vw] size-[62vw] rounded-full bg-[radial-gradient(closest-side,rgb(139_92_246/0.26),transparent)]" />
      <div className="absolute top-[28vh] -left-[18vw] size-[52vw] rounded-full bg-[radial-gradient(closest-side,rgb(20_184_166/0.2),transparent)]" />
      <div className="absolute right-[6vw] -bottom-[30vh] size-[56vw] rounded-full bg-[radial-gradient(closest-side,rgb(249_115_22/0.18),transparent)]" />
    </div>
  );
}
