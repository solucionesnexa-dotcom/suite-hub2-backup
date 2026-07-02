import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import ContaNexa from "@/pages/ContaNexa";

export const Route = createFileRoute("/_authenticated/contanexa")({
  ssr: false,
  head: () => ({ meta: [{ title: "ContaNexa · Nexa Suite" }] }),
  component: ContaNexaPage,
});

function ContaNexaPage() {
  return (
    <AppShell title="ContaNexa">
      <ContaNexa />
    </AppShell>
  );
}
