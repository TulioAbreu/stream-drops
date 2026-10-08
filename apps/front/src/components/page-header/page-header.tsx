interface PageHeaderProps {
    children: React.ReactNode;
}

export function PageHeader({ children }: PageHeaderProps) {
    return (
        <div className="mb-6 text-2xl font-bold">
            {children}
        </div>
    );
}