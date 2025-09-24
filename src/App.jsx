import Header from "./components/Layout/Header";
import MainContent from "./components/MainContent";

export default function App() {
  return (
    <div id="app-root" className="relative min-h-screen overflow-x-hidden">
      <div className="relative flex min-h-screen flex-col">
        <Header />
        <MainContent />
      </div>
    </div>
  );
}
