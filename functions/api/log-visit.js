function getCookieValue(cookieHeader, name) {
  const cookies = String(cookieHeader || "")
    .split(";")
    .map((v) => v.trim());

  const prefix = name + "=";
  const match = cookies.find((v) => v.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
}

function decodeJwtPayload(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padding = (4 - (base64.length % 4 || 4)) % 4;
    const padded = base64 + "=".repeat(padding);

    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export const onRequestPost = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const visitorIp = request.headers.get("CF-Connecting-IP") || "";

    if (!env.LOG_ENDPOINT) {
      return new Response(
        JSON.stringify({ ok: false, error: "LOG_ENDPOINT missing" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const cookieHeader = request.headers.get("Cookie") || "";
    const accessJwt = getCookieValue(cookieHeader, "CF_Authorization");
    const jwtPayload = decodeJwtPayload(accessJwt);

    const accessEmail = jwtPayload?.email || "";
    const accessName = jwtPayload?.name || "";

    const payload = {
      //environment: body.environment || "",
      //site: body.site || "",
      //url: body.url || "",
      //path: body.path || "",
      //referrer: body.referrer || request.headers.get("Referer") || ""
      //name: accessName,
      ip: visitorIp,
      email: accessEmail,
      userAgent: body.userAgent || request.headers.get("User-Agent") || ""
    };

    const res = await fetch(env.LOG_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    const text = await res.text();

    return new Response(
      JSON.stringify({
        ok: res.ok,
        gasStatus: res.status,
        gasResponse: text,
        debug: {
          accessEmail,
          accessName
        }
      }),
      {
        status: res.ok ? 200 : 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: String(err),
        stack: err?.stack || null
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};