interface PageHeaderTitleProps {
    children: React.ReactNode;
}

export function PageHeaderTitle({ children }: PageHeaderTitleProps) {
    return (
        <h1 className="mb-2 font-display text-[30px] leading-[1.15] font-extrabold tracking-tight">
            {children}
        </h1>
    );
}