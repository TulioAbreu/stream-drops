import { Layout } from "@/components/layout";
import { Outlet } from "react-router";
import { ConnectionBanner } from "./components/connection-banner";
import { SubathonProvider } from "./hooks/use-subathon";

export function SubathonLayout() {
  return (
    <SubathonProvider>
      <Layout>
        <div className="flex flex-col gap-4">
          <ConnectionBanner />
          <Outlet />
        </div>
      </Layout>
    </SubathonProvider>
  );
}
