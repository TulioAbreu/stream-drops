interface PageHeaderTitleProps {
    children: React.ReactNode;
}

export function PageHeaderTitle({ children }: PageHeaderTitleProps) {
    return (
        <h1 className="text-2xl font-bold mb-2">
            {children}
        </h1>
    );
}