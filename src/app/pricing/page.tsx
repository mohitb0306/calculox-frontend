import { Metadata } from "next";
import { notFound } from "next/navigation";
import PricingClient from "./client";
import { getSiteSettings } from "@/lib/content";
import { constructMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();

  // SYSTEM OVERRIDE: Pricing is currently disabled.
  // Forces the page to output strict 404/noindex metadata to block search engines.
  // When ready to launch, change type to "page" and update the title/description.
  return constructMetadata({
    data: { title: "Page Not Found" },
    settings,
    type: "404",
    path: "/pricing"
  });
}

export default function PricingPage() {
  // SYSTEM OVERRIDE: This instantly blocks users and shows the 404 page.
  // To reactivate the Pricing page in the future, simply delete the line below.
  notFound();
  
  // The code below becomes unreachable for now, keeping it safely hidden.
  return <PricingClient />;
}