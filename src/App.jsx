import Header from "./components/Layout/Header";
import MainContent from "./components/MainContent";

export default function App() {
  return (
    <div id="app-root" className="relative flex min-h-dvh flex-col overflow-x-hidden bg-gradient-to-b from-[#0b6b3a] via-[#146356] to-[#0c5335] dark:from-[#0a3f26] dark:via-[#0b3a30] dark:to-[#0c2e25]">
      <Header />
      <MainContent />
    </div>
  );
}
