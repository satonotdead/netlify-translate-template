
import { createHmac } from "node:crypto";

interface NetlifyEvent {
  headers: Record<string, string>;
  body: string;
}

export default async function verifyGhostSignature(
  event: NetlifyEvent,
) {
  try {
    const signature = event.headers["x-ghost-signature"];

    if (!signature) throw new Error("Missing signature");

    const signatureParts = signature.split(", ");
    const sha256Part = signatureParts.find((part) =>
      part.startsWith("sha256="),
    );
    const timestampPart = signatureParts.find((part) => part.startsWith("t="));

    if (!sha256Part || !timestampPart)
      throw new Error("Missing signature or timestamp");

    const receivedHash = sha256Part.split("=")[1];
    const timestamp = timestampPart.split("=")[1];

    const requestPayload = event.body + timestamp;

    const computedHash = createHmac(
      "sha256",
      process.env.GHOST_WEBHOOK_SECRET as string,
    )
    .update(requestPayload)
    .digest("hex");

    if (computedHash !== receivedHash)
      throw new Error("Signature verification failed");

    return true;
  } catch (error) {
    throw new Error(`Signature verification failed: ${error}`);
  }
}