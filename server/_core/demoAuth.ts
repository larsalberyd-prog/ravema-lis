import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

const DEMO_OPEN_ID = "demo-admin";
const DEMO_NAME = "Demo Admin (Ravema)";
const DEMO_EMAIL = "demo-admin@ravema.local";

export function registerDemoAuthRoutes(app: Express) {
  if (!ENV.demoMode) {
    console.log("[DemoAuth] DEMO_MODE=false — skipping demo-login route");
    return;
  }

  // Note: under pilot är Caddy basic auth den primära gate:n (Klas/Nejra).
  // Demo-route har därför ingen separat key — DEMO_LOGIN_KEY behålls i env
  // för bakåtkompatibilitet men kontrolleras ej.
  if (ENV.demoLoginKey) {
    console.log("[DemoAuth] /api/oauth/demo-login enabled (key check disabled — gated by Caddy basic auth)");
  } else {
    console.log("[DemoAuth] /api/oauth/demo-login enabled (no key set, no key check)");
  }

  app.get("/api/oauth/demo-login", async (req: Request, res: Response) => {
    try {
      await db.upsertUser({
        openId: DEMO_OPEN_ID,
        name: DEMO_NAME,
        email: DEMO_EMAIL,
        loginMethod: "demo",
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(DEMO_OPEN_ID, {
        name: DEMO_NAME,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      const redirectTo =
        typeof req.query.redirect === "string" && req.query.redirect.startsWith("/")
          ? req.query.redirect
          : "/";
      res.redirect(302, redirectTo);
    } catch (error) {
      console.error("[DemoAuth] demo-login failed", error);
      res.status(500).send("Demo login failed");
    }
  });
}
