import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getServerConfig } from "../config.server";

const searchSchema = z.object({
  query: z.string().min(2),
  location: z.string().min(2),
  maxResults: z.number().int().min(1).max(20).default(10),
});

export type GoogleMapsLead = {
  placeId: string;
  name: string;
  address: string | null;
  website: string | null;
  phone: string | null;
  rating: number | null;
  userRatingCount: number | null;
  googleMapsUri: string | null;
  primaryType: string | null;
  types: string[];
};

export const searchGoogleMapsLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(searchSchema)
  .handler(async ({ data }) => {
    const apiKey = getServerConfig().googleMapsApiKey;
    const lovableKey = process.env.LOVABLE_API_KEY;
    if (!apiKey || !lovableKey) {
      throw new Error("Faltan credenciales del conector Google Maps (LOVABLE_API_KEY / GOOGLE_MAPS_API_KEY).");
    }

    const textQuery = `${data.query} en ${data.location}`;
    // Route through the Lovable connector gateway — the raw key is referrer-restricted
    // and rejects direct server-side calls with API_KEY_HTTP_REFERRER_BLOCKED.
    const response = await fetch("https://connector-gateway.lovable.dev/google_maps/places/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.googleMapsUri,places.primaryType,places.types",
      },
      body: JSON.stringify({
        textQuery,
        languageCode: "es",
        regionCode: "ES",
        pageSize: data.maxResults,
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Google Maps rechazo la busqueda (${response.status}): ${message}`);
    }


    const payload = (await response.json()) as { places?: Array<any> };
    return (payload.places ?? []).map((place): GoogleMapsLead => ({
      placeId: place.id,
      name: place.displayName?.text ?? "Sin nombre",
      address: place.formattedAddress ?? null,
      website: place.websiteUri ?? null,
      phone: place.nationalPhoneNumber ?? null,
      rating: typeof place.rating === "number" ? place.rating : null,
      userRatingCount: typeof place.userRatingCount === "number" ? place.userRatingCount : null,
      googleMapsUri: place.googleMapsUri ?? null,
      primaryType: place.primaryType ?? null,
      types: Array.isArray(place.types) ? place.types : [],
    }));
  });
