export default function Footer() {
  return (
    <footer className="relative border-t border-[color:var(--hairline-soft)] bg-[color:var(--surface)] py-8 text-center text-[color:var(--ink-muted)]">
      <div className="app-shell w-full">
        <p className="text-sm">
          © {new Date().getFullYear()} Resume Optimizer — by Abdullah bin Ahmed
        </p>
      </div>
    </footer>
  );
}



