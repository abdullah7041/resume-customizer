import Button from "./ui/Button.jsx";
import { Save, X } from "lucide-react";

const TestButton = () => {
  return (
    <div className="flex min-h-screen items-center justify-center gap-4 bg-[color:var(--surface)] p-6">
      <Button disabled={false} icon={Save}>
        Save
      </Button>
      <Button variant="secondary" icon={X}>
        Cancel
      </Button>
    </div>
  );
};

export default TestButton;
