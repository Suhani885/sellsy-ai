"""
Thin wrapper around the Razorpay Python SDK.

Nothing here decides *whether* to charge someone — that decision (the
approved PaymentProposal) has already been made by the time this is
called. This module's only job is talking to Razorpay and translating its
exceptions into our own AppException hierarchy, so the rest of the app
never has to import razorpay.errors directly.
"""
import razorpay
from fastapi import status

from app.config.settings import settings
from app.utils.exceptions import AppException


class RazorpayError(AppException):
    """Order creation or another Razorpay API call failed. Mapped to 502 —
    this is an upstream/gateway failure, not a bug in our request."""

    status_code = status.HTTP_502_BAD_GATEWAY
    error_code = "RAZORPAY_ERROR"


class RazorpayService:
    def __init__(self, key_id: str | None = None, key_secret: str | None = None):
        self.key_id = key_id or settings.razorpay_key_id
        self.key_secret = key_secret or settings.razorpay_key_secret
        self._client: razorpay.Client | None = None

    def _get_client(self) -> razorpay.Client:
        if not self.key_id or not self.key_secret or self.key_id == "placeholder":
            raise RazorpayError(
                "Razorpay is not configured. Set RAZORPAY_KEY_ID and "
                "RAZORPAY_KEY_SECRET in backend/.env with your test-mode keys."
            )
        if self._client is None:
            self._client = razorpay.Client(auth=(self.key_id, self.key_secret))
        return self._client

    def create_order(self, amount_rupees: float, receipt: str) -> dict:
        """Amount is always in rupees here — this method handles the
        paise conversion internally so callers never have to remember
        Razorpay's smallest-unit convention."""
        client = self._get_client()
        amount_paise = int(round(amount_rupees * 100))

        try:
            return client.order.create(
                data={
                    "amount": amount_paise,
                    "currency": "INR",
                    "receipt": receipt,
                    "payment_capture": 1,
                }
            )
        except (
            razorpay.errors.BadRequestError,
            razorpay.errors.GatewayError,
            razorpay.errors.ServerError,
        ) as exc:
            raise RazorpayError(f"Razorpay order creation failed: {exc}") from exc
        except Exception as exc:  # network errors, etc.
            raise RazorpayError(f"Could not reach Razorpay: {exc}") from exc

    def verify_payment_signature(
        self, razorpay_order_id: str, razorpay_payment_id: str, razorpay_signature: str
    ) -> bool:
        client = self._get_client()
        try:
            client.utility.verify_payment_signature(
                {
                    "razorpay_order_id": razorpay_order_id,
                    "razorpay_payment_id": razorpay_payment_id,
                    "razorpay_signature": razorpay_signature,
                }
            )
            return True
        except razorpay.errors.SignatureVerificationError:
            return False
