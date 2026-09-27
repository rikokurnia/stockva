# Illustrated construction controls

Generated with the built-in image-generation tool. Asset: `public/assets/ui/construction-atlas.png` (transparent PNG). Used directly as a 3-column, 2-row CSS sprite atlas; no external image service at runtime.

Prompt: Create a production game UI sprite atlas, one square PNG with actual transparent alpha background. Exactly 3 columns by 2 rows equal square cells, each illustration centered with transparent padding. No text or grid lines. Richly painted miniature objects for a tropical isometric city builder: top row parchment blueprint with compass and pencil, asphalt road with narrow curb and cone, blue glass office tower; bottom row ivory city hall with blue roof, yellow bulldozer, leather ledger with gold coins. Warm sunshine, natural colors, substantial material detail, no flat line icons, no surrounding badges or panels, transparent edges.

The road surface and moving vehicles use native SVG geometry. Ground-plane vehicle heading is projected into the same isometric coordinate system as the road. Roads use one layered opaque path so curbs do not overlap at tile boundaries. Cars use offset lanes and sampled turns, with semicircular U-turns at dead ends.

Camera zoom is bounded to 1–2× relative to viewport-cover scale. Pan bounds are derived from the transformed 1280×720 video and recomputed on resize and zoom. Every viewport edge stays within the video.
