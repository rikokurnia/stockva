# Portfolio map view

Portfolio is an additional button after Select in the existing left menu. It is separate from the City finances panel. It shows a temporary grid, faint building shadows, footprint outlines, and automatically visible company labels. Each label shows the asset name, unrealized return relative to entry price, and level 1–3 using the existing tier thresholds (negative artwork is displayed as Level 1). Civic buildings become shadows but do not receive fabricated stock returns.

Select, Escape, or choosing a construction tool exits the view. The grid preference is preserved. Labels and shadows do not capture pointer events, so existing pan and zoom interactions continue to work. The view does not modify saved buildings, holdings, funds, market simulation, or transactions. Labels are positioned deterministically to avoid overlap among neighboring holdings; holdings outside the viewport can be reached by panning.

Validation: existing 14 city/vehicle tests, 4 dedicated Portfolio tests, TypeScript check, and production build. Browser verification covers a four-company test city, gains/losses, three level indicators, empty state, mobile, unchanged left menu, grid restoration both on and off, and construction-mode switching. Test city was restored after verification.

Run the dedicated checks with `node --experimental-strip-types tests/portfolio-view.test.mjs`.

Screenshots: `verification/portfolio-desktop.png` and `verification/portfolio-mobile.png`.
