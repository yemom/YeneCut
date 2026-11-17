import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import App from "./App";

describe("YeneCut AI plugin panel", () => {
  it("renders dashboard and navigation", () => {
    render(<App />);
    expect(screen.getByText("YeneCut AI")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("switches to silence tab", () => {
    render(<App />);
    fireEvent.click(screen.getByText("silence"));
    expect(screen.getByText("Silence Cut")).toBeInTheDocument();
  });

  it("switches to captions tab", () => {
    render(<App />);
    fireEvent.click(screen.getByText("captions"));
    expect(screen.getByText("Auto Captions")).toBeInTheDocument();
  });
});
