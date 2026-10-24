import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/85",
        secondary: "bg-muted text-foreground hover:bg-tile-hover",
        outline: "border bg-card shadow-xs hover:bg-accent",
        ghost: "hover:bg-muted",
        success: "bg-success text-white shadow-sm hover:bg-success/90",
        destructive: "bg-danger text-white shadow-sm hover:bg-danger/90",
        link: "text-foreground underline-offset-4 hover:underline px-0",
        /** For dark surfaces. */
        inverse: "bg-white text-[#141414] shadow-sm hover:bg-white/90",
        "inverse-muted": "bg-white/10 text-white hover:bg-white/15",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 gap-1.5 px-3 text-[13px]",
        lg: "h-10 px-6",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
