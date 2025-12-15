import Header from "./components/Layout/Header";
import MainContent from "./components/MainContent";
import EnvironmentBadge from "./components/ui/EnvironmentBadge";

export default function App() {
  return (
    <div id="app-root" className="relative flex min-h-dvh flex-col overflow-x-hidden bg-gradient-to-b from-[rgba(11,107,58,0.92)] via-[rgba(20,99,86,0.95)] to-[rgba(12,83,53,0.97)] dark:from-[rgba(10,63,38,0.93)] dark:via-[rgba(11,58,48,0.96)] dark:to-[rgba(12,46,37,0.97)]">
      <EnvironmentBadge />
      <Header />
      <MainContent />
    </div>
  );
}
