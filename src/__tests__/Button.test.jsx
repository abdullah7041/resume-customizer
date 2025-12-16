import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Button from "../components/ui/Button.jsx";

describe("Button", () => {
  it("applies gradient styling for the primary variant", () => {
    render(<Button>Call to Action</Button>);

    const button = screen.getByRole("button", { name: "Call to Action" });
    expect(button.className).toContain("bg-gradient-to-r");
    expect(button.className).toContain("from-emerald-500");
    expect(button.className).toContain("to-teal-600");
  });

  it("supports the secondary variant with backdrop blur", () => {
    render(
      <Button variant="secondary">Secondary Action</Button>
    );

    const button = screen.getByRole("button", { name: "Secondary Action" });
    expect(button.className).toContain("backdrop-blur");
    expect(button.className).toContain("border");
  });
});



