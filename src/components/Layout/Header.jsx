export default function Header() {
  return (
    <header className="bg-gradient-to-r from-primary to-secondary text-white shadow-soft">
      <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col flex items-center">
        <h1 className="text-xl font-bold text-center sm:text-center">AI Resume Optimizer</h1>
        <div className="mt-1 text-center text-sm font-medium">
          By Abdullah bin ahmed
        </div>
        <nav className="flex gap-4 justify-center mt-2 sm:mt-0">
          <a
            href="/"
            className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white rounded"
          >
            Home
          </a>
          <a
            href="/resume"
            className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white rounded"
          >
            Upload
          </a>
          <a
            href="/results"
            className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white rounded"
          >
            Results
          </a>
        </nav>
      </div>
    </header>
  );
}
