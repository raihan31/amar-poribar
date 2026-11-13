import { render, screen } from "@testing-library/react";
import { Avatar } from "./Avatar";

describe("Avatar", () => {
  it("shows the first letter and names the person", () => {
    render(<Avatar name="রহিম" />);
    expect(screen.getByRole("img", { name: "রহিম" })).toHaveTextContent("র");
  });
});
