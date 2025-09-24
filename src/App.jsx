import Header from "./components/Layout/Header";
import MainContent from "./components/MainContent";

export default function App() {
  return (
    <div id="app-root" className="relative min-h-screen overflow-x-hidden">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-50">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-950 via-emerald-900/95 to-emerald-800/90" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18)_0%,rgba(6,78,59,0)_70%)]" />
      </div>
      <div className="relative flex min-h-screen flex-col">
        <Header />
        <MainContent />
      </div>
    </div>
  );
}
