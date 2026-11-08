import { createFileRoute } from "@tanstack/react-router";
import MenuShowcase from "@/components/MenuShowcase";

export const Route = createFileRoute("/showcase-check")({
  component: () => (
    <div className="p-6">
      <MenuShowcase />
    </div>
  ),
});
