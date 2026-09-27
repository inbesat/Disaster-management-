"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { safeLog } from "@/lib/logger";
import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

let stripe: Stripe | null = null;

function getStripe() {
  if (!stripe && STRIPE_SECRET_KEY) {
    stripe = new Stripe(STRIPE_SECRET_KEY, {});
  }
  return stripe;
}

function requireStripe() {
  const instance = getStripe();
  if (!instance) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return instance;
}

/**
 * Create or retrieve a Stripe customer for the current user.
 */
async function getOrCreateCustomer(userId: string, email: string, name?: string | null) {
  const supabase = createClient();

  // Check if user already has a Stripe customer ID
  const { data: profile } = await supabase
    .from("users")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id;
  }

  // Create new Stripe customer
  const customer = await requireStripe().customers.create({
    email,
    name: name ?? undefined,
    metadata: { supabase_user_id: userId },
  });

  // Save customer ID to user profile
  await supabase
    .from("users")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);

  return customer.id;
}

/**
 * Create a Checkout Session for subscription purchase.
 * Redirects user to Stripe-hosted payment page.
 */
export async function createCheckoutSession(priceId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/settings/billing");
  }

  const customerId = await getOrCreateCustomer(
    user.id,
    user.email!,
    user.user_metadata?.full_name,
  );

  try {
    const session = await requireStripe().checkout.sessions.create({
      customer: customerId,
      client_reference_id: user.id,
      metadata: { supabase_user_id: user.id },
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_URL}/settings/billing?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${APP_URL}/settings/billing?canceled=true`,
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
      allow_promotion_codes: true,
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
    });

    return { url: session.url };
  } catch (error: unknown) {
    safeLog("error", "[billing] createCheckoutSession failed", {
      metadata: { error: String(error), userId: user.id },
    });
    throw new Error("Failed to create checkout session. Please try again.");
  }
}

/**
 * Create a Customer Portal session for subscription management.
 * Allows users to upgrade/downgrade/cancel plans, update payment method, view invoices.
 */
export async function createCustomerPortalSession() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/settings/billing");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    throw new Error("No billing account found. Please subscribe first.");
  }

  try {
    const session = await requireStripe().billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${APP_URL}/settings/billing`,
    });

    return { url: session.url };
  } catch (error: unknown) {
    safeLog("error", "[billing] createCustomerPortalSession failed", {
      metadata: { error: String(error), userId: user.id },
    });
    throw new Error("Failed to open billing portal. Please try again.");
  }
}

/**
 * Get current user's subscription status for UI display.
 */
export async function getSubscriptionStatus() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select(
      "subscription_status, stripe_price_id, stripe_current_period_end, cancel_at_period_end, stripe_customer_id",
    )
    .eq("id", user.id)
    .single();

  return profile;
}
