export default function Header() {
  return (
    <header className="bg-green-700 text-white px-6 py-4 flex justify-between items-center shadow">
      <h1 className="text-xl font-bold">AI Resume Optimizer</h1>
      <nav className="space-x-4">
        <a href="/" className="hover:underline">Home</a>
        <a href="/resume" className="hover:underline">Upload</a>
        <a href="/results" className="hover:underline">Results</a>
      </nav>
    </header>
  );
}
