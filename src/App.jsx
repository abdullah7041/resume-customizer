import Header from "./components/Layout/Header";
import MainContent from "./components/MainContent";

export default function App() {
  return (
    <div id="app-root" className="relative flex min-h-screen flex-col overflow-x-hidden">
      <Header />
      <MainContent />
    </div>
  );
}
