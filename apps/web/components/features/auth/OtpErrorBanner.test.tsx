import { render, screen } from "@testing-library/react";
import { OtpErrorBanner } from "./OtpErrorBanner";

describe("OtpErrorBanner", () => {
  it("has role=alert and icon", () => {
    const { container } = render(<OtpErrorBanner title="কোডটি মেলেনি">আবার দেখে লিখুন।</OtpErrorBanner>);
    expect(screen.getByRole("alert")).toHaveTextContent("কোডটি মেলেনি");
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
