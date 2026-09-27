import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeLog } from "@/lib/logger";
import Stripe from "stripe";

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

let stripe: Stripe | null = null;

function getStripe() {
  if (!stripe && process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {});
  }
  return stripe;
}

export async function POST(request: NextRequest) {
  if (!STRIPE_WEBHOOK_SECRET) {
    safeLog("error", "[stripe/webhook] STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  let event;

  try {
    const stripeInstance = getStripe();
    if (!stripeInstance) throw new Error("Stripe not initialized");
    event = stripeInstance.webhooks.constructEvent(
      body,
      signature,
      STRIPE_WEBHOOK_SECRET,
    );
  } catch (err: unknown) {
    safeLog("error", "[stripe/webhook] Signature verification failed", {
      metadata: { error: String(err) },
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id || session.client_reference_id;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (userId) {
          // Get subscription details
          const stripeInstance = getStripe();
          if (!stripeInstance) throw new Error("Stripe not initialized");
          const subscription =
            await stripeInstance.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0]?.price.id;
          const currentPeriodEnd = new Date(
            (subscription.items.data[0]?.current_period_end ?? 0) * 1000,
          );

          await supabase
            .from("users")
            .update({
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              stripe_price_id: priceId,
              stripe_current_period_end: currentPeriodEnd.toISOString(),
              subscription_status: "active",
              cancel_at_period_end: subscription.cancel_at_period_end,
              updated_at: new Date().toISOString(),
            })
            .eq("id", userId);

          safeLog("info", "[stripe/webhook] Subscription activated", {
            metadata: { userId, subscriptionId, priceId },
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subData = event.data.object as Stripe.Subscription;
        const customerId = subData.customer as string;
        const userId = subData.metadata?.supabase_user_id;

        // Also try to find user by customer ID if not in metadata
        let targetUserId = userId;
        if (!targetUserId) {
          const { data: profile } = await supabase
            .from("users")
            .select("id")
            .eq("stripe_customer_id", customerId)
            .single();
          targetUserId = profile?.id;
        }

        if (targetUserId) {
          const priceId = subData.items.data[0]?.price.id;
          const currentPeriodEnd = new Date(
            (subData.items.data[0]?.current_period_end ?? 0) * 1000,
          );
          let status: "active" | "past_due" | "canceled" | "trialing" = "active";

          switch (subData.status) {
            case "active":
            case "trialing":
              status = subData.status === "trialing" ? "trialing" : "active";
              break;
            case "past_due":
              status = "past_due";
              break;
            case "canceled":
            case "unpaid":
              status = "canceled";
              break;
            default:
              status = "active";
          }

          await supabase
            .from("users")
            .update({
              stripe_subscription_id: subData.id,
              stripe_price_id: priceId,
              stripe_current_period_end: currentPeriodEnd.toISOString(),
              subscription_status: status,
              cancel_at_period_end: subData.cancel_at_period_end,
              updated_at: new Date().toISOString(),
            })
            .eq("id", targetUserId);

          safeLog("info", "[stripe/webhook] Subscription updated", {
            metadata: {
              userId: targetUserId,
              subscriptionId: subData.id,
              status,
              priceId,
            },
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: profile } = await supabase
          .from("users")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (profile) {
          await supabase
            .from("users")
            .update({
              subscription_status: "canceled",
              stripe_subscription_id: null,
              stripe_price_id: null,
              stripe_current_period_end: null,
              cancel_at_period_end: false,
              updated_at: new Date().toISOString(),
            })
            .eq("id", profile.id);

          safeLog("info", "[stripe/webhook] Subscription canceled", {
            metadata: { userId: profile.id, subscriptionId: subscription.id },
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const { data: profile } = await supabase
          .from("users")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (profile) {
          await supabase
            .from("users")
            .update({
              subscription_status: "past_due",
              updated_at: new Date().toISOString(),
            })
            .eq("id", profile.id);

          safeLog("warn", "[stripe/webhook] Payment failed", {
            metadata: { userId: profile.id, invoiceId: invoice.id },
          });
        }
        break;
      }

      default:
        safeLog("info", "[stripe/webhook] Unhandled event type", {
          metadata: { type: event.type },
        });
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    safeLog("error", "[stripe/webhook] Handler error", {
      metadata: { error: String(error), type: event.type },
    });
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
