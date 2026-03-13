import * as React from "react"

type Context = {
    open: boolean
    setOpen: (v: boolean) => void
    toggle: () => void
}

const DropdownContext = React.createContext<Context | null>(null)

export function DropdownMenu({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = React.useState(false)
    const ref = React.useRef<HTMLDivElement | null>(null)

    React.useEffect(() => {
        function onDoc(e: MouseEvent) {
            if (!ref.current) return
            if (e.target instanceof Node && !ref.current.contains(e.target)) {
                setOpen(false)
            }
        }
        document.addEventListener("mousedown", onDoc)
        return () => document.removeEventListener("mousedown", onDoc)
    }, [])

    const toggle = React.useCallback(() => setOpen((v) => !v), [])

    return (
        <div ref={ref} style={{ display: "inline-block", position: "relative" }}>
            <DropdownContext.Provider value={{ open, setOpen, toggle }}>
                {children}
            </DropdownContext.Provider>
        </div>
    )
}

export function DropdownMenuTrigger({
    children,
    asChild,
}: {
    children: React.ReactElement
    asChild?: boolean
}) {
    const ctx = React.useContext(DropdownContext)
    if (!ctx) return null

    const props = {
        onClick: (e: React.MouseEvent) => {
            e.preventDefault()
            ctx.toggle()
        },
    }

    if (asChild) {
        return React.cloneElement(children, props)
    }

    return (
        <button type="button" {...props}>
            {children}
        </button>
    )
}

export function DropdownMenuContent({
    children,
    align = "start",
}: {
    children: React.ReactNode
    align?: "start" | "end"
}) {
    const ctx = React.useContext(DropdownContext)
    if (!ctx) return null
    if (!ctx.open) return null

    const style: React.CSSProperties = {
        position: "absolute",
        top: "100%",
        marginTop: "8px",
        minWidth: "120px",

        background: "var(--background)",
        color: "var(--foreground)",

        border: "1px solid var(--border)",
        borderRadius: "6px",
        boxShadow: "0 6px 18px rgba(0,0,0,0.2)",

        padding: "6px",
        right: 0,
        zIndex: 50,
    };

    return <div role="menu" style={style}>{children}</div>
}

export const DropdownMenuItem = React.forwardRef<
    HTMLDivElement,
    React.HTMLProps<HTMLDivElement> & { onClick?: () => void }
>(function DropdownMenuItem({ children, onClick, ...rest }, ref) {
    const ctx = React.useContext(DropdownContext)
    if (!ctx) return null

    return (
        <div
            ref={ref}
            role="menuitem"
            tabIndex={0}
            onClick={() => {
                onClick?.()
                ctx.setOpen(false)
            }}
            style={{ padding: "6px 10px", cursor: "pointer" }}
            {...rest}
        >
            {children}
        </div>
    )
})

export default DropdownMenu
