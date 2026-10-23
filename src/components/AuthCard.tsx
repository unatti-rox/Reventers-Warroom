export function AuthCard({ title, text, children }: { title: string; text?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--surface-tint)" }}>
      <div className="w-full max-w-[380px] rounded-2xl border p-7" style={{ borderColor: "var(--border)", background: "#fff" }}>
        <div className="text-[13px] font-extrabold leading-tight mb-6" style={{ color: "var(--brand-ink)" }}>
          Insomniacs Kitchen
        </div>
        <h1 className="text-[20px] font-extrabold mb-1.5">{title}</h1>
        {text ? (
          <p className="text-[12px] mb-5" style={{ color: "var(--text-muted)" }}>
            {text}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
