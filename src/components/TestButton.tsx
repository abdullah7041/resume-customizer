import PrimaryButton from "./ui/PrimaryButton.jsx";
import SecondaryButton from "./ui/SecondaryButton.jsx";

const TestButton = () => {
  return (
    <div className="flex min-h-screen items-center justify-center gap-4 bg-sand-50 p-6">
      <PrimaryButton>Save</PrimaryButton>
      <SecondaryButton>Cancel</SecondaryButton>
    </div>
  );
};

export default TestButton;
