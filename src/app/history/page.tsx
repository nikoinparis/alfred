"use client";

import { Page, EmptyState } from "@/components/shell/page";

export default function Placeholder() {
  return (
    <Page title="History">
      <EmptyState title="Coming up" body="This screen is next on the build list." />
    </Page>
  );
}
