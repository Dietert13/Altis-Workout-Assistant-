# Project Design Conventions

## UI Design Pattern: Button Hole Masking
When implementing "button holes" (where buttons appear as cutouts in a blurred container background):
1. Do NOT apply the mask or blur directly to the main container.
2. Use a layered structure inside the container:
   - **Background Layer:** Absolute-positioned, contains `glass_fill` (blur) and the `maskImage` (button holes).
   - **Content Layer:** Relative-positioned, contains the actual buttons and their content (text/icons).
3. This ensures the mask only affects the blurred background, not the content inside the buttons.
