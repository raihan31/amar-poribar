import { render, screen } from "@testing-library/react";
import { Spinner } from "./Spinner";

describe("Spinner", () => {
  it("announces its label", () => {
    render(<Spinner label="অপেক্ষা করুন" />);
    expect(screen.getByRole("status", { name: "অপেক্ষা করুন" })).toBeInTheDocument();
  });
});
