import { describe, expect, it } from "vitest";

describe("smoke", () => {
  it("renders with jsdom", () => {
    document.body.innerHTML = '<div data-testid="x">hello</div>';
    expect(document.querySelector("[data-testid=x]")).toBeInTheDocument();
    expect(document.querySelector("[data-testid=x]")).toHaveTextContent("hello");
  });
});
