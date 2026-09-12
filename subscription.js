import crypto from "node:crypto";

export function signToken(payload, secret) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyToken(token, secret) {
  const [encoded, sig] = String(token || "").split(".");
  if (!encoded || !sig) return null;
  const expected = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try { return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")); }
  catch { return null; }
}

export function makeSubscriptionToken(userId, secret) {
  return signToken({ uid: userId, v: 1 }, secret);
}

export function base64Subscription(lines) {
  return Buffer.from(lines.filter(Boolean).join("\n"), "utf8").toString("base64");
}