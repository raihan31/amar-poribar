import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VoiceFallbackCard } from "./VoiceFallbackCard";

class FakeRecognition {}

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  Object.defineProperty(window, "speechSynthesis", {
    writable: true,
    value: { speak: () => {}, cancel: () => {}, getVoices: () => [] },
  });
});

function setVoices(voices: Array<{ lang: string }>) {
  Object.defineProperty(window, "speechSynthesis", {
    writable: true,
    value: { speak: () => {}, cancel: () => {}, getVoices: () => voices },
  });
}

describe("VoiceFallbackCard", () => {
  it("shown when no bn voice", async () => {
    (window as unknown as Record<string, unknown>).SpeechRecognition = FakeRecognition;
    setVoices([{ lang: "en-US" }]);
    const onText = vi.fn();
    render(<VoiceFallbackCard onText={onText} />);
    expect(await screen.findByText("কথা বলা যাচ্ছে না")).toBeInTheDocument();
    expect(screen.getByText("এই ফোনে বাংলা ভয়েস নেই")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /বাংলা ভয়েস ইনস্টল করুন/ })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "এসএমএস পেস্ট" })).toHaveAttribute("href", "/add/sms");
    expect(screen.getByRole("link", { name: "মেমোর ছবি" })).toHaveAttribute("href", "/add/receipt");
    expect(screen.queryByText("উত্তর পড়ে শোনানোও এই ফোনে বন্ধ। লেখা দেখে নিন।")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "এখন লিখে রাখুন" }));
    const field = screen.getByPlaceholderText('লিখুন: "বাজার ৮৫০ ক্যাশ"');
    expect(field).toHaveFocus();
    await userEvent.type(field, "বাজার ৮৫০ ক্যাশ{Enter}");
    expect(onText).toHaveBeenCalledWith("বাজার ৮৫০ ক্যাশ");
  });

  it("hidden when Bangla speech works", async () => {
    (window as unknown as Record<string, unknown>).SpeechRecognition = FakeRecognition;
    setVoices([{ lang: "bn-BD" }]);
    const { container } = render(<VoiceFallbackCard onText={() => {}} />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("notes missing read-aloud when synthesis is absent", async () => {
    Object.defineProperty(window, "speechSynthesis", { writable: true, value: undefined });
    render(<VoiceFallbackCard onText={() => {}} />);
    expect(await screen.findByText("উত্তর পড়ে শোনানোও এই ফোনে বন্ধ। লেখা দেখে নিন।")).toBeInTheDocument();
  });
});
