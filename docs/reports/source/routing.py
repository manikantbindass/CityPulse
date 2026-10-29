"""Orthogonal diagram routes that never imply connections through intervening nodes."""


def route_edge(start, end, positions, gap):
    x, y, w, h = positions[start]
    xx, yy, ww, hh = positions[end]
    if abs(y-yy) < .001:
        if abs(x-xx) < 1.6 * max(w, ww):
            return [(x+w, y+h/2), (xx, yy+hh/2)] if xx > x else [(x, y+h/2), (xx+ww, yy+hh/2)]
        # A skipped column must remain visibly disconnected from its middle node.
        a, b = (x+w/2, y), (xx+ww/2, yy)
        return [a, (a[0], y-gap), (b[0], y-gap), b]
    downward = yy > y
    a = (x+w/2, y+h if downward else y)
    b = (xx+ww/2, yy if downward else yy+hh)
    if abs(y-yy) <= max(h, hh) + 3*gap:
        middle = (a[1]+b[1])/2
        return [a, (a[0], middle), (b[0], middle), b]
    outer = min(box[0] for box in positions.values()) - gap
    leave = a[1] + (gap if downward else -gap)
    enter = b[1] + (-gap if downward else gap)
    return [a, (a[0], leave), (outer, leave), (outer, enter), (b[0], enter), b]
