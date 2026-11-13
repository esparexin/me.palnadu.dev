/**
 * Clearance for the floating navigation trigger.
 *
 * Below `lg` the trigger is fixed to the right edge and vertically centred, so
 * it sits over whatever the middle of the viewport happens to contain. Text
 * that would land under it reserves the trigger's footprint instead of being
 * covered (UI_UX_STANDARDS 9: "no content hidden behind the floating menu").
 *
 * The clearance is 4rem: the trigger is 48px wide and sits 16px from the right
 * edge, so 64px of reserved space keeps the last glyph of a line clear of it.
 *
 * It is applied as right padding on the text block rather than on the page
 * container. Padding keeps the block's own left edge where it was, so a
 * left-aligned block does not move, and a block that is centred in its parent
 * is centred in the reserved space as well. A margin or a transform would
 * shift one or the other.
 *
 * At `lg` and above the trigger does not exist, so the reservation ends there.
 */
export const TRIGGER_CLEARANCE = 'pr-16 lg:pr-0';
