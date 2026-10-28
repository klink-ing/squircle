# Squircle

Corner shapes for Tailwind: superellipse corners that look as round as the `border-radius` the author wrote.

## Language

**Strength**:
How square a superellipse corner is. Higher strength gives a squarer corner at the same CSS radius. Where precision matters, call the value itself the **superellipse exponent**, as MDN does for the argument to `superellipse()`.
_Avoid_: Amount

**CSS radius**:
The radius value the author specifies, the distance from a corner's curve center to its edge.
_Avoid_: Specified radius

**Apparent radius**:
The radius of the circular corner that shares the shape's top and right edges and meets the superellipse at its 45° point. It is how round the corner looks, and it shrinks as strength rises.
_Avoid_: Perceived radius, visual radius

**Corrected radius**:
The CSS radius that makes a superellipse's apparent radius equal the circular corner the author intended.
_Avoid_: Compensated radius
