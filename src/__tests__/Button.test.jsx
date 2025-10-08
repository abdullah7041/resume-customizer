import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Button from "../components/ui/Button.jsx";

describe("Button", () => {
  it("applies glassmorphism tokens for the primary variant", () => {
    render(<Button>Call to Action</Button>);

    const button = screen.getByRole("button", { name: "Call to Action" });
    expect(button.className).toContain("bg-[image:var(--gradient-primary-value)]");
    expect(button.className).toContain("before:bg-[image:var(--glass-reflection)]");
    expect(button.className).toContain("after:bg-[image:var(--glass-gold-sheen)]");
  });

  it("supports the secondary variant for frosted controls", () => {
    render(
      <Button variant="secondary">Secondary Action</Button>
    );

    const button = screen.getByRole("button", { name: "Secondary Action" });
    expect(button.className).toContain("border-[color:var(--glass-border)]");
    expect(button.className).toContain("backdrop-blur-glass");
  });
});
