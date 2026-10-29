const GOOGLE_KEYS_URL =
  "https://www.gstatic.com/admob/reward/verifier-keys.json";

type GoogleKey = {
  keyId: number;
  pem: string;
  base64: string;
};

function decodeBase64(value: string): Uint8Array {
  const normalized = value
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);

  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function derToP1363(der: Uint8Array): Uint8Array {
  let offset = 0;

  const readLength = (): number => {
    const first = der[offset++];
    if (first === undefined) throw new Error("Invalid DER length");

    if (first < 128) return first;

    const count = first & 0x7f;
    if (count === 0 || count > 2) throw new Error("Invalid DER length");

    let length = 0;
    for (let i = 0; i < count; i++) {
      const byte = der[offset++];
      if (byte === undefined) throw new Error("Invalid DER length");
      length = length * 256 + byte;
    }
    return length;
  };

  if (der[offset++] !== 0x30) throw new Error("Invalid ECDSA sequence");
  const sequenceLength = readLength();
  if (offset + sequenceLength !== der.length) {
    throw new Error("Invalid ECDSA sequence length");
  }

  const readInteger = (): Uint8Array => {
    if (der[offset++] !== 0x02) throw new Error("Invalid ECDSA integer");

    const length = readLength();
    if (length < 1 || offset + length > der.length) {
      throw new Error("Invalid ECDSA integer length");
    }

    let value = der.slice(offset, offset + length);
    offset += length;

    while (value.length > 32 && value[0] === 0) {
      value = value.slice(1);
    }

    if (value.length > 32 || (value[0] & 0x80) !== 0) {
      throw new Error("Invalid ECDSA integer");
    }

    const result = new Uint8Array(32);
    result.set(value, 32 - value.length);
    return result;
  };

  const r = readInteger();
  const s = readInteger();

  if (offset !== der.length) throw new Error("Unexpected DER data");

  const raw = new Uint8Array(64);
  raw.set(r, 0);
  raw.set(s, 32);
  return raw;
}

export async function verifyAdmobSignature(
  rawUrl: string,
): Promise<boolean> {
  try {
    const url = new URL(rawUrl);
    const rawQuery = url.search.slice(1);

    // Google signs the original query string before signature and key_id.
    const marker = "&signature=";
    const signatureIndex = rawQuery.lastIndexOf(marker);
    if (signatureIndex < 0) return false;

    const signedContent = rawQuery.slice(0, signatureIndex);
    const signatureSection = rawQuery.slice(signatureIndex + marker.length);
    const keyMarker = "&key_id=";
    const keyIndex = signatureSection.indexOf(keyMarker);

    if (keyIndex < 0 || signatureSection.indexOf("&", keyIndex + 1) !== -1) {
      return false;
    }

    const signatureText = signatureSection.slice(0, keyIndex);
    const keyIdText = signatureSection.slice(keyIndex + keyMarker.length);

    if (!signatureText || !/^\d+$/.test(keyIdText)) return false;

    const keyId = Number(keyIdText);
    if (!Number.isSafeInteger(keyId)) return false;

    const response = await fetch(GOOGLE_KEYS_URL, {
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return false;

    const keyData = (await response.json()) as { keys?: GoogleKey[] };
    const key = keyData.keys?.find((item) => item.keyId === keyId);

    if (!key?.base64) return false;

    const publicKey = await crypto.subtle.importKey(
      "spki",
      decodeBase64(key.base64),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );

    const derSignature = decodeBase64(decodeURIComponent(signatureText));
    const rawSignature = derToP1363(derSignature);

    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      rawSignature,
      new TextEncoder().encode(signedContent),
    );
  } catch (error) {
    console.error("[AdMob] Signature verification failed:", error);
    return false;
  }
}

