// Formats critical alerts into lightweight SMS payloads for use when data
// connectivity drops. Produces both an `sms:` URI (works offline on a phone
// with signal but no data) and a plain-text body for a backend SMS gateway
// such as Twilio to send server-side.

const CHAR_LIMIT = 160; // single-segment GSM SMS limit

export function formatEmergencySms({ contact, trip, reason }) {
  const real = trip.positionSource === "browser"; // simulated route progress is never reported as a location
  const lastKnown = real && trip.currentPosition ? `${trip.currentPosition[0].toFixed(4)},${trip.currentPosition[1].toFixed(4)}` : "unknown";
  const mapsLink = real && trip.currentPosition
    ? `https://maps.google.com/?q=${trip.currentPosition[0]},${trip.currentPosition[1]}`
    : "";

  let body = `RAKSHA ALERT: ${reason}. Destination: ${trip.destination}. Last location: ${lastKnown}. ${mapsLink}`.trim();

  if (body.length > CHAR_LIMIT) {
    // Trim the map link first since the coordinates already convey location.
    body = `RAKSHA ALERT: ${reason}. Dest: ${trip.destination}. Loc: ${lastKnown}`;
  }
  if (body.length > CHAR_LIMIT) {
    body = body.slice(0, CHAR_LIMIT - 1) + "…";
  }

  const smsUri = `sms:${encodeURIComponent(contact.phone)}?body=${encodeURIComponent(body)}`;

  return {
    contactId: contact.id,
    contactName: contact.name,
    phone: contact.phone,
    body,
    charCount: body.length,
    segments: Math.ceil(body.length / CHAR_LIMIT),
    smsUri,
    deliveryMode: "manual_sms_link", // opens the phone's Messages app; delivery is NOT tracked
  };
}

export function simulateConnectivityCheck(signalStrength) {
  // signalStrength: 0-100. Below 30 triggers SMS fallback in the UI.
  const threshold = 30;
  return {
    online: signalStrength >= threshold,
    fallbackTriggered: signalStrength < threshold,
    signalStrength,
    threshold,
  };
}
