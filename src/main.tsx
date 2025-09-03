import React from "react"
import ReactDOM from "react-dom/client"
import "./index.css"
import TestButton from "./components/TestButton"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <div className="p-10">
      <TestButton />
    </div>
  </React.StrictMode>
)
