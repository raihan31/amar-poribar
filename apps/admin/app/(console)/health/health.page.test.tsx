import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { healthFixture } from "@/components/health/types";
import HealthPage from "./page";

const apiMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({ api: apiMock }));

describe("health page", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    apiMock.mockReset();
    apiMock.mockResolvedValue(healthFixture);
  });
  afterEach(() => vi.useRealTimers());

  it("refetches every 60 seconds", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <HealthPage />
      </QueryClientProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(screen.getByText("OTP delivery rate")).toBeInTheDocument();
    expect(screen.getByText(/Last 30 days · updated 11 Nov 2026, 10:00 \(Asia\/Dhaka\)/)).toBeInTheDocument();
    expect(screen.getByText(/NFR-12/)).toBeInTheDocument();
    expect(apiMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(apiMock).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(apiMock).toHaveBeenCalledTimes(3);
  });
});
