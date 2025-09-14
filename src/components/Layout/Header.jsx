export default function Header() {
  return (
    <header className="bg-primary text-white px-6 py-4 flex justify-between items-center shadow-soft">
      <h1 className="text-xl font-bold">AI Resume Optimizer</h1>
      <nav className="flex gap-4">
        <a href="/" className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white rounded">Home</a>
        <a href="/resume" className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white rounded">Upload</a>
        <a href="/results" className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white rounded">Results</a>
      </nav>
    </header>
  );
}
