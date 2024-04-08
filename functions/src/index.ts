export interface SiteverifyResponse {
  success: boolean;
  "error-codes": string[];
  challenge_ts?: Date;
  hostname?: string;
  action?: string;
  cdata?: string;
}

import { onRequest } from "firebase-functions/v2/https";
import { appCheck } from "firebase-admin";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import axios from "axios";
import { AppCheckToken } from "firebase-admin/app-check";

initializeApp({
  credential: applicationDefault(),
});

const appId = process.env.APPID || "";
const SECRET_KEY = process.env.SECRETKEY;
const ttlMinutes = process.env.TTL_MINUTES || 30;

const verifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

exports.tokenExchange = onRequest(
  {
    cors: true,
  },
  async (request, response) => {
    const { turnstileToken } = request.body;
    // For use in the future when the admin sdk supports
    // limited use token minting.
    // const limitedUse = request.body.limitedUse;
    const result = await axios.post(
      verifyUrl,
      {
        secret: SECRET_KEY,
        response: turnstileToken,
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const outcome = (await result.data) as SiteverifyResponse;
    if (outcome.success) {
      const appCheckToken: AppCheckToken = await appCheck().createToken(
        appId,
        /* 30 minutes until expiration */
        { ttlMillis: 60000 * (ttlMinutes as number) }
      );
      response.status(200).send({
        token: appCheckToken.token,
        expireTimeMillis: appCheckToken.ttlMillis + Date.now(),
      });
      return;
    } else {
      response.status(400).send({ token: "", expireTimeMillis: 0 });
      return;
    }
  }
);
