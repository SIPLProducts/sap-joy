Center the Quality Info form in the middle of the screen.

Change `src/pages/QualityInfo.tsx` so the form card is centered both horizontally and vertically within the available viewport area, while keeping the page header/title visible. Approach:
1. Replace the outer `space-y-4` container with a flex column that fills the full height and centers content (`min-h-full flex flex-col items-center justify-center`).
2. Keep the title and badge grouped above the card, also centered.
3. Ensure the card remains responsive (`max-w-3xl`, `w-full`) so it does not stretch on wide screens.
4. Verify the form still works the same (inputs, submit button, confirmation dialog, and toast behavior).