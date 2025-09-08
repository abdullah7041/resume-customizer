export function PrimaryButton({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-6 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition"
    >
      {children}
    </button>
  );
}

export function Card({ children }) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
      {children}
    </div>
  );
}
