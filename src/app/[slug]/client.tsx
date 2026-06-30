"use client";

import React from "react";
import { PageContent } from "@/lib/content";
import { normalizePageContent } from "@/lib/utils";

// --- Import Templates ---
import AboutTemplate from "@/components/templates/AboutTemplate";
import ContactTemplate from "@/components/templates/ContactTemplate";
import FaqTemplate from "@/components/templates/FaqTemplate";
import PolicyTemplate from "@/components/templates/PolicyTemplate";
import StandardTemplate from "@/components/templates/StandardTemplate";

interface ClientDynamicPageProps {
  data: PageContent;
  settings: any;
}

const ClientDynamicPage = ({ data, settings }: ClientDynamicPageProps) => {
  // 1. Identify the Template Key
  const templateKey = data.page_key || data.slug;

  // 2. Centralized Security & Normalization via global utility
  const normalizedData = {
    ...data,
    content: normalizePageContent(data.content)
  };

  // 3. Dispatch the correct component
  switch (templateKey) {
    case "about":
      return <AboutTemplate data={normalizedData} settings={settings} />;
    case "contact":
    case "contact-us":
      return <ContactTemplate data={normalizedData} settings={settings} />;
    case "faq":
      return <FaqTemplate data={normalizedData} settings={settings} />;
    case "privacy-policy":
    case "terms-of-service":
    case "cookie-policy":
      return <PolicyTemplate data={normalizedData} settings={settings} />;
    default:
      return <StandardTemplate data={normalizedData} settings={settings} />;
  }
};

export default ClientDynamicPage;