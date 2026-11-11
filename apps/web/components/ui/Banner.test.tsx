import { render, screen } from "@testing-library/react";
import { Banner } from "./Banner";

describe("Banner", () => {
  it("uses alert for warnings and status for info", () => {
    render(
      <>
        <Banner tone="warn">সাবধান</Banner>
        <Banner>জানুন</Banner>
      </>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("সাবধান");
    expect(screen.getByRole("status")).toHaveTextContent("জানুন");
  });
});
