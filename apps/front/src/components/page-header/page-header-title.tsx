interface PageHeaderTitleProps {
    children: React.ReactNode;
}

export function PageHeaderTitle({ children }: PageHeaderTitleProps) {
    return (
        <h1 className="font-display text-2xl font-extrabold tracking-tight mb-2">
            {children}
        </h1>
    );
}