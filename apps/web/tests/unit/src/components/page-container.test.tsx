import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageContainer, PageContainerContent } from "@/components/page-container";

describe("PageContainer", () => {
  it("separates the painted page rail from its centered content gutters", () => {
    render(
      <PageContainer className="min-h-screen" data-testid="page-container">
        <PageContainerContent className="flex" data-testid="page-container-content">
          Page content
        </PageContainerContent>
      </PageContainer>
    );

    const container = screen.getByTestId("page-container");
    const content = screen.getByTestId("page-container-content");

    expect(container.classList.contains("w-full")).toBe(true);
    expect(container.classList.contains("bg-background")).toBe(true);
    expect(container.classList.contains("min-h-screen")).toBe(true);
    expect(content.classList.contains("mx-auto")).toBe(true);
    expect(content.classList.contains("max-w-375")).toBe(true);
    expect(content.classList.contains("px-5")).toBe(true);
    expect(content.classList.contains("lg:px-10")).toBe(true);
    expect(content.classList.contains("flex")).toBe(true);
    expect(content.textContent).toBe("Page content");
  });
});
