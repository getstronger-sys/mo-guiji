"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  size?: "lg" | "xl" | "full";
}

const sizeClass = {
  lg: "max-w-3xl",
  xl: "max-w-5xl",
  full: "max-w-6xl",
};

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  className,
  size = "xl",
}: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
          role="presentation"
        >
          <motion.button
            type="button"
            aria-label="关闭"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-md"
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className={cn(
              "relative flex h-[min(92vh,920px)] w-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl ring-1 ring-border/80",
              sizeClass[size],
              className
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <h2 id="modal-title" className="text-base font-semibold">
                  {title}
                </h2>
                {subtitle && (
                  <p className="mt-0.5 truncate text-xs text-muted">{subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-card-hover hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
