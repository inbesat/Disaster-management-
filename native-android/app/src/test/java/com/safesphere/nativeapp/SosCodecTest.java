package com.safesphere.nativeapp.sos;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import org.junit.Test;

import java.util.Date;

/**
 * Phase 2 — JVM unit tests for SosCodec (mirrors lib/sos/codec.test.ts).
 * Pure java.util: runs without an Android device or emulator.
 */
public class SosCodecTest {

    @Test
    public void crc_matchesCcittFalseVector() {
        assertEquals(0x29B1, SosCodec.crc16Ccitt("123456789"));
    }

    @Test
    public void encode_shapeIsCompact() throws Exception {
        String code = SosCodec.encode(25.5941, 85.1376, 'R', true, new Date(0));
        assertTrue(code.matches("^SOS1,25\\.5941,85\\.1376,RP,\\d{4}\\*[0-9A-F]{4}$"));
        assertTrue(code.length() <= 40);
    }

    @Test
    public void roundTrip_allNeeds() throws Exception {
        for (char need : new char[]{'R', 'M', 'F', 'H', 'L'}) {
            String code = SosCodec.encode(25.6, 85.13, need, false, new Date());
            SosCodec.Decoded d = SosCodec.decode(code);
            assertEquals(need, d.need);
            assertFalse(d.isPwd);
            assertFalse(d.locationEstimated);
            assertEquals(25.6, d.lat, 0.00005);
        }
    }

    @Test
    public void roundTrip_noloc() throws Exception {
        String code = SosCodec.encode(null, null, 'M', true, new Date());
        assertTrue(code.contains("NOLOC,NOLOC"));
        SosCodec.Decoded d = SosCodec.decode(code);
        assertNull(d.lat);
        assertNull(d.lng);
        assertTrue(d.locationEstimated);
        assertTrue(d.isPwd);
    }

    @Test
    public void decode_rejectsTamperedChecksum() throws Exception {
        String code = SosCodec.encode(25.5941, 85.1376, 'R', false, new Date());
        char last = code.charAt(code.length() - 1);
        String bad = code.substring(0, code.length() - 1) + (last == '0' ? '1' : '0');
        try {
            SosCodec.decode(bad);
            fail("expected SosCodecException");
        } catch (SosCodec.SosCodecException e) {
            assertTrue(e.getMessage().contains("Checksum"));
        }
    }

    @Test
    public void encode_rejectsOutOfRange() {
        try {
            SosCodec.encode(91.0, 0.0, 'R', false, new Date());
            fail("expected SosCodecException");
        } catch (SosCodec.SosCodecException expected) {
        }
    }
}
