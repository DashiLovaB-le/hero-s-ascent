import { useEffect, useState } from "react";
import { Toaster as Sonner } from "sonner";
import { isNativePlatform } from "@/lib/platform";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const NATIVE_TOP_OFFSET =
  "max(1.75rem, calc(var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) + 0.75rem))";

const Toaster = ({ ...props }: ToasterProps) => {
  const [native, setNative] = useState(false);

  useEffect(() => {
    setNative(isNativePlatform());
  }, []);

  return (
    <Sonner
      className="toaster group"
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            "group toast cp-toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-transparent group-[.toaster]:shadow-lg group-[.toaster]:min-h-12 group-[.toaster]:px-4 group-[.toaster]:py-3",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
      offset={native ? NATIVE_TOP_OFFSET : (props.offset ?? 16)}
      mobileOffset={native ? NATIVE_TOP_OFFSET : (props.mobileOffset ?? 16)}
    />
  );
};

export { Toaster };
