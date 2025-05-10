import { Layout } from "@/components/layout";

export function DashboardPage() {
    return (
        <Layout>
            <div className="flex flex-col items-center justify-center">
                <div className="border rounded shadow-md min-w-[300px] p-4">
                    <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
                    <p>Welcome to the dashboard!</p>
                </div>
            </div>
        </Layout>
    );
}
