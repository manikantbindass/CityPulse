package io.citypulse.pulseai;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Pure reported-quantity arithmetic, never substitutes zero for missing data. */
final class EvidenceAnalytics {

    static String compare(BigDecimal demand, BigDecimal supply) {
        if (
            demand == null || supply == null
        ) return "Missing side is unknown; no shortage or surplus can be inferred.";
        BigDecimal gap = demand.subtract(supply);
        String ratio =
            supply.signum() == 0
                ? "undefined (zero reported supply)"
                : demand.divide(supply, 4, RoundingMode.HALF_UP).toPlainString();
        return (
            "Observed gap (demand minus supply): " +
            gap +
            "; demand-to-supply ratio: " +
            ratio +
            ". " +
            (gap.signum() > 0
                ? "Positive reported gap: a candidate for shortage/expansion investigation within this interval, not evidence of profitable demand. Allocation requires capacity, travel, cost and fairness constraints; these are not established here."
                : gap.signum() < 0
                  ? "Reported surplus: redistribution would require checking transport, shelf-life and recipient capacity."
                  : "Reported quantities balance for this interval; unmet demand outside coverage remains unknown.")
        );
    }
}
