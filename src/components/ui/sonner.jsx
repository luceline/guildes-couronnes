"use client";
import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

/**
 * Toaster Sonner — config customisée (10/05/2026) :
 * - Position "top-center" : les toasts apparaissent en milieu-haut de l'écran,
 *   au-dessus des drawers et autres overlays. Utile sur mobile où l'on a souvent
 *   un drawer ouvert (mairie, atelier, etc.) qui masquait les notifs en bas.
 * - z-index 99999 : au-dessus du drawer vaul (~50) et de l'overlay (~50).
 */
const Toaster = ({
  ...props
}) => {
  const { theme = "system" } = useTheme()

  return (
    (<Sonner
      theme={theme}
      className="toaster group"
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      style={{
        zIndex: 99999,
      }}
      {...props} />)
  );
}

export { Toaster }
