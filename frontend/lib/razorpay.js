// Loads Razorpay's Checkout script on demand (not needed until the user
// actually reaches the payment step) and wraps opening the checkout modal
// in a promise-friendly API.

let scriptLoadingPromise = null;

export function loadRazorpayScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay can only load in the browser."));
  }
  if (window.Razorpay) return Promise.resolve();

  if (!scriptLoadingPromise) {
    scriptLoadingPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Razorpay Checkout script."));
      document.body.appendChild(script);
    });
  }
  return scriptLoadingPromise;
}

/**
 * Opens Razorpay Checkout. Resolves with the payment result on success,
 * rejects with a distinguishable error if the user dismisses the modal
 * without paying (so callers can show "not completed" rather than a
 * generic error).
 */
export async function openRazorpayCheckout({ keyId, orderId, amount, currency, name, description }) {
  await loadRazorpayScript();

  return new Promise((resolve, reject) => {
    const options = {
      key: keyId,
      order_id: orderId,
      amount,
      currency,
      name,
      description,
      handler: (response) => {
        resolve({
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        });
      },
      modal: {
        ondismiss: () => {
          const err = new Error("Payment window closed before completing payment.");
          err.dismissed = true;
          reject(err);
        },
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.on("payment.failed", (response) => {
      const err = new Error(response.error?.description || "Payment failed.");
      err.paymentFailed = true;
      reject(err);
    });
    rzp.open();
  });
}
