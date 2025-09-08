// src/components/TestButton.jsx
import React from "react";

const TestButton = () => {
  return (
    <div className="flex gap-4 p-6 bg-gray-50 min-h-screen items-center justify-center">
      <button className="btn btn-primary">حفظ</button>
      <button className="btn btn-secondary">إلغاء</button>
    </div>
  );
};

export default TestButton;
