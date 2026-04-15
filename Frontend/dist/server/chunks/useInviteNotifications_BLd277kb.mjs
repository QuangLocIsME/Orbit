import { jsx, jsxs } from 'react/jsx-runtime';
import { Toaster as Toaster$1, toast } from 'sonner';
import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { io } from 'socket.io-client';
import { a as apiFetch } from './api-client_BrBa9f1N.mjs';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { c as cn } from './utils_B05Dmz_H.mjs';

const __vite_import_meta_env__ = {"ASSETS_PREFIX": undefined, "BASE_URL": "/", "DEV": false, "MODE": "production", "PROD": true, "SITE": undefined, "SSR": true};
let socket = null;
const BACKEND_WS_URL = typeof import.meta !== "undefined" && Object.assign(__vite_import_meta_env__, { PUBLIC: "C:\\Users\\Public" })?.PUBLIC_BACKEND_WS_URL || "http://localhost:3000";
function getSocket() {
  if (socket && socket.connected) return socket;
  if (socket) {
    socket.connect();
    return socket;
  }
  socket = io(BACKEND_WS_URL, {
    // Cookies are sent automatically because of `withCredentials`
    withCredentials: true,
    transports: ["websocket", "polling"],
    // Don't auto-connect — we call connect() manually after we know user is authed
    autoConnect: true
  });
  socket.on("connect", () => {
    console.debug("[WS] Connected", socket?.id);
  });
  socket.on("connect_error", (err) => {
    if (err.message === "NO_TOKEN" || err.message === "INVALID_TOKEN") {
      console.debug("[WS] Not authenticated — socket disabled");
      socket?.disconnect();
    } else {
      console.warn("[WS] Connection error:", err.message);
    }
  });
  socket.on("disconnect", (reason) => {
    console.debug("[WS] Disconnected:", reason);
  });
  return socket;
}

const Toaster = ({ ...props }) => {
  return /* @__PURE__ */ jsx(
    Toaster$1,
    {
      theme: "light",
      richColors: true,
      closeButton: true,
      position: "bottom-right",
      ...props
    }
  );
};

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogPortal = AlertDialogPrimitive.Portal;
const AlertDialogOverlay = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  AlertDialogPrimitive.Overlay,
  {
    className: cn(
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
      className
    ),
    ...props,
    ref
  }
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;
const AlertDialogContent = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsxs(AlertDialogPortal, { children: [
  /* @__PURE__ */ jsx(AlertDialogOverlay, {}),
  /* @__PURE__ */ jsx(
    AlertDialogPrimitive.Content,
    {
      ref,
      className: cn(
        "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed left-[50%] top-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
        className
      ),
      ...props
    }
  )
] }));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;
const AlertDialogHeader = ({ className, ...props }) => /* @__PURE__ */ jsx("div", { className: cn("flex flex-col gap-2 text-center sm:text-left", className), ...props });
AlertDialogHeader.displayName = "AlertDialogHeader";
const AlertDialogFooter = ({ className, ...props }) => /* @__PURE__ */ jsx(
  "div",
  {
    className: cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className),
    ...props
  }
);
AlertDialogFooter.displayName = "AlertDialogFooter";
const AlertDialogTitle = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(AlertDialogPrimitive.Title, { ref, className: cn("text-lg font-semibold", className), ...props }));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;
const AlertDialogDescription = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  AlertDialogPrimitive.Description,
  {
    ref,
    className: cn("text-muted-foreground text-sm", className),
    ...props
  }
));
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;
const baseButtonClass = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] h-9 px-4 py-2";
const AlertDialogAction = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  AlertDialogPrimitive.Action,
  {
    ref,
    className: cn(baseButtonClass, "bg-primary text-primary-foreground hover:bg-primary/90", className),
    ...props
  }
));
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;
const AlertDialogCancel = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  AlertDialogPrimitive.Cancel,
  {
    ref,
    className: cn(baseButtonClass, "border bg-background shadow-xs hover:bg-muted", className),
    ...props
  }
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

function InviteNotificationHandler() {
  const [activeInvite, setActiveInvite] = useState(null);
  const [mounted, setMounted] = useState(false);
  const activeInviteRef = useRef(null);
  useEffect(() => {
    activeInviteRef.current = activeInvite;
  }, [activeInvite]);
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    const handler = (e) => {
      const data = e.detail;
      setActiveInvite({ ...data, dismissed: false });
    };
    window.addEventListener("orbit:show-invite-dialog", handler);
    return () => window.removeEventListener("orbit:show-invite-dialog", handler);
  }, []);
  const handleAccept = async () => {
    const invite = activeInviteRef.current;
    if (!invite) return;
    try {
      const res = await apiFetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: invite.token || invite.inviteId })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Failed to accept invite");
        return;
      }
      toast.success(`You joined "${invite.projectName}"`);
      setActiveInvite(null);
      activeInviteRef.current = null;
    } catch {
      toast.error("Failed to accept invite");
    }
  };
  const handleReject = async () => {
    const invite = activeInviteRef.current;
    if (!invite) return;
    try {
      await apiFetch("/api/invites/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId: invite.inviteId })
      });
      toast.info(`Declined invite to "${invite.projectName}"`);
      setActiveInvite(null);
      activeInviteRef.current = null;
    } catch {
      toast.error("Failed to decline invite");
    }
  };
  if (!mounted) return null;
  return ReactDOM.createPortal(
    /* @__PURE__ */ jsx(
      AlertDialog,
      {
        open: !!activeInvite,
        onOpenChange: (open) => {
          if (!open) {
            setActiveInvite(null);
            activeInviteRef.current = null;
          }
        },
        children: /* @__PURE__ */ jsxs(AlertDialogContent, { children: [
          /* @__PURE__ */ jsxs(AlertDialogHeader, { children: [
            /* @__PURE__ */ jsxs(AlertDialogTitle, { children: [
              activeInvite?.inviterName,
              " invited you to join"
            ] }),
            /* @__PURE__ */ jsx(AlertDialogDescription, { asChild: true, children: /* @__PURE__ */ jsxs("div", { className: "space-y-2 pt-1", children: [
              /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3", children: [
                /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-[#101828]", children: activeInvite?.projectName }),
                /* @__PURE__ */ jsxs("p", { className: "text-xs text-[#6A7282] mt-0.5", children: [
                  "Role: ",
                  /* @__PURE__ */ jsx("span", { className: "capitalize font-medium", children: activeInvite?.role })
                ] })
              ] }),
              /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: "Would you like to accept this invitation?" })
            ] }) })
          ] }),
          /* @__PURE__ */ jsxs(AlertDialogFooter, { children: [
            /* @__PURE__ */ jsx(AlertDialogCancel, { onClick: handleReject, children: "Decline" }),
            /* @__PURE__ */ jsx(
              AlertDialogAction,
              {
                onClick: handleAccept,
                className: "bg-[#155DFC] text-white hover:bg-blue-700",
                children: "Accept"
              }
            )
          ] })
        ] })
      }
    ),
    document.body
  );
}

export { AlertDialog as A, InviteNotificationHandler as I, Toaster as T, AlertDialogContent as a, AlertDialogHeader as b, AlertDialogTitle as c, AlertDialogDescription as d, AlertDialogFooter as e, AlertDialogCancel as f, AlertDialogAction as g, getSocket as h };
