import { Layout } from "@/components/layout";
import { RouletteEditor } from "../components/roulette-editor";

export function RouletteNewPage() {
  return (
    <Layout>
      <RouletteEditor mode="new" />
    </Layout>
  );
}
