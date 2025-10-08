import Button from "./ui/Button.jsx";

const TestButton = () => {
  return (
    <div className="flex min-h-screen items-center justify-center gap-4 bg-[color:var(--surface)] p-6">
      <Button className="" disabled={false} icon={null}>
        Save
      </Button>
      <Button variant="secondary" className="" icon={null}>
        Cancel
      </Button>
    </div>
  );
};

export default TestButton;
