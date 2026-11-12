"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { appPath } from "@/lib/base-path";

type PayPalButtons = {
  render: (element: HTMLElement) => Promise<void> | void;
  close: () => void;
};

declare global {
  interface Window {
    paypal?: {
      Buttons: (options: {
        createOrder: () => Promise<string>;
        onApprove: (data: { orderID: string }) => Promise<void>;
        onError: (error: unknown) => void;
      }) => PayPalButtons;
    };
  }
}

export function PayPalFundButton({
  jobId,
  clientId,
  mock,
}: {
  jobId: string;
  clientId: string | null;
  mock: boolean;
}) {
  const router = useRouter();
  const host = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!clientId || !host.current) return;
    const element = host.current;
    let cancelled = false;
    let buttons: PayPalButtons | null = null;
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=authorize&components=buttons`;
    script.async = true;
    script.onload = () => {
      if (cancelled || !window.paypal || !element) return;
      buttons = window.paypal.Buttons({
        createOrder: async () => {
          const response = await fetch(appPath("/api/paypal/create-order"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Could not create the order.");
          return data.orderId as string;
        },
        onApprove: async (data) => {
          setFailed(false);
          setMessage("Buyer approval received. Recording the authorization hold without capturing.");
          const response = await fetch(appPath("/api/paypal/authorize-order"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId, orderId: data.orderID }),
          });
          const body = await response.json();
          if (!response.ok) {
            setFailed(true);
            setMessage(body.error || "Could not record the authorization.");
            return;
          }
          setFailed(false);
          setMessage("The funds are on an authorization hold. Nothing has been captured.");
          router.refresh();
        },
        onError: (error) => {
          setFailed(true);
          setMessage(error instanceof Error ? error.message : "The PayPal checkout window reported an error.");
        },
      });
      void buttons.render(element);
    };
    script.onerror = () => setMessage("Could not load the PayPal script.");
    document.body.appendChild(script);
    return () => {
      cancelled = true;
      buttons?.close();
      element.innerHTML = "";
      script.remove();
    };
  }, [clientId, jobId, router]);

  async function mockFund() {
    setPending(true);
    setMessage("");
    const created = await fetch(appPath("/api/paypal/create-order"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
    const order = await created.json();
    if (!created.ok) {
      setPending(false);
      setMessage(order.error || "Could not create the simulated order.");
      return;
    }
    const response = await fetch(appPath("/api/paypal/authorize-order"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, orderId: order.orderId }),
    });
    const data = await response.json();
    setPending(false);
    if (!response.ok) {
      setMessage(data.error || "Simulated authorization failed.");
      return;
    }
    setMessage("Recorded an authorization hold with the local simulation. This is not a PayPal sandbox payment.");
    router.refresh();
  }

  return (
    <div className="mt-4">
      <p className="text-sm leading-6">
        This button creates a PayPal <strong>authorization</strong>. It does not capture immediately after checkout.
      </p>
      {clientId ? <div ref={host} className="mt-3 max-w-sm" /> : null}
      {!clientId && mock ? (
        <button type="button" className="btn mt-3" disabled={pending} onClick={mockFund}>
          {pending ? "Recording" : "Simulate authorization hold"}
        </button>
      ) : null}
      {!clientId && !mock ? (
        <p className="mt-3 text-sm text-fail">
          NEXT_PUBLIC_PAYPAL_CLIENT_ID is missing. Add the sandbox app client ID to show the checkout button.
        </p>
      ) : null}
      {message ? <p className={failed ? "mt-3 text-sm text-fail" : "mt-3 text-sm"}>{message}</p> : null}
    </div>
  );
}
