import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "app-primary-button",
        destructive: "app-danger-button",
        outline: "border border-slate-200/90 bg-white text-slate-700 shadow-[0_2px_10px_rgba(15,23,42,0.035),0_1px_2px_rgba(15,23,42,0.025)] hover:border-slate-300/90 hover:bg-slate-50/90 hover:text-slate-900 hover:shadow-[0_6px_16px_rgba(15,23,42,0.05),0_1px_2px_rgba(15,23,42,0.025)]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
