import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { createTestQueryClient } from "../shared/query/test-query-client";
import { useCollectionSearchParams } from "../shared/url/collection-search-params";

function UrlProbe() {
  const collection = useCollectionSearchParams(50);
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <div>
      <output>{`${collection.page}:${collection.pageSize}:${collection.search}:${location.search}`}</output>
      <button onClick={() => collection.setSearch("tower")}>search</button>
      <button onClick={() => collection.setPage(3)}>page</button>
      <button onClick={() => navigate(-1)}>back</button>
    </div>
  );
}

describe("navigational URL state", () => {
  it("normalizes invalid values and supports refreshable Back/Forward history", async () => {
    const client = createTestQueryClient();
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/devices?page=-7&pageSize=999"]}>
          <UrlProbe />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText("1:50::?page=-7&pageSize=999")).toBeTruthy();
    fireEvent.click(screen.getByText("search"));
    await screen.findByText("1:50:tower:?page=1&pageSize=999&search=tower");
    fireEvent.click(screen.getByText("page"));
    await screen.findByText("3:50:tower:?page=3&pageSize=999&search=tower");
    fireEvent.click(screen.getByText("back"));
    await waitFor(() =>
      expect(screen.getByText("1:50:tower:?page=1&pageSize=999&search=tower")).toBeTruthy(),
    );
  });
});
