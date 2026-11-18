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

  it("switches to fonts tab and displays font studio", () => {
    render(<App />);
    fireEvent.click(screen.getByText("fonts"));
    expect(screen.getByText("Ethiopian Font Studio")).toBeInTheDocument();
  });

  it("switches to settings tab and displays credentials configuration", () => {
    render(<App />);
    fireEvent.click(screen.getByText("settings"));
    expect(screen.getByText("Settings & Engine Security")).toBeInTheDocument();
    expect(screen.getByText("Engine URL")).toBeInTheDocument();
    expect(screen.getByText(/Engine Token/)).toBeInTheDocument();
  });

  it("disables apply cut button when no regions are detected", () => {
    render(<App />);
    fireEvent.click(screen.getByText("silence"));
    const applyBtn = screen.getByText("Apply Selected Cuts");
    expect(applyBtn).toBeDisabled();
  });
});
