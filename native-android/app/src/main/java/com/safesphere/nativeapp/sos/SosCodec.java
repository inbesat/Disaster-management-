package com.safesphere.nativeapp.sos;

import java.util.Calendar;
import java.util.Date;
import java.util.TimeZone;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Phase 2 — Compact SOS codec, native mirror of lib/sos/codec.ts.
 *
 * <p>Grammar (NMEA-style, typable, ~32 chars):
 * <pre>
 *   SOS1,&lt;lat&gt;,&lt;lng&gt;,&lt;need&gt;[P],&lt;HHMM&gt;*&lt;CCCC&gt;
 *   SOS1,NOLOC,NOLOC,&lt;need&gt;[P],&lt;HHMM&gt;*&lt;CCCC&gt;   (no GPS fix)
 * </pre>
 * need: R rescue · M medical · F food/shelter · H hazard · L location share.
 * CCCC is CRC-16/CCITT-FALSE over everything before {@code *}, uppercase hex.
 * Test vector: crc16Ccitt("123456789") == 0x29B1 (shared with the TS tests).
 *
 * <p>Pure java.util — no Android dependencies — so it runs in JVM unit tests
 * and on-device identically.
 */
public final class SosCodec {

    private SosCodec() {
    }

    public static final class SosCodecException extends Exception {
        public SosCodecException(String message) {
            super(message);
        }
    }

    /** Decoded payload. lat/lng are null when the code carries NOLOC. */
    public static final class Decoded {
        public final Double lat;
        public final Double lng;
        public final boolean locationEstimated;
        public final char need;
        public final boolean isPwd;
        public final String hhmm;
        public final Date atUtc;
        public final String raw;

        Decoded(Double lat, Double lng, boolean locationEstimated, char need,
                boolean isPwd, String hhmm, Date atUtc, String raw) {
            this.lat = lat;
            this.lng = lng;
            this.locationEstimated = locationEstimated;
            this.need = need;
            this.isPwd = isPwd;
            this.hhmm = hhmm;
            this.atUtc = atUtc;
            this.raw = raw;
        }
    }

    private static final Pattern CODEC_RE = Pattern.compile(
            "^SOS1,(-?\\d{1,2}\\.\\d{4}|NOLOC),(-?\\d{1,3}\\.\\d{4}|NOLOC),([RMFHL])(P?),([01]\\d|2[0-3])([0-5]\\d)\\*([0-9A-F]{4})$");

    /** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF). */
    public static int crc16Ccitt(String input) {
        int crc = 0xFFFF;
        for (int i = 0; i < input.length(); i++) {
            crc ^= (input.charAt(i) & 0xFF) << 8;
            for (int b = 0; b < 8; b++) {
                crc = (crc & 0x8000) != 0 ? ((crc << 1) ^ 0x1021) : (crc << 1);
                crc &= 0xFFFF;
            }
        }
        return crc;
    }

    /**
     * Encodes an SOS. Pass null lat/lng for NOLOC (no GPS fix).
     *
     * @throws SosCodecException on unknown need or out-of-range coordinates.
     */
    public static String encode(Double lat, Double lng, char need, boolean isPwd, Date at)
            throws SosCodecException {
        if ("RMFHL".indexOf(need) < 0) throw new SosCodecException("Unknown need code: " + need);
        String loc;
        if (lat == null || lng == null) {
            loc = "NOLOC,NOLOC";
        } else {
            if (!Double.isFinite(lat) || !Double.isFinite(lng)
                    || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
                throw new SosCodecException("Coordinates out of range.");
            }
            loc = String.format(java.util.Locale.US, "%.4f,%.4f", lat, lng);
        }
        Calendar utc = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        utc.setTime(at != null ? at : new Date());
        String hhmm = String.format(java.util.Locale.US, "%02d%02d",
                utc.get(Calendar.HOUR_OF_DAY), utc.get(Calendar.MINUTE));
        String body = "SOS1," + loc + "," + need + (isPwd ? "P" : "") + "," + hhmm;
        String checksum = String.format(java.util.Locale.US, "%04X", crc16Ccitt(body));
        return body + "*" + checksum;
    }

    /** Decodes and checksum-validates a code (case- and whitespace-tolerant). */
    public static Decoded decode(String input) throws SosCodecException {
        if (input == null) throw new SosCodecException("Not a valid SOS code.");
        String raw = input.trim().toUpperCase(java.util.Locale.US);
        Matcher m = CODEC_RE.matcher(raw);
        if (!m.matches()) {
            throw new SosCodecException("Not a valid SOS code. Format: SOS1,lat,lng,need,HHMM*checksum.");
        }
        String latS = m.group(1);
        String lngS = m.group(2);
        char need = m.group(3).charAt(0);
        boolean isPwd = "P".equals(m.group(4));
        String hhmm = m.group(5) + m.group(6);
        String checksumS = m.group(7);

        String body = raw.substring(0, raw.lastIndexOf('*'));
        String expected = String.format(java.util.Locale.US, "%04X", crc16Ccitt(body));
        if (!expected.equals(checksumS)) {
            throw new SosCodecException("Checksum mismatch — the code was mistyped. Please re-enter it exactly.");
        }
        boolean latNoLoc = "NOLOC".equals(latS);
        boolean lngNoLoc = "NOLOC".equals(lngS);
        if (latNoLoc != lngNoLoc) {
            throw new SosCodecException("NOLOC must replace both coordinates, not one.");
        }
        Double lat = latNoLoc ? null : Double.parseDouble(latS);
        Double lng = lngNoLoc ? null : Double.parseDouble(lngS);
        if (!latNoLoc && (Math.abs(lat) > 90 || Math.abs(lng) > 180)) {
            throw new SosCodecException("Coordinates out of range.");
        }
        return new Decoded(lat, lng, latNoLoc, need, isPwd, hhmm, resolveTime(hhmm, new Date()), raw);
    }

    /** Most recent past UTC occurrence of a HHMM wall-time. */
    static Date resolveTime(String hhmm, Date now) {
        Calendar c = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        c.setTime(now);
        c.set(Calendar.HOUR_OF_DAY, Integer.parseInt(hhmm.substring(0, 2)));
        c.set(Calendar.MINUTE, Integer.parseInt(hhmm.substring(2, 4)));
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        if (c.getTime().after(now)) c.add(Calendar.DATE, -1);
        return c.getTime();
    }
}
